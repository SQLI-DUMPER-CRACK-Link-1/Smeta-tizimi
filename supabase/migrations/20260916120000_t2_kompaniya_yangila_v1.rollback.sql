-- Rollback for 20260916120000_t2_kompaniya_yangila_v1. PRE-USE ONLY: refuses
-- if any command log entry exists (i.e. the canonical command has already
-- been used for a real update) -- a post-use correction is a forward
-- compensating change, never a function drop that would orphan history.
do $$
begin
  if exists (select 1 from public.t2_kompaniya_command_log) then
    raise exception 'PRE-USE ONLY: t2_kompaniya_command_log has rows -- t2_kompaniya_yangila_v1 has already been used. Do not roll back; write a forward correction instead.';
  end if;
end $$;

drop function if exists public.t2_kompaniya_yangila_v1(bigint,bigint,integer,text,text,text,text,text,text,text,text,text,uuid);
drop table if exists public.t2_kompaniya_command_log;
