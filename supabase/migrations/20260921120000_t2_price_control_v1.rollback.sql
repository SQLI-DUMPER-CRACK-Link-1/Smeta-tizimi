-- Rollback for 20260921120000_t2_price_control_v1. PRE-USE ONLY: raises
-- if any approved (holat='tasdiqlangan') basis exists, or any
-- t2_akt_qator row has a non-null basis snapshot -- those represent real
-- decisions, not just schema.
do $$
begin
  if exists (select 1 from public.t2_price_basis where holat = 'tasdiqlangan') then
    raise exception 'ROLLBACK_BLOCKED: approved price basis documents exist. Pre-use only.';
  end if;
  if exists (select 1 from public.t2_akt_qator where reference_basis_line_id is not null or basis_approved_price_snapshot is not null) then
    raise exception 'ROLLBACK_BLOCKED: t2_akt_qator rows carry a basis snapshot. Pre-use only.';
  end if;
end $$;

-- restore t2_akt_yarat_v2 to its pre-basis-snapshot form (20260920130000)
-- is out of scope for an automated rollback -- re-apply that migration's
-- CREATE OR REPLACE manually if reverting this far, or drop and re-run.
drop function if exists public.t2_price_control_v1(bigint,bigint);
drop function if exists public.t2_price_basis_resolve_v1(bigint,date);
drop function if exists public.t2_price_basis_yarat_v1(bigint,bigint,text,jsonb,bigint,uuid);

alter table public.t2_akt_qator
  drop column if exists basis_approved_price_snapshot,
  drop column if exists reference_basis_line_id;

drop table if exists public.t2_price_basis_line;
drop table if exists public.t2_price_basis;
