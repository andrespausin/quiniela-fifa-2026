-- =============================================================
-- Quiniela FIFA 2026 — Schema inicial
-- =============================================================
-- Convenciones:
--  * Todas las tablas en schema public.
--  * RLS activo en todas las tablas con datos de usuario.
--  * IDs internos de partidos son enteros (no dependen del proveedor externo).
--  * external_id guarda el ID del proveedor (football-data.org / API-Football).
-- =============================================================

-- Limpieza idempotente para desarrollo (no destructiva si las tablas no existen)
do $$ begin
  create extension if not exists "pgcrypto";
exception when others then null; end $$;

-- -------------------------------------------------------------
-- profiles: 1:1 con auth.users
-- -------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is 'Perfil público del usuario. Se crea con el registro tras validar el PIN.';

-- -------------------------------------------------------------
-- teams: 48 selecciones del Mundial 2026
-- -------------------------------------------------------------
create table if not exists public.teams (
  id           serial primary key,
  code         text not null unique,     -- p.ej. "ARG", "MEX"
  name         text not null,            -- "Argentina"
  flag_emoji   text,
  external_id  text unique               -- id en el proveedor de datos
);

-- Idempotente: si la tabla existía sin la unicidad, añadirla.
create unique index if not exists teams_external_id_unique
  on public.teams(external_id) where external_id is not null;

comment on table public.teams is 'Selecciones nacionales participantes en el Mundial 2026.';

-- -------------------------------------------------------------
-- groups: 12 grupos (A..L)
-- -------------------------------------------------------------
create table if not exists public.groups (
  id       serial primary key,
  code     char(1) not null unique check (code between 'A' and 'L')
);

comment on table public.groups is '12 grupos oficiales del Mundial 2026.';

-- Pertenencia de equipo a grupo
create table if not exists public.group_teams (
  group_id integer not null references public.groups(id) on delete cascade,
  team_id  integer not null references public.teams(id) on delete cascade,
  primary key (group_id, team_id)
);

-- -------------------------------------------------------------
-- matches: 104 partidos del torneo
-- -------------------------------------------------------------
-- Stages oficiales 2026:
--   group, round_of_32, round_of_16, quarter_final, semi_final,
--   third_place, final
create type public.match_stage as enum (
  'group',
  'round_of_32',
  'round_of_16',
  'quarter_final',
  'semi_final',
  'third_place',
  'final'
);

create type public.match_status as enum (
  'scheduled',
  'live',
  'finished',
  'postponed',
  'cancelled'
);

create table if not exists public.matches (
  id            serial primary key,
  external_id   text unique,
  stage         public.match_stage not null,
  group_id      integer references public.groups(id),  -- sólo para 'group'
  bracket_slot  text,                                  -- p.ej. 'R32-01', 'QF-3'
  home_team_id  integer references public.teams(id),
  away_team_id  integer references public.teams(id),
  home_placeholder text,   -- p.ej. "1A", "2B", "3C/D/E", "W R32-01"
  away_placeholder text,
  kickoff_at    timestamptz not null,
  status        public.match_status not null default 'scheduled',
  home_score    integer,
  away_score    integer,
  home_score_pen integer,   -- penales (eliminación directa)
  away_score_pen integer,
  updated_at    timestamptz not null default now()
);

create index if not exists matches_stage_idx on public.matches(stage);
create index if not exists matches_kickoff_idx on public.matches(kickoff_at);

comment on table public.matches is '104 partidos. En fase de grupos los equipos se conocen desde el inicio; en eliminatorias se resuelven al cerrar la ronda previa.';
comment on column public.matches.home_placeholder is 'Cuando home_team_id es null, describe quién jugará (ej. "1A", "W R32-01").';

-- -------------------------------------------------------------
-- predictions: una por (usuario, partido)
-- -------------------------------------------------------------
create table if not exists public.predictions (
  id           bigserial primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  match_id     integer not null references public.matches(id) on delete cascade,
  home_score   integer not null check (home_score >= 0),
  away_score   integer not null check (away_score >= 0),
  winner       text check (winner in ('home','away','draw')),  -- usado en eliminatorias (resolución por penales)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  points       integer,    -- calculado al finalizar el partido
  unique(user_id, match_id)
);

