-- SMETA/F2/NAKOPITELNIY 1/3 — F2 price-fact separation + revision baseline + Nakopitelniy
-- SOURCE ONLY — NOT applied to production by this task.
--
-- REUSE: t2_qator (scope truth), t2_akt/t2_akt_qator (F2/fakt), t2_akt_yarat,
--        t2_qator_holat, t2_ozgarish (field-level diff log).
-- EXTEND: t2_akt_qator (separated price facts + frozen baseline + revision link).
-- ADDITIVE: t2_smeta_revision (original baseline + approved-change revisions),
--           t2_nakopitelniy_v1 read model, one-time backfill.
--
-- PRICE FACTS ARE KEPT STRICTLY SEPARATE (never collapsed into one "narx"):
--   A baseline_narx     — estimate/reference/contract price, FROZEN per act line
--   B narx              — the price CERTIFIED on this F2 line (what was paid on)
--   C actual_narx        — the real procurement/execution price for the period,
--                          NULL when unknown (NEVER silently the estimate or a
--                          bare manual override); narx_manba/_id/_izoh carry the
--                          lineage (taminot / faktura / shartnoma / qol_nomalum)
--   D approved change price lives on t2_smeta_ozgarish_qator (migration 2/3)
--
-- BASELINE NEVER DRIFTS: a later t2_qator edit cannot touch a frozen act-line
-- baseline. ORIGINAL BASELINE (revision seq 0) + APPROVED CHANGES (later
-- revisions) = CURRENT APPROVED ENTITLEMENT. Historical F2 keeps pointing to the
-- revision it was certified against.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. t2_smeta_revision — the revision ledger
--    seq 0 = 'asl' (the original baseline snapshot); seq N = after change order N.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.t2_smeta_revision (
  id           bigint generated always as identity primary key,
  obyekt_id    bigint not null references public.t2_obyekt(id),
  kompaniya_id bigint not null,
  seq          integer not null,
  tur          text not null check (tur in ('asl','ozgarish')),
  ozgarish_id  bigint,                    -- FK added in migration 2/3
  snapshot     jsonb not null,            -- [{qator_id,nom,birlik,kat,hajm,narx,summa}]
  jami_summa   numeric not null default 0,
  actor_id     bigint,
  izoh         text,
  yaratildi    timestamptz not null default now(),
  unique (obyekt_id, seq)
);
create index if not exists t2_smeta_revision_obyekt_ix on public.t2_smeta_revision (obyekt_id, seq desc);
alter table public.t2_smeta_revision enable row level security;

comment on table public.t2_smeta_revision is
  'SMETA/F2 CONTROL: BOQ revision ledger. seq 0 = original baseline; later seq = post-approved-change. Historical F2 acts point to the revision effective when certified. The original is always reconstructable from seq 0.';

-- Lazy-create the seq-0 baseline for an object (idempotent).
create or replace function public.t2_smeta_baseline_kafolat_v1(p_obyekt_id bigint, p_actor_id bigint)
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare v_komp bigint; v_id bigint; v_snap jsonb; v_jami numeric;
begin
  select id into v_id from public.t2_smeta_revision where obyekt_id = p_obyekt_id and seq = 0;
  if found then return v_id; end if;
  select kompaniya_id into v_komp from public.t2_obyekt where id = p_obyekt_id;
  if v_komp is null then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'qator_id', q.id, 'nom', q.nom, 'birlik', q.birlik, 'kat', q.kat,
           'tur', q.tur, 'ota_id', q.ota_id, 'hajm', q.hajm, 'narx', q.narx, 'summa', q.summa)), '[]'::jsonb),
         coalesce(sum(q.summa) filter (where q.tur in ('rs','mat','ob')), 0)
    into v_snap, v_jami
  from public.t2_qator q where q.obyekt_id = p_obyekt_id;
  insert into public.t2_smeta_revision (obyekt_id, kompaniya_id, seq, tur, snapshot, jami_summa, actor_id, izoh)
  values (p_obyekt_id, v_komp, 0, 'asl', v_snap, v_jami, p_actor_id, 'Original baseline (avtomatik muhrlandi)')
  on conflict (obyekt_id, seq) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.t2_smeta_revision where obyekt_id = p_obyekt_id and seq = 0;
  end if;
  return v_id;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. EXTEND t2_akt_qator with separated price facts + frozen baseline + revision
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.t2_akt_qator
  add column if not exists baseline_narx   numeric,           -- A: frozen estimate/reference price
  add column if not exists baseline_summa  numeric,           -- A: hajm * baseline_narx, frozen
  add column if not exists actual_narx     numeric,           -- C: real procurement/execution price, NULL = unknown
  add column if not exists narx_manba      text
      check (narx_manba is null or narx_manba in ('smeta','f2_sertifikat','taminot','shartnoma','qol_nomalum')),
  add column if not exists narx_manba_id   bigint,            -- C: lineage id (faktura/taminot/shartnoma row)
  add column if not exists narx_izoh       text,
  add column if not exists revision_id     bigint;            -- effective BOQ revision for this line

