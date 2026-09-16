-- PRE-USE ONLY rollback for T2-PTO-SMETA-PAKET-IMPORT-001.
-- Agar birorta package qatori yoki slot-hujjat ishlatilgan bo'lsa bu skript
-- qasddan to'xtaydi: ishlab turgan manba tarixini o'chirish taqiqlangan.

begin;

do $$
begin
  if exists(select 1 from public.t2_qator where smeta_paket_manba_id is not null)
     or exists(select 1 from public.t2_smeta_paket)
     or exists(select 1 from public.t2_document_registry where source_slot_key is not null) then
    raise exception 'PRE_USE_ROLLBACK_REFUSED: package/source documents already used';
  end if;
end $$;

drop function if exists public.t2_smeta_paket_import_yakunla_v1(bigint,bigint,bigint);
drop function if exists public.t2_smeta_paket_import_bolak_v1(bigint,bigint,bigint,integer,jsonb);
drop function if exists public.t2_smeta_paket_import_boshla_v1(bigint,bigint,bigint,uuid,text,text,jsonb);
drop function if exists public.t2_document_canonical_reserve_slot_v1(bigint,bigint,bigint,bigint,text,text,text,text,bigint,text,uuid,text);

alter table public.t2_qator drop column if exists smeta_paket_manba_id;
drop table if exists public.t2_smeta_paket_import_bolak;
drop table if exists public.t2_smeta_paket_import_sessiya;
drop table if exists public.t2_smeta_paket_res_manba;
drop table if exists public.t2_smeta_paket_manba;
drop table if exists public.t2_smeta_paket;
-- `source_slot_key` va uning indeksini ataylab qoldiramiz: finalize_v1
-- shu ustunni ishlatadi. Barcha slotlar NULL bo'lsa uning amaliy semantikasi
-- eski (document_type bo'yicha) tartib bilan aynan bir xil bo'ladi; ustunni
-- o'chirish esa finalize funksiyasini sindiradi.

commit;
