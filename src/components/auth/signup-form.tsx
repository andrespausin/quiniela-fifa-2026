"use client";

import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signupSchema } from "@/lib/validation";

export function SignupForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      displayName: "",
      email: "",
      password: "",
      pin: "",
    },
    onSubmit: async ({ value }) => {
      setServerError(null);
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(value),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setServerError(data.error ?? "No se pudo registrar");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <form.Field
        name="displayName"
        validators={{
          onChange: ({ value }) => {
            const r = signupSchema.shape.displayName.safeParse(value);
            return r.success ? undefined : r.error.issues[0]?.message;
          },
        }}
      >
        {(field) => (
          <Input
            label="Nombre para mostrar"
            name={field.name}
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            error={
              field.state.meta.isTouched
                ? (field.state.meta.errors[0] as string | undefined) ?? null
                : null
            }
            autoComplete="nickname"
          />
        )}
      </form.Field>

      <form.Field
        name="email"
        validators={{
          onChange: ({ value }) => {
            const r = signupSchema.shape.email.safeParse(value);
            return r.success ? undefined : r.error.issues[0]?.message;
          },
        }}
      >
        {(field) => (
          <Input
            label="Email"
            type="email"
            name={field.name}
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            error={
              field.state.meta.isTouched
                ? (field.state.meta.errors[0] as string | undefined) ?? null
                : null
            }
            autoComplete="email"
          />
        )}
      </form.Field>

      <form.Field
        name="password"
        validators={{
          onChange: ({ value }) => {
            const r = signupSchema.shape.password.safeParse(value);
            return r.success ? undefined : r.error.issues[0]?.message;
          },
        }}
      >
        {(field) => (
          <Input
            label="Contraseña (mín. 8 caracteres)"
            type="password"
            name={field.name}
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            error={
              field.state.meta.isTouched
                ? (field.state.meta.errors[0] as string | undefined) ?? null
                : null
            }
            autoComplete="new-password"
          />
        )}
      </form.Field>

      <form.Field
        name="pin"
        validators={{
          onChange: ({ value }) => {
            const r = signupSchema.shape.pin.safeParse(value);
            return r.success ? undefined : r.error.issues[0]?.message;
          },
        }}
      >
        {(field) => (
          <Input
            label="Código de invitación"
            type="password"
            name={field.name}
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            error={
              field.state.meta.isTouched
                ? (field.state.meta.errors[0] as string | undefined) ?? null
                : null
            }
            placeholder="Pídelo al organizador"
          />
        )}
      </form.Field>

      {serverError ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {serverError}
        </p>
      ) : null}

      <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <Button
            type="submit"
            disabled={!canSubmit}
            loading={isSubmitting}
            className="mt-2 h-11 w-full"
          >
            Crear cuenta
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