do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='t2_akt_qator' and column_name='variance_summa') then
    -- certified value vs frozen baseline (summa is itself generated -> mirror hajm*narx)
    alter table public.t2_akt_qator add column variance_summa numeric
      generated always as ((case when narx is null then 0::numeric else hajm * narx end) - coalesce(baseline_summa,0)) stored;
  end if;
end $$;

comment on column public.t2_akt_qator.baseline_narx is
  'A: estimate/reference/contract unit price FROZEN at act-creation from the effective BOQ revision. Never recomputed.';
comment on column public.t2_akt_qator.narx is
  'B: the unit price this F2 line was CERTIFIED / paid on.';
comment on column public.t2_akt_qator.actual_narx is
  'C: the real procurement/execution unit price for the period. NULL = unknown (never silently the estimate). Lineage in narx_manba/_id/_izoh.';
comment on column public.t2_akt_qator.narx_manba is
  'Price-fact source: smeta (=baseline) | f2_sertifikat | taminot | shartnoma | qol_nomalum (manual, source unknown).';

alter table public.t2_akt
  add column if not exists forma3_id   bigint,
  add column if not exists davr_muhr   boolean not null default false,
  add column if not exists revision_id bigint;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. t2_akt_yarat — freeze the baseline, stamp the revision, separate price facts
--    (production body + PARK additions in the insert; nothing else changed)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.t2_akt_yarat(
  p_obyekt_id bigint, p_tur text, p_oy date, p_qatorlar jsonb,
  p_raqam text default null, p_operation_id uuid default null,
  p_manba text default 'frontend', p_kim text default null, p_majburiy boolean default false)
returns jsonb language plpgsql set search_path to 'public','pg_temp' as $function$
declare
  v_akt_id bigint; v_bor bigint; v_komp bigint;
  v_jami numeric; v_soni int; v_narxsiz int; v_buzilish jsonb;
  v_ogoh_soni int := 0; v_izoh text; v_rev bigint; v_actor bigint;
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

  v_actor := (regexp_match(coalesce(p_kim,''), '^actor:(\d+)$'))[1]::bigint;
  -- effective BOQ revision when this F2 is certified: seal seq-0 if absent, then take the latest
  perform public.t2_smeta_baseline_kafolat_v1(p_obyekt_id, v_actor);
  select id into v_rev from public.t2_smeta_revision where obyekt_id = p_obyekt_id order by seq desc limit 1;

  drop table if exists _kir;
  create temp table _kir on commit drop as
  select (x->>'qator_id')::bigint qator_id, t2_son(x->>'hajm') hajm,
         case when x ? 'narx' then t2_son(x->>'narx') end narx_kir,
         coalesce((x->>'narx_yoq')::boolean, false) narx_yoq,
         nullif(btrim(coalesce(x->>'narx_manba','')),'') narx_manba_kir,
         case when x ? 'actual_narx' then t2_son(x->>'actual_narx') end actual_kir,
         nullif(x->>'narx_manba_id','')::bigint narx_manba_id_kir,
         nullif(btrim(coalesce(x->>'narx_izoh','')),'') narx_izoh_kir,
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

  insert into t2_akt (obyekt_id,kompaniya_id,tur,raqam,oy,holat,operation_id,manba,kim,revision_id)
  values (p_obyekt_id,v_komp,p_tur,p_raqam,date_trunc('month',p_oy)::date,
          'qoralama',p_operation_id,p_manba,p_kim,v_rev)
  returning id into v_akt_id;

  -- ⚡ canonical: baseline frozen (A); certified price (B); actual price (C) only when
  --    a source is given — otherwise actual_narx stays NULL and manba='qol_nomalum'.
  insert into t2_akt_qator (akt_id,qator_id,obyekt_id,kompaniya_id,hajm,narx,izoh,
                            baseline_narx,baseline_summa,actual_narx,narx_manba,narx_manba_id,narx_izoh,revision_id)
  select v_akt_id,k.qator_id,p_obyekt_id,v_komp,k.hajm,
         case when k.narx_yoq then null else coalesce(k.narx_kir,q.narx) end,
         k.izoh,
         q.narx,
         case when k.hajm is not null and q.narx is not null then k.hajm * q.narx end,
         k.actual_kir,
         coalesce(k.narx_manba_kir,
                  case when k.actual_kir is not null then 'qol_nomalum'
                       when k.narx_yoq then 'smeta'
                       when k.narx_kir is not null and q.narx is not null and k.narx_kir <> q.narx then 'qol_nomalum'
                       else 'smeta' end),
         k.narx_manba_id_kir,
         k.narx_izoh_kir,
         v_rev
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
    'holat','qoralama','oy',to_char(date_trunc('month',p_oy),'YYYY-MM'),'revision_id',v_rev,
    'qator_soni',v_soni,'narxsiz',v_narxsiz,'jami',v_jami,
    'toliq',(v_narxsiz=0),
    'ogohlantirish',v_buzilish,
    'ogohlantirish_soni',v_ogoh_soni,
    'izoh', trim(both ' |' from
      case when v_narxsiz>0 then v_narxsiz||' qatorda narx yo''q — JAMI TO''LIQ EMAS.' else '' end
      || case when v_ogoh_soni>0 then ' | '||v_izoh else '' end
      || case when v_narxsiz=0 and v_ogoh_soni=0 then 'Barcha qator narxlangan, ogohlantirish yo''q.' else '' end));
