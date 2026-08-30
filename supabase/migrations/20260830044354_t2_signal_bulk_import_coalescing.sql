-- Importdagi t2_qator o'zgarishlari bitta-bitta signal refresh qilinsa,
-- N qator uchun N marta butun obyekt skan qilinadi. Bulk bosqichlarda
-- refresh T2_Import.js yakunida aynan bir marta bajariladi.
-- This migration is additive to business data: it changes trigger behaviour
-- only while the transaction's t2.manba is a known bulk calculation phase.

create or replace function public.t2_signal_source_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_kompaniya_id bigint;
  v_obyekt_id bigint;
  v_manba text := coalesce(nullif(current_setting('t2.manba', true), ''), '');
begin
  -- t2_markirovka, t2_narxla and t2_rollup set this transaction-local marker.
  -- A single explicit refresh follows after the full import pipeline.
  if tg_table_name = 't2_qator'
     and v_manba in ('markirovka', 'narxlash', 'rollup', 'import') then
    return coalesce(new, old);
  end if;

  if tg_table_name = 't2_obyekt' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    v_kompaniya_id := (to_jsonb(old)->>'kompaniya_id')::bigint;
    v_obyekt_id := (to_jsonb(old)->>'obyekt_id')::bigint;
  else
    v_kompaniya_id := coalesce((to_jsonb(new)->>'kompaniya_id')::bigint,
                               (to_jsonb(old)->>'kompaniya_id')::bigint);
    v_obyekt_id := coalesce((to_jsonb(new)->>'obyekt_id')::bigint,
                            (to_jsonb(old)->>'obyekt_id')::bigint);
  end if;

  if tg_table_name = 't2_tolov' and v_kompaniya_id is not null then
    perform public.t2_signal_refresh_kompaniya(v_kompaniya_id);
  elsif v_kompaniya_id is not null and v_obyekt_id is not null
    and exists (select 1 from public.t2_obyekt
                where id = v_obyekt_id and kompaniya_id = v_kompaniya_id and holat <> 'bekor') then
    perform public.t2_signal_refresh_object(v_kompaniya_id, v_obyekt_id);
  elsif v_kompaniya_id is not null then
    perform public.t2_signal_refresh_kompaniya(v_kompaniya_id);
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

comment on function public.t2_signal_source_trigger() is
  'Refreshes derived signals for ordinary writes; coalesces T2 bulk import phases to one explicit object refresh.';
