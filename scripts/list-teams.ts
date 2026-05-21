#!/usr/bin/env tsx
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

async function main() {
  const { createSupabaseAdminClient } = await import(
    "../src/lib/supabase/admin"
  );
  const sb = createSupabaseAdminClient();
  const { data } = await sb
    .from("teams")
    .select("code, name")
    .order("code");
  console.log(JSON.stringify(data, null, 2));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
