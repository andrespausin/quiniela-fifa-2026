-- =============================================================
-- Quiniela FIFA 2026 — Migración 0002: multi-quiniela + resultados públicos
-- =============================================================
-- Estrategia sin romper producción:
--   1. Crear tabla quinielas y generar una quiniela por defecto para
--      cada usuario existente (profiles).
--   2. Añadir quiniela_id a predictions y bracket_predictions,
--      poblar con la quiniela por defecto, luego hacer NOT NULL.
--   3. Reemplazar los unique constraints para incluir quiniela_id.
--   4. Ampliar la política de lectura en predictions para partidos
--      ya terminados (sección Resultados).
--   5. Actualizar la vista leaderboard para que una fila = una quiniela.
--   6. Crear vista match_predictions_view para la página Resultados.
-- =============================================================

begin;

-- -------------------------------------------------------------
-- 1. Tabla quinielas
-- -------------------------------------------------------------
create table if not exists public.quinielas (
  id         uuid        primary key default gen_random_uuid(),
  owner_id   uuid        not null references auth.users(id) on delete cascade,
  name       text        not null default 'Mi quiniela',
  created_at timestamptz not null default now()
);

create index if not exists quinielas_owner_idx on public.quinielas(owner_id);

comment on table public.quinielas is
  'Cada quiniela es un juego independiente de predicciones. Un usuario puede tener varias.';

-- -------------------------------------------------------------
-- 2. Crear una quiniela por defecto para cada usuario existente
-- -------------------------------------------------------------
-- Usamos una tabla temporal para guardar el mapeo owner→quiniela_id
-- y luego actualizar las predicciones en el mismo bloque.
create temp table _quiniela_default as
  with ins as (
    insert into public.quinielas(owner_id, name)
    select id, 'Mi quiniela'
      from public.profiles
    returning id as quiniela_id, owner_id
  )
  select * from ins;

-- Si hay usuarios con predicciones pero sin perfil, crear su quiniela también
insert into public.quinielas(owner_id, name)
select distinct p.user_id, 'Mi quiniela'
  from public.predictions p
 where p.user_id not in (select owner_id from _quiniela_default)
on conflict do nothing;

-- Completar la tabla temporal con los recién creados
insert into _quiniela_default(quiniela_id, owner_id)
select q.id, q.owner_id
  from public.quinielas q
 where q.owner_id not in (select owner_id from _quiniela_default);

-- -------------------------------------------------------------
-- 3. Añadir quiniela_id a predictions
-- -------------------------------------------------------------
alter table public.predictions
  add column if not exists quiniela_id uuid
    references public.quinielas(id) on delete cascade;

-- Poblar
update public.predictions p
   set quiniela_id = qd.quiniela_id
  from _quiniela_default qd
 where qd.owner_id = p.user_id
   and p.quiniela_id is null;

-- NOT NULL (todos deberían estar rellenos ahora)
alter table public.predictions
  alter column quiniela_id set not null;

-- Reemplazar unique constraint
alter table public.predictions
  drop constraint if exists predictions_user_id_match_id_key;
alter table public.predictions
  add constraint predictions_quiniela_id_match_id_key unique(quiniela_id, match_id);

create index if not exists predictions_quiniela_idx
  on public.predictions(quiniela_id);

-- -------------------------------------------------------------
-- 4. Añadir quiniela_id a bracket_predictions
-- -------------------------------------------------------------
alter table public.bracket_predictions
  add column if not exists quiniela_id uuid
    references public.quinielas(id) on delete cascade;

update public.bracket_predictions bp
   set quiniela_id = qd.quiniela_id
  from _quiniela_default qd
 where qd.owner_id = bp.user_id
   and bp.quiniela_id is null;

alter table public.bracket_predictions
  alter column quiniela_id set not null;

alter table public.bracket_predictions
  drop constraint if exists bracket_predictions_user_id_stage_team_id_key;
alter table public.bracket_predictions
  add constraint bracket_pred_quiniela_stage_team_key unique(quiniela_id, stage, team_id);

