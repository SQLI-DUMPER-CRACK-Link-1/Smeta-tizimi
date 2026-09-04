-- T2-GAS-EXIT-001 §5/§6 — F2 import resumable job model + durable draft mapping
-- SOURCE ONLY — NOT applied to production. NOT reviewed. Draft design for the
-- owner's own requirement (ops/handoff/T2_GAS_EXIT_001.md §5/§6): "a failure
-- at row 32,000 resumes near the checkpoint, never restarts from row 1" and
-- "manual F2 matching/corrections... must survive a page refresh, PC restart,
-- browser crash, network loss, or a failed worker step."
--
-- This does NOT touch the F2 matching engine itself (frontend/src/lib/f2-match-engine,
-- ported separately, Step 3) or any existing GAS-backed F2 path. It only adds
-- the durable job/draft state a future Cloudflare-orchestrated F2 import needs
-- so it stops depending on one long-lived synchronous GAS call.
--
-- REUSE: t2_obyekt (scope), t2_document_registry (FILE-TRUTH source document),
--        t2_actor_kompaniya_azo_tekshir (membership), t2_audit_yoz (audit).
-- ADDITIVE ONLY: two new tables + four new RPCs. Nothing existing is altered.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. t2_f2_import_job — one row per F2 import/matching run.
--    `cursor` is an opaque resumption pointer (e.g. {"varaq":"...","row":N} or
--    a section index) written by whichever chunked worker processes this job;
--    this table does not interpret it, only persists it.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.t2_f2_import_job (
  id                bigint generated always as identity primary key,
  kompaniya_id      bigint not null references public.t2_kompaniya(id),
  loyiha_id         bigint not null references public.t2_loyiha(id),
  obyekt_id         bigint not null references public.t2_obyekt(id),
  source_document_id bigint references public.t2_document_registry(id),
  operation_id      uuid,
  status            text not null default 'queued'
                      check (status in ('queued','running','paused','completed','failed','cancelled')),
  cursor            jsonb not null default '{}'::jsonb,
  total_rows        integer,
  processed_rows    integer not null default 0,
  matched_rows      integer not null default 0,
  unmatched_rows    integer not null default 0,
  last_error        text,
  actor_id          bigint references public.t2_foydalanuvchi(id),
  versiya           integer not null default 1,
  started_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  completed_at      timestamptz,
  check (processed_rows >= 0 and matched_rows >= 0 and unmatched_rows >= 0),
  check (total_rows is null or processed_rows <= total_rows)
);
create index if not exists t2_f2_import_job_obyekt_ix on public.t2_f2_import_job (obyekt_id, started_at desc);
create unique index if not exists t2_f2_import_job_operation_uq
  on public.t2_f2_import_job (kompaniya_id, operation_id) where operation_id is not null;
alter table public.t2_f2_import_job enable row level security;

comment on table public.t2_f2_import_job is
  'T2-GAS-EXIT-001 §5: resumable F2 import/matching job. A failed/interrupted run resumes from `cursor`, never restarts row 1. Access via revoked-from-public RPCs only (t2_actor_kompaniya_azo_tekshir-gated).';
comment on column public.t2_f2_import_job.cursor is
  'Opaque resumption pointer written by the worker (e.g. {"varaq":"...","row":N}); this table never interprets it.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. t2_f2_import_draft_qator — durable per-row draft/mapping state.
--    One row per (job, act-tree uid). Upserted as the user works; a manual
--    correction or an engine auto-match both land here — never localStorage-only.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.t2_f2_import_draft_qator (
  id           bigint generated always as identity primary key,
  job_id       bigint not null references public.t2_f2_import_job(id) on delete cascade,
  uid          text not null,                      -- act-tree node uid (f2-match-engine AktNode.uid)
  holat        text not null
                 check (holat in ('avto_moslashti','qolda_moslashtirildi','otkazib_yuborildi','hal_qilinmagan')),
  lrv_varaq    text,
  lrv_row      integer,
  kod          text,
  hajm         numeric,
  narx         numeric,
  summa        numeric,
  sabab        text,                                -- why unmatched / why manually overridden
  actor_id     bigint references public.t2_foydalanuvchi(id),
  versiya      integer not null default 1,
  yaratildi    timestamptz not null default now(),
  yangilandi   timestamptz not null default now(),
  unique (job_id, uid)
);
create index if not exists t2_f2_import_draft_qator_job_ix on public.t2_f2_import_draft_qator (job_id);
alter table public.t2_f2_import_draft_qator enable row level security;

