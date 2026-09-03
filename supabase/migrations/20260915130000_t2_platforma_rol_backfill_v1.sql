-- T2-COMPANY-CONTROL-FOUNDATION-001 -- platform-role backfill.
-- SOURCE ONLY. Production freeze active -- NOT applied in this task.
-- Depends on 20260915120000_t2_effective_authorization_core_v1 (t2_platforma_rol,
-- t2_platforma_kompaniya_kontekst tables must exist first).
--
-- FOUND DURING ACCEPTANCE TESTING (2026-09-03): the two live t2_azolik rows
-- with rol='superadmin' (foydalanuvchi_id 4 and 7, company 1) are NOT
-- recognised by t2_effective_authorization_v1's company-membership role
-- vocabulary (boss/rahbar/bugalter/pto/prorab/buyurtmachi/pudratchi/
-- kuzatuvchi) -- by design, per the owner's Section 2 law that platform
-- authority must never be a company-membership role. Reproduced live:
-- calling t2_kompaniya_yangila_v1 as actor 4 (superadmin) returned
-- AUTHORIZATION_DENIED/UNKNOWN_ROLE inside a rolled-back transaction, not
-- because the code is wrong but because these two users would have no
-- platform_rol row yet if this migration ships without this backfill --
-- an outage for the only two admin accounts that currently exist.
--
-- This backfill grants both existing superadmins platform_superadmin PLUS
-- an explicit company-1 context (t2_platforma_kompaniya_kontekst) so they
-- keep exactly the access they have today -- no wider, no narrower. It does
-- NOT touch t2_azolik.rol='superadmin' (left as historical data; nothing in
-- the new authorization core reads it, and the current frontend's
-- superadmin derivation is deliberately still reading it too -- see the
-- Company Control contract's note on why that frontend rewire is deferred
-- until this migration actually ships).

begin;

insert into public.t2_platforma_rol (foydalanuvchi_id, rol, berilgan_by)
select distinct a.foydalanuvchi_id, 'platform_superadmin', a.foydalanuvchi_id
from public.t2_azolik a
where a.rol = 'superadmin' and a.holat = 'faol'
on conflict (foydalanuvchi_id, rol) do nothing;

insert into public.t2_platforma_kompaniya_kontekst (foydalanuvchi_id, kompaniya_id, berilgan_by)
select distinct a.foydalanuvchi_id, a.kompaniya_id, a.foydalanuvchi_id
from public.t2_azolik a
where a.rol = 'superadmin' and a.holat = 'faol'
on conflict (foydalanuvchi_id, kompaniya_id) do nothing;

commit;