-- -------------------------------------------------------------
-- 5. RLS para quinielas
-- -------------------------------------------------------------
alter table public.quinielas enable row level security;

drop policy if exists "quinielas_read_own"   on public.quinielas;
drop policy if exists "quinielas_insert_own" on public.quinielas;
drop policy if exists "quinielas_update_own" on public.quinielas;
drop policy if exists "quinielas_delete_own" on public.quinielas;

create policy "quinielas_read_own" on public.quinielas
  for select to authenticated using (auth.uid() = owner_id);
create policy "quinielas_insert_own" on public.quinielas
  for insert to authenticated with check (auth.uid() = owner_id);
create policy "quinielas_update_own" on public.quinielas
  for update to authenticated
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "quinielas_delete_own" on public.quinielas
  for delete to authenticated using (auth.uid() = owner_id);

-- -------------------------------------------------------------
-- 6. Ampliar lectura de predictions para partidos terminados
--    (necesario para la página Resultados)
-- -------------------------------------------------------------
-- Reemplazar la política de sólo lectura propia por una que también
-- permite ver predicciones de partidos ya finalizados.
drop policy if exists "predictions_read_own"             on public.predictions;
drop policy if exists "predictions_read_finished_matches" on public.predictions;

create policy "predictions_read_own" on public.predictions
  for select to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.matches m
       where m.id = predictions.match_id
         and m.status = 'finished'
    )
  );

-- -------------------------------------------------------------
-- 7. Actualizar vista leaderboard → una fila por quiniela
-- -------------------------------------------------------------
-- DROP necesario porque CREATE OR REPLACE no permite renombrar columnas
drop view if exists public.leaderboard;
create view public.leaderboard as
with match_pts as (
  select q.id    as quiniela_id,
         q.owner_id as user_id,
         coalesce(sum(p.points), 0)::int as pts
    from public.quinielas q
    left join public.predictions p
           on p.quiniela_id = q.id and p.points is not null
   group by q.id, q.owner_id
),
bracket_pts as (
  -- bracket_predictions siguen siendo por usuario (compartidas entre quinielas)
  select bp.user_id,
         coalesce(sum(
           case when br.team_id is not null
                then public.stage_multiplier(bp.stage)
                else 0 end
         ), 0)::int as pts
    from public.bracket_predictions bp
    left join public.bracket_results br
           on br.stage = bp.stage and br.team_id = bp.team_id
   group by bp.user_id
)
select
  q.id          as quiniela_id,
  q.owner_id    as user_id,
  pr.display_name,
  q.name        as quiniela_name,
  coalesce(mp.pts, 0) + coalesce(bp.pts, 0) as total_points,
  coalesce(mp.pts, 0)  as match_points,
  coalesce(bp.pts, 0)  as bracket_points
from public.quinielas     q
join public.profiles      pr on pr.id        = q.owner_id
left join match_pts       mp on mp.quiniela_id = q.id
left join bracket_pts     bp on bp.user_id     = q.owner_id
order by total_points desc, pr.display_name asc, q.name asc;

grant select on public.leaderboard to authenticated;

comment on view public.leaderboard is
  'Una fila por quiniela. Incluye match_points (de predicciones de esa quiniela) y bracket_points (del dueño, compartidos entre sus quinielas).';

-- -------------------------------------------------------------
-- 8. Vista match_predictions_view (página Resultados)
-- -------------------------------------------------------------
create or replace view public.match_predictions_view as
select
  p.id,
  p.quiniela_id,
  p.user_id,
  p.match_id,
  p.home_score,
  p.away_score,
  p.winner,
  p.points,
  q.name    as quiniela_name,
  pr.display_name
from public.predictions   p
join public.quinielas      q  on q.id  = p.quiniela_id
join public.profiles       pr on pr.id = p.user_id;

grant select on public.match_predictions_view to authenticated;

comment on view public.match_predictions_view is
  'Predicciones enriquecidas con nombre de quiniela y display_name del usuario. Heredan el RLS de predictions.';

-- -------------------------------------------------------------
-- Limpieza
-- -------------------------------------------------------------
drop table _quiniela_default;

commit;
