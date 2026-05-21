import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signupSchema } from "@/lib/validation";
import { env } from "@/lib/env";

/**
 * POST /api/auth/signup
 *
 * Body: { email, password, displayName, pin }
 *
 * Valida el PIN estático en backend; si es correcto crea el usuario con
 * service_role (email_confirm: true, sin email de confirmación) y luego
 * inicia sesión vía el cliente de servidor para setear las cookies.
 */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(payload);
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Datos de registro inválidos";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const { email, password, displayName, pin } = parsed.data;

  // Validación timing-safe del PIN
  const expected = env.invitationPin;
  if (!constantTimeEquals(pin, expected)) {
    return NextResponse.json(
      { error: "Código de invitación incorrecto" },
      { status: 403 },
    );
  }

  const admin = createSupabaseAdminClient();

  // Crear usuario (email confirmado automáticamente: el grupo es cerrado)
  const { data: created, error: createErr } = await admin.auth.admin.createUser(
    {
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    },
  );

  if (createErr || !created.user) {
    const msg = createErr?.message ?? "No se pudo crear el usuario";
    const status =
      createErr?.message?.toLowerCase().includes("already") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }

  // Crear el perfil correspondiente (RLS-safe con service_role)
  const { error: profileErr } = await admin.from("profiles").insert({
    id: created.user.id,
    display_name: displayName,
  });
  if (profileErr) {
    // rollback del usuario para evitar inconsistencias
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  // Iniciar sesión en el cliente server para setear cookies
  const supabase = await createSupabaseServerClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr) {
    return NextResponse.json({ error: signInErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// Asegura runtime Node (necesario para el SDK admin)
export const runtime = "nodejs";

// Evita que se cachee la respuesta
export const dynamic = "force-dynamic";
