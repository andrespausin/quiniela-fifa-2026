import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/auth/cron";
import { syncFixtures } from "@/lib/tournament/sync";

/**
 * Carga / actualiza el calendario completo del torneo (equipos + 104 partidos).
 * Llamar 1-2 veces al día.
 *
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *        https://<app>/api/cron/sync-fixtures
 */
export async function POST(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await syncFixtures();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
