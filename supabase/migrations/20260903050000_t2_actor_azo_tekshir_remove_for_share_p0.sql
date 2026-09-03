-- P0 HOTFIX (applied to prod 2026-09-03): t2_actor_kompaniya_azo_tekshir used
-- `for share`, which PostgREST cannot execute inside the read-only
-- transaction it wraps every STABLE RPC call in (regardless of GET/POST or
-- which Supabase key calls it) -- causing SQLSTATE 25006 "cannot execute
-- SELECT FOR SHARE in a read-only transaction" on every STABLE RPC that
-- transitively calls this helper: t2_boss_dashboard_v1,
-- t2_document_registry_v1, t2_system_control_v1, t2_workbench_v1,
-- t2_nakopitelniy_v1, t2_obyekt_yakunlash_v1, t2_forma3_royxat_v1,
-- t2_smeta_baseline_asl_v1, t2_smeta_ozgarish_royxat_v1,
-- t2_azo_actor_director_tekshir.
--
-- This broke Boss Dashboard / Document Center / System Control / Workbench /
-- Nakopitelniy / Closeout / Forma-3 / Change Control on production for real
-- PostgREST traffic. Earlier verification of these RPCs used raw SQL
-- execution (via the Supabase MCP tool), which bypasses PostgREST's
-- read-only wrapping entirely and never caught this. Found and reproduced
-- exactly (same SQLSTATE, same source line) 2026-09-03 while diagnosing an
-- owner-reported `25006` error on `/admin/system-control`.
--
-- Fix: drop the row lock. It only protected a narrow check-then-write race
-- for VOLATILE (write-command) callers; for the STABLE read-model callers
-- above it serves no purpose and broke them outright. Normal READ COMMITTED
-- semantics remain correct for the membership check. Signature, params,
-- error codes, and not-found/invalid-input behavior are byte-identical --
-- only the lock clause is removed.
create or replace function public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id bigint, p_actor_id bigint)
 returns text
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare v_rol text;
begin
  if p_kompaniya_id is null or p_kompaniya_id <= 0 then raise exception 'kompaniya_id majburiy' using errcode='22023'; end if;
  if p_actor_id is null or p_actor_id <= 0 then raise exception 'authenticated actor majburiy' using errcode='22023'; end if;
  select a.rol into v_rol from public.t2_azolik a
   where a.kompaniya_id=p_kompaniya_id and a.foydalanuvchi_id=p_actor_id and a.holat='faol';
  if not found then raise exception 'actor bu kompaniyaning faol a''zosi emas' using errcode='42501'; end if;
  return v_rol;
end $function$;
