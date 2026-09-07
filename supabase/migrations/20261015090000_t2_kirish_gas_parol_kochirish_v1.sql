-- T2-AUTH-GAS-RETIREMENT-001 -- self-healing GAS->Supabase password
-- migration, at the exact moment a GAS-verified login proves it knows the
-- plaintext password.
--
-- Owner (2026-09-07): "hali ham login da gas tizimidan foydalanib kirilayapdimi?
-- qanaqadir sekinroq kirayapdida hali ham" -- confirmed: t2_parol_hash_v1
-- (20261005120000) added the Supabase-native bcrypt path but never migrated
-- any EXISTING user off GAS -- `parol_hash` starts NULL for every row, and
-- nothing ever sets it afterward. Every login that predates that migration
-- (i.e. every login today) still pays a live Google Apps Script round trip
-- on EVERY sign-in -- GAS cold starts routinely add multiple seconds, on
-- top of the two Supabase round trips (t2_parol_tekshir_v1 + this RPC)
-- already in the chain. That GAS hop is the slowness.
--
-- Fix: `t2_kirish_royxatga_ol` (already called on every login, both paths,
-- right after password verification) gains one new trailing optional
-- parameter. `frontend/functions/api/kirish.ts` passes the plaintext
-- password it JUST had GAS verify, ONLY on the GAS-fallback branch. If
-- this login's `parol_hash` is still null, it is hashed and stored right
-- here -- zero extra network round trip (this call was already happening),
-- and every LATER login for that user takes the fast Supabase-only path
-- and never touches GAS again. An existing hash is never touched (the
-- login flow only reaches this RPC via the GAS branch when Supabase
-- already reported NO_PASSWORD_SET, so this can't race a fresher hash).
--
-- ADDITIVE ONLY: one new default-valued trailing parameter on an existing
-- function (same pattern as the earlier `p_email` addition to this same
-- RPC) -- no existing caller needs to change, no grant changes.

begin;

create or replace function public.t2_kirish_royxatga_ol(
  p_login text, p_rol text, p_email text default null, p_gas_verified_parol text default null)
returns jsonb language plpgsql security definer set search_path=public, pg_temp as $$
declare v_id bigint; v_komp jsonb; v_hash text;
begin
  insert into t2_foydalanuvchi (login, email)
  values (p_login, p_email)
  on conflict (login) do update set email = coalesce(excluded.email, t2_foydalanuvchi.email)
  returning id, parol_hash into v_id, v_hash;

  if p_gas_verified_parol is not null and v_hash is null then
    update t2_foydalanuvchi
      set parol_hash = extensions.crypt(p_gas_verified_parol, extensions.gen_salt('bf')),
          parol_yangilandi = now()
      where id = v_id;
  end if;

  select jsonb_agg(jsonb_build_object('kompaniya_id', a.kompaniya_id, 'rol', a.rol))
    into v_komp
  from t2_azolik a where a.foydalanuvchi_id = v_id and a.holat = 'faol';

  return jsonb_build_object('ok', true, 'foydalanuvchi_id', v_id, 'azoliklar', coalesce(v_komp, '[]'::jsonb));
end $$;

commit;
