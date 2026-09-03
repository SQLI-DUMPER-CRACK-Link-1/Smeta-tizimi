-- T2-REAL-PARK-LRV-VERTICAL-SLICE-004 -- Price Control (Sections 3-8).
-- Reconciled with codex/t2-lrv-price-control-core-v1 (5d0bff1) -- see
-- ops/handoff/T2_REAL_PARK_LRV_VERTICAL_SLICE_004.md Section 0/4-7.
-- SOURCE ONLY. Production freeze active -- NOT applied in this task.
--
-- NOT procurement saving. Two distinct comparisons, per the owner's own
-- worked examples (kept literally, not re-derived):
--   1. certified_unit_price vs REFERENCE (the frozen smeta baseline
--      snapshot, t2_akt_qator.baseline_narx, captured at F2-creation
--      time -- reused, not duplicated) -- drives BELOW_REFERENCE/NORMAL/
--      "above reference" and FROZEN_AMOUNT / AT_RISK_AMOUNT.
--   2. When certified is ABOVE reference, a SEPARATE approved price
--      basis (protocol/change/agreement) is checked as a ceiling:
--      certified <= approved basis price -> JUSTIFIED; certified >
--      approved basis price -> EXCEEDED (ABOVE_APPROVED_BASIS); no basis
--      at all -> BASIS_MISSING.
-- (A basis is never treated as replacing "reference" for the delta/
-- frozen/at-risk numbers -- an approved smeta price CHANGE already
-- updates t2_qator.narx, hence baseline_narx, through the existing
-- governed t2_smeta_ozgarish engine; t2_price_basis's distinct job is
-- the above-reference justification ceiling, not a second reference
-- price.)
--
-- Reconciliation with codex/t2-lrv-price-control-core-v1: ACCEPT_CODEX
-- the two-table basis/basis_line shape (one document can cover several
-- lines) and the PriceState vocabulary
-- (NORMAL/BELOW_REFERENCE/ABOVE_REFERENCE_JUSTIFIED/
-- ABOVE_REFERENCE_MISSING_BASIS/ABOVE_APPROVED_BASIS). ADAPT: Codex's
-- own one-line classifyCertifiedPrice() has a reachability gap (its
-- ABOVE_REFERENCE_JUSTIFIED branch is unreachable given how it folds the
-- basis price into "reference" before comparing) -- this migration
-- keeps the basis as a SEPARATE ceiling check instead, verified against
-- every worked example in the task (Section 18/Section 7 of both
-- steering messages) rather than ported as-is.

begin;

