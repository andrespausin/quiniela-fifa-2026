import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";
import { QuinielaProvider } from "@/lib/quiniela-context";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <QuinielaProvider>
      <Nav userEmail={user.email} />
      <div className="flex-1">{children}</div>
    </QuinielaProvider>
  );
}
