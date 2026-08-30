-- A new t2_obyekt starts without rows, requests, or documents.  Running the
-- company-wide signal refresh in the INSERT transaction makes object creation
-- depend on every existing object and can exceed PostgREST's timeout.
-- Signals remain derived: source-table mutations still refresh their object.
create or replace function public.t2_signal_source_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_kompaniya_id bigint;
  v_obyekt_id bigint;
begin
  -- Entity registration is intentionally lightweight.  There is no source
  -- state to signal at this point, and a full tenant refresh is not safe in a
  -- synchronous INSERT transaction.
  if TG_TABLE_NAME = 't2_obyekt' then
    if TG_OP = 'DELETE' then return OLD; end if;
    return NEW;
  end if;

  if TG_OP = 'DELETE' then
    v_kompaniya_id := (to_jsonb(OLD)->>'kompaniya_id')::bigint;
    v_obyekt_id := (to_jsonb(OLD)->>'obyekt_id')::bigint;
  else
    v_kompaniya_id := coalesce((to_jsonb(NEW)->>'kompaniya_id')::bigint,
                               (to_jsonb(OLD)->>'kompaniya_id')::bigint);
    v_obyekt_id := coalesce((to_jsonb(NEW)->>'obyekt_id')::bigint,
                             (to_jsonb(OLD)->>'obyekt_id')::bigint);
  end if;

  if TG_TABLE_NAME = 't2_tolov' and v_kompaniya_id is not null then
    perform public.t2_signal_refresh_kompaniya(v_kompaniya_id);
  elsif v_kompaniya_id is not null and v_obyekt_id is not null
    and exists (select 1 from public.t2_obyekt
                where id=v_obyekt_id and kompaniya_id=v_kompaniya_id and holat<>'bekor') then
    perform public.t2_signal_refresh_object(v_kompaniya_id,v_obyekt_id);
  elsif v_kompaniya_id is not null then
    perform public.t2_signal_refresh_kompaniya(v_kompaniya_id);
  end if;

  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;
