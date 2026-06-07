"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  useQuinielasQuery,
  useUpdateProfileMutation,
  useRenameQuinielaMutation,
} from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  email: string;
  displayName: string;
}

export function PerfilClient({ email, displayName }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <DisplayNameSection initialName={displayName} />
      <EmailSection currentEmail={email} />
      <PasswordSection />
      <QuinielasSection />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nombre de usuario
// ---------------------------------------------------------------------------
function DisplayNameSection({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const mutation = useUpdateProfileMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === initialName) return;
    await mutation.mutateAsync(trimmed);
  };

  return (
    <Card title="Nombre de usuario">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Nombre visible en la clasificación"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
        />
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            variant="primary"
            loading={mutation.isPending}
            disabled={!name.trim() || name.trim() === initialName}
          >
            Guardar nombre
          </Button>
          {mutation.isSuccess && (
            <span className="text-sm text-emerald-600 dark:text-emerald-400">
              ✓ Guardado
            </span>
          )}
          {mutation.isError && (
            <span className="text-sm text-red-600 dark:text-red-400">
              {(mutation.error as Error).message}
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Cambio de email
// ---------------------------------------------------------------------------
function EmailSection({ currentEmail }: { currentEmail: string }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || trimmed === currentEmail) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: err } = await supabase.auth.updateUser({ email: trimmed });
      if (err) throw new Error(err.message);
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <Card title="Correo electrónico">
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          ✓ Revisa tu correo nuevo. El cambio se aplica cuando confirmes desde{" "}
          <strong>{email}</strong>.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Correo electrónico">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Correo actual" value={currentEmail} disabled />
        <Input
          label="Nuevo correo"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nuevo@ejemplo.com"
          error={error}
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Se enviará un enlace de confirmación al nuevo correo antes de aplicar
          el cambio.
        </p>
        <Button
          type="submit"
          variant="primary"
          loading={loading}
          disabled={!email.trim() || email.trim().toLowerCase() === currentEmail}
        >
          Cambiar correo
        </Button>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Cambio de contraseña
// ---------------------------------------------------------------------------
function PasswordSection() {
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = confirm.length > 0 && pwd !== confirm;
  const valid = pwd.length >= 8 && pwd === confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: err } = await supabase.auth.updateUser({ password: pwd });
      if (err) throw new Error(err.message);
      setDone(true);
      setPwd("");
      setConfirm("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <Card title="Contraseña">
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          ✓ Contraseña actualizada correctamente.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Contraseña">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Nueva contraseña"
          type="password"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          minLength={8}
          placeholder="Mínimo 8 caracteres"
        />
        <Input
          label="Confirmar contraseña"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repite la contraseña"
          error={mismatch ? "Las contraseñas no coinciden." : null}
        />
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        <Button
          type="submit"
          variant="primary"
          loading={loading}
          disabled={!valid}
        >
          Cambiar contraseña
        </Button>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Quinielas: renombrar
// ---------------------------------------------------------------------------
function QuinielasSection() {
  const { data: quinielas, isLoading } = useQuinielasQuery();
  const rename = useRenameQuinielaMutation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  if (isLoading || !quinielas || quinielas.length === 0) return null;

  const startEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
    rename.reset();
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const confirmRename = async (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    await rename.mutateAsync({ id, name: trimmed });
    setEditingId(null);
  };

  return (
    <Card title="Mis quinielas">
      <ul className="flex flex-col gap-2">
        {quinielas.map((q) => (
          <li
            key={q.id}
            className="flex items-center gap-3 rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800"
          >
            {editingId === q.id ? (
              <>
                <input
                  autoFocus
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmRename(q.id);
                    if (e.key === "Escape") cancelEdit();
                  }}
                  maxLength={40}
                  className="h-9 min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900"
                />
                <button
                  onClick={() => confirmRename(q.id)}
                  disabled={!editName.trim() || rename.isPending}
                  className="shrink-0 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {rename.isPending ? "…" : "Guardar"}
                </button>
                <button
                  onClick={cancelEdit}
                  className="shrink-0 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {q.name}
                </span>
                <button
                  onClick={() => startEdit(q.id, q.name)}
                  className="shrink-0 rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 hover:border-zinc-400 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500"
                >
                  Renombrar
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      {rename.isError && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          {(rename.error as Error).message}
        </p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// UI local
// ---------------------------------------------------------------------------
function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}
