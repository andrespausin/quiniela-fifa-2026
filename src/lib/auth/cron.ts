import { env } from "@/lib/env";

/**
 * Compara `Authorization: Bearer <CRON_SECRET>` en constant-time.
 * Devuelve true si pasa, false en caso contrario.
 */
export function isAuthorizedCron(request: Request): boolean {
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${env.cronSecret}`;
  if (header.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < header.length; i++) {
    diff |= header.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