create index if not exists predictions_user_idx on public.predictions(user_id);
create index if not exists predictions_match_idx on public.predictions(match_id);

comment on table public.predictions is 'Predicción del usuario para un partido específico.';

-- -------------------------------------------------------------
-- bracket_predictions: clasificados que el usuario apuesta para rondas siguientes
-- -------------------------------------------------------------
-- stage describe la ronda a la que el equipo clasifica
create table if not exists public.bracket_predictions (
  id        bigserial primary key,
  user_id   uuid not null references auth.users(id) on delete cascade,
  stage     public.match_stage not null,
  team_id   integer not null references public.teams(id) on delete cascade,
  unique(user_id, stage, team_id)
);

create index if not exists bracket_predictions_user_idx on public.bracket_predictions(user_id);

comment on table public.bracket_predictions is 'Equipos que el usuario predice clasificarán a cada ronda. Da puntos extra.';

-- -------------------------------------------------------------
-- bracket_results: equipos que realmente clasificaron a cada ronda
-- -------------------------------------------------------------
create table if not exists public.bracket_results (
  stage   public.match_stage not null,
  team_id integer not null references public.teams(id) on delete cascade,
  primary key (stage, team_id)
);

-- -------------------------------------------------------------
-- score_log: trazabilidad de puntuación por usuario/partido
-- -------------------------------------------------------------
create table if not exists public.score_log (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  source      text not null,         -- 'match', 'bracket'
  source_id   text not null,         -- match id o stage
  points      integer not null,
  created_at  timestamptz not null default now()
);

create index if not exists score_log_user_idx on public.score_log(user_id);

-- =============================================================
-- Funciones y triggers
-- =============================================================

-- Mantener updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_predictions_updated_at on public.predictions;
create trigger trg_predictions_updated_at before update on public.predictions
  for each row execute function public.set_updated_at();

drop trigger if exists trg_matches_updated_at on public.matches;
create trigger trg_matches_updated_at before update on public.matches
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- Lock: una predicción no se puede crear/editar a menos de 1h del kickoff
-- -------------------------------------------------------------
create or replace function public.predictions_check_lock()
returns trigger language plpgsql as $$
declare
  v_kickoff timestamptz;
begin
  select kickoff_at into v_kickoff from public.matches where id = new.match_id;
  if v_kickoff is null then
    raise exception 'Partido inexistente';
  end if;
  if now() >= (v_kickoff - interval '1 hour') then
    raise exception 'Predicciones cerradas: faltan menos de 60 minutos para el inicio del partido';
  end if;
  return new;
end $$;

drop trigger if exists trg_predictions_lock_ins on public.predictions;
create trigger trg_predictions_lock_ins before insert on public.predictions
  for each row execute function public.predictions_check_lock();

drop trigger if exists trg_predictions_lock_upd on public.predictions;
create trigger trg_predictions_lock_upd before update of home_score, away_score, winner
  on public.predictions
  for each row execute function public.predictions_check_lock();

-- -------------------------------------------------------------
-- Bracket predictions: bloqueo según el inicio de la ronda
-- -------------------------------------------------------------
create or replace function public.bracket_predictions_check_lock()
returns trigger language plpgsql as $$
declare
  v_first_kickoff timestamptz;
begin
  select min(kickoff_at) into v_first_kickoff
    from public.matches where stage = new.stage;
  if v_first_kickoff is not null and now() >= (v_first_kickoff - interval '1 hour') then
    raise exception 'Predicciones de bracket cerradas para esta ronda';
  end if;
  return new;
end $$;

drop trigger if exists trg_bracket_lock_ins on public.bracket_predictions;
create trigger trg_bracket_lock_ins before insert on public.bracket_predictions
  for each row execute function public.bracket_predictions_check_lock();