-- ── Canonical basis relation (Section 7), adopted from Codex ──────────
create table if not exists public.t2_price_basis (
  id bigint generated always as identity primary key,
  kompaniya_id bigint not null references public.t2_kompaniya(id),
  document_id bigint,
  basis_type text not null,
  holat text not null default 'qoralama',
  versiya integer not null default 1,
  operation_id uuid unique,
  actor_id bigint references public.t2_foydalanuvchi(id),
  yaratildi timestamptz not null default now()
);
create table if not exists public.t2_price_basis_line (
  id bigint generated always as identity primary key,
  basis_id bigint not null references public.t2_price_basis(id),
  qator_id bigint not null references public.t2_qator(id),
  approved_price numeric not null,
  valid_from date,
  valid_to date,
  unique (basis_id, qator_id)
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 't2_price_basis_type_ck') then
    alter table public.t2_price_basis add constraint t2_price_basis_type_ck
      check (basis_type in ('PRICE_AGREEMENT_PROTOCOL','APPROVED_CHANGE','ADDITIONAL_AGREEMENT','OTHER_APPROVED_PRICE_BASIS'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 't2_price_basis_holat_ck') then
    alter table public.t2_price_basis add constraint t2_price_basis_holat_ck
      check (holat in ('qoralama','tasdiqlangan','bekor'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 't2_price_basis_line_range_ck') then
    alter table public.t2_price_basis_line add constraint t2_price_basis_line_range_ck
      check (valid_to is null or valid_from is null or valid_to >= valid_from);
  end if;
end $$;
create index if not exists t2_price_basis_line_qator_idx on public.t2_price_basis_line (qator_id, valid_from desc);

alter table public.t2_price_basis enable row level security;
alter table public.t2_price_basis_line enable row level security;
revoke all on public.t2_price_basis, public.t2_price_basis_line from public, anon, authenticated;

comment on table public.t2_price_basis is
  'T2-REAL-PARK-LRV-VERTICAL-SLICE-004 Section 7: header for a price-justification document (e.g. Протокол согласования цены). No hardcoded legal claim -- Contract Pack / Company Rules decide what blocks a certification, this table only records what basis exists. NOT a replacement reference price -- see migration header.';
comment on table public.t2_price_basis_line is
  'One smeta line covered by a basis document: the approved ceiling price and its validity window.';

-- ── Frozen basis-ceiling snapshot on t2_akt_qator ──────────────────────
-- Written ONCE by t2_akt_yarat_v2 at F2-creation time: which basis line
-- (if any) was valid THEN, and its approved price AT THAT TIME (snapshot,
-- not a live FK-join value -- a basis_line could theoretically be edited
-- later, and historical justification must not silently change).
-- baseline_narx (existing column, already frozen at write time) remains
-- THE reference price -- not duplicated here.
alter table public.t2_akt_qator
  add column if not exists reference_basis_line_id bigint references public.t2_price_basis_line(id),
  add column if not exists basis_approved_price_snapshot numeric;

-- Extend the certified-freeze trigger (from 20260920120000) to also
-- cover the basis snapshot and baseline_narx itself -- once approved,
-- nothing this comparison depends on may change.
create or replace function public.t2_akt_qator_certified_freeze_v1()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if exists (
    select 1 from public.t2_akt a
    where a.id = old.akt_id and a.tur = 'f2' and a.holat = 'tasdiqlangan'
  ) and (new.certified_quantity, new.certified_unit_price, new.certified_amount,
          new.provenance_status, new.certified_source_hash,
          new.baseline_narx, new.reference_basis_line_id, new.basis_approved_price_snapshot)
      is distinct from
         (old.certified_quantity, old.certified_unit_price, old.certified_amount,
          old.provenance_status, old.certified_source_hash,
          old.baseline_narx, old.reference_basis_line_id, old.basis_approved_price_snapshot) then
    raise exception using errcode = '23514', message = 'APPROVED_F2_CERTIFIED_FROZEN';
  end if;
  return new;
end
$function$;

-- ── Write command: record a price basis document + its lines (idempotent, audited) ──
create or replace function public.t2_price_basis_yarat_v1(
  p_actor_id bigint,
  p_kompaniya_id bigint,
  p_basis_type text,
  p_lines jsonb, -- [{qator_id, approved_price, valid_from?, valid_to?}, ...]
  p_document_id bigint default null,
  p_operation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_prev jsonb; v_basis_id bigint; v_bad jsonb;
begin
  if p_operation_id is null then return jsonb_build_object('ok', false, 'code', 'OPERATION_ID_REQUIRED'); end if;
  select natija into v_prev from public.t2_kompaniya_command_log where operation_id = p_operation_id;
  if found then return v_prev; end if;

  perform public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id, p_actor_id);
  if p_basis_type not in ('PRICE_AGREEMENT_PROTOCOL','APPROVED_CHANGE','ADDITIONAL_AGREEMENT','OTHER_APPROVED_PRICE_BASIS') then
    return jsonb_build_object('ok', false, 'code', 'BASIS_TYPE_INVALID');
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    return jsonb_build_object('ok', false, 'code', 'BASIS_LINES_REQUIRED');
  end if;
  select jsonb_agg(x->>'qator_id') into v_bad from jsonb_array_elements(p_lines) x
    where nullif(x->>'qator_id', '') is null or nullif(x->>'approved_price', '') is null;
  if v_bad is not null then
    return jsonb_build_object('ok', false, 'code', 'BASIS_LINE_INVALID', 'qatorlar', v_bad);
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_lines) x
    left join public.t2_qator q on q.id = (x->>'qator_id')::bigint and q.kompaniya_id = p_kompaniya_id
    where q.id is null
  ) then
    return jsonb_build_object('ok', false, 'code', 'LINE_NOT_FOUND');
  end if;

  insert into public.t2_price_basis (kompaniya_id, document_id, basis_type, holat, actor_id, operation_id)
  values (p_kompaniya_id, p_document_id, p_basis_type, 'tasdiqlangan', p_actor_id, p_operation_id)
  returning id into v_basis_id;

  insert into public.t2_price_basis_line (basis_id, qator_id, approved_price, valid_from, valid_to)
  select v_basis_id, (x->>'qator_id')::bigint, (x->>'approved_price')::numeric,
         coalesce(nullif(x->>'valid_from','')::date, current_date), nullif(x->>'valid_to','')::date
  from jsonb_array_elements(p_lines) x;

  perform public.t2_audit_yoz(p_kompaniya_id, 'price_basis_yarat', 'price_basis', v_basis_id,
    p_basis_type || ' (' || jsonb_array_length(p_lines) || ' qator)', 'actor:' || p_actor_id, null);

  v_prev := jsonb_build_object('ok', true, 'basis_id', v_basis_id);
  insert into public.t2_kompaniya_command_log (operation_id, actor_id, command, natija)
    values (p_operation_id, p_actor_id, 'price_basis_yarat_v1', v_prev);
  return v_prev;
