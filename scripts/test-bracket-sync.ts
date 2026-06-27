#!/usr/bin/env tsx
/**
 * Test del fix: syncResults() debe resolver home_team_id/away_team_id de
 * las eliminatorias (vía syncFixtures) además de marcador/estado, en vez
 * de esperar a la sincronización de fixtures aparte (1-2 veces/día).
 *
 * Uso: npx tsx scripts/test-bracket-sync.ts
 *
 * Incluye:
 *  1. Chequeo estático del código (sin credenciales): confirma que
 *     syncResults() sigue delegando en syncFixtures()+refreshBracketResults()
 *     y no volvió a la versión vieja que sólo actualizaba marcador/estado.
 *  2. Si hay .env.local con credenciales: corre syncResults() de verdad
 *     contra Supabase + football-data.org y valida que no haya regresión
 *     (ningún cruce que ya estaba resuelto puede quedar sin equipos) y
 *     reporta cuántos cruces nuevos se resolvieron.
 *
 * Sin .env.local, el bloque 2 se reporta como SKIP (no hay forma de
 * probar contra datos reales sin credenciales).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv(path: string) {
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
      if (m && !(m[1] in process.env)) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {}
}
loadEnv(resolve(process.cwd(), ".env.local"));

type Status = "PASS" | "FAIL" | "WARN" | "SKIP" | "INFO";
const results: { name: string; status: Status; note?: string }[] = [];

function report(name: string, status: Status, note?: string) {
  const color = {
    PASS: "\x1b[32m",
    FAIL: "\x1b[31m",
    WARN: "\x1b[33m",
    SKIP: "\x1b[33m",
    INFO: "\x1b[36m",
  }[status];
  console.log(`  ${color}${status}\x1b[0m ${name}${note ? ` — ${note}` : ""}`);
  results.push({ name, status, note });
}

function section(title: string) {
  console.log(`\n\x1b[1m▸ ${title}\x1b[0m`);
}

type MatchRow = {
  id: number;
  stage: string;
  home_team_id: number | null;
  away_team_id: number | null;
};

async function main() {
  // ──────────────────────────────────────────────────────────────────
  // 1. Chequeo estático: syncResults() debe delegar en syncFixtures()
  // ──────────────────────────────────────────────────────────────────
  section("Wiring estático de syncResults()");

  const src = readFileSync(
    resolve(process.cwd(), "src/lib/tournament/sync.ts"),
    "utf8",
  );
  const fnMatch = /export async function syncResults\(\)[^{]*\{([\s\S]*?)\n\}/.exec(
    src,
  );
  if (!fnMatch) {
    report("ubicar syncResults() en sync.ts", "FAIL", "no se encontró la función");
  } else {
    const body = fnMatch[1];
    if (body.includes("syncFixtures()")) {
      report("syncResults() llama a syncFixtures()", "PASS");
    } else {
      report(
        "syncResults() llama a syncFixtures()",
        "FAIL",
        "no resuelve home_team_id/away_team_id de las eliminatorias",
      );
    }
    if (body.includes("refreshBracketResults()")) {
      report("syncResults() llama a refreshBracketResults()", "PASS");
    } else {
      report("syncResults() llama a refreshBracketResults()", "FAIL");
    }
    if (body.includes("provider.fetchMatches()")) {
      report(
        "syncResults() no actualiza marcador a mano",
        "FAIL",
        "volvió al patrón viejo (sólo status/score por external_id)",
      );
    } else {
      report("syncResults() no actualiza marcador a mano", "PASS");
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // 2. Integración real (requiere .env.local)
  // ──────────────────────────────────────────────────────────────────
  section("Integración: syncResults() contra Supabase + proveedor real");

  const hasCreds =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
    !!process.env.FOOTBALL_DATA_API_KEY &&
    !process.env.SUPABASE_SERVICE_ROLE_KEY.startsWith("your-");

  if (!hasCreds) {
    report(
      "credenciales disponibles",
      "SKIP",
      "no hay .env.local con SUPABASE_SERVICE_ROLE_KEY/FOOTBALL_DATA_API_KEY — correr este script con credenciales reales (local o en CI con secrets) para validar contra producción",
    );
  } else {
    const { createSupabaseAdminClient } = await import(
      "../src/lib/supabase/admin"
    );
    const { syncResults } = await import("../src/lib/tournament/sync");
    const sb = createSupabaseAdminClient();

    const before = await sb
      .from("matches")
      .select("id, stage, home_team_id, away_team_id")
      .neq("stage", "group");
    if (before.error) {
      report("snapshot pre-sync", "FAIL", before.error.message);
    } else {
      report("snapshot pre-sync", "PASS", `${before.data.length} partidos de eliminatoria`);

      const beforeById = new Map<number, MatchRow>(
        (before.data as MatchRow[]).map((m) => [m.id, m]),
      );
      const resolvedBefore = (before.data as MatchRow[]).filter(
        (m) => m.home_team_id && m.away_team_id,
      ).length;

      let syncError: Error | null = null;
      try {
        await syncResults();
      } catch (e) {
        syncError = e instanceof Error ? e : new Error(String(e));
      }
      if (syncError) {
        report("ejecutar syncResults()", "FAIL", syncError.message);
      } else {
        report("ejecutar syncResults()", "PASS");

        const after = await sb
          .from("matches")
          .select("id, stage, home_team_id, away_team_id")
          .neq("stage", "group");
        if (after.error) {
          report("snapshot post-sync", "FAIL", after.error.message);
        } else {
          report("snapshot post-sync", "PASS", `${after.data.length} partidos de eliminatoria`);

          const afterRows = after.data as MatchRow[];
          const resolvedAfter = afterRows.filter(
            (m) => m.home_team_id && m.away_team_id,
          ).length;

          // No regresión: ningún cruce que ya estaba resuelto puede perder equipos.
          const regressions = afterRows.filter((m) => {
            const prev = beforeById.get(m.id);
            if (!prev || !prev.home_team_id || !prev.away_team_id) return false;
            return !m.home_team_id || !m.away_team_id;
          });
          if (regressions.length === 0) {
            report("sin regresiones (cruces resueltos no se pierden)", "PASS");
          } else {
            report(
              "sin regresiones (cruces resueltos no se pierden)",
              "FAIL",
              `${regressions.length} partido(s): ${regressions.map((m) => m.id).join(", ")}`,
            );
          }

          // El conteo de resueltos nunca debería bajar.
          if (resolvedAfter >= resolvedBefore) {
            const delta = resolvedAfter - resolvedBefore;
            report(
              "cruces resueltos no decrece",
              "PASS",
              `${resolvedBefore} → ${resolvedAfter}${delta > 0 ? ` (+${delta} nuevos)` : ""}`,
            );
          } else {
            report(
              "cruces resueltos no decrece",
              "FAIL",
              `${resolvedBefore} → ${resolvedAfter}`,
            );
          }

          // Aviso informativo (no bloqueante): grupos terminados pero R32 sin equipos.
          const groupMatches = await sb
            .from("matches")
            .select("status")
            .eq("stage", "group");
          const allGroupsFinished =
            !groupMatches.error &&
            groupMatches.data.length > 0 &&
            groupMatches.data.every((m) => m.status === "finished");

          const r32Unresolved = afterRows.filter(
            (m) => m.stage === "round_of_32" && (!m.home_team_id || !m.away_team_id),
          ).length;

          if (allGroupsFinished && r32Unresolved > 0) {
            report(
              "32avos resueltos tras fin de grupos",
              "WARN",
              `${r32Unresolved} partido(s) de R32 aún sin equipos — puede ser lag del proveedor, no necesariamente un bug`,
            );
          } else if (allGroupsFinished) {
            report("32avos resueltos tras fin de grupos", "PASS");
          } else {
            report(
              "32avos resueltos tras fin de grupos",
              "INFO",
              "fase de grupos aún no termina — chequeo no aplica todavía",
            );
          }
        }
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // Resumen
  // ──────────────────────────────────────────────────────────────────
  const fails = results.filter((r) => r.status === "FAIL");
  const warns = results.filter((r) => r.status === "WARN");
  const pass = results.filter((r) => r.status === "PASS").length;
  const skip = results.filter((r) => r.status === "SKIP").length;

  console.log(
    `\n\x1b[1mResumen:\x1b[0m \x1b[32m${pass} PASS\x1b[0m · \x1b[31m${fails.length} FAIL\x1b[0m · \x1b[33m${warns.length} WARN\x1b[0m · \x1b[33m${skip} SKIP\x1b[0m`,
  );
  if (warns.length > 0) {
    console.log("\n\x1b[33m⚠ Avisos no bloqueantes:\x1b[0m");
    for (const w of warns) console.log(`  · ${w.name}${w.note ? ` — ${w.note}` : ""}`);
  }
  if (skip > 0) {
    console.log("\n\x1b[33mℹ Omitidos:\x1b[0m");
    for (const s of results.filter((r) => r.status === "SKIP"))
      console.log(`  · ${s.name}${s.note ? ` — ${s.note}` : ""}`);
  }
  if (fails.length > 0) {
    console.log("\n\x1b[31m✗ Test con fallos:\x1b[0m");
    for (const f of fails) console.log(`  · ${f.name}${f.note ? ` — ${f.note}` : ""}`);
    process.exit(1);
  }
  console.log("\n\x1b[32m✓ Test superado.\x1b[0m");
}

main().catch((e) => {
  console.error("\n\x1b[31mError inesperado:\x1b[0m", e);
  process.exit(2);
});
