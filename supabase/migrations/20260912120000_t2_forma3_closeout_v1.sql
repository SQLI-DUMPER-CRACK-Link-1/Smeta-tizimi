-- SMETA/F2/NAKOPITELNIY 3/3 — Forma-3 (UNRESOLVED boundary) + project closeout control
-- SOURCE ONLY — NOT applied to production by this task. Depends on 20260910/20260911120000.
--
-- Generic (project-agnostic). Binds through kompaniya_id / loyiha_id / obyekt_id /
-- shartnoma_id / akt_id / document_id. No park-specific rule is hard-coded.
--
-- ═══ FORMA-3 IS DELIBERATELY UNRESOLVED ═══
-- No authoritative Forma-3 (КС-3 / country pack / approved template) legal rule
-- is evidenced. t2_forma3 is a THIN period container that links approved F2
-- (КС-2) acts and records the FACT `bajarilgan_f2_summa` (Σ approved F2 line
-- sums in the period). It has NO markup / tax / payment-due / legal-total column
-- and computes none. `qoida_holat` stays 'FORMA3_RULE_UNRESOLVED' until
-- t2_forma3_qoida_belgila_v1 is given a verified evidence reference — and even
-- then this migration adds no legal formula (a future reviewed migration does,
-- once the rule is known).

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Closeout requirement pack — CONFIG/DATA driven (not hard-coded rules)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.t2_yakunlash_talab (
  id            bigint generated always as identity primary key,
  kompaniya_id  bigint,     -- null = global default pack
  loyiha_id     bigint,     -- null = applies company-wide; set = project override
  turi          text not null check (turi in ('contract','f2','nakopitelniy','aosr','act','invoice','handover','change_evidence','forma3')),
  nom           text not null,
  majburiy      boolean not null default true,
  tasdiq_kerak  boolean not null default true,   -- requires an APPROVED document
  evidence_rule text check (evidence_rule is null or evidence_rule in ('verified','forma3_unresolved')),
  tartib        integer not null default 100,
  faol          boolean not null default true,
  yaratildi     timestamptz not null default now()
);
create index if not exists t2_yakunlash_talab_scope_ix on public.t2_yakunlash_talab (coalesce(kompaniya_id,0), coalesce(loyiha_id,0), faol);
alter table public.t2_yakunlash_talab enable row level security;

insert into public.t2_yakunlash_talab (kompaniya_id, loyiha_id, turi, nom, majburiy, tasdiq_kerak, evidence_rule, tartib) values
  (null, null, 'contract',     'Tasdiqlangan shartnoma',        true,  true,  'verified',          10),
  (null, null, 'f2',           'Har davr uchun tasdiqlangan Ф2', true, true,  'verified',          20),
  (null, null, 'nakopitelniy', 'Nakopitelniy vedomost',          true, true,  'verified',          30),
  (null, null, 'aosr',         'AOSR / yashirin ishlar dalolatnomalari', true, true, 'verified',   40),
  (null, null, 'change_evidence','Har tasdiqlangan o''zgarish uchun hujjat', true, true, 'verified', 50),
  (null, null, 'forma3',       'Forma-3 (qonuniy qoida aniqlanmagan)', false, false, 'forma3_unresolved', 90)
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Forma-3 — thin period value certificate container (UNRESOLVED)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.t2_forma3 (
  id            bigint generated always as identity primary key,
  kompaniya_id  bigint not null,
  loyiha_id     bigint,
  obyekt_id     bigint,             -- null = whole-project certificate
  shartnoma_id  bigint,
  raqam         text,
  davr_boshi    date not null,
  davr_oxiri    date not null,
  holat         text not null default 'qoralama' check (holat in ('qoralama','tayyor','imzolangan','bekor')),
  -- ── the ONLY numeric field: a FACT, not a legal total ──
  bajarilgan_f2_summa numeric not null default 0,
  -- ── the unresolved-rule guard ──
  qoida_holat   text not null default 'FORMA3_RULE_UNRESOLVED'
                check (qoida_holat in ('FORMA3_RULE_UNRESOLVED','FORMA3_RULE_MAPPED')),
  qoida_manba   text,               -- verified evidence ref; required to leave UNRESOLVED
  izoh          text,
  versiya       integer not null default 1,
  operation_id  uuid,
  actor_id      bigint,
  yaratildi     timestamptz not null default now(),
  yangilandi    timestamptz not null default now(),
  check (davr_oxiri >= davr_boshi)
);
create index if not exists t2_forma3_scope_ix on public.t2_forma3 (loyiha_id, obyekt_id, holat);
create unique index if not exists t2_forma3_op_uq on public.t2_forma3 (operation_id) where operation_id is not null;

