# Supabase — Quiniela FIFA 2026

## Aplicar el esquema

### Opción A — SQL Editor (sin CLI)

1. Crea un proyecto en https://supabase.com (capa gratuita).
2. Copia el contenido de `migrations/0001_init.sql` y pégalo en
   **SQL Editor → New query → Run**. Esto crea tablas, RLS, triggers,
   vista de leaderboard y el seed mínimo (12 grupos `A..L`).

### Opción B — Supabase CLI

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

## Variables de entorno necesarias

Ver `.env.example` en la raíz. En particular:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (¡sólo en backend!)
- `INVITATION_PIN` — código de invitación estático que valida `/api/auth/signup`

## Flujo de registro

1. El usuario manda `POST /api/auth/signup` con `email`, `password`,
   `displayName` y `pin`.
2. El handler compara el PIN con `INVITATION_PIN` (comparación
   constant-time) **sólo en el servidor**.
3. Si coincide, crea el usuario con `service_role`
   (`email_confirm: true`) y su `profile`.
4. Si falla cualquier paso posterior, se elimina el usuario para
   evitar inconsistencias.

## Reglas implementadas en la base

- **RLS** activo en todas las tablas con datos de usuario.
- Cada usuario sólo ve/escribe sus `predictions` y `bracket_predictions`.
- Los catálogos (`teams`, `groups`, `matches`, …) son legibles por
  cualquier usuario autenticado.
- **Bloqueo 1h antes del partido**: defensa en 3 capas:
  1. UI deshabilita los inputs (`isLocked()` en cliente)
  2. Cliente filtra `dirtyDrafts` antes de enviar
  3. Policy RLS con función `public.match_is_editable()` lo verifica
     (en algunos entornos Supabase la evaluación REST no aplica el
     subquery; las capas 1-2 son las activas).
- **Cálculo automático de puntos**: trigger `matches_after_finish`
  recorre todas las predicciones del partido y actualiza
  `predictions.points` + `score_log`.
- **Multiplicadores por etapa** (`stage_multiplier`):
  - `group`: 1
  - `round_of_32`, `round_of_16`, `third_place`: 2
  - `quarter_final`: 3
  - `semi_final`, `final`: 4
- **Leaderboard** (`public.leaderboard`): suma de puntos de partidos
  más puntos de bracket (clasificados acertados, multiplicador por
  ronda).
