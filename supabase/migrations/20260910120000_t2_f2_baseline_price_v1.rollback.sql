-- PRE-USE SCHEMA ROLLBACK for 20260910120000_t2_f2_baseline_price_v1.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- SAFE ONLY BEFORE THE FEATURE HAS BEEN USED. This migration is additive; the
-- ONLY thing a rollback loses is the frozen price-fact split + revision link.
-- Once F2 acts have been certified against a frozen baseline, or an original
-- baseline (t2_smeta_revision seq 0) has been sealed, dropping the columns
-- would destroy audit-grade history. This script REFUSES to run in that case
-- and points you to the forward-repair path instead.
--
-- POST-USE = FORWARD REPAIR (do NOT delete history):
--   * keep the columns; leave baseline_narx / actual_narx / revision_id in place
--   * if a specific bad row must be corrected, issue a compensating F2/revision
--   * a genuine schema removal after use requires a bespoke, reviewed migration
--     that first archives t2_smeta_revision + t2_akt_qator price facts elsewhere
-- ═══════════════════════════════════════════════════════════════════════════
begin;

do $$
begin
  if to_regclass('public.t2_smeta_revision') is not null
     and exists (select 1 from public.t2_smeta_revision) then
    raise exception 'POST-USE: t2_smeta_revision has % row(s). Pre-use rollback refused — use forward repair (see header).',
      (select count(*) from public.t2_smeta_revision);
  end if;
  if exists (select 1 from public.t2_akt_qator where baseline_narx is not null) then
    raise exception 'POST-USE: % t2_akt_qator row(s) carry a frozen baseline. Pre-use rollback refused — use forward repair.',
      (select count(*) from public.t2_akt_qator where baseline_narx is not null);
  end if;
end $$;

drop function if exists public.t2_nakopitelniy_v1(bigint,bigint,date,integer,boolean);
drop function if exists public.t2_akt_qator_baseline_backfill_v1();
drop function if exists public.t2_smeta_baseline_kafolat_v1(bigint,bigint);

alter table public.t2_akt_qator
  drop column if exists variance_summa,
  drop column if exists revision_id,
  drop column if exists narx_izoh,
  drop column if exists narx_manba_id,
  drop column if exists narx_manba,
  drop column if exists actual_narx,
  drop column if exists baseline_summa,
  drop column if exists baseline_narx;

alter table public.t2_akt
  drop column if exists revision_id,
  drop column if exists davr_muhr,
  drop column if exists forma3_id;

drop table if exists public.t2_smeta_revision;

-- original t2_akt_yarat (pre-2026-09-10) restored verbatim
create or replace function public.t2_akt_yarat(
  p_obyekt_id bigint, p_tur text, p_oy date, p_qatorlar jsonb,
  p_raqam text default null, p_operation_id uuid default null,
  p_manba text default 'frontend', p_kim text default null, p_majburiy boolean default false)
returns jsonb language plpgsql set search_path to 'public','pg_temp' as $function$
declare
  v_akt_id bigint; v_bor bigint; v_komp bigint;
  v_jami numeric; v_soni int; v_narxsiz int; v_buzilish jsonb;
  v_ogoh_soni int := 0; v_izoh text;
