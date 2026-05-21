import { createClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase con service_role.
 * Sólo debe usarse en código de servidor (route handlers, server actions, cron).
 */
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
