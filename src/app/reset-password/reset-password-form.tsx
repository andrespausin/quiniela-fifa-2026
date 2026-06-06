"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const MIN_LENGTH = 8;

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mismatch = confirm.length > 0 && password !== confirm;
  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const canSubmit =
    password.length >= MIN_LENGTH && password === confirm && !loading;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const sb = createSupabaseBrowserClient();
      const { error: updateError } = await sb.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setDone(true);
      // Redirigir al dashboard tras un breve momento
      setTimeout(() => router.replace("/dashboard"), 1500);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-xl bg-emerald-50 px-4 py-5 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
        <p className="font-medium">Contraseña actualizada</p>
        <p className="mt-1 text-emerald-700 dark:text-emerald-400">
          Redirigiendo al dashboard…
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Input
        label="Nueva contraseña"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
        error={tooShort ? `Mínimo ${MIN_LENGTH} caracteres` : null}
      />
      <Input
        label="Confirmar contraseña"
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        autoComplete="new-password"
        error={mismatch ? "Las contraseñas no coinciden" : null}
      />
      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={!canSubmit}
        loading={loading}
        className="mt-2 h-11 w-full"
      >
        Guardar nueva contraseña
      </Button>
    </form>
  );
}