end
$function$;

-- ── Effective basis-ceiling resolver -- ONE place both the write path
-- (snapshot-at-creation) and any manual lookup use. ────────────────────
create or replace function public.t2_price_basis_resolve_v1(p_qator_id bigint, p_as_of date default current_date)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_basis record;
begin
  select pbl.id as line_id, pbl.approved_price
    into v_basis
    from public.t2_price_basis_line pbl
    join public.t2_price_basis pb on pb.id = pbl.basis_id and pb.holat = 'tasdiqlangan'
    where pbl.qator_id = p_qator_id
      and (pbl.valid_from is null or pbl.valid_from <= p_as_of)
      and (pbl.valid_to is null or pbl.valid_to >= p_as_of)
    order by pbl.valid_from desc nulls last, pbl.id desc
    limit 1;
  if found then
    return jsonb_build_object('basis_line_id', v_basis.line_id, 'approved_price', v_basis.approved_price);
  end if;
  return jsonb_build_object('basis_line_id', null, 'approved_price', null);
end
$function$;

-- ── Extend t2_akt_yarat_v2 (20260920130000) to snapshot the basis
-- ceiling at F2-creation time. CREATE OR REPLACE of the same function --
-- must run AFTER t2_price_basis_resolve_v1 exists (hence living in this
-- later-timestamped migration rather than the earlier one). Everything
-- else about the function is unchanged from 20260920130000.
create or replace function public.t2_akt_yarat_v2(
  p_obyekt_id bigint,
  p_oy date,
  p_qatorlar jsonb,
  p_actor_id bigint,
  p_raqam text default null,
  p_operation_id uuid default null,
  p_manba text default 'f2_import_v2'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_komp bigint; v_result jsonb; v_akt_id bigint;
  v_missing_price jsonb; v_missing_amount jsonb;
begin
  select kompaniya_id into v_komp from public.t2_obyekt where id = p_obyekt_id;
  if v_komp is null then
    return jsonb_build_object('ok', false, 'code', 'OBYEKT_NOT_FOUND');
  end if;
  perform public.t2_actor_kompaniya_azo_tekshir(v_komp, p_actor_id);

  if p_operation_id is null then
    return jsonb_build_object('ok', false, 'code', 'OPERATION_ID_REQUIRED');
  end if;
  if p_qatorlar is null or jsonb_typeof(p_qatorlar) <> 'array' or jsonb_array_length(p_qatorlar) = 0 then
    return jsonb_build_object('ok', false, 'code', 'F2_LINES_REQUIRED');
  end if;
  if exists (select 1 from jsonb_array_elements(p_qatorlar) x where nullif(x->>'qator_id', '') is null) then
    return jsonb_build_object('ok', false, 'code', 'QATOR_ID_REQUIRED');
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_qatorlar) x
    group by x->>'qator_id' having count(*) > 1
  ) then
    return jsonb_build_object('ok', false, 'code', 'DUPLICATE_F2_SOURCE_LINE');
  end if;
  if exists (select 1 from jsonb_array_elements(p_qatorlar) x where nullif(x->>'certified_quantity', '') is null) then
    return jsonb_build_object('ok', false, 'code', 'CERTIFIED_QTY_INVALID',
      'qatorlar', (select jsonb_agg(x->>'qator_id') from jsonb_array_elements(p_qatorlar) x where nullif(x->>'certified_quantity', '') is null));
  end if;
  select jsonb_agg(x->>'qator_id') into v_missing_price from jsonb_array_elements(p_qatorlar) x
    where coalesce((x->>'price_intentionally_absent')::boolean, false) is not true
      and nullif(x->>'certified_unit_price', '') is null;
  if v_missing_price is not null then
    return jsonb_build_object('ok', false, 'code', 'MISSING_CERTIFIED_PRICE',
      'xabar', 'Ba''zi qatorlarda F2 hujjatining o''z narxi yo''q va price_intentionally_absent belgilanmagan -- smeta narxiga jim qaytish YO''Q.',
      'qatorlar', v_missing_price);
  end if;
  select jsonb_agg(x->>'qator_id') into v_missing_amount from jsonb_array_elements(p_qatorlar) x
    where coalesce((x->>'price_intentionally_absent')::boolean, false) is not true
      and nullif(x->>'certified_amount', '') is null;
  if v_missing_amount is not null then
    return jsonb_build_object('ok', false, 'code', 'MISSING_CERTIFIED_AMOUNT',
      'xabar', 'Ba''zi qatorlarda F2 hujjatining o''z summasi yuborilmagan.',
      'qatorlar', v_missing_amount);
  end if;

  select public.t2_akt_yarat(
    p_obyekt_id, 'f2', p_oy,
    (select jsonb_agg(jsonb_build_object(
       'qator_id', (x->>'qator_id')::bigint,
       'hajm', (x->>'certified_quantity')::numeric,
       'narx', case when coalesce((x->>'price_intentionally_absent')::boolean, false) then null
                    else (x->>'certified_unit_price')::numeric end,
       'narx_yoq', coalesce((x->>'price_intentionally_absent')::boolean, false),
       'izoh', x->>'izoh'
     )) from jsonb_array_elements(p_qatorlar) x),
    p_raqam, p_operation_id, p_manba, 'actor:' || p_actor_id, false
  ) into v_result;

  if coalesce((v_result->>'ok')::boolean, false) is not true then
    return v_result;
  end if;
  if (v_result->>'takror')::boolean is true then
    return v_result || jsonb_build_object('contract', 'CERTIFIED_F2_V2');
  end if;
  v_akt_id := (v_result->>'akt_id')::bigint;

  update public.t2_akt_qator aq set
    certified_quantity = (x->>'certified_quantity')::numeric,
    certified_unit_price = case when coalesce((x->>'price_intentionally_absent')::boolean, false) then null
                                 else (x->>'certified_unit_price')::numeric end,
    certified_amount = case when coalesce((x->>'price_intentionally_absent')::boolean, false) then null
                             else (x->>'certified_amount')::numeric end,
    certified_source_hash = nullif(x->>'certified_source_hash', ''),
    raw_snapshot = coalesce(x->'raw_snapshot', x),
    provenance_status = case when coalesce((x->>'price_intentionally_absent')::boolean, false)
                              then 'price_intentionally_absent' else 'source_certified' end,
    -- Price Control (Sections 3-8): snapshot the basis ceiling valid NOW
    -- (F2-creation time) -- frozen from this point on by the trigger.
    -- baseline_narx (the reference itself) is already set by the
    -- delegated t2_akt_yarat call above -- not touched here.
    reference_basis_line_id = (public.t2_price_basis_resolve_v1(aq.qator_id, current_date)->>'basis_line_id')::bigint,
    basis_approved_price_snapshot = (public.t2_price_basis_resolve_v1(aq.qator_id, current_date)->>'approved_price')::numeric
  from jsonb_array_elements(p_qatorlar) x
  where aq.akt_id = v_akt_id and aq.qator_id = (x->>'qator_id')::bigint;

  return v_result || jsonb_build_object('contract', 'CERTIFIED_F2_V2',
    'arithmetic_mismatch_soni', (
      select count(*) from public.t2_akt_qator
      where akt_id = v_akt_id and certified_amount is not null
        and certified_quantity is not null and certified_unit_price is not null
        and abs(certified_quantity * certified_unit_price - certified_amount) > 0.005
    ));
