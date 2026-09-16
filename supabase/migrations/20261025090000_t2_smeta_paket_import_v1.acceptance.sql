-- T2-PTO-SMETA-PAKET-IMPORT-001 acceptance.
-- Migration qo'llangandan keyin READ-ONLY kontrakt tekshiruvi. Bu fayl
-- real obyekt, foydalanuvchi yoki moliyaviy qator yaratmaydi.

begin;

do $$
declare v_def text;
begin
  if to_regclass('public.t2_smeta_paket') is null
     or to_regclass('public.t2_smeta_paket_manba') is null
     or to_regclass('public.t2_smeta_paket_res_manba') is null
     or to_regclass('public.t2_smeta_paket_import_sessiya') is null
     or to_regclass('public.t2_smeta_paket_import_bolak') is null then
    raise exception 'SMETA_PACKAGE_ACCEPTANCE_FAIL: package tables missing';
  end if;
  if not exists(select 1 from information_schema.columns
                where table_schema='public' and table_name='t2_qator' and column_name='smeta_paket_manba_id') then
    raise exception 'SMETA_PACKAGE_ACCEPTANCE_FAIL: t2_qator provenance member missing';
  end if;
  if not exists(select 1 from information_schema.columns
                where table_schema='public' and table_name='t2_document_registry' and column_name='source_slot_key') then
    raise exception 'SMETA_PACKAGE_ACCEPTANCE_FAIL: document logical slot missing';
  end if;
  if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                where n.nspname='public' and p.proname='t2_smeta_paket_import_boshla_v1')
     or not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                   where n.nspname='public' and p.proname='t2_smeta_paket_import_bolak_v1')
     or not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                   where n.nspname='public' and p.proname='t2_smeta_paket_import_yakunla_v1') then
    raise exception 'SMETA_PACKAGE_ACCEPTANCE_FAIL: package RPC missing';
  end if;
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='t2_smeta_paket_import_yakunla_v1' limit 1;
  if v_def not ilike '%source_document_id%' or v_def not ilike '%smeta_paket_manba_id%' then
    raise exception 'SMETA_PACKAGE_ACCEPTANCE_FAIL: row provenance write missing';
  end if;
  if v_def not ilike '%SMETA_ALREADY_EXISTS%' then
    raise exception 'SMETA_PACKAGE_ACCEPTANCE_FAIL: first-import guard missing';
  end if;
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
                where n.nspname='public' and c.relname='t2_smeta_paket' and c.relrowsecurity) then
    raise exception 'SMETA_PACKAGE_ACCEPTANCE_FAIL: package RLS disabled';
  end if;
  raise notice 'SMETA_PACKAGE_ACCEPTANCE_PASS';
end $$;

rollback;
