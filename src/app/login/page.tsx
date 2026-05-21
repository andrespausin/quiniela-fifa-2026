import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Iniciar sesión · Quiniela FIFA 2026" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="mb-1 text-2xl font-semibold">Iniciar sesión</h1>
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          Quiniela privada del Mundial FIFA 2026
        </p>
        <LoginForm />
        <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          ¿Aún no tienes cuenta?{" "}
          <Link
            href="/registro"
            className="font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            Regístrate con el PIN
          </Link>
        </p>
      </div>
    </main>
  );
}
