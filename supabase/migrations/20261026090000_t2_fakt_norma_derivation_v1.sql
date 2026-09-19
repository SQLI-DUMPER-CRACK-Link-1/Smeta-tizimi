-- T2-FAKT-NORMA-DERIVATION-001
--
-- Operator Faktni faqat ish (BL) hamda mustaqil MAT/OB qatoriga kiritadi.
-- BL ichidagi norma-sarf RS Fakt qiymati parent BL Fakt × norma orqali
-- hisoblanadi. Oldin qo'lda yozilgan RS Fakt tarixini yo'qotmaslik uchun
-- u mavjud bo'lsa aynan o'sha direct qiymat ustun turadi.
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
  if exists (
    select 1 from jsonb_array_elements(p_qatorlar) x left join public.t2_qator q on q.id=(x->>'qator_id')::bigint
    where q.id is null or q.obyekt_id<>p_obyekt_id
  ) then return jsonb_build_object('ok',false,'code','FAKT_LINE_OUTSIDE_OBJECT'); end if;
  if exists (
    select 1 from jsonb_array_elements(p_qatorlar) x join public.t2_qator q on q.id=(x->>'qator_id')::bigint
    where q.tur not in ('bl','mat','ob')
  ) then return jsonb_build_object('ok',false,'code','FAKT_DERIVED_OR_ROLLUP_LINE','message','Fakt faqat BL, MAT yoki OB qatoriga kiritiladi; RS norma orqali BL Faktdan hisoblanadi.'); end if;
  select public.t2_fakt_yoz(p_obyekt_id,p_sana,p_qatorlar,p_actor_label,p_operation_id,p_izoh,p_raqam) into v_result;
  return coalesce(v_result,jsonb_build_object('ok',false,'code','FAKT_ENGINE_NO_RESULT')) || jsonb_build_object('contract','FAKT_V2','actor_id',p_actor_id,'entry_policy','BL_MAT_OB_ONLY');
end $$;

create or replace view public.t2_qator_holat as
with direct as (
  select q.id, q.obyekt_id, q.tur, q.raqam, q.kod, q.nom, q.birlik, q.kat, q.ota_id, q.norma, q.hajm, q.narx, q.summa,
    coalesce(sum(aq.hajm) filter (where a.tur='fakt' and a.holat<>'bekor'),0::numeric) as direct_fakt_hajm,
    coalesce(sum(aq.summa) filter (where a.tur='fakt' and a.holat<>'bekor'),0::numeric) as direct_fakt_summa,
    coalesce(sum(coalesce(aq.certified_quantity,aq.hajm)) filter (where a.tur='f2' and a.holat='tasdiqlangan'),0::numeric) as f2_hajm,
    coalesce(sum(coalesce(aq.certified_amount,aq.summa)) filter (where a.tur='f2' and a.holat='tasdiqlangan'),0::numeric) as f2_summa
  from public.t2_qator q left join public.t2_akt_qator aq on aq.qator_id=q.id left join public.t2_akt a on a.id=aq.akt_id
  group by q.id,q.obyekt_id,q.tur,q.raqam,q.kod,q.nom,q.birlik,q.kat,q.ota_id,q.norma,q.hajm,q.narx,q.summa
), effective as (
  select d.*, case when d.tur='rs' and d.norma is not null and parent.tur='bl' and d.direct_fakt_hajm=0 then parent.direct_fakt_hajm*d.norma else d.direct_fakt_hajm end as fakt_hajm,
    case when d.tur='rs' and d.norma is not null and parent.tur='bl' and d.direct_fakt_hajm=0
      then case when d.narx is null then null::numeric else parent.direct_fakt_hajm*d.norma*d.narx end
      else d.direct_fakt_summa end as fakt_summa,
    case when d.tur='rs' and d.norma is not null and parent.tur='bl' and d.direct_fakt_hajm=0 then 'BL_NORMA' else 'DIRECT' end as fakt_manbasi
  from direct d left join direct parent on parent.id=d.ota_id
)
select id,id as qator_id,obyekt_id,tur,raqam,kod,nom,birlik,kat,hajm as smeta_hajm,narx as smeta_narx,summa as smeta_summa,
  fakt_hajm,fakt_summa,f2_hajm,f2_summa,hajm-f2_hajm as qoldiq_hajm,summa-f2_summa as qoldiq_summa,
  greatest(fakt_hajm-f2_hajm,0::numeric) as f2_mumkin_hajm,greatest(fakt_summa-f2_summa,0::numeric) as f2_mumkin_summa,
  case when f2_hajm<>0 then round(f2_summa/f2_hajm,2) else null::numeric end as f2_narx,
  case when fakt_hajm<>0 then round(fakt_summa/fakt_hajm,2) else null::numeric end as fakt_narx,
  case when f2_hajm<>0 and narx is not null and narx<>0 then round(((f2_summa/f2_hajm)-narx)/narx*100,1) else null::numeric end as f2_narx_farq_foiz,
  ota_id,norma,direct_fakt_hajm,direct_fakt_summa,fakt_manbasi
from effective;

revoke all on function public.t2_fakt_yoz_v2(bigint,date,jsonb,bigint,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.t2_fakt_yoz_v2(bigint,date,jsonb,bigint,uuid,text,text,text) to service_role;
commit;
