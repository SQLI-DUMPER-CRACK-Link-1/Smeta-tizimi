-- COMPANY / AUTH / DIRECTOR — P0 onboarding + multi-tenant safety
-- SOURCE ONLY — NOT applied to production by this task (production_write_allowed=false).
--
-- Law: ONE ENTITY — ONE ID — ONE SOURCE OF TRUTH — MANY VIEWS.
-- Supabase = business truth for users, companies, membership, roles.
--
-- P0 BUG FIXED HERE: t2_kirish_royxatga_ol currently joins a brand-new user to
-- EVERY active company (`INSERT ... SELECT v_id, k.id, p_rol FROM t2_kompaniya
-- WHERE faol`). With >1 company that is a hard tenant-isolation breach. A new
-- user must land with ZERO memberships and go through explicit onboarding
-- (create a company, or be added by a director).

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Idempotency ledger for onboarding commands
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.t2_onboarding_command_log (
  operation_id uuid primary key,
  actor_id     bigint not null,
  command      text   not null,
  natija       jsonb  not null,
  created_at   timestamptz not null default now()
);
alter table public.t2_onboarding_command_log enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. P0 FIX — login registration no longer auto-joins every company
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.t2_kirish_royxatga_ol(p_login text, p_rol text, p_email text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id bigint; v_komp jsonb;
begin
  insert into t2_foydalanuvchi (login, email)
  values (p_login, p_email)
  on conflict (login) do update set email = coalesce(excluded.email, t2_foydalanuvchi.email)
  returning id into v_id;

  -- NOTE: intentionally NO auto-membership. A user with zero memberships is a
  -- valid state -> the frontend shows onboarding (create/join a company).
  -- p_rol is retained in the signature for call-site compatibility but is only
  -- used by explicit membership commands, never here.

  select jsonb_agg(jsonb_build_object('kompaniya_id', a.kompaniya_id, 'rol', a.rol))
    into v_komp
  from t2_azolik a where a.foydalanuvchi_id = v_id and a.holat = 'faol';

  return jsonb_build_object('ok', true, 'foydalanuvchi_id', v_id, 'azoliklar', coalesce(v_komp, '[]'::jsonb));
end $$;

comment on function public.t2_kirish_royxatga_ol(text,text,text) is
  'Login: find-or-create user, return active memberships. Does NOT auto-join companies (fixed 2026-09: was joining every active company).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Helper — a unique company code from a display name
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.t2_kompaniya_kod_yasa(p_nom text, p_seed bigint)
returns text language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_kod text;
begin
  v_kod := upper(regexp_replace(coalesce(p_nom,''), '[^a-zA-Z0-9]', '', 'g'));
  v_kod := nullif(left(v_kod, 12), '');
  if v_kod is null then v_kod := 'K' || p_seed; end if;
  if exists (select 1 from public.t2_kompaniya where kod = v_kod) then
    v_kod := v_kod || '-' || p_seed;
  end if;
  return v_kod;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Canonical self-service company creation -> creator becomes director (boss)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.t2_kompaniya_yarat_v1(
  p_actor_id bigint, p_nom text, p_inn text, p_telefon text, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_prev jsonb; v_komp bigint; v_kod text; v_azolik bigint; v_nom text;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  select natija into v_prev from public.t2_onboarding_command_log where operation_id = p_operation_id;
  if found then return v_prev; end if;

  if p_actor_id is null or p_actor_id <= 0 then return jsonb_build_object('ok',false,'code','AUTH_REQUIRED'); end if;
  if not exists (select 1 from public.t2_foydalanuvchi where id = p_actor_id and coalesce(holat,'faol') = 'faol') then
    return jsonb_build_object('ok',false,'code','ACTOR_NOT_FOUND');
  end if;

  v_nom := btrim(coalesce(p_nom,''));
  if length(v_nom) < 2 then return jsonb_build_object('ok',false,'code','COMPANY_NAME_REQUIRED'); end if;
  if p_inn is not null and p_inn <> '' and p_inn !~ '^\d{9}$' then
    return jsonb_build_object('ok',false,'code','INN_INVALID','xato','STIR 9 ta raqam');
  end if;

  insert into public.t2_kompaniya (nom, kod, faol, inn, telefon)
  values (v_nom, 'PENDING', true, nullif(p_inn,''), nullif(p_telefon,''))
  returning id into v_komp;
  v_kod := public.t2_kompaniya_kod_yasa(v_nom, v_komp);
  update public.t2_kompaniya set kod = v_kod where id = v_komp;

  insert into public.t2_azolik (foydalanuvchi_id, kompaniya_id, rol, holat)
  values (p_actor_id, v_komp, 'boss', 'faol')
  returning id into v_azolik;

  perform public.t2_audit_yoz(v_komp, 'kompaniya_yarat', 'onboarding', null,
    format('nom=%s kod=%s director=azolik:%s', v_nom, v_kod, v_azolik), 'actor:'||p_actor_id, null);

  v_prev := jsonb_build_object('ok',true,'kompaniya_id',v_komp,'kod',v_kod,'rol','boss','azolik_id',v_azolik);
  insert into public.t2_onboarding_command_log (operation_id, actor_id, command, natija)
    values (p_operation_id, p_actor_id, 'kompaniya_yarat', v_prev);
  return v_prev;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Canonical "current user + memberships" read model
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.t2_men_v1(p_actor_id bigint)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_u public.t2_foydalanuvchi%rowtype; v_az jsonb;
begin
  if p_actor_id is null or p_actor_id <= 0 then return jsonb_build_object('ok',false,'code','AUTH_REQUIRED'); end if;
  select * into v_u from public.t2_foydalanuvchi where id = p_actor_id;
  if not found then return jsonb_build_object('ok',false,'code','ACTOR_NOT_FOUND'); end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'azolik_id', a.id, 'kompaniya_id', k.id, 'nom', k.nom, 'kod', k.kod,
           'rol', a.rol, 'is_director', a.rol in ('boss','superadmin'),
           'holat', a.holat, 'faol', k.faol) order by k.nom), '[]'::jsonb)
    into v_az
  from public.t2_azolik a join public.t2_kompaniya k on k.id = a.kompaniya_id
  where a.foydalanuvchi_id = p_actor_id and a.holat = 'faol';

  return jsonb_build_object('ok', true,
    'foydalanuvchi', jsonb_build_object('id', v_u.id, 'login', v_u.login, 'ism', v_u.ism,
                                        'email', v_u.email, 'holat', coalesce(v_u.holat,'faol')),
    'azoliklar', v_az,
    'jami', jsonb_array_length(v_az),
    'onboarding_kerak', jsonb_array_length(v_az) = 0);
