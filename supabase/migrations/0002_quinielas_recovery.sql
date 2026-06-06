-- =============================================================
-- RECOVERY: Restaurar constraint si el rollback anterior lo eliminó
-- =============================================================
-- Ejecutar SOLO si el rollback de 0002_quinielas.sql dejó la tabla
-- predictions sin el constraint unique(user_id, match_id) y sin la
-- columna quiniela_id. Después de ejecutar este script, aplica
-- 0002_quinielas.sql completo.
-- =============================================================

do $$ begin
  -- Restaurar unique(user_id, match_id) si fue eliminado por el rollback
  if not exists (
    select 1
      from information_schema.table_constraints
     where table_schema = 'public'
       and table_name   = 'predictions'
       and constraint_name = 'predictions_user_id_match_id_key'
  ) and not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'predictions'
       and column_name  = 'quiniela_id'
  ) then
    alter table public.predictions
      add constraint predictions_user_id_match_id_key unique(user_id, match_id);
    raise notice 'Constraint predictions_user_id_match_id_key restaurado.';
  else
    raise notice 'No se necesitó restaurar el constraint (ya existe o quiniela_id presente).';
  end if;
end $$;
