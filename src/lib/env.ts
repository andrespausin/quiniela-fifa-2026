const required = (name: string, value: string | undefined): string => {
  if (!value || value.length === 0) {
    throw new Error(`Falta la variable de entorno: ${name}`);
  }
  return value;
};

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  get supabaseServiceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
  },
  get invitationPin() {
    return required("INVITATION_PIN", process.env.INVITATION_PIN);
  },
  get cronSecret() {
    return required("CRON_SECRET", process.env.CRON_SECRET);
  },
  footballProvider: (process.env.FOOTBALL_PROVIDER ?? "football-data") as
    | "football-data"
    | "api-football",
  footballDataApiKey: process.env.FOOTBALL_DATA_API_KEY ?? "",
  apiFootballKey: process.env.API_FOOTBALL_KEY ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
};
