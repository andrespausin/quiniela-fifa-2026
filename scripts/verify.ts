#!/usr/bin/env tsx
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv(path: string) {
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
      if (!m) continue;
      if (!(m[1] in process.env)) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {}
}
loadEnv(resolve(process.cwd(), ".env.local"));

async function main() {
  const { createSupabaseAdminClient } = await import(
    "../src/lib/supabase/admin"
  );
  const sb = createSupabaseAdminClient();

  const counts = await Promise.all([
    sb.from("teams").select("*", { count: "exact", head: true }),
    sb.from("matches").select("*", { count: "exact", head: true }),
    sb.from("groups").select("*", { count: "exact", head: true }),
    sb.from("group_teams").select("*", { count: "exact", head: true }),
  ]);
  console.log("teams       :", counts[0].count);
  console.log("matches     :", counts[1].count);
  console.log("groups      :", counts[2].count);
  console.log("group_teams :", counts[3].count);

  const byStage = await sb
    .from("matches")
    .select("stage")
    .order("kickoff_at");
  const tally: Record<string, number> = {};
  for (const r of byStage.data ?? []) tally[r.stage] = (tally[r.stage] ?? 0) + 1;
  console.log("por etapa   :", tally);

  const first = await sb
    .from("matches")
    .select("kickoff_at, home_team:home_team_id(name), away_team:away_team_id(name)")
    .order("kickoff_at", { ascending: true })
    .limit(3);
  console.log("primeros 3  :", first.data);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
