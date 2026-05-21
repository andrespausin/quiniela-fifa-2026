import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/auth/cron";
import { syncResults } from "@/lib/tournament/sync";

/**
 * Actualiza marcadores y estado de los partidos en curso o finalizados,
 * y recalcula bracket_results (clasificados a cada ronda).
 *
 * Recomendado correr cada 10-15 min durante días de partido.
 *
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *        https://<app>/api/cron/sync-results
 */
export async function POST(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await syncResults();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
