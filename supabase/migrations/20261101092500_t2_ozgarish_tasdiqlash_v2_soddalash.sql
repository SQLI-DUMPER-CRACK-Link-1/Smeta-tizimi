-- T2_OZGARISH_TASDIQLASH_V2_SODDALASH — 20261101092000 (bosqichli signal) dan
-- keyin t2.signal_kechiktir aylanma yo'li va oxirgi to'liq refresh kerak emas:
-- har qator signali O(1). v2 — v1 ning oddiy o'rami (imzo va gateway o'zgarmaydi).
-- Prod tranzaksiya testi (rollback): Amfiteatr bl bekor — 5,0 s → 1,85 s, natija bir xil.
-- Rollback: 20261101091000 dagi v2 ta'rifi. Prod: version 20260925173604.
begin;
create or replace function public.t2_smeta_ozgarish_tasdiqlash_v2(
  p_ozgarish_id bigint, p_actor_id bigint, p_kutilgan_versiya integer, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  return public.t2_smeta_ozgarish_tasdiqlash_v1(p_ozgarish_id, p_actor_id, p_kutilgan_versiya, p_operation_id);
end $$;
revoke all on function public.t2_smeta_ozgarish_tasdiqlash_v2(bigint,bigint,integer,uuid) from public, anon, authenticated;
commit;
