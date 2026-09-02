-- T2-COMPANY-CONTEXT-P0-FIX-001 — explicit, audited platform-superadmin path.
-- SOURCE ONLY here; applied to production as part of the company-context fix release.
--
-- ═══ MUAMMO (Codex audit §6, §12, §P0-2) ═══
-- `superadmin` nomenklaturada platforma roli, lekin HAR privileged server
-- path `t2_actor_kompaniya_azo_tekshir` orqali FAOL `t2_azolik` talab qiladi.
-- Ya'ni platforma operatori har kompaniyaga SUN'IY a'zolik qo'shmasa
-- ishlay olmaydi — bu biznes a'zolik semantikasini va audit atributsiyasini
-- buzadi.
--
-- ═══ YECHIM ═══
-- 1. `t2_platforma_superadmin(actor)` — YAGONA, aniq manba: actor'ning
--    FAOL `t2_azolik` qatorlaridan birortasi `rol='superadmin'` bo'lsa true.
--    Bu qatorni foydalanuvchi O'ZI yoza olmaydi: yagona yozish yo'li
--    `t2_azolik_qosh_v1` direktor-qo'riqchili va `rol='superadmin'` ni
--    `ROLE_INVALID` bilan rad etadi.
-- 2. `t2_actor_kompaniya_azo_tekshir` — a'zolik topilmasa, VA actor
--    platforma superadmin bo'lsa: HECH QANDAY `t2_azolik` yozilmasdan
--    `'superadmin'` qaytaradi. Aks holda avvalgidek 42501.
--
-- Audit: superadmin CROSS-COMPANY YOZUV har buyruq RPC'sining o'z
-- `t2_audit_yoz(<target_komp>, ..., 'actor:'||actor)` chaqiruvi bilan
-- allaqachon qayd etiladi (actor + target kompaniya alohida). Superadmin
-- cross-company O'QISH per-access audit qilinmaydi (o'zgartirmaydi, hajm).
--
-- Oddiy foydalanuvchi xatti-harakati O'ZGARMAYDI: a'zoligi bor -> avvalgidek
-- roli qaytadi; a'zoligi yo'q + superadmin emas -> avvalgidek 42501.

begin;

create or replace function public.t2_platforma_superadmin(p_actor_id bigint)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from public.t2_azolik a
    where a.foydalanuvchi_id = p_actor_id
      and a.rol = 'superadmin'
      and a.holat = 'faol'
  );
$$;

comment on function public.t2_platforma_superadmin(bigint) is
  'COMPANY-CONTEXT: platforma superadmin resolveri. TRUE iff actor FAOL t2_azolik da rol=superadmin. Sun''iy a''zolik EMAS — cross-company privileged path shu yerdan hal qilinadi.';

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
   where a.kompaniya_id=p_kompaniya_id and a.foydalanuvchi_id=p_actor_id and a.holat='faol' for share;
  if found then return v_rol; end if;

  -- ═══ PLATFORMA SUPERADMIN — explicit cross-company path (no synthetic membership) ═══
  if public.t2_platforma_superadmin(p_actor_id) then
    select exists(select 1 from public.t2_kompaniya where id = p_kompaniya_id) into v_komp_bor;
    if not v_komp_bor then raise exception 'kompaniya topilmadi' using errcode='42501'; end if;
    return 'superadmin';
  end if;

  raise exception 'actor bu kompaniyaning faol a''zosi emas' using errcode='42501';
end $function$;

commit;