create table if not exists public.t2_forma3_akt (
  forma3_id bigint not null references public.t2_forma3(id) on delete cascade,
  akt_id    bigint not null,
  primary key (forma3_id, akt_id)
);

alter table public.t2_forma3      enable row level security;
alter table public.t2_forma3_akt  enable row level security;

comment on table public.t2_forma3 is
  'SMETA/F2 CONTROL: Forma-3 period certificate — UNRESOLVED legal boundary. Links approved F2 (КС-2) acts + the FACT bajarilgan_f2_summa. NO markup/tax/payment/legal-total column or formula. qoida_holat=FORMA3_RULE_UNRESOLVED until a verified rule source is mapped.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Commands
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.t2_forma3_yarat_v1(
  p_actor_id bigint, p_loyiha_id bigint, p_obyekt_id bigint, p_shartnoma_id bigint,
  p_davr_boshi date, p_davr_oxiri date, p_akt_ids bigint[], p_raqam text, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_komp bigint; v_rol text; v_id bigint; v_summa numeric := 0; v_n integer := 0;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  select id into v_id from public.t2_forma3 where operation_id = p_operation_id;
  if found then return jsonb_build_object('ok',true,'takror',true,'forma3_id',v_id); end if;

  if p_loyiha_id is not null then
    select kompaniya_id into v_komp from public.t2_loyiha where id = p_loyiha_id;
  elsif p_obyekt_id is not null then
    select kompaniya_id, loyiha_id into v_komp, p_loyiha_id from public.t2_obyekt where id = p_obyekt_id;
  end if;
  if v_komp is null then return jsonb_build_object('ok',false,'code','SCOPE_NOT_FOUND'); end if;
  v_rol := public.t2_actor_kompaniya_azo_tekshir(v_komp, p_actor_id);
  if v_rol not in ('boss','superadmin','rahbar','bugalter') then
    return jsonb_build_object('ok',false,'code','FORMA3_DENIED');
  end if;
  if p_akt_ids is null or array_length(p_akt_ids,1) is null then
    return jsonb_build_object('ok',false,'code','FORMA3_AKT_REQUIRED');
  end if;
  -- every linked act must be an APPROVED F2 in scope + in the period
  if exists (
    select 1 from unnest(p_akt_ids) aid
    left join public.t2_akt a on a.id = aid
    where a.id is null or a.tur <> 'f2' or a.holat <> 'tasdiqlangan'
       or a.kompaniya_id <> v_komp
       or (p_obyekt_id is not null and a.obyekt_id <> p_obyekt_id)
       or a.oy < date_trunc('month', p_davr_boshi) or a.oy > date_trunc('month', p_davr_oxiri)
  ) then
    return jsonb_build_object('ok',false,'code','FORMA3_AKT_INVALID',
      'xato','Har akt: tasdiqlangan Ф2, shu scope va davr ichida bo''lishi kerak');
  end if;

  select coalesce(sum(aq.summa),0), count(distinct a.id)
    into v_summa, v_n
  from public.t2_akt a join public.t2_akt_qator aq on aq.akt_id = a.id
  where a.id = any(p_akt_ids);

  insert into public.t2_forma3
    (kompaniya_id, loyiha_id, obyekt_id, shartnoma_id, raqam, davr_boshi, davr_oxiri,
     holat, bajarilgan_f2_summa, qoida_holat, operation_id, actor_id)
  values (v_komp, p_loyiha_id, p_obyekt_id, p_shartnoma_id, p_raqam, p_davr_boshi, p_davr_oxiri,
     'qoralama', v_summa, 'FORMA3_RULE_UNRESOLVED', p_operation_id, p_actor_id)
  returning id into v_id;

  insert into public.t2_forma3_akt (forma3_id, akt_id) select v_id, unnest(p_akt_ids);
  update public.t2_akt set forma3_id = v_id where id = any(p_akt_ids);

  perform public.t2_audit_yoz(v_komp, 'forma3_yarat', 'smeta', p_obyekt_id,
    format('forma3_id=%s davr=%s..%s aktlar=%s f2_summa=%s', v_id, p_davr_boshi, p_davr_oxiri, v_n, round(v_summa,2)),
    'actor:'||p_actor_id, null);

  return jsonb_build_object('ok',true,'takror',false,'forma3_id',v_id,
    'bajarilgan_f2_summa',v_summa,'aktlar',v_n,
    'qoida_holat','FORMA3_RULE_UNRESOLVED',
    'izoh','Forma-3 qonuniy jami/soliq/to''lov HISOBLANMADI — qoida manbai aniqlanmagan.');
end $$;

-- Map a verified Forma-3 rule source. Does NOT compute a legal total here — it
-- only lifts the guard so a future reviewed migration may.
create or replace function public.t2_forma3_qoida_belgila_v1(
  p_forma3_id bigint, p_actor_id bigint, p_qoida_manba text, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare f public.t2_forma3%rowtype; v_rol text;
begin
  select * into f from public.t2_forma3 where id = p_forma3_id for update;
  if not found then return jsonb_build_object('ok',false,'code','FORMA3_NOT_FOUND'); end if;
  v_rol := public.t2_actor_kompaniya_azo_tekshir(f.kompaniya_id, p_actor_id);
  if v_rol not in ('boss','superadmin') then return jsonb_build_object('ok',false,'code','FORMA3_RULE_DENIED'); end if;
  if coalesce(btrim(p_qoida_manba),'') = '' then
    return jsonb_build_object('ok',false,'code','FORMA3_EVIDENCE_REQUIRED',
      'xato','Tasdiqlangan shablon + davlat/shartnoma paketi havolasi majburiy');
  end if;
  update public.t2_forma3
     set qoida_holat = 'FORMA3_RULE_MAPPED', qoida_manba = btrim(p_qoida_manba),
         versiya = versiya + 1, yangilandi = now()
   where id = p_forma3_id;
  perform public.t2_audit_yoz(f.kompaniya_id, 'forma3_qoida_belgila', 'smeta', f.obyekt_id,
    format('forma3_id=%s manba=%s', p_forma3_id, btrim(p_qoida_manba)), 'actor:'||p_actor_id, null);
  return jsonb_build_object('ok',true,'forma3_id',p_forma3_id,'qoida_holat','FORMA3_RULE_MAPPED',
    'izoh','Qoida manbai qayd etildi. Qonuniy hisob-kitob hali qo''shilmagan (alohida ko''rib chiqiladigan migratsiya).');
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Project/object CLOSEOUT read model -> ParkCloseoutReadModel shape
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.t2_obyekt_yakunlash_v1(p_obyekt_id bigint, p_actor_id bigint)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  v_komp bigint; v_loyiha bigint; v_rol text; v_nom text;
  v_docs jsonb; v_reqs jsonb; v_periods jsonb; v_forma3 jsonb; v_blockers jsonb;
begin
  select kompaniya_id, loyiha_id, nom into v_komp, v_loyiha, v_nom from public.t2_obyekt where id = p_obyekt_id;
  if v_komp is null then return jsonb_build_object('ok',false,'code','OBYEKT_NOT_FOUND'); end if;
  v_rol := public.t2_actor_kompaniya_azo_tekshir(v_komp, p_actor_id);

  -- effective requirement pack: project override > company > global default
  select coalesce(jsonb_agg(jsonb_build_object(
           'requirementId', 'req-'||t.id, 'type', t.turi, 'label', t.nom,
           'required', t.majburiy, 'requiresApproved', t.tasdiq_kerak, 'evidenceRule', t.evidence_rule
         ) order by t.tartib), '[]'::jsonb)
    into v_reqs
  from (
    select distinct on (turi) *
    from public.t2_yakunlash_talab
    where faol
      and (kompaniya_id is null or kompaniya_id = v_komp)
      and (loyiha_id is null or loyiha_id = v_loyiha)
    order by turi, (loyiha_id is not null) desc, (kompaniya_id is not null) desc, tartib
  ) t;

  -- documents: F2/fakt acts + AOSR + contracts + forma3, mapped to CloseoutDocumentMetadata
  select coalesce(jsonb_agg(d order by (d->>'documentId')), '[]'::jsonb) into v_docs from (
    select jsonb_build_object('documentId','akt-'||a.id, 'objectId', p_obyekt_id::text, 'type',
             case a.tur when 'f2' then 'f2' else 'act' end,
             'status', case a.holat when 'tasdiqlangan' then 'approved' when 'bekor' then 'rejected' else 'pending' end,
             'periodId', to_char(a.oy,'YYYY-MM'), 'revisionId', 'rev-'||coalesce(a.revision_id::text,'0')) d
    from public.t2_akt a where a.obyekt_id = p_obyekt_id and a.tur in ('f2','fakt')
    union all
    select jsonb_build_object('documentId','aosr-'||s.id, 'objectId', p_obyekt_id::text, 'type','aosr',
             'status', case s.holat when 'tasdiqlangan' then 'approved' when 'rad' then 'rejected'
                                    when 'imzolangan' then 'approved' else 'pending' end) d
    from public.t2_aosr s where s.obyekt_id = p_obyekt_id
    union all
    select jsonb_build_object('documentId','shartnoma-'||c.id, 'objectId', p_obyekt_id::text, 'type','contract',
             'status', case c.holat when 'faol' then 'approved' when 'bekor' then 'superseded' else 'pending' end) d
    from public.t2_shartnoma c where c.loyiha_id = v_loyiha
    union all
    select jsonb_build_object('documentId','forma3-'||f.id, 'objectId', p_obyekt_id::text, 'type','forma3',
             'status', case when f.qoida_holat = 'FORMA3_RULE_UNRESOLVED' then 'pending'
                            when f.holat = 'imzolangan' then 'approved' else 'pending' end) d
    from public.t2_forma3 f where f.obyekt_id = p_obyekt_id or (f.loyiha_id = v_loyiha and f.obyekt_id is null)
    union all
    select jsonb_build_object('documentId','change-'||o.id, 'objectId', p_obyekt_id::text, 'type','change_evidence',
             'status', case when o.holat = 'tasdiqlangan' and o.evidence_hujjat_id is not null then 'approved'
                            when o.holat = 'tasdiqlangan' then 'pending' else 'pending' end,
             'evidenceIds', case when o.evidence_hujjat_id is not null then jsonb_build_array('hujjat-'||o.evidence_hujjat_id) else '[]'::jsonb end) d
    from public.t2_smeta_ozgarish o where o.obyekt_id = p_obyekt_id and o.holat = 'tasdiqlangan'
  ) s;

  -- export periods: one per approved F2 month, previous/current/cumulative + entitlement
  select coalesce(jsonb_agg(p order by (p->>'periodId')), '[]'::jsonb) into v_periods from (
    select jsonb_build_object(
      'periodId', to_char(a.oy,'YYYY-MM'),
      'revisionId', 'rev-'||coalesce(max(a.revision_id)::text,'0'),
      'frozen', bool_and(a.davr_muhr) or bool_and(a.holat = 'tasdiqlangan'),
      'previousQuantity', 0, 'currentQuantity', coalesce(sum(aq.hajm),0),
      'cumulativeQuantity', coalesce(sum(aq.hajm),0),
      'approvedQuantity', (select coalesce(sum(q.hajm),0) from public.t2_qator q where q.obyekt_id = p_obyekt_id),
      'previousValue', 0, 'currentValue', coalesce(sum(aq.summa),0),
      'cumulativeValue', coalesce(sum(aq.summa),0),
      'approvedValue', (select coalesce(sum(q.summa),0) from public.t2_qator q where q.obyekt_id = p_obyekt_id),
      'referencePriceSourceId', 'baseline-rev-'||coalesce(max(a.revision_id)::text,'0'),
      'actualPriceSourceId', case when bool_or(aq.actual_narx is not null) then 'actual-'||to_char(a.oy,'YYYYMM') else null end,
      'approvedChangeIds', '[]'::jsonb, 'includedApprovedChangeIds', '[]'::jsonb) p
    from public.t2_akt a join public.t2_akt_qator aq on aq.akt_id = a.id
    where a.obyekt_id = p_obyekt_id and a.tur = 'f2' and a.holat = 'tasdiqlangan'
    group by a.oy
  ) s;

  select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'raqam', f.raqam,
           'davr', to_char(f.davr_boshi,'YYYY-MM')||'..'||to_char(f.davr_oxiri,'YYYY-MM'),
           'holat', f.holat, 'qoida_holat', f.qoida_holat, 'bajarilgan_f2_summa', f.bajarilgan_f2_summa)
         order by f.davr_boshi), '[]'::jsonb) into v_forma3
  from public.t2_forma3 f where f.obyekt_id = p_obyekt_id or (f.loyiha_id = v_loyiha and f.obyekt_id is null);

  return jsonb_build_object(
    'ok', true, 'generated_at', now(),
    'objectId', p_obyekt_id::text, 'obyekt_nom', v_nom, 'loyiha_id', v_loyiha, 'kompaniya_id', v_komp,
    'documents', v_docs,
    'requirements', v_reqs,
    'exportPeriods', v_periods,
    'forma3', v_forma3,
    'forma3_unresolved', exists (select 1 from public.t2_forma3 f
       where (f.obyekt_id = p_obyekt_id or (f.loyiha_id = v_loyiha and f.obyekt_id is null))
         and f.qoida_holat = 'FORMA3_RULE_UNRESOLVED'));
