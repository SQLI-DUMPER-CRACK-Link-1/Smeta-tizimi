-- ROLLBACK for 20260914120000_t2_platforma_superadmin_context_v1.sql
-- Additive + idempotent — restores the pre-fix t2_actor_kompaniya_azo_tekshir
-- body verbatim and drops the resolver. Safe at any time (the superadmin
-- branch leaves no data behind).
begin;

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
   where a.kompaniya_id=p_kompaniya_id and a.foydalanuvchi_id=p_actor_id and a.holat='faol' for share;
  if not found then raise exception 'actor bu kompaniyaning faol a''zosi emas' using errcode='42501'; end if;
  return v_rol;
end $function$;

drop function if exists public.t2_platforma_superadmin(bigint);

commit;
