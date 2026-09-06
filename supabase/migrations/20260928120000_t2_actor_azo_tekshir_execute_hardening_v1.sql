-- Productionda avval qo'llangan 20260905150000 hotfix uchun permission
-- yakunlash. DDL emas, ma'lumotni o'zgartirmaydi va faqat browser
-- rollarining ichki authorization helperiga bevosita kirishini yopadi.
begin;

revoke all on function public.t2_actor_kompaniya_azo_tekshir(bigint,bigint) from public, anon, authenticated;
grant execute on function public.t2_actor_kompaniya_azo_tekshir(bigint,bigint) to service_role;

commit;
