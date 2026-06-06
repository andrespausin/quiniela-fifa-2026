import Link from "next/link";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "Nueva contraseña · Quiniela FIFA 2026" };

export default function ResetPasswordPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="mb-1 text-2xl font-semibold">Nueva contraseña</h1>
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          Elige una contraseña segura para tu cuenta.
        </p>
        <ResetPasswordForm />
        <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          <Link
            href="/login"
            className="font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