-- -------------------------------------------------------------
-- Multiplicador de puntos por etapa
-- -------------------------------------------------------------
create or replace function public.stage_multiplier(p_stage public.match_stage)
returns integer language sql immutable as $$
  select case p_stage
    when 'group'         then 1
    when 'round_of_32'   then 2
    when 'round_of_16'   then 2
    when 'quarter_final' then 3
    when 'semi_final'    then 4
    when 'final'         then 4
    when 'third_place'   then 2
  end;
$$;

-- -------------------------------------------------------------
-- Resultado canónico de un partido (home/away/draw)
-- -------------------------------------------------------------
create or replace function public.match_outcome(p_match public.matches)
returns text language plpgsql immutable as $$
begin
  if p_match.home_score is null or p_match.away_score is null then
    return null;
  end if;
  if p_match.home_score > p_match.away_score then
    return 'home';
  elsif p_match.home_score < p_match.away_score then
    return 'away';
  else
    -- empate; en eliminatorias el desempate va por penales
    if p_match.stage <> 'group'
       and p_match.home_score_pen is not null
       and p_match.away_score_pen is not null
       and p_match.home_score_pen <> p_match.away_score_pen then
      return case when p_match.home_score_pen > p_match.away_score_pen
                  then 'home' else 'away' end;
    end if;
    return 'draw';
  end if;
end $$;

-- -------------------------------------------------------------
-- Cálculo de puntos para UNA predicción
-- -------------------------------------------------------------
-- Reglas:
--  * Grupos: 3 pts si marcador exacto; 1 pt si acierta ganador/empate; 0 si no.
--  * Eliminatorias: aplican mismas reglas sobre los 90'+prórroga;
--    si terminó empatado y se decidió por penales, el "ganador" se mide con
--    el penalti (winner del usuario debe coincidir con quien clasificó).
--  * Multiplicador por etapa.
create or replace function public.calc_prediction_points(
  p_pred public.predictions,
  p_match public.matches
) returns integer language plpgsql immutable as $$
declare
  v_mult        integer := public.stage_multiplier(p_match.stage);
  v_outcome     text    := public.match_outcome(p_match);
  v_pred_out    text;
  v_base        integer := 0;
