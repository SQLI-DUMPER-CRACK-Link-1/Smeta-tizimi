-- Rollback for 20261011120000_t2_workbench_preserve_null_v1.sql.
--
-- Restore the exact function definition captured immediately before the
-- forward correction.  This avoids duplicating an older function body and
-- avoids dropping the read-model contract during rollback.

begin;

do $$
declare
  v_definition text;
begin
  select function_sql into v_definition
  from public.t2_workbench_v1_definition_backup_v1
  where backup_id = true;
  if v_definition is null then
    raise exception 'ROLLBACK_BLOCKED: t2_workbench_v1 pre-migration definition backup is missing';
  end if;
  execute v_definition;
end $$;

revoke all on function public.t2_workbench_v1(bigint,bigint,date,integer) from public, anon, authenticated;
drop table public.t2_workbench_v1_definition_backup_v1;

commit;
