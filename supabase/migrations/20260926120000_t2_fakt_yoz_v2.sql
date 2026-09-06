-- T2-DAILY-PTO-NATIVE-001 -- native Fakt command boundary.
--
-- The legacy t2_fakt_yoz remains untouched for existing integrations.  This
-- wrapper is intentionally narrow: a browser never supplies the actor, every
-- source line is checked against the object, and retries carry one required
-- operation_id.  It delegates document creation to the established Fakt
-- engine rather than cloning its calculation or numbering rules.

begin;

create or replace function public.t2_fakt_yoz_v2(
  p_obyekt_id bigint,
  p_sana date,
  p_qatorlar jsonb,
  p_actor_id bigint,
  p_operation_id uuid,
  p_izoh text default null,
  p_raqam text default null,
  p_actor_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_kompaniya_id bigint;
  v_result jsonb;
begin
  select o.kompaniya_id into v_kompaniya_id
  from public.t2_obyekt o
  where o.id = p_obyekt_id;

  if v_kompaniya_id is null then
    return jsonb_build_object('ok', false, 'code', 'OBYEKT_NOT_FOUND');
  end if;
  perform public.t2_actor_kompaniya_azo_tekshir(v_kompaniya_id, p_actor_id);

  if p_operation_id is null then
    return jsonb_build_object('ok', false, 'code', 'OPERATION_ID_REQUIRED');
  end if;
  if p_sana is null then
    return jsonb_build_object('ok', false, 'code', 'FAKT_DATE_REQUIRED');
  end if;
  if p_qatorlar is null or jsonb_typeof(p_qatorlar) <> 'array' or jsonb_array_length(p_qatorlar) = 0 then
    return jsonb_build_object('ok', false, 'code', 'FAKT_LINES_REQUIRED');
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_qatorlar) x
    where coalesce(x->>'qator_id', '') !~ '^[1-9][0-9]*$'
       or coalesce(x->>'hajm', '') !~ '^-?[0-9]+(\.[0-9]+)?$'
       or (x->>'hajm')::numeric = 0
  ) then
    return jsonb_build_object('ok', false, 'code', 'FAKT_LINE_INVALID');
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_qatorlar) x
    group by x->>'qator_id' having count(*) > 1
  ) then
    return jsonb_build_object('ok', false, 'code', 'DUPLICATE_FAKT_SOURCE_LINE');
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_qatorlar) x
    left join public.t2_qator q on q.id = (x->>'qator_id')::bigint
    where q.id is null or q.obyekt_id <> p_obyekt_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'FAKT_LINE_OUTSIDE_OBJECT');
  end if;

  -- This is an append-only Fakt document, not a last-writer-wins row update.
  -- The mandatory operation_id is its concurrency receipt: a failed client
  -- retry must replay the same receipt instead of creating a second document.
  select public.t2_fakt_yoz(
    p_obyekt_id, p_sana, p_qatorlar, p_actor_label,
    p_operation_id, p_izoh, p_raqam
  ) into v_result;

  return coalesce(v_result, jsonb_build_object('ok', false, 'code', 'FAKT_ENGINE_NO_RESULT'))
    || jsonb_build_object('contract', 'FAKT_V2', 'actor_id', p_actor_id);
end
$function$;

revoke all on function public.t2_fakt_yoz_v2(bigint,date,jsonb,bigint,uuid,text,text,text)
  from public, anon, authenticated;
grant execute on function public.t2_fakt_yoz_v2(bigint,date,jsonb,bigint,uuid,text,text,text) to service_role;

comment on function public.t2_fakt_yoz_v2(bigint,date,jsonb,bigint,uuid,text,text,text) is
  'T2 daily native Fakt command. Actor is verified from the server session; qator_id is canonical and object-scoped; retries use one operation_id. Legacy t2_fakt_yoz remains for existing bridge callers.';

commit;
