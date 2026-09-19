-- Rollback for T2-FAKT-NORMA-DERIVATION-001.
-- Restores the preceding approved-only LRV read model and its Fakt V2 command.
-- No Fakt/F2 document, audit or historical certified source value is deleted.
begin;

create or replace function public.t2_fakt_yoz_v2(
  p_obyekt_id bigint, p_sana date, p_qatorlar jsonb, p_actor_id bigint,
  p_operation_id uuid, p_izoh text default null, p_raqam text default null,
  p_actor_label text default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_kompaniya_id bigint; v_result jsonb;
begin
  select o.kompaniya_id into v_kompaniya_id from public.t2_obyekt o where o.id=p_obyekt_id;
  if v_kompaniya_id is null then return jsonb_build_object('ok',false,'code','OBYEKT_NOT_FOUND'); end if;
  perform public.t2_actor_kompaniya_azo_tekshir(v_kompaniya_id,p_actor_id);
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  if p_sana is null then return jsonb_build_object('ok',false,'code','FAKT_DATE_REQUIRED'); end if;
  if p_qatorlar is null or jsonb_typeof(p_qatorlar) <> 'array' or jsonb_array_length(p_qatorlar)=0 then return jsonb_build_object('ok',false,'code','FAKT_LINES_REQUIRED'); end if;
  if exists (select 1 from jsonb_array_elements(p_qatorlar) x where coalesce(x->>'qator_id','') !~ '^[1-9][0-9]*$' or coalesce(x->>'hajm','') !~ '^-?[0-9]+(\.[0-9]+)?$' or (x->>'hajm')::numeric=0) then return jsonb_build_object('ok',false,'code','FAKT_LINE_INVALID'); end if;
  if exists (select 1 from jsonb_array_elements(p_qatorlar) x group by x->>'qator_id' having count(*)>1) then return jsonb_build_object('ok',false,'code','DUPLICATE_FAKT_SOURCE_LINE'); end if;
  if exists (select 1 from jsonb_array_elements(p_qatorlar) x left join public.t2_qator q on q.id=(x->>'qator_id')::bigint where q.id is null or q.obyekt_id<>p_obyekt_id) then return jsonb_build_object('ok',false,'code','FAKT_LINE_OUTSIDE_OBJECT'); end if;
  select public.t2_fakt_yoz(p_obyekt_id,p_sana,p_qatorlar,p_actor_label,p_operation_id,p_izoh,p_raqam) into v_result;
  return coalesce(v_result,jsonb_build_object('ok',false,'code','FAKT_ENGINE_NO_RESULT')) || jsonb_build_object('contract','FAKT_V2','actor_id',p_actor_id);
end $$;

revoke all on function public.t2_fakt_yoz_v2(bigint,date,jsonb,bigint,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.t2_fakt_yoz_v2(bigint,date,jsonb,bigint,uuid,text,text,text) to service_role;

create or replace view public.t2_qator_holat as
select q.id,q.id as qator_id,q.obyekt_id,q.tur,q.raqam,q.kod,q.nom,q.birlik,q.kat,
  q.hajm as smeta_hajm,q.narx as smeta_narx,q.summa as smeta_summa,
  coalesce(sum(aq.hajm) filter (where a.tur='fakt'),0::numeric) as fakt_hajm,
  coalesce(sum(aq.summa) filter (where a.tur='fakt'),0::numeric) as fakt_summa,
  coalesce(sum(coalesce(aq.certified_quantity,aq.hajm)) filter (where a.tur='f2' and a.holat='tasdiqlangan'),0::numeric) as f2_hajm,
  coalesce(sum(coalesce(aq.certified_amount,aq.summa)) filter (where a.tur='f2' and a.holat='tasdiqlangan'),0::numeric) as f2_summa,
  q.hajm-coalesce(sum(coalesce(aq.certified_quantity,aq.hajm)) filter (where a.tur='f2' and a.holat='tasdiqlangan'),0::numeric) as qoldiq_hajm,
  q.summa-coalesce(sum(coalesce(aq.certified_amount,aq.summa)) filter (where a.tur='f2' and a.holat='tasdiqlangan'),0::numeric) as qoldiq_summa,
  greatest(coalesce(sum(aq.hajm) filter (where a.tur='fakt'),0::numeric)-coalesce(sum(coalesce(aq.certified_quantity,aq.hajm)) filter (where a.tur='f2' and a.holat='tasdiqlangan'),0::numeric),0::numeric) as f2_mumkin_hajm,
  greatest(coalesce(sum(aq.summa) filter (where a.tur='fakt'),0::numeric)-coalesce(sum(coalesce(aq.certified_amount,aq.summa)) filter (where a.tur='f2' and a.holat='tasdiqlangan'),0::numeric),0::numeric) as f2_mumkin_summa,
  case when coalesce(sum(coalesce(aq.certified_quantity,aq.hajm)) filter (where a.tur='f2' and a.holat='tasdiqlangan'),0::numeric)<>0::numeric then round(sum(coalesce(aq.certified_amount,aq.summa)) filter (where a.tur='f2' and a.holat='tasdiqlangan')/sum(coalesce(aq.certified_quantity,aq.hajm)) filter (where a.tur='f2' and a.holat='tasdiqlangan'),2) else null::numeric end as f2_narx,
  case when coalesce(sum(aq.hajm) filter (where a.tur='fakt'),0::numeric)<>0::numeric then round(sum(aq.summa) filter (where a.tur='fakt')/sum(aq.hajm) filter (where a.tur='fakt'),2) else null::numeric end as fakt_narx,
  case when coalesce(sum(coalesce(aq.certified_quantity,aq.hajm)) filter (where a.tur='f2' and a.holat='tasdiqlangan'),0::numeric)<>0::numeric and q.narx is not null and q.narx<>0::numeric then round((sum(coalesce(aq.certified_amount,aq.summa)) filter (where a.tur='f2' and a.holat='tasdiqlangan')/sum(coalesce(aq.certified_quantity,aq.hajm)) filter (where a.tur='f2' and a.holat='tasdiqlangan')-q.narx)/q.narx*100::numeric,1) else null::numeric end as f2_narx_farq_foiz
from public.t2_qator q left join public.t2_akt_qator aq on aq.qator_id=q.id left join public.t2_akt a on a.id=aq.akt_id and a.holat<>'bekor'
group by q.id,q.obyekt_id,q.tur,q.raqam,q.kod,q.nom,q.birlik,q.kat,q.hajm,q.narx,q.summa;

commit;
