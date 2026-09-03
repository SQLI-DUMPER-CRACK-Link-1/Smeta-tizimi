-- Rollback for 20260915130000_t2_platforma_rol_backfill_v1. Pure data
-- deletion of exactly the rows this backfill would have inserted -- additive
-- migration, safe to reverse any time (no downstream writes depend on these
-- specific rows existing, since the effective-authorization core is itself
-- not yet wired into any live write path at the time this pairs with it).
delete from public.t2_platforma_kompaniya_kontekst c
using public.t2_azolik a
where a.rol = 'superadmin' and a.holat = 'faol'
  and c.foydalanuvchi_id = a.foydalanuvchi_id and c.kompaniya_id = a.kompaniya_id;

delete from public.t2_platforma_rol r
using public.t2_azolik a
where a.rol = 'superadmin' and a.holat = 'faol'
  and r.foydalanuvchi_id = a.foydalanuvchi_id and r.rol = 'platform_superadmin';
