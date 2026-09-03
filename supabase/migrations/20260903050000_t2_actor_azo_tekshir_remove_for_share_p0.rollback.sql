-- Rollback for 20260903050000_t2_actor_azo_tekshir_remove_for_share_p0.
-- Restores the original `for share` locking body. PRE-USE caution: this
-- reintroduces the confirmed 25006 production bug for every STABLE RPC
-- listed in the forward migration's header comment -- only run this if the
-- forward fix itself is found to be wrong, not as a routine rollback.
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
