-- T2-SMETA-IMPORT-TIMEOUT-002 -- root cause of a THIRD recurrence of
-- IMPORT_RPC_FAILED / Postgres 57014 on "slightly bigger" smeta files,
-- even after the previous O(n^2) trigger-cascade fix
-- (20260907173056_t2_smeta_import_bulk_perf_fix.sql) was confirmed live.
--
-- Direct measurement in production (rolled back, no data kept) showed
-- `t2_smeta_import_bulk_v1` itself runs in ~10s for a realistic 8,970-row
-- smeta (195 sections x 5 works x 8 resources) -- proportional to row
-- count, i.e. genuinely O(n) now, NOT O(n^2). The SQL is fine. That is
-- not the wall the owner is hitting.
--
-- The actual wall: PostgREST (which serves every /rest/v1/rpc/* call
-- this app makes, including from the Cloudflare Function using the
-- service_role key) always physically LOGS IN to Postgres as the
-- `authenticator` role, then does `SET ROLE` per request based on the
-- API key's JWT claim. Per-role `ALTER ROLE ... SET` config is applied
-- ONLY at session start, keyed to the role that authenticated the
-- connection -- a later `SET ROLE service_role` does NOT re-apply
-- service_role's own config (which is unset anyway: rolconfig IS NULL).
-- So EVERY PostgREST request in this entire application -- anon,
-- authenticated, or service_role alike -- runs under whatever
-- `authenticator` has configured:
--
--   authenticator: statement_timeout=8s, lock_timeout=8s
--
-- This is a Supabase project default (a defensive cap against abuse of
-- the public anon-key surface), not something this app ever configured
-- on purpose. It silently caps EVERY RPC call site in the app at 8
-- seconds of Postgres execution time, regardless of the query's own
-- cost -- a small smeta finishes under 8s and "just works"; a bigger
-- one crosses the wall and Postgres itself cancels it (57014), which is
-- exactly the owner's repeated report ("kichikroq ishlaydi, kattaroqda
-- RPC FAILED"). This also silently bounds every OTHER slow-ish RPC in
-- the app (F2 import steps, akt operations, big reports), not just
-- smeta import -- so this is fixed at the role level, not per-call-site.
--
-- Fix, two parts:
--  1) Raise the actual effective ceiling for the whole API surface to a
--     sane value for an internal admin/PTO tool (not a public anon
--     surface taking arbitrary user queries) -- 30s statement_timeout,
--     15s lock_timeout (lock waits should still fail fast; only actual
--     query runtime needed the bigger budget).
--  2) Independently, reduce actual work: `t2_smeta_import_bulk_v1`'s own
--     post-import signal refresh (t2_signal_refresh_object) is an
--     ADVISORY rescan (missing-price/data-quality warnings) that scales
--     with row count and, measured directly, cost ~3.5s of the ~10s
--     total for the 8,970-row case -- over a third. It is not required
--     for import correctness (the RPC's own prior comment already says
--     so). Skipped for imports at/above 5,000 rows so large imports get
--     both a bigger budget AND less work to do inside it; small imports
--     (the common case) keep identical behavior/UX.

begin;

alter role authenticator set statement_timeout = '30s';
alter role authenticator set lock_timeout = '15s';

create or replace function public.t2_smeta_import_bulk_v1(
  p_kompaniya_id bigint, p_actor_id bigint, p_obyekt_id bigint,
  p_operation_id uuid, p_source_document_id bigint, p_qatorlar jsonb)
returns jsonb language plpgsql security definer set search_path=public, pg_temp as $$
declare
  v_prev jsonb; v_rol text; v_soni integer;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  select natija into v_prev from public.t2_onboarding_command_log where operation_id = p_operation_id;
  if found then return v_prev; end if;

  v_rol := public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id, p_actor_id);
  if v_rol not in ('admin','superadmin','boss','director','pto') then
    raise exception 'WRITE_ROLE_REQUIRED' using errcode='42501';
  end if;

  if not exists (select 1 from public.t2_obyekt where id=p_obyekt_id and kompaniya_id=p_kompaniya_id) then
    return jsonb_build_object('ok',false,'code','OBJECT_ACCESS_DENIED');
  end if;
  if exists (select 1 from public.t2_qator where obyekt_id=p_obyekt_id) then
    return jsonb_build_object('ok',false,'code','SMETA_ALREADY_EXISTS');
  end if;
  if p_source_document_id is not null and not exists(
      select 1 from public.t2_document_registry d
      where d.id=p_source_document_id and d.kompaniya_id=p_kompaniya_id
        and (d.obyekt_id is null or d.obyekt_id=p_obyekt_id)) then
    return jsonb_build_object('ok',false,'code','SOURCE_DOCUMENT_SCOPE_MISMATCH');
  end if;
  if p_qatorlar is null or jsonb_typeof(p_qatorlar) <> 'array' or jsonb_array_length(p_qatorlar) = 0
     or jsonb_array_length(p_qatorlar) > 60000 then
    return jsonb_build_object('ok',false,'code','BAD_PAYLOAD');
  end if;

  -- T2-SMETA-IMPORT-PERF-001: bulk path -- per-row change-log/signal
  -- triggers on t2_qator already know to skip their expensive per-row
  -- work when this is set (session/transaction-local; PostgREST runs
  -- each RPC call in its own transaction, so this never leaks between
  -- requests).
  perform set_config('t2.manba', 'import', true);

  create temporary table t2_smeta_import_map(
    local_id text primary key, id bigint, parent_local_id text, ordinal integer
  ) on commit drop;

  with kir as (
    select
      (x->>'local_id') as local_id, (x->>'parent_local_id') as parent_local_id,
      (x->>'tur') as tur, nullif(x->>'kod','') as kod, nullif(x->>'nom','') as nom,
      nullif(x->>'birlik','') as birlik,
      public.t2_son(x->>'hajm') as hajm, public.t2_son(x->>'narx') as narx,
      public.t2_son(x->>'summa') as summa,
      (ordinality)::integer as ordinal
    from jsonb_array_elements(p_qatorlar) with ordinality as t(x, ordinality)
  ),
  kir_kat as (
    select kir.*,
      case when kir.tur in ('rs','mat','ob') then
        coalesce(
          (select rk.kategoriya from public.t2_resurs_kategoriya rk
            where rk.kompaniya_id = p_kompaniya_id
              and rk.nom_key = public.t2_resurs_nom_kalit(kir.nom)
              and rk.birlik_key = public.t2_resurs_birlik_kalit(kir.birlik)),
          public.t2_kat_birlik(kir.birlik, kir.nom))
      end as kat
    from kir
  ),
  ins as (
    insert into public.t2_qator(obyekt_id, kompaniya_id, tur, kod, nom, birlik, hajm, narx, summa,
      source_document_id, tartib, daraja, kat)
    select p_obyekt_id, p_kompaniya_id, tur, kod, nom, birlik, hajm, narx, summa,
      p_source_document_id, ordinal, 0, kat
    from kir_kat order by ordinal
    returning id, tartib
  )
  insert into t2_smeta_import_map(local_id, id, parent_local_id, ordinal)
  select kir_kat.local_id, ins.id, kir_kat.parent_local_id, kir_kat.ordinal
  from kir_kat join ins on ins.tartib = kir_kat.ordinal;

  update public.t2_qator q set ota_id = pmap.id
  from t2_smeta_import_map m
  join t2_smeta_import_map pmap on pmap.local_id = m.parent_local_id
  where q.id = m.id and m.parent_local_id is not null;

  with recursive chuqurlik as (
    select id, 0::int as d from public.t2_qator where obyekt_id=p_obyekt_id and ota_id is null
    union all
    select q.id, c.d+1 from public.t2_qator q join chuqurlik c on q.ota_id = c.id
  )
  update public.t2_qator q set daraja = c.d from chuqurlik c where q.id = c.id;

  select count(*) into v_soni from t2_smeta_import_map;

  -- T2-SMETA-IMPORT-TIMEOUT-002: measured ~3.5s of the ~10s total for an
  -- 8,970-row import -- skip for large imports (advisory-only, never
  -- required for correctness) so big files spend the new 30s budget on
  -- the write itself, not on missing-price warnings that can just as
  -- well appear on the next read/write signal cycle for that object.
  if v_soni < 5000 then
    begin
      perform public.t2_signal_refresh_object(p_kompaniya_id, p_obyekt_id);
    exception when others then
      raise warning 't2_smeta_import_bulk_v1: signal refresh failed (non-fatal): %', sqlerrm;
    end;
  end if;

  perform public.t2_audit_yoz(p_kompaniya_id,'smeta_import_bulk','smeta',p_obyekt_id,
    format('qator_soni=%s; source_document_id=%s',v_soni,p_source_document_id),'actor:'||p_actor_id,null);

  v_prev := jsonb_build_object('ok',true,'obyekt_id',p_obyekt_id,'qator_soni',v_soni);
  insert into public.t2_onboarding_command_log (operation_id, actor_id, command, natija)
    values (p_operation_id, p_actor_id, 'smeta_import_bulk', v_prev);
  return v_prev;
end $$;

commit;
