-- P0 HOTFIX: 20260914120000_t2_platforma_superadmin_context_v1.sql
-- (applied to production 2026-09-05, out of chronological order relative
-- to its own filename because it had been sitting unapplied since an
-- earlier session) re-created t2_actor_kompaniya_azo_tekshir from an
-- OLDER source that still had `for share` -- silently UNDOING the P0
-- fix in 20260903050000_t2_actor_azo_tekshir_remove_for_share_p0.sql,
-- which had already removed it (SQLSTATE 25006, "cannot execute SELECT
-- FOR SHARE in a read-only transaction", breaks every STABLE RPC that
-- transitively calls this helper -- Boss Dashboard, System Control,
-- Workbench, Nakopitelniy, etc; reproduced live on /admin/dashboard
-- "Rahbar paneli" 2026-09-05).
--
-- Fix: re-apply the 2026-09-03 lock removal, this time WITH the
-- superadmin bypass path from t2_platforma_superadmin_context_v1 kept
-- intact. Signature/params/error codes unchanged from both prior
-- versions -- only the lock clause is (again) removed.

begin;

create or replace function public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id bigint, p_actor_id bigint)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_rol text; v_komp_bor boolean;
begin
  if p_kompaniya_id is null or p_kompaniya_id <= 0 then raise exception 'kompaniya_id majburiy' using errcode='22023'; end if;
  if p_actor_id is null or p_actor_id <= 0 then raise exception 'authenticated actor majburiy' using errcode='22023'; end if;

  select a.rol into v_rol from public.t2_azolik a
   where a.kompaniya_id=p_kompaniya_id and a.foydalanuvchi_id=p_actor_id and a.holat='faol';
  if found then return v_rol; end if;

  if public.t2_platforma_superadmin(p_actor_id) then
    select exists(select 1 from public.t2_kompaniya where id = p_kompaniya_id) into v_komp_bor;
    if not v_komp_bor then raise exception 'kompaniya topilmadi' using errcode='42501'; end if;
    return 'superadmin';
  end if;

  raise exception 'actor bu kompaniyaning faol a''zosi emas' using errcode='42501';
end $function$;

commit;