end $function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. One-time backfill for act lines created before the price-fact split.
--    baseline = current BOQ price (best available); certified = existing narx;
--    actual stays NULL (unknown) unless the certified price differs from baseline
--    AND there is no evidence -> then narx_manba='qol_nomalum', actual stays NULL.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.t2_akt_qator_baseline_backfill_v1()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_n integer;
begin
  update public.t2_akt_qator aq
     set baseline_narx  = q.narx,
         baseline_summa = case when aq.hajm is not null and q.narx is not null then aq.hajm * q.narx end,
         narx_manba     = case
                            when aq.narx is null or q.narx is null or aq.narx = q.narx then 'smeta'
                            else 'qol_nomalum' end
  from public.t2_qator q
  where q.id = aq.qator_id
    and aq.baseline_narx is null;
  get diagnostics v_n = row_count;
  update public.t2_akt a
     set revision_id = coalesce(a.revision_id,
           (select id from public.t2_smeta_revision r where r.obyekt_id = a.obyekt_id order by seq desc limit 1))
   where a.revision_id is null;
  return jsonb_build_object('ok',true,'backfilled',v_n);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Nakopitelniy vedomost — bounded, STABLE, no temp table.
--    Cumulative uses APPROVED F2 only. Draft/pending kept strictly separate.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.t2_nakopitelniy_v1(
  p_obyekt_id bigint, p_actor_id bigint, p_davr date default null,
  p_limit integer default 500, p_faqat_faol boolean default true)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  v_komp bigint; v_rol text; v_davr date; v_obnom text; v_loyiha bigint;
  v_lim integer := least(greatest(coalesce(p_limit,500),1),3000);
  v_qatorlar jsonb; v_jami jsonb; v_davrlar jsonb; v_qcount integer;
  v_pending numeric := 0;