begin
  if p_operation_id is not null then
    select id into v_bor from t2_akt where operation_id = p_operation_id;
    if found then
      return jsonb_build_object('ok',true,'takror',true,'akt_id',v_bor,
        'izoh','Bu operatsiya allaqachon bajarilgan — yangi hujjat yaratilmadi.');
    end if;
  end if;
  if p_tur not in ('fakt','f2') then
    return jsonb_build_object('ok',false,'sabab','tur',
      'xabar','tur faqat «fakt» yoki «f2» bo''ladi, berilgani: '||coalesce(p_tur,'(bo''sh)'));
  end if;
  if p_oy is null then
    return jsonb_build_object('ok',false,'sabab','oy','xabar','Oy ko''rsatilmagan');
  end if;
  if p_qatorlar is null or jsonb_array_length(p_qatorlar)=0 then
    return jsonb_build_object('ok',false,'sabab','bosh','xabar','Hujjatda bironta qator yo''q');
  end if;
  select kompaniya_id into v_komp from t2_obyekt where id=p_obyekt_id;
  if not found then
    return jsonb_build_object('ok',false,'sabab','obyekt','xabar','Obyekt topilmadi: '||p_obyekt_id);
  end if;

  drop table if exists _kir;
  create temp table _kir on commit drop as
  select (x->>'qator_id')::bigint qator_id, t2_son(x->>'hajm') hajm,
         case when x ? 'narx' then t2_son(x->>'narx') end narx_kir,
         coalesce((x->>'narx_yoq')::boolean, false) narx_yoq,
         nullif(btrim(coalesce(x->>'izoh','')),'') izoh
  from jsonb_array_elements(p_qatorlar) x;

  if exists (select 1 from _kir k left join t2_qator q
             on q.id=k.qator_id and q.obyekt_id=p_obyekt_id where q.id is null) then
    return jsonb_build_object('ok',false,'sabab','qator',
      'xabar','Ba''zi qatorlar bu obyektga tegishli emas',
      'qatorlar',(select jsonb_agg(k.qator_id) from _kir k left join t2_qator q
                  on q.id=k.qator_id and q.obyekt_id=p_obyekt_id where q.id is null));
  end if;
  if exists (select 1 from _kir where hajm is null) then
    return jsonb_build_object('ok',false,'sabab','hajm',
      'xabar','Ba''zi qatorlarda hajm son emas',
      'qatorlar',(select jsonb_agg(qator_id) from _kir where hajm is null));
  end if;

  select jsonb_agg(jsonb_build_object('qator_id',t.qator_id,'nom',t.nom,
           'bor',t.bor,'qoshilmoqda',t.qosh,'chegara',t.chegara))
    into v_buzilish
  from (select k.qator_id, h.nom,
               case when p_tur='fakt' then h.fakt_hajm else h.f2_hajm end bor,
               k.hajm qosh,
               case when p_tur='fakt' then h.smeta_hajm else h.fakt_hajm end chegara
        from _kir k join t2_qator_holat h on h.id=k.qator_id) t
  where t.chegara is not null
    and (abs(t.bor+t.qosh) > abs(t.chegara)+0.000001 or (t.bor+t.qosh)*t.chegara < 0);

  v_ogoh_soni := coalesce(jsonb_array_length(v_buzilish), 0);

  insert into t2_akt (obyekt_id,kompaniya_id,tur,raqam,oy,holat,operation_id,manba,kim)
  values (p_obyekt_id,v_komp,p_tur,p_raqam,date_trunc('month',p_oy)::date,
          'qoralama',p_operation_id,p_manba,p_kim)
  returning id into v_akt_id;

  insert into t2_akt_qator (akt_id,qator_id,obyekt_id,kompaniya_id,hajm,narx,izoh)
  select v_akt_id,k.qator_id,p_obyekt_id,v_komp,k.hajm,
         case when k.narx_yoq then null else coalesce(k.narx_kir,q.narx) end,
         k.izoh
  from _kir k join t2_qator q on q.id=k.qator_id;

  select count(*),count(*) filter (where summa is null),sum(summa)
    into v_soni,v_narxsiz,v_jami from t2_akt_qator where akt_id=v_akt_id;
  update t2_akt set hujjat_jami=v_jami where id=v_akt_id;

  if v_ogoh_soni > 0 then
    v_izoh := v_ogoh_soni || ' qatorda ' ||
              case when p_tur='fakt' then 'FAKT smetadan' else 'Ф2 FAKTdan' end ||
              ' oshadi — tekshiring';
    update t2_akt set izoh = coalesce(izoh||' | ','') || v_izoh where id = v_akt_id;
  end if;

  return jsonb_build_object('ok',true,'takror',false,'akt_id',v_akt_id,'tur',p_tur,
    'holat','qoralama','oy',to_char(date_trunc('month',p_oy),'YYYY-MM'),
    'qator_soni',v_soni,'narxsiz',v_narxsiz,'jami',v_jami,
    'toliq',(v_narxsiz=0),
    'ogohlantirish',v_buzilish,
    'ogohlantirish_soni',v_ogoh_soni,
    'izoh', trim(both ' |' from
      case when v_narxsiz>0 then v_narxsiz||' qatorda narx yo''q — JAMI TO''LIQ EMAS.' else '' end
      || case when v_ogoh_soni>0 then ' | '||v_izoh else '' end
      || case when v_narxsiz=0 and v_ogoh_soni=0 then 'Barcha qator narxlangan, ogohlantirish yo''q.' else '' end));
end $function$;

commit;
