import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Ruta de callback OAuth / PKCE.
 * Supabase redirige aquí con ?code=XXX tras una operación de auth
 * (recuperación de contraseña, confirmación de email, OAuth, etc.).
 * Intercambiamos el código por una sesión y redirigimos al destino.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  // Sin código o intercambio fallido → al login con mensaje de error
  const loginUrl = new URL("/login", url.origin);
  loginUrl.searchParams.set("error", "link-invalido");
  return NextResponse.redirect(loginUrl);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