begin
  select kompaniya_id, nom, loyiha_id into v_komp, v_obnom, v_loyiha from public.t2_obyekt where id = p_obyekt_id;
  if v_komp is null then return jsonb_build_object('ok',false,'code','OBYEKT_NOT_FOUND'); end if;
  v_rol := public.t2_actor_kompaniya_azo_tekshir(v_komp, p_actor_id);  -- raises 42501

  v_davr := date_trunc('month', coalesce(
              p_davr,
              (select max(a.oy) from public.t2_akt a where a.obyekt_id = p_obyekt_id and a.tur='f2' and a.holat='tasdiqlangan'),
              (select max(a.oy) from public.t2_akt a where a.obyekt_id = p_obyekt_id and a.tur='f2'),
              now()::date))::date;

  -- pending approved-change projection (migration 2/3 table; guarded)
  if to_regclass('public.t2_smeta_ozgarish') is not null then
    execute 'select coalesce(sum(delta_summa),0) from public.t2_smeta_ozgarish where obyekt_id=$1 and holat=''qoralama'''
      into v_pending using p_obyekt_id;
  end if;

  -- DETAIL (bounded): one indexed pass, per-row period-split from a bounded lateral
  select
    coalesce(jsonb_agg(r order by (r->>'tartib')::numeric, (r->>'qator_id')::bigint), '[]'::jsonb)
  into v_qatorlar
  from (
    select jsonb_build_object(
      'qator_id', q.id, 'tartib', q.tartib, 'kod', q.kod, 'nom', q.nom, 'birlik', q.birlik,
      'tur', q.tur, 'kat', q.kat, 'qoshimcha', q.qoshimcha, 'zamena', q.zamena,
      'smeta_hajm', q.hajm, 'smeta_narx', q.narx, 'smeta_summa', q.summa,
      'oldingi_hajm',  coalesce(p.oldingi_hajm,0),  'oldingi_summa',  coalesce(p.oldingi_summa,0),
      'joriy_hajm',    coalesce(p.joriy_hajm,0),    'joriy_summa',    coalesce(p.joriy_summa,0),
      'joriy_qoralama_summa', coalesce(p.joriy_qoralama_summa,0),
      'jami_hajm',  coalesce(p.oldingi_hajm,0) + coalesce(p.joriy_hajm,0),
      'jami_summa', coalesce(p.oldingi_summa,0) + coalesce(p.joriy_summa,0),
      'qoldiq_hajm',  coalesce(q.hajm,0) - (coalesce(p.oldingi_hajm,0) + coalesce(p.joriy_hajm,0)),
      'qoldiq_summa', coalesce(q.summa,0) - (coalesce(p.oldingi_summa,0) + coalesce(p.joriy_summa,0)),
      'jami_baseline_summa', coalesce(p.oldingi_baseline,0) + coalesce(p.joriy_baseline,0),
      'jami_actual_summa',   p.jami_actual_summa,
      'narx_variance_summa',
        (coalesce(p.oldingi_summa,0) + coalesce(p.joriy_summa,0))
        - (coalesce(p.oldingi_baseline,0) + coalesce(p.joriy_baseline,0)),
      'bajarilish_foiz', case when coalesce(q.hajm,0) <> 0
        then round((coalesce(p.oldingi_hajm,0) + coalesce(p.joriy_hajm,0)) / q.hajm * 100, 1) end
    ) as r
    from public.t2_qator q
    left join lateral (
      select
        sum(aq.hajm)  filter (where a.tur='f2' and a.holat='tasdiqlangan' and a.oy <  v_davr) as oldingi_hajm,
        sum(aq.summa) filter (where a.tur='f2' and a.holat='tasdiqlangan' and a.oy <  v_davr) as oldingi_summa,
        sum(aq.baseline_summa) filter (where a.tur='f2' and a.holat='tasdiqlangan' and a.oy < v_davr) as oldingi_baseline,
        sum(aq.hajm)  filter (where a.tur='f2' and a.holat='tasdiqlangan' and a.oy = v_davr) as joriy_hajm,
        sum(aq.summa) filter (where a.tur='f2' and a.holat='tasdiqlangan' and a.oy = v_davr) as joriy_summa,
        sum(aq.baseline_summa) filter (where a.tur='f2' and a.holat='tasdiqlangan' and a.oy = v_davr) as joriy_baseline,
        sum(aq.summa) filter (where a.tur='f2' and a.holat='qoralama' and a.oy = v_davr) as joriy_qoralama_summa,
        case when count(*) filter (where a.tur='f2' and a.holat='tasdiqlangan' and aq.actual_narx is null) > 0
             then null
             else sum(aq.hajm * aq.actual_narx) filter (where a.tur='f2' and a.holat='tasdiqlangan')
        end as jami_actual_summa
      from public.t2_akt_qator aq
      join public.t2_akt a on a.id = aq.akt_id and a.holat <> 'bekor'
      where aq.qator_id = q.id
    ) p on true
    where q.obyekt_id = p_obyekt_id
      and (not p_faqat_faol or coalesce(p.oldingi_hajm,0) <> 0 or coalesce(p.joriy_hajm,0) <> 0
           or coalesce(p.joriy_qoralama_summa,0) <> 0 or q.qoshimcha or q.zamena)
    order by q.tartib, q.id
    limit v_lim
  ) d;

  select count(*) into v_qcount from public.t2_qator where obyekt_id = p_obyekt_id;

  -- TOTALS (all rows): one aggregate, no per-row work
  with agg as (
    select
      coalesce(sum(q.summa),0) as smeta_summa,
      coalesce(sum(x.oldingi_summa),0) as oldingi_summa,
      coalesce(sum(x.joriy_summa),0)   as joriy_summa,
      coalesce(sum(x.joriy_qoralama_summa),0) as joriy_qoralama_summa,
      coalesce(sum(x.oldingi_summa),0) + coalesce(sum(x.joriy_summa),0) as jami_summa,
      coalesce(sum(x.oldingi_baseline),0) + coalesce(sum(x.joriy_baseline),0) as baseline_summa
    from public.t2_qator q
    left join lateral (
      select
        sum(aq.summa) filter (where a.tur='f2' and a.holat='tasdiqlangan' and a.oy <  v_davr) as oldingi_summa,
        sum(aq.baseline_summa) filter (where a.tur='f2' and a.holat='tasdiqlangan' and a.oy < v_davr) as oldingi_baseline,
        sum(aq.summa) filter (where a.tur='f2' and a.holat='tasdiqlangan' and a.oy = v_davr) as joriy_summa,
        sum(aq.baseline_summa) filter (where a.tur='f2' and a.holat='tasdiqlangan' and a.oy = v_davr) as joriy_baseline,
        sum(aq.summa) filter (where a.tur='f2' and a.holat='qoralama' and a.oy = v_davr) as joriy_qoralama_summa
      from public.t2_akt_qator aq
      join public.t2_akt a on a.id = aq.akt_id and a.holat <> 'bekor'
      where aq.qator_id = q.id
    ) x on true
    where q.obyekt_id = p_obyekt_id
  )
  select jsonb_build_object(
    'smeta_summa', smeta_summa,
    'oldingi_summa', oldingi_summa,
    'joriy_tasdiqlangan_summa', joriy_summa,
    'joriy_qoralama_summa', joriy_qoralama_summa,
    'jami_tasdiqlangan_summa', jami_summa,
    'qoldiq_summa', smeta_summa - jami_summa,
    'baseline_summa', baseline_summa,
    'narx_variance_summa', jami_summa - baseline_summa,
    'pending_ozgarish_delta', v_pending,
    'bajarilish_foiz', case when smeta_summa <> 0 then round(jami_summa / smeta_summa * 100, 1) end)
    into v_jami from agg;

  select coalesce(jsonb_agg(jsonb_build_object(
           'oy', to_char(a.oy,'YYYY-MM'), 'akt_id', a.id, 'raqam', a.raqam,
           'holat', a.holat, 'hujjat_jami', a.hujjat_jami, 'davr_muhr', a.davr_muhr,
           'revision_id', a.revision_id,
           'joriy', a.oy = v_davr, 'oldingi', a.oy < v_davr,
           'certified', a.holat = 'tasdiqlangan') order by a.oy, a.id), '[]'::jsonb)
    into v_davrlar
  from public.t2_akt a where a.obyekt_id = p_obyekt_id and a.tur = 'f2' and a.holat <> 'bekor';

  return jsonb_build_object(
    'ok', true, 'generated_at', now(),
    'obyekt', jsonb_build_object('id', p_obyekt_id, 'nom', v_obnom, 'kompaniya_id', v_komp, 'loyiha_id', v_loyiha),
    'davr', to_char(v_davr,'YYYY-MM'),
    'joriy_revision_id', (select id from public.t2_smeta_revision where obyekt_id=p_obyekt_id order by seq desc limit 1),
    'qatorlar', v_qatorlar,
    'qatorlar_jami', v_qcount,
    'qatorlar_korsatildi', jsonb_array_length(v_qatorlar),
    'truncated', jsonb_array_length(v_qatorlar) >= v_lim,
    'jami', v_jami,
    'davrlar', v_davrlar);
end $$;

revoke all on function public.t2_nakopitelniy_v1(bigint,bigint,date,integer,boolean) from public, anon, authenticated;
revoke all on function public.t2_akt_qator_baseline_backfill_v1() from public, anon, authenticated;
revoke all on function public.t2_smeta_baseline_kafolat_v1(bigint,bigint) from public, anon, authenticated;

comment on function public.t2_nakopitelniy_v1(bigint,bigint,date,integer,boolean) is
  'SMETA/F2 CONTROL: bounded STABLE period-aware cumulative statement. Cumulative = APPROVED F2 only; draft & pending-change kept separate. Frozen-baseline price variance. Detail paginated, totals over all rows. Membership-checked; no Drive/Sheets/GAS.';

commit;
