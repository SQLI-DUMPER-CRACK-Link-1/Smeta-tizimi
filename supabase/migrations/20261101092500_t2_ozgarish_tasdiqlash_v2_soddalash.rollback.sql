-- ROLLBACK: v2 = bayroq + v1 + oxirida bitta refresh (20261101091000).
begin;

create or replace function public.t2_smeta_ozgarish_tasdiqlash_v2(
  p_ozgarish_id bigint, p_actor_id bigint, p_kutilgan_versiya integer, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_res jsonb; v_obyekt bigint; v_komp bigint; v_holat text;
begin
  select obyekt_id, kompaniya_id into v_obyekt, v_komp from public.t2_smeta_ozgarish where id = p_ozgarish_id;
  perform set_config('t2.signal_kechiktir', 'on', true);
  v_res := public.t2_smeta_ozgarish_tasdiqlash_v1(p_ozgarish_id, p_actor_id, p_kutilgan_versiya, p_operation_id);
  perform set_config('t2.signal_kechiktir', '', true);
  if coalesce((v_res->>'ok')::boolean, false) and v_obyekt is not null and v_komp is not null then
    select holat into v_holat from public.t2_obyekt where id = v_obyekt;
    if v_holat is distinct from 'bekor' then
      perform public.t2_signal_refresh_object(v_komp, v_obyekt);
    else
      perform public.t2_signal_refresh_kompaniya(v_komp);
    end if;
  end if;
  return v_res;
end $$;

commit;