comment on table public.t2_f2_import_draft_qator is
  'T2-GAS-EXIT-001 §6: durable per-row F2 match/mapping draft. Survives refresh/restart/crash — localStorage may remain only as a secondary convenience cache, never the source of truth.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RPCs — membership-checked, idempotent, optimistic-locked, audited.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.t2_f2_import_job_yarat_v1(
  p_obyekt_id bigint, p_actor_id bigint, p_source_document_id bigint default null,
  p_operation_id uuid default null, p_total_rows integer default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_komp bigint; v_loyiha bigint; v_job_id bigint; v_bor bigint;
begin
  select kompaniya_id, loyiha_id into v_komp, v_loyiha from public.t2_obyekt where id = p_obyekt_id;
  if v_komp is null then return jsonb_build_object('ok',false,'code','OBYEKT_NOT_FOUND'); end if;
  perform public.t2_actor_kompaniya_azo_tekshir(v_komp, p_actor_id); -- raises 42501 if not a member

  if p_operation_id is not null then
    select id into v_bor from public.t2_f2_import_job
      where kompaniya_id = v_komp and operation_id = p_operation_id;
    if found then
      return jsonb_build_object('ok',true,'takror',true,'job_id',v_bor);
    end if;
  end if;

  insert into public.t2_f2_import_job
    (kompaniya_id, loyiha_id, obyekt_id, source_document_id, operation_id, total_rows, actor_id)
  values (v_komp, v_loyiha, p_obyekt_id, p_source_document_id, p_operation_id, p_total_rows, p_actor_id)
  returning id into v_job_id;

  perform public.t2_audit_yoz(v_komp, 'f2_import_job_yarat', 'f2', v_job_id,
    format('obyekt=%s total_rows=%s', p_obyekt_id, coalesce(p_total_rows::text,'?')),
    'actor:'||p_actor_id, null);

  return jsonb_build_object('ok',true,'takror',false,'job_id',v_job_id,'status','queued');
end $$;

create or replace function public.t2_f2_import_job_holat_v1(p_job_id bigint, p_actor_id bigint)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_komp bigint; v jsonb;
begin
  select kompaniya_id into v_komp from public.t2_f2_import_job where id = p_job_id;
  if v_komp is null then return jsonb_build_object('ok',false,'code','JOB_NOT_FOUND'); end if;
  perform public.t2_actor_kompaniya_azo_tekshir(v_komp, p_actor_id);

  select jsonb_build_object(
      'ok', true, 'job_id', j.id, 'obyekt_id', j.obyekt_id, 'status', j.status,
      'cursor', j.cursor, 'total_rows', j.total_rows, 'processed_rows', j.processed_rows,
      'matched_rows', j.matched_rows, 'unmatched_rows', j.unmatched_rows,
      'last_error', j.last_error, 'versiya', j.versiya,
      'started_at', j.started_at, 'updated_at', j.updated_at, 'completed_at', j.completed_at)
    into v
  from public.t2_f2_import_job j where j.id = p_job_id;
  return v;
end $$;

