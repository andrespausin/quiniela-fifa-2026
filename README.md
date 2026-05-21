# Quiniela FIFA 2026

Aplicación web privada para una quiniela del Mundial FIFA 2026.
Grupo cerrado de hasta 50 personas, acceso por **código de invitación**
(PIN estático). 100% capas gratuitas.

## Stack

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS v4**
- **Supabase** (Auth + Postgres + RLS)
- **TanStack Query** (consumo de datos) y **TanStack Form** (predicciones)
- **football-data.org** (Free Tier) como proveedor de fixtures/resultados
- **Railway** (despliegue)

## Características

- Login y registro con Supabase. El registro exige el `INVITATION_PIN`,
  validado **sólo en backend** con comparación constant-time.
- Dashboard de predicciones con **bloqueo automático a 1h del kickoff**
  (trigger SQL, no depende del cliente).
- Cron endpoints (`/api/cron/sync-fixtures`, `/api/cron/sync-results`)
  protegidos por `CRON_SECRET`.
- Cálculo automático de puntos en SQL:
  - Grupos: 3 pts marcador exacto · 1 pt ganador/empate
  - Multiplicadores por etapa: x1 grupos · x2 16vos/8vos · x3 cuartos ·
    x4 semis/final
  - Puntos extra por acertar clasificados a cada ronda
- Leaderboard agregado en tiempo real (vista SQL).

## Setup local

```bash
cp .env.example .env.local         # rellenar variables
npm install
npm run dev                        # http://localhost:3000
```

Variables obligatorias (ver `.env.example`):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`
- `INVITATION_PIN` — clave estática para registrarse
- `FOOTBALL_DATA_API_KEY` — key de football-data.org
- `CRON_SECRET` — bearer token de los endpoints de cron

## Base de datos

Aplicar `supabase/migrations/0001_init.sql` en el SQL Editor de Supabase
(o con `supabase db push`). Crea tablas, RLS, triggers de puntuación y
de bloqueo, vista de leaderboard y seed de los 12 grupos.

Más detalles en [`supabase/README.md`](supabase/README.md).

## Despliegue

`railway.json` define `build` y `start` para que Railway use NIXPACKS.
Configurar las mismas variables de entorno en el dashboard de Railway.

## Scripts

```bash
npm run dev         # desarrollo
npm run build       # build de producción
npm run start       # arrancar el build
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
```