end $$;

create or replace function public.t2_forma3_royxat_v1(p_loyiha_id bigint, p_obyekt_id bigint, p_actor_id bigint)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_komp bigint; v_rol text; v_rows jsonb;
begin
  if p_obyekt_id is not null then select kompaniya_id, loyiha_id into v_komp, p_loyiha_id from public.t2_obyekt where id = p_obyekt_id;
  elsif p_loyiha_id is not null then select kompaniya_id into v_komp from public.t2_loyiha where id = p_loyiha_id; end if;
  if v_komp is null then return jsonb_build_object('ok',false,'code','SCOPE_NOT_FOUND'); end if;
  v_rol := public.t2_actor_kompaniya_azo_tekshir(v_komp, p_actor_id);
  select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'raqam', f.raqam, 'obyekt_id', f.obyekt_id,
           'davr_boshi', f.davr_boshi, 'davr_oxiri', f.davr_oxiri, 'holat', f.holat,
           'qoida_holat', f.qoida_holat, 'qoida_manba', f.qoida_manba,
           'bajarilgan_f2_summa', f.bajarilgan_f2_summa,
           'aktlar', (select coalesce(jsonb_agg(x.akt_id), '[]'::jsonb) from public.t2_forma3_akt x where x.forma3_id = f.id)
         ) order by f.davr_boshi desc), '[]'::jsonb) into v_rows
  from public.t2_forma3 f
  where (p_obyekt_id is not null and f.obyekt_id = p_obyekt_id)
     or (p_obyekt_id is null and f.loyiha_id = p_loyiha_id);
  return jsonb_build_object('ok',true,'forma3lar',v_rows,
    'unresolved_soni', (select count(*) from public.t2_forma3 f
      where ((p_obyekt_id is not null and f.obyekt_id = p_obyekt_id) or (p_obyekt_id is null and f.loyiha_id = p_loyiha_id))
        and f.qoida_holat = 'FORMA3_RULE_UNRESOLVED'));
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. WORKBENCH aggregate -> ConstructionDocumentControlReadModel (generic)
--    One bounded call: valuation input (lines/changes/periods) + requirements +
--    documents + revision timeline. The pure engine (frontend) does the math.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.t2_workbench_v1(
  p_obyekt_id bigint, p_actor_id bigint, p_davr date default null,
  p_limit integer default 800)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  v_komp bigint; v_loyiha bigint; v_rol text; v_nom text; v_loyiha_nom text;
  v_lim integer := least(greatest(coalesce(p_limit,800),1),3000);
  v_davrlar date[]; v_through integer; v_cur_rev bigint;
  v_lines jsonb; v_changes jsonb; v_periods jsonb; v_revisions jsonb;
  v_yakun jsonb;
