import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata = { title: "Crear cuenta · Quiniela FIFA 2026" };

export default function RegistroPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="mb-1 text-2xl font-semibold">Crear cuenta</h1>
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          Necesitas el código de invitación del grupo.
        </p>
        <SignupForm />
        <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          ¿Ya tienes cuenta?{" "}
          <Link
            href="/login"
            className="font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            Inicia sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
