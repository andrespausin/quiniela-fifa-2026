import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthRoute =
    pathname.startsWith("/login") || pathname.startsWith("/registro");
  // Páginas de recuperación de contraseña: accesibles sin sesión,
  // pero no redirigimos usuarios autenticados que las visiten.
  const isPasswordRoute =
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password");
  // Las API de auth y cron deben atravesar el middleware sin redirección:
  // /api/auth establece la sesión, /api/cron usa su propio bearer.
  const isApiPassthrough =
    pathname.startsWith("/api/auth") || pathname.startsWith("/api/cron");
  const isPublicAsset =
    pathname.startsWith("/_next") ||
    pathname === "/" ||
    pathname.startsWith("/favicon");

  if (!user && !isAuthRoute && !isPasswordRoute && !isPublicAsset && !isApiPassthrough) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
