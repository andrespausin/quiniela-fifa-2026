#!/usr/bin/env tsx
/**
 * Script de mantenimiento — corre los servicios de sincronización sin
 * necesidad de levantar Next.js. Carga .env.local manualmente.
 *
 * Uso:
 *   npx tsx scripts/sync.ts fixtures
 *   npx tsx scripts/sync.ts results
 *   npx tsx scripts/sync.ts all
 *
 * Equivalente a llamar:
 *   POST /api/cron/sync-fixtures
 *   POST /api/cron/sync-results
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// .env.local manual loader (no añadimos dotenv como dep nueva)
function loadEnv(path: string) {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    console.warn(`⚠️  No se encontró ${path}, usando process.env existente.`);
    return;
  }
  for (const line of raw.split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
    if (!m) continue;
    const [, k, v] = m;
    if (!(k in process.env)) {
      process.env[k] = v.replace(/^["']|["']$/g, "");
    }
  }
}

loadEnv(resolve(process.cwd(), ".env.local"));

// IMPORTANTE: importar después de cargar las variables.
async function main() {
  const cmd = process.argv[2] ?? "fixtures";
  const { syncFixtures, syncResults } = await import(
    "../src/lib/tournament/sync"
  );

  if (cmd === "fixtures" || cmd === "all") {
    console.log("⏳ Sync fixtures…");
    const r = await syncFixtures();
    console.log("✅ fixtures:", r);
  }
  if (cmd === "results" || cmd === "all") {
    console.log("⏳ Sync results…");
    const r = await syncResults();
    console.log("✅ results:", r);
  }
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
