-- T2 Google Bridge: set an observed Fakt total atomically.
-- No row number/name identity, no client supplied actor, no last-write-wins.
begin;
create or replace function public.t2_fakt_belgila_v2(
  p_obyekt_id bigint, p_qator_id bigint, p_expected_fakt_hajm numeric,
  p_yangi_fakt_hajm numeric, p_sana date, p_actor_id bigint,
  p_operation_id uuid, p_izoh text default null, p_actor_label text default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_komp bigint; v_current numeric; v_delta numeric; v_result jsonb;
begin
  select o.kompaniya_id into v_komp from public.t2_obyekt o where o.id=p_obyekt_id;
  if v_komp is null then return jsonb_build_object('ok',false,'code','OBYEKT_NOT_FOUND'); end if;
  perform public.t2_actor_kompaniya_azo_tekshir(v_komp,p_actor_id);
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  perform 1 from public.t2_qator q where q.id=p_qator_id and q.obyekt_id=p_obyekt_id for update;
  if not found then return jsonb_build_object('ok',false,'code','QATOR_OUTSIDE_OBJECT'); end if;
  select coalesce(h.fakt_hajm,0) into v_current from public.t2_qator_holat h where h.qator_id=p_qator_id;
  if v_current is distinct from p_expected_fakt_hajm then
    return jsonb_build_object('ok',false,'code','FAKT_CONFLICT','current_fakt_hajm',v_current);
  end if;
  v_delta:=p_yangi_fakt_hajm-v_current;
  if v_delta=0 then return jsonb_build_object('ok',true,'unchanged',true,'fakt_hajm',v_current); end if;
  select public.t2_fakt_yoz_v2(p_obyekt_id,p_sana,jsonb_build_array(jsonb_build_object('qator_id',p_qator_id,'hajm',v_delta)),p_actor_id,p_operation_id,p_izoh,null,p_actor_label) into v_result;
  return v_result || jsonb_build_object('contract','FAKT_TOTAL_V2','fakt_hajm',p_yangi_fakt_hajm);
end $$;
revoke all on function public.t2_fakt_belgila_v2(bigint,bigint,numeric,numeric,date,bigint,uuid,text,text) from public,anon,authenticated;
grant execute on function public.t2_fakt_belgila_v2(bigint,bigint,numeric,numeric,date,bigint,uuid,text,text) to service_role;
commit;
