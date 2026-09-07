-- P0 (owner-reported live): mindmap joylashuv saqlashda boss uchun
-- "ruxsat yo'q" (42501). Root cause: t2_mindmap_actor_tekshir bloklagan
-- edi rol in ('boss','rahbar') -- xuddi shu sessiyada sb-yoz.ts va
-- t2_actor_kompaniya_azo_tekshir'da topilgan naqsh (boss to'liq yozish
-- huquqiga ega, faqat rahbar emas -- t2_effective_authorization_v1ning
-- o'z jadvaliga qarang). Faqat 'rahbar' qoladi.

begin;

create or replace function public.t2_mindmap_actor_tekshir(p_kompaniya_id bigint, p_actor_id bigint)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_rol text;
begin
  if p_kompaniya_id is null or p_kompaniya_id <= 0 then
    raise exception 'kompaniya_id majburiy' using errcode = '22023';
  end if;
  if p_actor_id is null or p_actor_id <= 0 then
    raise exception 'authenticated actor majburiy' using errcode = '22023';
  end if;

  select a.rol into v_rol
    from t2_azolik a
   where a.kompaniya_id = p_kompaniya_id
     and a.foydalanuvchi_id = p_actor_id
     and a.holat = 'faol';

  if not found then
    raise exception 'actor bu kompaniyaning faol a''zosi emas'
      using errcode = '42501';
  end if;
  if v_rol = 'rahbar' then
    raise exception 'bu rol mindmap mutation qila olmaydi'
      using errcode = '42501';
  end if;
  return v_rol;
end;
$$;

commit;
