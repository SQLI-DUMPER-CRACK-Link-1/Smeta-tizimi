-- Rollback for 20261005120000_t2_parol_hash_v1.
-- ⚠️ REFUSES to drop `parol_hash` if any row actually has one set -- that
-- would silently lock out every member who was migrated to a Supabase
-- password (their login would then find no hash AND no GAS _XODIMLAR
-- row either, since new members never had one). Drop the functions first
-- either way (they are pure, no data loss); the columns only drop clean.

begin;

drop function if exists public.t2_parol_tekshir_v1(text,text);
drop function if exists public.t2_parol_belgila_v1(bigint,bigint,bigint,text,uuid);

do $$
begin
  if exists (select 1 from public.t2_foydalanuvchi where parol_hash is not null) then
    raise exception 'REFUSING ROLLBACK: kamida bitta foydalanuvchida parol_hash bor -- ustunni o''chirish uni tizimga umuman kira olmaydigan qilib qo''yadi. Avval o''sha foydalanuvchi(lar)ni GAS _XODIMLAR''ga qo''lda qaytaring, keyin qayta urining.';
  end if;
end $$;

alter table public.t2_foydalanuvchi
  drop column if exists parol_hash,
  drop column if exists parol_yangilandi;

commit;
