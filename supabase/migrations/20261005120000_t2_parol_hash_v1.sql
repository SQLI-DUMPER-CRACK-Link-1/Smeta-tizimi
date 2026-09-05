-- T2-AUTH-PASSWORD-MIGRATION-001 -- Supabase-native bcrypt password, additive
-- and DUAL-CHECK by design: this migration alone changes NO existing user's
-- ability to log in. `t2_foydalanuvchi.parol_hash` starts NULL for every
-- current row; `t2_parol_tekshir_v1` returns `code:'NO_PASSWORD_SET'` for a
-- NULL hash and the CALLER (frontend/functions/api/kirish.ts) falls back to
-- the existing GAS `_XODIMLAR` check unchanged. Only a login that HAS been
-- given a Supabase password (via `t2_parol_belgila_v1`, the "A'zo qo'shish"
-- flow) is authenticated here instead of GAS -- and once it has one, GAS is
-- no longer consulted for that login (fail-closed: a wrong password against
-- an existing hash is a hard reject, never a silent fall-through to GAS).
--
-- Incident: 2026-09-05 post-deploy round, item 2.1 -- "A'zo qo'shish" wrote a
-- new t2_foydalanuvchi/t2_azolik row but never touched a password anywhere
-- (t2_foydalanuvchi had no password column at all), so a newly added member
-- could not log in: their login did not exist in GAS's plaintext _XODIMLAR
-- sheet either. Owner decision (2026-09-05, via AskUserQuestion): migrate to
-- Supabase, hashed (bcrypt via pgcrypto), never plaintext, GAS stays parallel
-- for existing logins.
--
-- REUSE: t2_actor_kompaniya_azo_tekshir / t2_azo_actor_director_tekshir
-- (membership + director gate, same law as t2_azolik_qosh_v1), t2_audit_yoz.
-- ADDITIVE ONLY: two new nullable columns + two new RPCs. No existing row,
-- table, or RPC is altered.

begin;

alter table public.t2_foydalanuvchi
  add column if not exists parol_hash text,
  add column if not exists parol_yangilandi timestamptz;

comment on column public.t2_foydalanuvchi.parol_hash is
  'bcrypt hash (extensions.crypt/gen_salt(''bf'')) -- NEVER plaintext. NULL means this login still authenticates via the legacy GAS _XODIMLAR sheet (T2-AUTH-PASSWORD-MIGRATION-001 dual-check window).';

-- ─────────────────────────────────────────────────────────────────────────
-- t2_parol_tekshir_v1 -- login-time check. STABLE: reads only, no side
-- effects (bcrypt comparison is pure computation over stored/input text).
-- Case-insensitive login match, matching GAS's own String(login).toLowerCase()
-- behavior exactly (kirish.ts must not become MORE permissive OR stricter
-- than the flow it is displacing for the logins that use it).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.t2_parol_tekshir_v1(p_login text, p_parol text)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_id bigint; v_hash text; v_holat text; v_rol text;
begin
  if coalesce(btrim(p_login),'') = '' or coalesce(p_parol,'') = '' then
    return jsonb_build_object('ok',false,'code','LOGIN_PAROL_MAJBURIY');
  end if;

  select id, parol_hash, holat into v_id, v_hash, v_holat
    from public.t2_foydalanuvchi
    where lower(login) = lower(btrim(p_login));

  if v_id is null then
    return jsonb_build_object('ok',false,'code','NO_PASSWORD_SET');
  end if;
  if v_hash is null then
    return jsonb_build_object('ok',false,'code','NO_PASSWORD_SET');
  end if;
  if v_holat is distinct from 'faol' then
    return jsonb_build_object('ok',false,'code','FOYDALANUVCHI_FAOL_EMAS');
  end if;
  if v_hash <> extensions.crypt(p_parol, v_hash) then
    return jsonb_build_object('ok',false,'code','PAROL_NOTOGRI');
  end if;

  /* Global `rol` -- kirish.ts / imzola() sessiyaga shu maydonni yozadi
     (sess.rol, boss/superadmin ayrim keng qamrovli tekshiruvlar uchun).
     Ko'p kompaniyaga a'zo bo'lsa BIRINCHI faol a'zolik roli olinadi --
     haqiqiy ruxsat har doim per-company tekshiriladi (kompaniyalar[]),
     bu yerdagi qiymat faqat boshlang'ich/keng qamrovli signal. */
  select a.rol into v_rol from public.t2_azolik a
    where a.foydalanuvchi_id = v_id and a.holat = 'faol'
    order by a.id asc limit 1;

  return jsonb_build_object('ok',true,'foydalanuvchi_id',v_id,'rol',coalesce(v_rol,'kuzatuvchi'));
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- t2_parol_belgila_v1 -- admin (boss/superadmin of a company the target
-- shares with the actor) sets/resets a member's password. Same idempotency
-- law as t2_azolik_qosh_v1 (operation_id, t2_onboarding_command_log reuse).
-- Deliberately NOT self-service: this closes exactly the reported gap (a
-- newly added member has no way to log in at all); a user changing their
-- OWN already-working password is a separate, smaller follow-up.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.t2_parol_belgila_v1(
  p_actor_id bigint, p_kompaniya_id bigint, p_foydalanuvchi_id bigint,
  p_yangi_parol text, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_prev jsonb; v_bor boolean;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  select natija into v_prev from public.t2_onboarding_command_log where operation_id = p_operation_id;
  if found then return v_prev; end if;

  perform public.t2_azo_actor_director_tekshir(p_kompaniya_id, p_actor_id);

  if length(coalesce(p_yangi_parol,'')) < 8 then
    return jsonb_build_object('ok',false,'code','PAROL_QISQA','xato','Parol kamida 8 belgi bo''lishi kerak');
  end if;

  /* Maqsad qatorda direktor kompaniyasining haqiqiy a'zosi ekanligi --
     boshqa kompaniyaning foydalanuvchisiga parol tayinlab qo'yish yo'q. */
  select exists(
    select 1 from public.t2_azolik
    where foydalanuvchi_id = p_foydalanuvchi_id and kompaniya_id = p_kompaniya_id and holat = 'faol'
  ) into v_bor;
  if not v_bor then
    return jsonb_build_object('ok',false,'code','AZOLIK_TOPILMADI');
  end if;

  update public.t2_foydalanuvchi
    set parol_hash = extensions.crypt(p_yangi_parol, extensions.gen_salt('bf')),
        parol_yangilandi = now()
    where id = p_foydalanuvchi_id;

  perform public.t2_audit_yoz(p_kompaniya_id, 'parol_belgila', 'onboarding', null,
    format('foydalanuvchi_id=%s', p_foydalanuvchi_id), 'actor:'||p_actor_id, null);

  v_prev := jsonb_build_object('ok',true,'foydalanuvchi_id',p_foydalanuvchi_id);
  insert into public.t2_onboarding_command_log (operation_id, actor_id, command, natija)
    values (p_operation_id, p_actor_id, 'parol_belgila', v_prev);
  return v_prev;
end $$;

revoke all on function public.t2_parol_tekshir_v1(text,text) from public, anon, authenticated;
revoke all on function public.t2_parol_belgila_v1(bigint,bigint,bigint,text,uuid) from public, anon, authenticated;
grant execute on function public.t2_parol_tekshir_v1(text,text) to service_role;
grant execute on function public.t2_parol_belgila_v1(bigint,bigint,bigint,text,uuid) to service_role;

commit;