end $$;

revoke all on function public.t2_men_v1(bigint) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Director-guarded membership commands
--    Actor must be an active boss/superadmin of the target company.
--    superadmin can never be granted through these paths (platform-level only).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.t2_azo_actor_director_tekshir(p_kompaniya_id bigint, p_actor_id bigint)
returns text language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_rol text;
begin
  v_rol := public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id, p_actor_id); -- raises 42501 if not a member
  if v_rol not in ('boss','superadmin') then
    raise exception 'faqat direktor (boss) yoki superadmin' using errcode='42501';
  end if;
  return v_rol;
end $$;

create or replace function public.t2_azolik_qosh_v1(
  p_actor_id bigint, p_kompaniya_id bigint, p_login text, p_rol text,
  p_email text, p_ism text, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_prev jsonb; v_uid bigint; v_azolik bigint;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  select natija into v_prev from public.t2_onboarding_command_log where operation_id = p_operation_id;
  if found then return v_prev; end if;

  perform public.t2_azo_actor_director_tekshir(p_kompaniya_id, p_actor_id);

  if coalesce(btrim(p_login),'') = '' then return jsonb_build_object('ok',false,'code','LOGIN_REQUIRED'); end if;
  if p_rol is null or p_rol not in ('boss','rahbar','bugalter','pto','prorab','buyurtmachi','pudratchi','kuzatuvchi') then
    return jsonb_build_object('ok',false,'code','ROLE_INVALID','xato','superadmin bu yerdan berilmaydi');
  end if;
  if not exists (select 1 from public.t2_kompaniya where id = p_kompaniya_id and faol) then
    return jsonb_build_object('ok',false,'code','COMPANY_NOT_FOUND');
  end if;

  select id into v_uid from public.t2_foydalanuvchi where login = p_login;
  if not found then
    insert into public.t2_foydalanuvchi (login, email, ism, holat)
    values (p_login, nullif(p_email,''), nullif(p_ism,''), 'faol') returning id into v_uid;
  end if;

  if exists (select 1 from public.t2_azolik
             where foydalanuvchi_id = v_uid and kompaniya_id = p_kompaniya_id and holat = 'faol') then
    return jsonb_build_object('ok',false,'code','ALREADY_MEMBER');
  end if;

  insert into public.t2_azolik (foydalanuvchi_id, kompaniya_id, rol, holat)
  values (v_uid, p_kompaniya_id, p_rol, 'faol') returning id into v_azolik;

  perform public.t2_audit_yoz(p_kompaniya_id, 'azolik_qosh', 'onboarding', null,
    format('login=%s rol=%s azolik:%s', p_login, p_rol, v_azolik), 'actor:'||p_actor_id, null);

  v_prev := jsonb_build_object('ok',true,'azolik_id',v_azolik,'foydalanuvchi_id',v_uid,'rol',p_rol);
  insert into public.t2_onboarding_command_log (operation_id, actor_id, command, natija)
    values (p_operation_id, p_actor_id, 'azolik_qosh', v_prev);
  return v_prev;
end $$;

create or replace function public.t2_azolik_rol_ozgartir_v1(
  p_actor_id bigint, p_azolik_id bigint, p_yangi_rol text, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_prev jsonb; v_az public.t2_azolik%rowtype; v_boss_soni int;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  select natija into v_prev from public.t2_onboarding_command_log where operation_id = p_operation_id;
  if found then return v_prev; end if;

  select * into v_az from public.t2_azolik where id = p_azolik_id;
  if not found then return jsonb_build_object('ok',false,'code','MEMBERSHIP_NOT_FOUND'); end if;
  perform public.t2_azo_actor_director_tekshir(v_az.kompaniya_id, p_actor_id);

  if p_yangi_rol is null or p_yangi_rol not in ('boss','rahbar','bugalter','pto','prorab','buyurtmachi','pudratchi','kuzatuvchi') then
    return jsonb_build_object('ok',false,'code','ROLE_INVALID');
  end if;

  -- cannot demote the last active director of a company
  if v_az.rol = 'boss' and p_yangi_rol <> 'boss' then
    select count(*) into v_boss_soni from public.t2_azolik
     where kompaniya_id = v_az.kompaniya_id and holat = 'faol' and rol = 'boss';
    if v_boss_soni <= 1 then return jsonb_build_object('ok',false,'code','LAST_DIRECTOR'); end if;
  end if;

  update public.t2_azolik set rol = p_yangi_rol where id = p_azolik_id;
  perform public.t2_audit_yoz(v_az.kompaniya_id, 'azolik_rol_ozgartir', 'onboarding', null,
    format('azolik:%s %s->%s', p_azolik_id, v_az.rol, p_yangi_rol), 'actor:'||p_actor_id, null);

  v_prev := jsonb_build_object('ok',true,'azolik_id',p_azolik_id,'rol',p_yangi_rol);
  insert into public.t2_onboarding_command_log (operation_id, actor_id, command, natija)
    values (p_operation_id, p_actor_id, 'azolik_rol_ozgartir', v_prev);
  return v_prev;
end $$;

create or replace function public.t2_azolik_ochir_v1(
  p_actor_id bigint, p_azolik_id bigint, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_prev jsonb; v_az public.t2_azolik%rowtype; v_boss_soni int;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  select natija into v_prev from public.t2_onboarding_command_log where operation_id = p_operation_id;
  if found then return v_prev; end if;

  select * into v_az from public.t2_azolik where id = p_azolik_id;
  if not found then return jsonb_build_object('ok',false,'code','MEMBERSHIP_NOT_FOUND'); end if;
  if v_az.holat <> 'faol' then return jsonb_build_object('ok',true,'takror',true,'azolik_id',p_azolik_id); end if;
  perform public.t2_azo_actor_director_tekshir(v_az.kompaniya_id, p_actor_id);

  if v_az.rol = 'boss' then
    select count(*) into v_boss_soni from public.t2_azolik
     where kompaniya_id = v_az.kompaniya_id and holat = 'faol' and rol = 'boss';
    if v_boss_soni <= 1 then return jsonb_build_object('ok',false,'code','LAST_DIRECTOR'); end if;
  end if;

  update public.t2_azolik set holat = 'bekor' where id = p_azolik_id;
  perform public.t2_audit_yoz(v_az.kompaniya_id, 'azolik_ochir', 'onboarding', null,
    format('azolik:%s login_uid:%s', p_azolik_id, v_az.foydalanuvchi_id), 'actor:'||p_actor_id, null);

  v_prev := jsonb_build_object('ok',true,'azolik_id',p_azolik_id,'holat','bekor');
  insert into public.t2_onboarding_command_log (operation_id, actor_id, command, natija)
    values (p_operation_id, p_actor_id, 'azolik_ochir', v_prev);
  return v_prev;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Registration-request approval that ALSO provisions the director
--    (v1 t2_royxat_sorov_qabul left intact for back-compat; this is additive)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.t2_royxat_sorov_qabul_v2(
  p_id bigint, p_korgan text, p_izoh text,
  p_owner_login text, p_owner_ism text default null, p_owner_email text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_s record; v_komp bigint; v_kod text; v_uid bigint; v_azolik bigint;
begin
  select * into v_s from public.t2_royxat_sorov where id = p_id;
  if not found then return jsonb_build_object('ok',false,'code','REQUEST_NOT_FOUND'); end if;
  if v_s.holat = 'qabul' and v_s.kompaniya_id is not null then
    return jsonb_build_object('ok',true,'takror',true,'kompaniya_id',v_s.kompaniya_id);
  end if;
  if coalesce(btrim(p_owner_login),'') = '' then return jsonb_build_object('ok',false,'code','OWNER_LOGIN_REQUIRED'); end if;

  insert into public.t2_kompaniya (nom, kod, faol, inn, telefon)
  values (v_s.kompaniya, 'PENDING', true, v_s.inn, v_s.telefon) returning id into v_komp;
  v_kod := public.t2_kompaniya_kod_yasa(v_s.kompaniya, v_komp);
  update public.t2_kompaniya set kod = v_kod where id = v_komp;

  select id into v_uid from public.t2_foydalanuvchi where login = p_owner_login;
  if not found then
    insert into public.t2_foydalanuvchi (login, ism, email, holat)
    values (p_owner_login, coalesce(nullif(p_owner_ism,''), v_s.ism), coalesce(nullif(p_owner_email,''), v_s.email), 'faol')
    returning id into v_uid;
  end if;

  insert into public.t2_azolik (foydalanuvchi_id, kompaniya_id, rol, holat)
  values (v_uid, v_komp, 'boss', 'faol') returning id into v_azolik;

  update public.t2_royxat_sorov
     set holat='qabul', kompaniya_id=v_komp, korgan=p_korgan, qaror_izoh=p_izoh, yangilandi=now()
   where id = p_id;

  perform public.t2_audit_yoz(v_komp, 'royxat_sorov_qabul', 'onboarding', null,
    format('sorov:%s kod=%s director_login=%s azolik:%s', p_id, v_kod, p_owner_login, v_azolik),
    coalesce('actor:'||p_korgan, 'system'), null);

  return jsonb_build_object('ok',true,'kompaniya_id',v_komp,'kod',v_kod,'director_foydalanuvchi_id',v_uid,'azolik_id',v_azolik);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Lock down: service_role only
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on function public.t2_kompaniya_yarat_v1(bigint,text,text,text,uuid) from public, anon, authenticated;
revoke all on function public.t2_azolik_qosh_v1(bigint,bigint,text,text,text,text,uuid) from public, anon, authenticated;
revoke all on function public.t2_azolik_rol_ozgartir_v1(bigint,bigint,text,uuid) from public, anon, authenticated;
revoke all on function public.t2_azolik_ochir_v1(bigint,bigint,uuid) from public, anon, authenticated;
revoke all on function public.t2_royxat_sorov_qabul_v2(bigint,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.t2_kompaniya_kod_yasa(text,bigint) from public, anon, authenticated;
revoke all on function public.t2_azo_actor_director_tekshir(bigint,bigint) from public, anon, authenticated;

commit;
