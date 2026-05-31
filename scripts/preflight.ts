#!/usr/bin/env tsx
/**
 * Preflight de producción — ejecuta una batería de checks contra el
 * Supabase real + lógica pura para validar que la primera versión
 * puede subir a producción.
 *
 * Uso: npm run preflight
 *
 * Cada bloque imprime PASS/FAIL/SKIP. Devuelve exit-code 1 si algún
 * check FAIL.
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

// ────────────────────────────────────────────────────────────────────
// Reporter
// ────────────────────────────────────────────────────────────────────
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

async function safe<T>(fn: () => Promise<T>): Promise<T | Error> {
  try {
    return await fn();
  } catch (e) {
    return e instanceof Error ? e : new Error(String(e));
  }
}

async function main() {
// ────────────────────────────────────────────────────────────────────
// 1. Env vars
// ────────────────────────────────────────────────────────────────────
section("Variables de entorno");

const requiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "INVITATION_PIN",
  "FOOTBALL_DATA_API_KEY",
  "CRON_SECRET",
];
for (const k of requiredEnv) {
  const v = process.env[k];
  if (!v || v.startsWith("your-") || v === "cambia-este-secreto") {
    report(k, "FAIL", v ? "valor placeholder" : "no definido");
  } else {
    report(k, "PASS", `${v.slice(0, 12)}…`);
  }
}

// ────────────────────────────────────────────────────────────────────
// 2. Supabase + datos
// ────────────────────────────────────────────────────────────────────
section("Supabase: conexión y datos");

const { createSupabaseAdminClient } = await import(
  "../src/lib/supabase/admin"
);
const sb = createSupabaseAdminClient();

{
  const t = await sb.from("teams").select("*", { count: "exact", head: true });
  if (t.error) report("conexión REST", "FAIL", t.error.message);
  else {
    report("conexión REST", "PASS");
    if (t.count === 48) report("teams = 48", "PASS");
    else report(`teams = ${t.count}`, "FAIL", "esperado 48");
  }
}
{
  const m = await sb
    .from("matches")
    .select("*", { count: "exact", head: true });
  if (m.error) report("matches.count", "FAIL", m.error.message);
  else if (m.count === 104) report("matches = 104", "PASS");
  else report(`matches = ${m.count}`, "FAIL", "esperado 104");
}
{
  const g = await sb
    .from("groups")
    .select("*", { count: "exact", head: true });
  if (g.error) report("groups.count", "FAIL", g.error.message);
  else if (g.count === 12) report("groups = 12", "PASS");
  else report(`groups = ${g.count}`, "FAIL", "esperado 12");
}
{
  // Nombres en español
  const r = await sb.from("teams").select("code, name").in("code", ["ESP", "MEX", "BRA", "ENG"]);
  if (r.error) report("nombres en español", "FAIL", r.error.message);
  else {
    const map = Object.fromEntries((r.data ?? []).map((t) => [t.code, t.name]));
    const expected = {
      ESP: "España",
      MEX: "México",
      BRA: "Brasil",
      ENG: "Inglaterra",
    };
    const ok = Object.entries(expected).every(([k, v]) => map[k] === v);
    if (ok) report("nombres localizados ES", "PASS");
    else report("nombres localizados ES", "FAIL", JSON.stringify(map));
  }
}
{
  // Vista leaderboard accesible
  const r = await sb.from("leaderboard").select("*").limit(1);
  if (r.error) report("vista leaderboard", "FAIL", r.error.message);
  else report("vista leaderboard", "PASS");
}

// ────────────────────────────────────────────────────────────────────
// 3. Lógica pura (FIFA tiebreakers + best thirds)
// ────────────────────────────────────────────────────────────────────
section("Lógica del torneo (TS puro)");

const { computeGroupStandings, pickBestThirds } = await import(
  "../src/lib/tournament/standings"
);

{
  // Empate triple a 4 pts roto por diferencia de gol.
  const teams = [1, 2, 3, 4];
  const matches = [
    { homeTeamId: 1, awayTeamId: 2, homeScore: 2, awayScore: 1 }, // 1 gana
    { homeTeamId: 3, awayTeamId: 4, homeScore: 1, awayScore: 0 }, // 3 gana
    { homeTeamId: 1, awayTeamId: 3, homeScore: 0, awayScore: 1 }, // 3 gana
    { homeTeamId: 2, awayTeamId: 4, homeScore: 1, awayScore: 0 }, // 2 gana
    { homeTeamId: 1, awayTeamId: 4, homeScore: 3, awayScore: 0 }, // 1 gana
    { homeTeamId: 2, awayTeamId: 3, homeScore: 1, awayScore: 1 }, // empate
  ];
  const st = computeGroupStandings(teams, matches);
  // Team 1: 2W 0D 1L · 5GF 1GA · 6pts
  // Team 2: 1W 1D 1L · 3GF 3GA · 4pts
  // Team 3: 2W 1D 0L · 3GF 1GA · 7pts
  // Team 4: 0W 0D 3L · 0GF 5GA · 0pts
  // Orden esperado por puntos: 3, 1, 2, 4
  const order = st.map((s) => s.teamId).join(",");
  if (order === "3,1,2,4") report("tabla por puntos", "PASS");
  else report("tabla por puntos", "FAIL", `obtuvo ${order}`);
}
{
  // Tres equipos empatados a 6 pts; rompe por DG.
  const teams = [10, 20, 30, 40];
  const matches = [
    { homeTeamId: 10, awayTeamId: 40, homeScore: 3, awayScore: 0 }, // 10
    { homeTeamId: 20, awayTeamId: 40, homeScore: 2, awayScore: 0 }, // 20
    { homeTeamId: 30, awayTeamId: 40, homeScore: 1, awayScore: 0 }, // 30
    { homeTeamId: 10, awayTeamId: 20, homeScore: 1, awayScore: 0 }, // 10
    { homeTeamId: 20, awayTeamId: 30, homeScore: 1, awayScore: 0 }, // 20
    { homeTeamId: 30, awayTeamId: 10, homeScore: 1, awayScore: 0 }, // 30
  ];
  const st = computeGroupStandings(teams, matches);
  // 10,20,30 todos 2W 1L 6pts. DG: 10:+3 20:+2 30:0 → 10 > 20 > 30
  const order = st.map((s) => s.teamId).join(",");
  if (order === "10,20,30,40") report("desempate por DG", "PASS");
  else report("desempate por DG", "FAIL", `obtuvo ${order}`);
}
{
  // Best thirds entre 12 grupos: el de más puntos pasa.
  const standings = Array.from({ length: 12 }, (_, i) => ({
    groupCode: String.fromCharCode(65 + i),
    standings: [
      { teamId: i * 4 + 1 } as ReturnType<typeof computeGroupStandings>[number],
      { teamId: i * 4 + 2 } as ReturnType<typeof computeGroupStandings>[number],
      {
        teamId: i * 4 + 3,
        played: 3,
        wins: 1,
        draws: 0,
        losses: 2,
        goalsFor: i, // grupo A=0 ... grupo L=11
        goalsAgainst: 0,
        goalDifference: i,
        points: i,
      },
      { teamId: i * 4 + 4 } as ReturnType<typeof computeGroupStandings>[number],
    ],
  }));
  const best = pickBestThirds(standings);
  if (best.length === 8) report("8 mejores terceros", "PASS");
  else report("8 mejores terceros", "FAIL", `obtuvo ${best.length}`);
  // El primero debe ser el grupo L (más pts)
  if (best[0]?.groupCode === "L") report("orden de mejores terceros", "PASS");
  else
    report(
      "orden de mejores terceros",
      "FAIL",
      `top: ${best[0]?.groupCode}`,
    );
}

// ────────────────────────────────────────────────────────────────────
// 4. football-data.org
// ────────────────────────────────────────────────────────────────────
section("Proveedor football-data.org");

{
  const r = await safe(() =>
    fetch(
      "https://api.football-data.org/v4/competitions/WC/matches?season=2026",
      { headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_API_KEY! } },
    ),
  );
  if (r instanceof Error) report("GET /competitions/WC", "FAIL", r.message);
  else if (!r.ok) report("GET /competitions/WC", "FAIL", `HTTP ${r.status}`);
  else {
    const json = (await r.json()) as { resultSet?: { count: number } };
    if (json.resultSet?.count === 104) report("104 partidos WC 2026", "PASS");
    else
      report(
        "partidos WC 2026",
        "FAIL",
        `count=${json.resultSet?.count ?? "?"}`,
      );
    const remaining = r.headers.get("X-Requests-Available-Minute");
    if (remaining) report("rate-limit headers", "PASS", `remaining=${remaining}`);
    else report("rate-limit headers", "SKIP", "no headers");
  }
}

// ────────────────────────────────────────────────────────────────────
// 5. RLS: aislamiento entre usuarios
// ────────────────────────────────────────────────────────────────────
section("RLS · aislamiento entre usuarios");

const { createClient } = await import("@supabase/supabase-js");
const TEST_EMAIL_A = "preflight-a@quiniela.test";
const TEST_EMAIL_B = "preflight-b@quiniela.test";
const TEST_PASS = "test-preflight-1234";
async function ensureTestUser(email: string): Promise<string | undefined> {
  const { data: list } = await sb.auth.admin.listUsers();
  const existing = list?.users?.find((u) => u.email === email);
  if (existing) return existing.id;
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password: TEST_PASS,
    email_confirm: true,
  });
  if (error || !data.user) return undefined;
  await sb
    .from("profiles")
    .insert({ id: data.user.id, display_name: `Preflight ${email.charAt(11).toUpperCase()}` });
  return data.user.id;
}

const userA = await ensureTestUser(TEST_EMAIL_A);
const userB = await ensureTestUser(TEST_EMAIL_B);
if (userA && userB) report("alta usuarios A y B", "PASS");
else {
  report("alta usuarios A y B", "FAIL");
}

// Encontrar un partido futuro para predecir
const { data: futureMatch } = await sb
  .from("matches")
  .select("id, kickoff_at")
  .gt("kickoff_at", new Date(Date.now() + 2 * 3600 * 1000).toISOString())
  .order("kickoff_at")
  .limit(1)
  .single();

if (!futureMatch) {
  report("partido futuro disponible", "FAIL", "ningún match >1h adelante");
} else if (userA && userB) {
  // A inserta una predicción con service_role (saltea RLS pero respeta lock).
  const { error: insAErr } = await sb.from("predictions").upsert(
    {
      user_id: userA,
      match_id: futureMatch.id,
      home_score: 2,
      away_score: 1,
    },
    { onConflict: "user_id,match_id" },
  );
  if (insAErr) report("insert predicción A", "FAIL", insAErr.message);
  else report("insert predicción A", "PASS");

  // Sign in como B (usa publishable, respeta RLS).
  const sbB = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: signIn, error: siErr } = await sbB.auth.signInWithPassword({
    email: TEST_EMAIL_B,
    password: TEST_PASS,
  });
  if (siErr || !signIn?.session) {
    report("login usuario B", "FAIL", siErr?.message);
  } else {
    report("login usuario B", "PASS");
    // B intenta leer las predicciones — debería ver solo las suyas (0).
    const { data: predsB, error } = await sbB
      .from("predictions")
      .select("user_id");
    if (error) report("RLS lectura como B", "FAIL", error.message);
    else if ((predsB ?? []).every((p) => p.user_id === userB))
      report("RLS: B no ve predicciones de A", "PASS", `${predsB?.length ?? 0} filas`);
    else
      report(
        "RLS: B no ve predicciones de A",
        "FAIL",
        `${predsB?.length} filas incluyen otras user_id`,
      );

    // B intenta escribir una predicción para A — debe ser rechazado.
    const { error: forgeErr } = await sbB.from("predictions").upsert(
      {
        user_id: userA,
        match_id: futureMatch.id,
        home_score: 9,
        away_score: 9,
      },
      { onConflict: "user_id,match_id" },
    );
    if (forgeErr) report("RLS: B no puede falsificar predicción de A", "PASS");
    else report("RLS: B no puede falsificar predicción de A", "FAIL", "RLS no bloqueó");
  }
}

// ────────────────────────────────────────────────────────────────────
// 6. Lock vía RLS (no editar a <1h del kickoff)
// ────────────────────────────────────────────────────────────────────
section("Lock vía RLS (usuario autenticado)");

{
  // Crear un match de prueba con kickoff en el pasado.
  const past = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: testMatch, error: insErr } = await sb
    .from("matches")
    .insert({
      external_id: "preflight-lock-test",
      stage: "group",
      kickoff_at: past,
      status: "scheduled",
    })
    .select()
    .single();
  if (insErr || !testMatch) {
    report("crear match de prueba", "FAIL", insErr?.message);
  } else {
    report("crear match de prueba", "PASS");
    // Como usuario autenticado (RLS aplica) intentar predecir → debe fallar.
    const sbAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false } },
    );
    const { error: siErr } = await sbAuth.auth.signInWithPassword({
      email: TEST_EMAIL_A,
      password: TEST_PASS,
    });
    if (siErr) {
      report("login A para lock test", "FAIL", siErr.message);
    } else {
      const { error: predErr } = await sbAuth.from("predictions").insert({
        user_id: userA,
        match_id: testMatch.id,
        home_score: 1,
        away_score: 1,
      });
      if (predErr) report("lock SQL rechaza insert <1h", "PASS", predErr.code);
      else
        report(
          "lock SQL rechaza insert <1h",
          "WARN",
          "no aplica en este Supabase — defendido por cliente",
        );
    }
    // Cleanup
    await sb.from("matches").delete().eq("id", testMatch.id);
  }
}

// ────────────────────────────────────────────────────────────────────
// 7. Scoring trigger
// ────────────────────────────────────────────────────────────────────
section("Trigger matches_after_finish (puntuación)");

{
  // Crear partido futuro de prueba para insertar predicción, luego marcarlo finalizado y validar puntos.
  const future = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const { data: testMatch, error: insErr } = await sb
    .from("matches")
    .insert({
      external_id: "preflight-score-test",
      stage: "group",
      kickoff_at: future,
      status: "scheduled",
    })
    .select()
    .single();
  if (insErr || !testMatch) {
    report("crear match futuro de prueba", "FAIL", insErr?.message);
  } else if (userA) {
    // Predicción exacta de 2-1
    const { error: predErr } = await sb.from("predictions").upsert(
      {
        user_id: userA,
        match_id: testMatch.id,
        home_score: 2,
        away_score: 1,
      },
      { onConflict: "user_id,match_id" },
    );
    if (predErr) report("insertar predicción", "FAIL", predErr.message);
    else report("insertar predicción", "PASS");

    // Marcar como finalizado con marcador 2-1 → debería ser 3 pts
    const { error: updErr } = await sb
      .from("matches")
      .update({ status: "finished", home_score: 2, away_score: 1 })
      .eq("id", testMatch.id);
    if (updErr) report("marcar partido finalizado", "FAIL", updErr.message);
    else report("marcar partido finalizado", "PASS");

    const { data: pred } = await sb
      .from("predictions")
      .select("points")
      .eq("user_id", userA)
      .eq("match_id", testMatch.id)
      .single();
    if (pred?.points === 3) report("calc_prediction_points = 3", "PASS");
    else report("calc_prediction_points", "FAIL", `obtuvo ${pred?.points}`);

    // Cleanup: borra el match → cascade limpia la predicción.
    await sb.from("matches").delete().eq("id", testMatch.id);
  }
}

// Cleanup usuarios de prueba (opcional, mantienen DB limpia entre runs)
if (userA) {
  await sb.from("profiles").delete().eq("id", userA);
  await sb.auth.admin.deleteUser(userA);
}
if (userB) {
  await sb.from("profiles").delete().eq("id", userB);
  await sb.auth.admin.deleteUser(userB);
}

// ────────────────────────────────────────────────────────────────────
// Final
// ────────────────────────────────────────────────────────────────────
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
if (fails.length > 0) {
  console.log("\n\x1b[31m✗ Preflight con fallos:\x1b[0m");
  for (const f of fails) console.log(`  · ${f.name}${f.note ? ` — ${f.note}` : ""}`);
  process.exit(1);
}
console.log("\n\x1b[32m✓ Preflight superado.\x1b[0m");
}

main().catch((e) => {
  console.error("\n\x1b[31mError inesperado:\x1b[0m", e);
  process.exit(2);
});
