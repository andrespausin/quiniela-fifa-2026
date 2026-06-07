"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Mis predicciones" },
  { href: "/eliminatorias", label: "Eliminatorias" },
  { href: "/jugadores", label: "Jugadores" },
  { href: "/resultados", label: "Resultados" },
  { href: "/clasificacion", label: "Clasificación" },
  { href: "/perfil", label: "Perfil" },
];

export function Nav({ userEmail }: { userEmail?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/dashboard" className="font-bold tracking-tight">
          Quiniela <span className="text-emerald-600">FIFA 2026</span>
        </Link>
        <nav className="hidden gap-1 sm:flex">
          {items.map((it) => {
            const active = pathname === it.href;
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                }`}
              >
                {it.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          {userEmail ? (
            <span className="hidden text-xs text-zinc-500 md:inline">
              {userEmail}
            </span>
          ) : null}
          <button
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              router.replace("/login");
              router.refresh();
            }}
            className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Salir
          </button>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-4 pb-2 sm:hidden">
        {items.map((it) => {
          const active = pathname === it.href;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${
                active
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  : "text-zinc-600 dark:text-zinc-300"
              }`}
            >
              {it.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