end
$function$;

-- ── Read model: per-line price control state (Sections 3-8) ───────────
-- price_state derivation, verified against every worked example in the
-- task (not re-derived ad hoc):
--   certified < reference               -> BELOW_REFERENCE
--   certified = reference                -> NORMAL
--   certified > reference, basis exists, certified <= basis price -> ABOVE_REFERENCE_JUSTIFIED
--   certified > reference, basis exists, certified >  basis price -> ABOVE_APPROVED_BASIS
--   certified > reference, no basis      -> ABOVE_REFERENCE_MISSING_BASIS
create or replace function public.t2_price_control_v1(p_obyekt_id bigint, p_actor_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_komp bigint; v_rows jsonb;
begin
  select kompaniya_id into v_komp from public.t2_obyekt where id = p_obyekt_id;
  if v_komp is null then return jsonb_build_object('ok', false, 'code', 'OBYEKT_NOT_FOUND'); end if;
  perform public.t2_actor_kompaniya_azo_tekshir(v_komp, p_actor_id);

  with lines as (
    select aq.qator_id, a.holat as akt_holat,
           aq.certified_unit_price, aq.certified_quantity,
           aq.baseline_narx as reference_price,
           aq.basis_approved_price_snapshot as basis_price
    from public.t2_akt_qator aq
    join public.t2_akt a on a.id = aq.akt_id
    where a.obyekt_id = p_obyekt_id and a.tur = 'f2'
      and aq.provenance_status = 'source_certified'
      and aq.certified_unit_price is not null
  ),
  per_line as (
    select l.qator_id,
           max(l.reference_price) filter (where l.akt_holat = 'tasdiqlangan') as reference_price_approved,
           max(l.certified_unit_price) filter (where l.akt_holat = 'tasdiqlangan') as certified_price_approved,
           max(l.basis_price) filter (where l.akt_holat = 'tasdiqlangan') as basis_price_approved,
           sum(greatest(coalesce(l.reference_price, l.certified_unit_price) - l.certified_unit_price, 0) * l.certified_quantity)
             filter (where l.akt_holat = 'tasdiqlangan' and l.certified_unit_price < coalesce(l.reference_price, l.certified_unit_price))
             as frozen_amount,
           sum(greatest(coalesce(l.reference_price, l.certified_unit_price) - l.certified_unit_price, 0) * l.certified_quantity)
             filter (where l.akt_holat <> 'tasdiqlangan' and l.certified_unit_price < coalesce(l.reference_price, l.certified_unit_price))
             as at_risk_amount
    from lines l
    group by l.qator_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'qator_id', h.id, 'kod', h.kod, 'nom', h.nom, 'birlik', h.birlik,
      'reference_unit_price', pl.reference_price_approved,
      'certified_unit_price', pl.certified_price_approved,
      'price_delta', case when pl.certified_price_approved is not null and pl.reference_price_approved is not null
                           then pl.certified_price_approved - pl.reference_price_approved end,
      'frozen_amount', coalesce(pl.frozen_amount, 0),
      'at_risk_amount', coalesce(pl.at_risk_amount, 0),
      'basis_approved_price', pl.basis_price_approved,
      'price_state',
        case
          when pl.certified_price_approved is null or pl.reference_price_approved is null then 'ABOVE_REFERENCE_MISSING_BASIS'
          when pl.certified_price_approved < pl.reference_price_approved then 'BELOW_REFERENCE'
          when pl.certified_price_approved = pl.reference_price_approved then 'NORMAL'
          when pl.basis_price_approved is null then 'ABOVE_REFERENCE_MISSING_BASIS'
          when pl.certified_price_approved <= pl.basis_price_approved then 'ABOVE_REFERENCE_JUSTIFIED'
          else 'ABOVE_APPROVED_BASIS'
        end
    ) order by h.kod)
  , '[]'::jsonb)
  into v_rows
  from public.t2_qator_holat h
  join per_line pl on pl.qator_id = h.id
  where h.obyekt_id = p_obyekt_id;

  return jsonb_build_object('ok', true, 'qatorlar', v_rows);
end
$function$;

revoke all on function public.t2_price_basis_yarat_v1(bigint,bigint,text,jsonb,bigint,uuid) from public, anon, authenticated;
grant execute on function public.t2_price_basis_yarat_v1(bigint,bigint,text,jsonb,bigint,uuid) to service_role;
revoke all on function public.t2_price_basis_resolve_v1(bigint,date) from public, anon, authenticated;
grant execute on function public.t2_price_basis_resolve_v1(bigint,date) to service_role;
revoke all on function public.t2_price_control_v1(bigint,bigint) from public, anon, authenticated;
grant execute on function public.t2_price_control_v1(bigint,bigint) to service_role;

comment on function public.t2_price_control_v1(bigint,bigint) is
  'T2-REAL-PARK-LRV-VERTICAL-SLICE-004: per-line price control state for one object. NOT a procurement-saving report. FROZEN_AMOUNT only from approved F2, using baseline_narx (frozen at F2-creation time) as reference -- never recomputed against a later smeta revision or basis change.';

commit;
