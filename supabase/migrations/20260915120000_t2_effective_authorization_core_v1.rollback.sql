-- PRE-USE ONLY. Do not use once platform roles or scope grants contain business authority.
begin;
drop function if exists public.t2_effective_authorization_v1(bigint,bigint,bigint,bigint,text,text);
drop table if exists public.t2_obyekt_foydalanuvchi_ruxsat;
drop table if exists public.t2_loyiha_foydalanuvchi_ruxsat;
drop table if exists public.t2_platforma_kompaniya_kontekst;
drop table if exists public.t2_platforma_rol;
commit;
