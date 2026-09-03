-- T2-COMPANY-CONTROL-FOUNDATION-001 -- canonical company profile update.
-- SOURCE ONLY. Production freeze active -- NOT applied in this task.
-- Depends on 20260915120000_t2_effective_authorization_core_v1 (Codex,
-- already merged into this branch) for the permission check.
--
-- The legacy t2_kompaniya_yangila (no actor check, EXECUTE was granted to
-- PUBLIC/anon/authenticated -- see the 2026-09-03 security incident
-- record) stays revoked and is NOT the canonical path. This is its
-- actor-aware, audited, optimistically-locked, idempotent replacement.

begin;

create table if not exists public.t2_kompaniya_command_log (
  operation_id uuid primary key,
  actor_id     bigint not null,
  command      text   not null,
  natija       jsonb  not null,
  created_at   timestamptz not null default now()
);
alter table public.t2_kompaniya_command_log enable row level security;
revoke all on public.t2_kompaniya_command_log from public, anon, authenticated;

create or replace function public.t2_kompaniya_yangila_v1(
  p_actor_id bigint,
  p_kompaniya_id bigint,
  p_expected_version integer,
  p_toliq_nom text default null,
  p_inn text default null,
  p_manzil text default null,
  p_rahbar text default null,
  p_telefon text default null,
  p_bank text default null,
  p_hisob_raqam text default null,
  p_mfo text default null,
  p_mavqe text default null,
  p_operation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_prev jsonb;
  v_auth jsonb;
  v_row public.t2_kompaniya%rowtype;
  v_new_version integer;
  v_diff text := '';
begin
  if p_operation_id is null then
    return jsonb_build_object('ok', false, 'code', 'OPERATION_ID_REQUIRED');
  end if;
  select natija into v_prev from public.t2_kompaniya_command_log where operation_id = p_operation_id;
  if found then return v_prev; end if;

  if p_kompaniya_id is null or p_kompaniya_id <= 0 or p_actor_id is null or p_actor_id <= 0 then
    return jsonb_build_object('ok', false, 'code', 'REQUEST_INVALID');
  end if;

  -- Reuses the effective-authorization core (Codex, T2-COMPANY-CONTROL-AUTH-CORE-001)
  -- instead of a bespoke director check -- one authorization truth, not two.
  v_auth := public.t2_effective_authorization_v1(p_actor_id, p_kompaniya_id, null, null, 'company.profile.update', null);
  if coalesce((v_auth->>'allowed')::boolean, false) is distinct from true then
    return jsonb_build_object('ok', false, 'code', 'AUTHORIZATION_DENIED', 'reason', v_auth->>'reason');
  end if;

  if p_inn is not null and p_inn <> '' and p_inn !~ '^\d{9}$' then
    return jsonb_build_object('ok', false, 'code', 'INN_INVALID', 'xato', 'STIR 9 ta raqam');
  end if;
  if p_mavqe is not null and p_mavqe not in ('zakazchik','pudratchi','loyihachi') then
    return jsonb_build_object('ok', false, 'code', 'MAVQE_INVALID');
  end if;

  select * into v_row from public.t2_kompaniya where id = p_kompaniya_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'COMPANY_NOT_FOUND');
  end if;
  if v_row.versiya <> p_expected_version then
    return jsonb_build_object('ok', false, 'code', 'STALE_VERSION', 'versiya', v_row.versiya);
  end if;

  -- old/new per changed field, for the audit trail -- never just "profile updated".
  if p_toliq_nom is not null and p_toliq_nom is distinct from v_row.toliq_nom then
    v_diff := v_diff || format('toliq_nom: %s -> %s; ', coalesce(v_row.toliq_nom,'-'), p_toliq_nom); end if;
  if p_inn is not null and p_inn is distinct from v_row.inn then
    v_diff := v_diff || format('inn: %s -> %s; ', coalesce(v_row.inn,'-'), p_inn); end if;
  if p_manzil is not null and p_manzil is distinct from v_row.manzil then
    v_diff := v_diff || format('manzil: %s -> %s; ', coalesce(v_row.manzil,'-'), p_manzil); end if;
  if p_rahbar is not null and p_rahbar is distinct from v_row.rahbar then
    v_diff := v_diff || format('rahbar: %s -> %s; ', coalesce(v_row.rahbar,'-'), p_rahbar); end if;
  if p_telefon is not null and p_telefon is distinct from v_row.telefon then
    v_diff := v_diff || format('telefon: %s -> %s; ', coalesce(v_row.telefon,'-'), p_telefon); end if;
  if p_bank is not null and p_bank is distinct from v_row.bank then
    v_diff := v_diff || 'bank: (o''zgardi); '; end if;
  if p_hisob_raqam is not null and p_hisob_raqam is distinct from v_row.hisob_raqam then
    v_diff := v_diff || 'hisob_raqam: (o''zgardi); '; end if;
  if p_mfo is not null and p_mfo is distinct from v_row.mfo then
    v_diff := v_diff || format('mfo: %s -> %s; ', coalesce(v_row.mfo,'-'), p_mfo); end if;
  if p_mavqe is not null and p_mavqe is distinct from v_row.mavqe then
    v_diff := v_diff || format('mavqe: %s -> %s; ', coalesce(v_row.mavqe,'-'), p_mavqe); end if;

  update public.t2_kompaniya set
    toliq_nom = coalesce(p_toliq_nom, toliq_nom),
    inn = coalesce(p_inn, inn),
    manzil = coalesce(p_manzil, manzil),
    rahbar = coalesce(p_rahbar, rahbar),
    telefon = coalesce(p_telefon, telefon),
    bank = coalesce(p_bank, bank),
    hisob_raqam = coalesce(p_hisob_raqam, hisob_raqam),
    mfo = coalesce(p_mfo, mfo),
    mavqe = coalesce(p_mavqe, mavqe),
    versiya = versiya + 1
  where id = p_kompaniya_id
  returning versiya into v_new_version;

  if v_diff <> '' then
    perform public.t2_audit_yoz(p_kompaniya_id, 'kompaniya_profil_yangila', 'company', null,
      v_diff, 'actor:'||p_actor_id, null);
  end if;

  v_prev := jsonb_build_object('ok', true, 'kompaniya_id', p_kompaniya_id, 'versiya', v_new_version);
  insert into public.t2_kompaniya_command_log (operation_id, actor_id, command, natija)
    values (p_operation_id, p_actor_id, 'kompaniya_yangila_v1', v_prev);
  return v_prev;
end
$function$;

revoke all on function public.t2_kompaniya_yangila_v1(bigint,bigint,integer,text,text,text,text,text,text,text,text,text,uuid)
  from public, anon, authenticated;
grant execute on function public.t2_kompaniya_yangila_v1(bigint,bigint,integer,text,text,text,text,text,text,text,text,text,uuid)
  to service_role;

comment on function public.t2_kompaniya_yangila_v1(bigint,bigint,integer,text,text,text,text,text,text,text,text,text,uuid) is
  'T2-COMPANY-CONTROL-FOUNDATION-001: canonical company-profile update. Actor from session only, effective-authorization-core guarded, optimistic lock, operation_id idempotent, per-field audit diff. Replaces the legacy unguarded t2_kompaniya_yangila (revoked 2026-09-03).';

commit;
