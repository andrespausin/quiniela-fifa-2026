# Quiniela FIFA 2026 — Contexto del proyecto

## Propósito

Aplicación web privada de quiniela para el Mundial FIFA 2026. Los participantes predicen resultados de los 104 partidos (fase de grupos + eliminatorias) y acumulan puntos según su precisión. El organizador administra los datos de partidos; los usuarios solo predicen y consultan resultados.

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js App Router (versión con breaking changes — leer `node_modules/next/dist/docs/` antes de tocar APIs) |
| Base de datos + Auth | Supabase (PostgreSQL 15+, Row Level Security, PKCE auth) |
| Data fetching | React Query (`@tanstack/react-query`) para queries y mutaciones en el cliente |
| Estilos | Tailwind CSS |
| Lenguaje | TypeScript estricto |
| Deploy | Railway (rama `main` → auto-deploy) |

## Estructura de archivos relevante

```
src/
  app/
    (app)/                    # Rutas protegidas (requieren sesión)
      layout.tsx              # Guarda de auth + Nav + QuinielaProvider
      dashboard/              # Página principal de predicciones
      clasificacion/          # Leaderboard global
      eliminatorias/          # Predicciones de bracket
      jugadores/              # Ver quinielas de otros participantes (read-only)
      resultados/             # Predicciones por partido (partidos finalizados)
      perfil/                 # Editar nombre, email, contraseña y quinielas
    login/                    # Login con email+password
    registro/                 # Registro (requiere PIN del organizador)
    forgot-password/          # Solicitar reset de contraseña
    reset-password/           # Establecer nueva contraseña (desde link de email)
    api/
      auth/callback/          # Intercambia code PKCE → session (usado en reset-password)
      auth/forgot-password/   # Llama a resetPasswordForEmail
      auth/logout/            # Cierra sesión
  lib/
    queries.ts                # Todos los React Query hooks (useMatchesQuery, usePredictionsQuery, etc.)
    quiniela-context.tsx      # Context de quiniela activa (persiste en localStorage)
    supabase/
      client.ts               # createSupabaseBrowserClient (cliente)
      server.ts               # createSupabaseServerClient (SSR)
      middleware.ts           # Refresca sesión en cada request
      database.types.ts       # Tipos TypeScript de todas las tablas/vistas (mantenido a mano)
  components/
    nav.tsx                   # Barra de navegación superior
    prediction-row.tsx        # Tarjeta editable de predicción de partido
    readonly-prediction-card.tsx  # Tarjeta solo lectura (jugadores/resultados)
    pending-reminder.tsx      # Banner de partidos sin predecir
    auth/login-form.tsx
    ui/button.tsx, input.tsx  # Primitivas de UI
supabase/migrations/
  0001_init.sql               # Schema completo inicial
  0002_quinielas.sql          # Multi-quiniela (DEBE aplicarse en producción)
  0002_quinielas_recovery.sql # SQL de recuperación si el rollback dejó la DB inconsistente
```

## Esquema de base de datos

### Tablas principales

**`profiles`** — 1:1 con `auth.users`
- `id` uuid PK (= auth.users.id)
- `display_name` text — nombre visible en clasificación
- `created_at`, `updated_at`
- RLS: cualquier usuario autenticado puede leer; cada usuario actualiza solo el propio.

**`quinielas`** — una o más por usuario (migración 0002)
- `id` uuid PK
- `owner_id` uuid → auth.users
- `name` text (default "Mi quiniela")
- `created_at`
- RLS: solo el dueño puede leer/crear/editar/borrar sus quinielas.
- Al aplicar 0002, se crea automáticamente una quiniela "Mi quiniela" para cada usuario existente.

**`matches`** — 104 partidos del torneo
- `id` serial PK
- `stage` enum: `group | round_of_32 | round_of_16 | quarter_final | semi_final | third_place | final`
- `status` enum: `scheduled | live | finished | postponed | cancelled`
- `home_team_id`, `away_team_id` → teams (null hasta que se resuelva la ronda anterior)
- `home_placeholder`, `away_placeholder` — descripción cuando los equipos no están definidos
- `kickoff_at` timestamptz
- `home_score`, `away_score`, `home_score_pen`, `away_score_pen` — resultados

**`predictions`** — predicciones de partido (post migración 0002)
- `id` bigserial PK
- `user_id` uuid → auth.users
- `quiniela_id` uuid → quinielas (NOT NULL, agregado en 0002)
- `match_id` int → matches
- `home_score`, `away_score` int NOT NULL ≥ 0
- `winner` text (`home | away | draw | null`) — solo para eliminatorias con penales
- `points` int — calculado automáticamente por trigger al finalizar el partido
- Unique: `(quiniela_id, match_id)`
- **Lock**: trigger SQL bloquea INSERT/UPDATE a menos de 1 hora del kickoff.

