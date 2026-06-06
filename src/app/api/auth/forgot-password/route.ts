import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("Email inválido"),
});

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Email inválido" },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();

  // El link redirige al callback que intercambia el código PKCE,
  // luego lleva al usuario a /reset-password ya autenticado.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.appUrl}/api/auth/callback?next=/reset-password`,
  });

  // Siempre respondemos ok para no revelar si el email existe (enumeración).
  return NextResponse.json({ ok: true });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
