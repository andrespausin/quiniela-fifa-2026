-- =============================================================
-- Seed: 12 grupos del Mundial 2026 (A..L)
-- Los equipos y partidos se cargan vía /api/cron/sync-fixtures
-- desde el proveedor de datos (football-data.org / API-Football).
-- =============================================================

insert into public.groups(code) values
  ('A'),('B'),('C'),('D'),('E'),('F'),
  ('G'),('H'),('I'),('J'),('K'),('L')
on conflict (code) do nothing;