**`bracket_predictions`** — equipos que el usuario predice clasificarán a cada ronda
- `quiniela_id` uuid → quinielas (agregado en 0002)
- Unique: `(quiniela_id, stage, team_id)`

**`teams`**, **`groups`**, **`group_teams`** — datos de selecciones y grupos (solo lectura para usuarios)

**`bracket_results`** — equipos que realmente clasificaron (gestión del organizador)

**`score_log`** — trazabilidad de puntos

### Vistas

**`leaderboard`** (actualizada en 0002) — una fila por quiniela
- `quiniela_id`, `user_id`, `display_name`, `quiniela_name`
- `total_points` = `match_points` + `bracket_points`

**`match_predictions_view`** (nueva en 0002) — predicciones enriquecidas
- Une `predictions` + `quinielas` + `profiles`
- Permite ver todas las predicciones de un partido o todas las de una quiniela

## Sistema de puntuación

| Acierto | Base | Multiplicador |
|---------|------|---------------|
| Marcador exacto | 3 pts | × stage_multiplier |
| Solo ganador/empate | 1 pt | × stage_multiplier |
| Falla | 0 pts | — |

`stage_multiplier`: group=1, round_of_32/round_of_16=2, quarter_final=2(?), semi_final=4, final=4, third_place=2.
Para eliminatorias con penales: el usuario predice empate + winner (campo `winner`).

El trigger `matches_after_finish` recalcula automáticamente los puntos de todas las predicciones cuando un partido cambia a `finished`.

## Auth y sesiones

- **Registro**: formulario con PIN del organizador (validado en API route).
- **Login**: email + password con Supabase Auth.
- **Forgot/reset password**: flujo PKCE → `resetPasswordForEmail` → email con link → `/api/auth/callback?code=XXX&next=/reset-password` → `exchangeCodeForSession` → `/reset-password` → `updateUser({ password })`.
- **Middleware** (`src/lib/supabase/middleware.ts`): refresca el access token en cada request. Las rutas `/forgot-password` y `/reset-password` son accesibles sin sesión.
- **Supabase redirect URL configurado**: `https://quiniela-fifa-2026-production.up.railway.app/api/auth/callback`

## Multi-quiniela (migración 0002)

Permite que un usuario tenga varias quinielas (distintos conjuntos de predicciones). La quiniela activa se persiste en `localStorage` via `QuinielaProvider` (`src/lib/quiniela-context.tsx`).

**Estado crítico**: La migración `0002_quinielas.sql` DEBE estar aplicada en producción para que el dashboard funcione. Si no está aplicada, `useQuinielasQuery` falla y el guardado de predicciones falla silenciosamente (el error se muestra desde el commit `3f1f7f1`).

Para aplicar la migración: Supabase → SQL Editor → copiar y ejecutar `supabase/migrations/0002_quinielas.sql`. El script es idempotente (puede re-ejecutarse).

## Variables de entorno requeridas

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...   # o NEXT_PUBLIC_SUPABASE_ANON_KEY
REGISTRATION_PIN=xxxx                          # PIN para nuevos registros
APP_URL=https://quiniela-fifa-2026-production.up.railway.app
```

## Scripts útiles

```bash
npm run dev          # Desarrollo local
npm run build        # Build de producción
npm run sync:fixtures # Sincronizar fixtures desde la API externa
```

## Decisiones de diseño relevantes

1. **`number | null` para scores**: `null` significa "no ingresado" (no es 0). El stepper muestra `–` cuando null; `+` arranca desde 0; `–` en 0 vuelve a null. Esto evita guardar accidentalmente 0-0 sin querer.

2. **`onConflict: "quiniela_id,match_id"`** en el upsert de predicciones. Requiere que la constraint `predictions_quiniela_id_match_id_key` exista en la DB (la crea 0002).

3. **RLS en `predictions`** (post 0002): permite leer predicciones propias Y predicciones de partidos `finished` (para las páginas Resultados y Jugadores).

4. **`effectiveId`** en `dashboard-client.tsx`: IIFE que resuelve qué quiniela está activa. Si `quinielas` falla, es `null` y el guardado muestra un error en la barra inferior.

5. **`CollapsibleSection`** usa `useState` + `onToggle` (no `defaultOpen` estático) para que los re-renders de React no colapsen la sección al pulsar +/-.