begin
  if p_match.home_score is null or p_match.away_score is null then
    return null;
  end if;

  -- marcador exacto (sólo 90' / global)
  if p_pred.home_score = p_match.home_score
     and p_pred.away_score = p_match.away_score then
    v_base := 3;
  else
    if p_pred.home_score > p_pred.away_score then
      v_pred_out := 'home';
    elsif p_pred.home_score < p_pred.away_score then
      v_pred_out := 'away';
    else
      v_pred_out := 'draw';
    end if;

    -- En eliminatorias, si el usuario predijo empate y luego hubo penales,
    -- aceptamos su 'winner' explícito si existe.
    if p_match.stage <> 'group' and v_pred_out = 'draw' and p_pred.winner is not null then
      v_pred_out := p_pred.winner;
    end if;

    if v_pred_out = v_outcome then
      v_base := 1;
    end if;
  end if;

  return v_base * v_mult;
end $$;

-- -------------------------------------------------------------
-- Trigger: al finalizar un partido, calcula puntos de todas las predicciones
-- -------------------------------------------------------------
create or replace function public.matches_after_finish()
returns trigger language plpgsql as $$
declare
  r record;
  v_pts integer;
begin
  if new.status = 'finished'
     and (old.status is distinct from 'finished'
          or old.home_score is distinct from new.home_score
          or old.away_score is distinct from new.away_score
          or old.home_score_pen is distinct from new.home_score_pen
          or old.away_score_pen is distinct from new.away_score_pen) then

    for r in select * from public.predictions where match_id = new.id loop
      v_pts := public.calc_prediction_points(r, new);
      update public.predictions set points = v_pts where id = r.id;

      -- log
      insert into public.score_log(user_id, source, source_id, points)
      values (r.user_id, 'match', new.id::text, coalesce(v_pts, 0));
    end loop;
  end if;
  return new;
end $$;

drop trigger if exists trg_matches_finish on public.matches;
create trigger trg_matches_finish after update on public.matches
  for each row execute function public.matches_after_finish();

-- -------------------------------------------------------------
-- Vista: leaderboard
-- -------------------------------------------------------------
create or replace view public.leaderboard as
with match_points as (
  select user_id, coalesce(sum(points), 0)::int as pts
    from public.predictions
   where points is not null
   group by user_id
),
bracket_points as (
  -- 2 pts por acierto en cualquier ronda predicha (multiplicador implícito)
  select bp.user_id,
         coalesce(sum(case when br.team_id is not null
                           then public.stage_multiplier(bp.stage)
                           else 0 end), 0)::int as pts
    from public.bracket_predictions bp
    left join public.bracket_results br
           on br.stage = bp.stage and br.team_id = bp.team_id
   group by bp.user_id
)
select
  p.id          as user_id,
  p.display_name,
  coalesce(mp.pts, 0) + coalesce(bp.pts, 0) as total_points,
  coalesce(mp.pts, 0) as match_points,
  coalesce(bp.pts, 0) as bracket_points
from public.profiles p
left join match_points   mp on mp.user_id = p.id
left join bracket_points bp on bp.user_id = p.id
order by total_points desc, p.display_name asc;

comment on view public.leaderboard is 'Ranking global de todos los participantes.';

-- =============================================================
-- Row Level Security
-- =============================================================
alter table public.profiles            enable row level security;
alter table public.teams               enable row level security;
alter table public.groups              enable row level security;
alter table public.group_teams         enable row level security;
alter table public.matches             enable row level security;
alter table public.predictions         enable row level security;
alter table public.bracket_predictions enable row level security;
alter table public.bracket_results     enable row level security;
alter table public.score_log           enable row level security;

-- profiles: cualquier usuario autenticado puede leer (para leaderboard)
drop policy if exists "profiles_read_all" on public.profiles;
create policy "profiles_read_all" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Catálogos: lectura para autenticados
drop policy if exists "teams_read"        on public.teams;
create policy "teams_read"        on public.teams        for select to authenticated using (true);
drop policy if exists "groups_read"       on public.groups;
create policy "groups_read"       on public.groups       for select to authenticated using (true);
drop policy if exists "group_teams_read"  on public.group_teams;
create policy "group_teams_read"  on public.group_teams  for select to authenticated using (true);
drop policy if exists "matches_read"      on public.matches;
create policy "matches_read"      on public.matches      for select to authenticated using (true);
drop policy if exists "bracket_results_read" on public.bracket_results;
create policy "bracket_results_read" on public.bracket_results for select to authenticated using (true);

-- predictions: cada usuario sobre lo suyo
drop policy if exists "predictions_read_own" on public.predictions;
create policy "predictions_read_own" on public.predictions
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "predictions_insert_own" on public.predictions;
create policy "predictions_insert_own" on public.predictions
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "predictions_update_own" on public.predictions;
create policy "predictions_update_own" on public.predictions
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "predictions_delete_own" on public.predictions;
create policy "predictions_delete_own" on public.predictions
  for delete to authenticated using (auth.uid() = user_id);

-- Leaderboard "público" entre participantes: cualquiera autenticado ve
-- el total agregado, pero NO las predicciones individuales antes de que se
-- jueguen los partidos (eso ya lo protege la política anterior).

-- bracket_predictions: idéntico patrón
drop policy if exists "bracket_pred_read_own" on public.bracket_predictions;
create policy "bracket_pred_read_own" on public.bracket_predictions
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "bracket_pred_write_own" on public.bracket_predictions;
create policy "bracket_pred_write_own" on public.bracket_predictions
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- score_log: lectura propia (auditoría del propio usuario)
drop policy if exists "score_log_read_own" on public.score_log;
create policy "score_log_read_own" on public.score_log
  for select to authenticated using (auth.uid() = user_id);

-- =============================================================
-- Permisos sobre la vista de leaderboard
-- =============================================================
grant select on public.leaderboard to authenticated;

-- =============================================================
-- Seed mínimo: 12 grupos
-- (los equipos y partidos se cargan después vía /api/cron/sync-fixtures)
-- =============================================================
insert into public.groups(code) values
  ('A'),('B'),('C'),('D'),('E'),('F'),
  ('G'),('H'),('I'),('J'),('K'),('L')
on conflict (code) do nothing;