-- Called by the chunked worker after each processed batch. Optimistic-locked:
-- a stale `p_expected_versiya` fails closed rather than silently overwriting
-- progress from a concurrent/duplicate worker invocation.
create or replace function public.t2_f2_import_job_ilgarilash_v1(
  p_job_id bigint, p_actor_id bigint, p_expected_versiya integer,
  p_processed_delta integer, p_matched_delta integer, p_unmatched_delta integer,
  p_cursor jsonb default null, p_status text default null, p_last_error text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_komp bigint; v_new_versiya integer;
begin
  select kompaniya_id into v_komp from public.t2_f2_import_job where id = p_job_id;
  if v_komp is null then return jsonb_build_object('ok',false,'code','JOB_NOT_FOUND'); end if;
  perform public.t2_actor_kompaniya_azo_tekshir(v_komp, p_actor_id);

  if p_status is not null and p_status not in ('queued','running','paused','completed','failed','cancelled') then
    return jsonb_build_object('ok',false,'code','BAD_STATUS');
  end if;

  update public.t2_f2_import_job set
    processed_rows = processed_rows + coalesce(p_processed_delta,0),
    matched_rows   = matched_rows   + coalesce(p_matched_delta,0),
    unmatched_rows = unmatched_rows + coalesce(p_unmatched_delta,0),
    cursor         = coalesce(p_cursor, cursor),
    status         = coalesce(p_status, status),
    last_error     = p_last_error,
    completed_at   = case when p_status in ('completed','failed','cancelled') then now() else completed_at end,
    versiya        = versiya + 1,
    updated_at     = now()
  where id = p_job_id and versiya = p_expected_versiya
  returning versiya into v_new_versiya;

  if v_new_versiya is null then
    return jsonb_build_object('ok',false,'code','STALE_VERSION');
  end if;
  return jsonb_build_object('ok',true,'job_id',p_job_id,'versiya',v_new_versiya);
end $$;

-- Bulk upsert of draft/mapping rows for a job. Each element of p_qatorlar is
-- {uid, holat, lrv_varaq?, lrv_row?, kod?, hajm?, narx?, summa?, sabab?}.
-- Per-row upsert (not a single job-level version) because independent rows
-- are edited independently in the UI — a stale write to one uid must not be
-- blocked by (or silently clobber) a concurrent edit to a different uid.
create or replace function public.t2_f2_import_draft_saqla_v1(
  p_job_id bigint, p_actor_id bigint, p_qatorlar jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_komp bigint; v_soni integer;
begin
  select kompaniya_id into v_komp from public.t2_f2_import_job where id = p_job_id;
  if v_komp is null then return jsonb_build_object('ok',false,'code','JOB_NOT_FOUND'); end if;
  perform public.t2_actor_kompaniya_azo_tekshir(v_komp, p_actor_id);

  if p_qatorlar is null or jsonb_typeof(p_qatorlar) <> 'array' then
    return jsonb_build_object('ok',false,'code','BAD_PAYLOAD');
  end if;

  with kir as (
    select
      (x->>'uid') as uid, (x->>'holat') as holat,
      nullif(x->>'lrv_varaq','') as lrv_varaq, nullif(x->>'lrv_row','')::integer as lrv_row,
      nullif(x->>'kod','') as kod, nullif(x->>'hajm','')::numeric as hajm,
      nullif(x->>'narx','')::numeric as narx, nullif(x->>'summa','')::numeric as summa,
      nullif(x->>'sabab','') as sabab
    from jsonb_array_elements(p_qatorlar) x
  )
  insert into public.t2_f2_import_draft_qator
    (job_id, uid, holat, lrv_varaq, lrv_row, kod, hajm, narx, summa, sabab, actor_id)
  select p_job_id, k.uid, k.holat, k.lrv_varaq, k.lrv_row, k.kod, k.hajm, k.narx, k.summa, k.sabab, p_actor_id
  from kir k
  where k.uid is not null and k.holat is not null
  on conflict (job_id, uid) do update set
    holat = excluded.holat, lrv_varaq = excluded.lrv_varaq, lrv_row = excluded.lrv_row,
    kod = excluded.kod, hajm = excluded.hajm, narx = excluded.narx, summa = excluded.summa,
    sabab = excluded.sabab, actor_id = excluded.actor_id,
    versiya = public.t2_f2_import_draft_qator.versiya + 1, yangilandi = now();
  get diagnostics v_soni = row_count;

  return jsonb_build_object('ok',true,'job_id',p_job_id,'saqlandi',v_soni);
end $$;

revoke all on function public.t2_f2_import_job_yarat_v1(bigint,bigint,bigint,uuid,integer) from public, anon, authenticated;
revoke all on function public.t2_f2_import_job_holat_v1(bigint,bigint) from public, anon, authenticated;
revoke all on function public.t2_f2_import_job_ilgarilash_v1(bigint,bigint,integer,integer,integer,integer,jsonb,text,text) from public, anon, authenticated;
revoke all on function public.t2_f2_import_draft_saqla_v1(bigint,bigint,jsonb) from public, anon, authenticated;

commit;
