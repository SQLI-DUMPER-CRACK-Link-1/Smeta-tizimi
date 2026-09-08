-- PRE-USE rollback only. RES V2 bilan yozuv bo'lsa tarix/auditni buzmaslik
-- uchun rollback rad etiladi; bunday holatda forward corrective migration kerak.
begin;

do $rollback$
begin
  if exists (
    select 1 from public.t2_onboarding_command_log
     where command = 't2_smeta_narxla_res_v2'
  ) then
    raise exception 'T2_RES_PRICING_V2_ROLLBACK_REFUSED_POST_USE';
  end if;
end;
$rollback$;

revoke all on function public.t2_smeta_narxla_res_v2(bigint, bigint, bigint, uuid, jsonb, jsonb)
  from public, anon, authenticated, service_role;
drop function if exists public.t2_smeta_narxla_res_v2(bigint, bigint, bigint, uuid, jsonb, jsonb);

commit;
