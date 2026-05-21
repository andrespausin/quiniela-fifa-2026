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

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`
- `INVITATION_PIN` — clave estática para registrarse
- `FOOTBALL_DATA_API_KEY` — key de football-data.org
- `CRON_SECRET` — bearer token de los endpoints de cron
  (generar con `openssl rand -hex 32`)

## Base de datos

Aplicar `supabase/migrations/0001_init.sql` en el SQL Editor de Supabase
(o con `supabase db push`). Crea tablas, RLS, triggers de puntuación y
de bloqueo, vista de leaderboard y seed de los 12 grupos.

Más detalles en [`supabase/README.md`](supabase/README.md).

## Despliegue en Railway

1. https://railway.app → **New Project → Deploy from GitHub** → selecciona
   `andrespausin/quiniela-fifa-2026`. Railway detectará `railway.json` y
   compilará con NIXPACKS.
2. Pestaña **Variables** del servicio → pega TODAS las del `.env.example`
   con los valores reales (las mismas que ya usas en local). Importante:
   - `SUPABASE_SERVICE_ROLE_KEY` debe ir aquí, **no** en cliente.
   - `NEXT_PUBLIC_APP_URL` con la URL pública que Railway te asigne.
3. **Generate Domain** desde la pestaña *Settings → Networking* para que
   Railway publique tu app en `https://<algo>.up.railway.app`.
4. Tras el primer deploy, los 104 partidos ya están cargados en Supabase
   (los sembramos en local con `npm run sync:fixtures`), así que el
   dashboard funciona inmediatamente. Si quisieras sembrar desde
   Railway en su lugar, usa:
   ```bash
   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
     https://<app>.up.railway.app/api/cron/sync-fixtures
   ```

### Crons recomendados (gratis con cron-job.org)

| Endpoint                       | Frecuencia                                  |
|--------------------------------|---------------------------------------------|
| `POST /api/cron/sync-fixtures` | 1× al día (catálogo + nuevos cruces)        |
| `POST /api/cron/sync-results`  | cada 10-15 min en días de partido           |

Pasos en cron-job.org:

1. Crea cuenta gratis en https://cron-job.org.
2. *Create cronjob* → URL: `https://<app>.up.railway.app/api/cron/sync-results`.
3. *Advanced → Headers* → añade: `Authorization: Bearer <CRON_SECRET>`.
4. *Schedule* → cada 15 minutos durante el Mundial.
5. Repite para `sync-fixtures` con frecuencia diaria.

### Scripts de mantenimiento manual

```bash
npm run sync:fixtures   # repuebla equipos + 104 partidos desde football-data
npm run sync:results    # actualiza marcadores y avanza clasificados
npm run sync:all        # ambos
```

## Scripts

```bash
npm run dev         # desarrollo
npm run build       # build de producción
npm run start       # arrancar el build
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
```
