import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex flex-1 flex-col px-6 py-12">
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="mb-2 text-3xl font-bold">Dashboard</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Bienvenido{user?.email ? `, ${user.email}` : ""}. Las predicciones se
          construirán en la Fase 4.
        </p>
      </div>
    </main>
  );
}