begin
  select o.kompaniya_id, o.loyiha_id, o.nom, l.nom
    into v_komp, v_loyiha, v_nom, v_loyiha_nom
  from public.t2_obyekt o left join public.t2_loyiha l on l.id = o.loyiha_id
  where o.id = p_obyekt_id;
  if v_komp is null then return jsonb_build_object('ok',false,'code','OBYEKT_NOT_FOUND'); end if;
  v_rol := public.t2_actor_kompaniya_azo_tekshir(v_komp, p_actor_id);

  -- ordered list of approved-F2 period months
  select array_agg(oy order by oy) into v_davrlar
  from (select distinct date_trunc('month', a.oy)::date oy
        from public.t2_akt a where a.obyekt_id = p_obyekt_id and a.tur = 'f2' and a.holat = 'tasdiqlangan') s;
  v_davrlar := coalesce(v_davrlar, array[]::date[]);
  if array_length(v_davrlar,1) is null then
    v_through := 0;
  else
    v_through := coalesce(
      array_position(v_davrlar, date_trunc('month', coalesce(p_davr, v_davrlar[array_length(v_davrlar,1)]))::date) - 1,
      array_length(v_davrlar,1) - 1);
  end if;
  select id into v_cur_rev from public.t2_smeta_revision where obyekt_id = p_obyekt_id order by seq desc limit 1;

  -- lines (bounded): baseline reference quantity + price from t2_qator leaves
  select coalesce(jsonb_agg(x order by (x->>'_tartib')::numeric), '[]'::jsonb) into v_lines from (
    select jsonb_build_object('lineId', q.id::text, 'sectionId', coalesce(q.ota_id::text,'root'),
      'description', q.nom, 'unit', coalesce(q.birlik,''),
      'baselineQuantity', coalesce(q.hajm,0), 'baselineReferencePrice', coalesce(q.narx,0),
      '_tartib', q.tartib) x
    from public.t2_qator q
    where q.obyekt_id = p_obyekt_id and q.tur in ('rs','mat','ob')
    order by q.tartib, q.id limit v_lim) s;

  -- changes: map holat -> engine status; effectivePeriodIndex from effective_oy
  select coalesce(jsonb_agg(jsonb_build_object(
      'changeId', o.id::text, 'kind',
        case o.tur when 'almashtirish' then 'substitution' when 'qoshimcha_ish' then 'additional_work'
             when 'olib_tashlash' then 'removal' when 'hajm_ozgarish' then 'quantity_increase'
             when 'yangi_bolim' then 'new_section' when 'yangi_ish' then 'new_item'
             when 'resurs_almashtirish' then 'resource_replacement' else 'additional_work' end,
      'status', case o.holat when 'tasdiqlangan' then 'approved' when 'qoralama' then 'pending' else 'rejected' end,
      'lineId', coalesce((select z.qator_id::text from public.t2_smeta_ozgarish_qator z
                          where z.ozgarish_id = o.id and z.qator_id is not null limit 1),
                         (select z.yangi_qator_id::text from public.t2_smeta_ozgarish_qator z
                          where z.ozgarish_id = o.id and z.yangi_qator_id is not null limit 1), 'na'),
      'revisionId', 'rev-'||coalesce(o.natija_revision_id::text,'pending'),
      'effectivePeriodIndex', coalesce(array_position(v_davrlar, date_trunc('month', o.effective_oy)::date) - 1, 0),
      'quantityDelta', coalesce((select sum(coalesce(z.yangi_hajm,0) - coalesce(z.eski_hajm,0))
                                 from public.t2_smeta_ozgarish_qator z where z.ozgarish_id = o.id), 0),
      'reason', coalesce(o.sabab,''),
      'evidenceIds', case when o.evidence_hujjat_id is not null then jsonb_build_array('hujjat-'||o.evidence_hujjat_id) else '[]'::jsonb end,
      'actorId', o.actor_id::text
    ) order by o.yaratildi), '[]'::jsonb) into v_changes
  from public.t2_smeta_ozgarish o where o.obyekt_id = p_obyekt_id;

  -- periods: approved F2 by month -> CertifiedPeriod with per-line certified rows
  select coalesce(jsonb_agg(p order by (p->>'_oy')), '[]'::jsonb) into v_periods from (
    select jsonb_build_object(
      'periodId', to_char(a.oy,'YYYY-MM'), 'label', to_char(a.oy,'YYYY-MM'),
      'revisionId', 'rev-'||coalesce(max(a.revision_id)::text,'0'), 'frozen', true,
      'documentIds', jsonb_agg(distinct 'akt-'||a.id),
      'lines', jsonb_agg(jsonb_build_object(
        'lineId', aq.qator_id::text, 'quantity', aq.hajm,
        'f2ValuationPrice', aq.narx, 'actualProcurementPrice', aq.actual_narx,
        'referencePriceSourceId', 'baseline-'||coalesce(aq.revision_id::text,'0'),
        'actualPriceSourceId', case when aq.actual_narx is not null
          then coalesce(aq.narx_manba,'qol')||'-'||coalesce(aq.narx_manba_id::text,'?') else null end)),
      '_oy', a.oy) p
    from public.t2_akt a join public.t2_akt_qator aq on aq.akt_id = a.id
    where a.obyekt_id = p_obyekt_id and a.tur = 'f2' and a.holat = 'tasdiqlangan'
    group by a.oy) s;

  -- revision timeline
  select coalesce(jsonb_agg(jsonb_build_object(
      'revisionId', 'rev-'||r.id, 'kind', case when r.seq = 0 then 'baseline' else 'change' end,
      'status', case when r.seq = 0 then 'certified' else 'approved' end,
      'actorId', r.actor_id::text, 'occurredAt', r.yaratildi, 'reason', coalesce(r.izoh,''),
      'evidenceIds', '[]'::jsonb, 'immutable', true) order by r.seq), '[]'::jsonb) into v_revisions
  from public.t2_smeta_revision r where r.obyekt_id = p_obyekt_id;

  -- requirements + documents (reuse closeout logic)
  v_yakun := public.t2_obyekt_yakunlash_v1(p_obyekt_id, p_actor_id);

  return jsonb_build_object(
    'ok', true, 'generated_at', now(),
    'projectId', v_loyiha::text, 'objectId', p_obyekt_id::text,
    'projectName', coalesce(v_loyiha_nom,''), 'objectName', v_nom,
    'currentPeriodId', case when array_length(v_davrlar,1) is not null
      then to_char(v_davrlar[v_through + 1],'YYYY-MM') else null end,
    'valuation', jsonb_build_object(
      'projectId', v_loyiha::text, 'objectId', p_obyekt_id::text,
      'estimateRevisionId', 'rev-'||coalesce(v_cur_rev::text,'0'),
      'currency', 'UZS', 'throughPeriod', v_through,
      'lines', (select coalesce(jsonb_agg(l - '_tartib'), '[]'::jsonb) from jsonb_array_elements(v_lines) l),
      'changes', v_changes,
      'periods', (select coalesce(jsonb_agg(pp - '_oy'), '[]'::jsonb) from jsonb_array_elements(v_periods) pp)),
    'requirements', v_yakun->'requirements',
    'documents', v_yakun->'documents',
    'revisions', v_revisions,
    'lines_truncated', jsonb_array_length(v_lines) >= v_lim,
    'forma3_unresolved', v_yakun->'forma3_unresolved');
end $$;

revoke all on function public.t2_forma3_yarat_v1(bigint,bigint,bigint,bigint,date,date,bigint[],text,uuid) from public, anon, authenticated;
revoke all on function public.t2_forma3_qoida_belgila_v1(bigint,bigint,text,uuid) from public, anon, authenticated;
revoke all on function public.t2_obyekt_yakunlash_v1(bigint,bigint) from public, anon, authenticated;
revoke all on function public.t2_forma3_royxat_v1(bigint,bigint,bigint) from public, anon, authenticated;
revoke all on function public.t2_workbench_v1(bigint,bigint,date,integer) from public, anon, authenticated;

comment on function public.t2_workbench_v1(bigint,bigint,date,integer) is
  'SMETA/F2 CONTROL: one bounded aggregate for the generic construction-document-control workbench (ConstructionDocumentControlReadModel). Membership-checked; no Drive/Sheets/GAS; pure-engine math is client-side.';

commit;
