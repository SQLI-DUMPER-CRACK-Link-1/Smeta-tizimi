-- T2-PTO-OWNER-CRITICAL-CLOSURE: NAKRUTKA (markup/overhead) cascade engine,
-- ported natively from T1 GAS (Smeta tizimi/80_Shartnoma.js, apiNakrutkaOl/
-- apiNakrutkaSaqla/apiResursNakrutka/apiNakrutkaKoef/apiObyektNakrutka).
--
-- This is the concrete reason resource `kat` (ЧЕЛ/МАШ/МАТ/ОБ/М/К/КАБ)
-- matters at all: transport/warehouse/contractor/insurance/risk/VAT steps
-- apply to DIFFERENT category sums, in a specific cascade order, not
-- uniformly. Confirmed line-by-line against the T1 source; this is a
-- straight, faithful port of `nakrutkaHisob` (linear cascade) and
-- `_nakrutkaKoefTable` (exact per-category marginal coefficient via
-- probing -- exact because the cascade is linear, not an approximation).
--
-- Coefficients are company-scoped, with optional per-contract (shartnoma)
-- override -- same two-tier model as T1's "default column + one column per
-- shartnoma" sheet. A company with no rows yet gets T1's own defaults
-- (t2_nakrutka_koef_ol_v1 merges stored rows over hardcoded defaults, never
-- silently zero).

begin;

create table if not exists public.t2_nakrutka_koef (
  id bigint generated always as identity primary key,
  kompaniya_id bigint not null references public.t2_kompaniya(id),
  shartnoma_id bigint references public.t2_shartnoma(id),
  koef_kod text not null,
  qiymat numeric not null,
  izoh text,
  actor_id bigint references public.t2_foydalanuvchi(id),
  yaratildi timestamptz not null default now(),
  yangilandi timestamptz not null default now(),
  versiya integer not null default 1,
  unique (kompaniya_id, shartnoma_id, koef_kod)
);
-- Postgres treats NULL as distinct in a unique index, so the "default row"
-- (shartnoma_id is null) needs its own partial unique index -- the composite
-- unique above only dedupes *within* one shartnoma_id.
create unique index if not exists t2_nakrutka_koef_default_uniq
  on public.t2_nakrutka_koef (kompaniya_id, koef_kod) where shartnoma_id is null;

alter table public.t2_nakrutka_koef enable row level security;
revoke all on table public.t2_nakrutka_koef from anon, authenticated;
drop policy if exists t2_nakrutka_koef_tenant_read on public.t2_nakrutka_koef;
create policy t2_nakrutka_koef_tenant_read on public.t2_nakrutka_koef
  for select to authenticated
  using (exists (select 1 from public.t2_azolik a where a.kompaniya_id = t2_nakrutka_koef.kompaniya_id and a.holat = 'faol'
    and a.foydalanuvchi_id = nullif((select auth.jwt()->'app_metadata'->>'t2_actor_id'),'')::bigint));

-- ── T1's exact defaults (_NAKR_DEFAULT) ─────────────────────────────────
create or replace function public.t2_nakrutka_default_v1()
returns jsonb language sql immutable parallel safe as $$
  select jsonb_build_object(
    'ЗТР_СОЦСТРАХ', 12, 'ТРАНСПОРТ_МАТЕРИАЛ', 5, 'СКЛАДСКИЕ_МАТЕРИАЛ', 2,
    'СКЛАДСКИЕ_МК', 0.75, 'ТРАНСПОРТ_КАБЕЛЬ', 1.5, 'ПРОЧИЕ_ПОДРЯДЧИК', 18,
    'ТРАНСПОРТ_ОБОРУД', 2, 'ЗАГОТ_СКЛАД_ОБОРУД', 1.2, 'СТРАХОВАНИЕ', 0.32,
    'РИСК', 0, 'НДС', 12);
$$;

-- ── nakrutkaHisob cascade, ported 1:1 ────────────────────────────────────
-- p_cats: {chel,mash,mat,ob,mk,kab,bez} direct-cost category sums.
-- p_nk: coefficient map (jsonb), same keys as t2_nakrutka_default_v1.
create or replace function public.t2_nakrutka_hisobla_v1(p_cats jsonb, p_nk jsonb)
returns jsonb language plpgsql immutable parallel safe as $$
declare
  chel numeric := coalesce((p_cats->>'chel')::numeric, 0);
  mash numeric := coalesce((p_cats->>'mash')::numeric, 0);
  mat  numeric := coalesce((p_cats->>'mat')::numeric, 0);
  ob   numeric := coalesce((p_cats->>'ob')::numeric, 0);
  mk   numeric := coalesce((p_cats->>'mk')::numeric, 0);
  kab  numeric := coalesce((p_cats->>'kab')::numeric, 0);
  bez  numeric := coalesce((p_cats->>'bez')::numeric, 0);
  k_transport_mat numeric := coalesce((p_nk->>'ТРАНСПОРТ_МАТЕРИАЛ')::numeric, 0);
  k_sklad_mat     numeric := coalesce((p_nk->>'СКЛАДСКИЕ_МАТЕРИАЛ')::numeric, 0);
  k_sklad_mk      numeric := coalesce((p_nk->>'СКЛАДСКИЕ_МК')::numeric, 0);
  k_transport_kab numeric := coalesce((p_nk->>'ТРАНСПОРТ_КАБЕЛЬ')::numeric, 0);
  k_prochie       numeric := coalesce((p_nk->>'ПРОЧИЕ_ПОДРЯДЧИК')::numeric, 0);
  k_transport_ob  numeric := coalesce((p_nk->>'ТРАНСПОРТ_ОБОРУД')::numeric, 0);
  k_zagot_ob      numeric := coalesce((p_nk->>'ЗАГОТ_СКЛАД_ОБОРУД')::numeric, 0);
  k_strah         numeric := coalesce((p_nk->>'СТРАХОВАНИЕ')::numeric, 0);
  k_risk          numeric := coalesce((p_nk->>'РИСК')::numeric, 0);
  k_nds           numeric := coalesce((p_nk->>'НДС')::numeric, 0);
  pryamye numeric; tr_mat numeric; skl_mat numeric; tr_kab numeric;
  itogo1 numeric; prochie numeric; itogo2 numeric;
  tr_ob numeric; zag_ob numeric; itogo3 numeric;
  strax numeric; risk numeric; itogo4 numeric; nds numeric; vsego numeric;
begin
  pryamye := chel + mash + mat + ob;
  tr_mat  := (mat - kab) * k_transport_mat / 100;
  skl_mat := (mat - bez - mk) * k_sklad_mat / 100 + mk * k_sklad_mk / 100;
  tr_kab  := kab * k_transport_kab / 100;
  itogo1  := pryamye - ob + tr_mat + skl_mat + tr_kab;
  prochie := itogo1 * k_prochie / 100;
  itogo2  := itogo1 + prochie;
  tr_ob   := ob * k_transport_ob / 100;
  zag_ob  := ob * k_zagot_ob / 100;
  itogo3  := itogo2 + ob + tr_ob + zag_ob;
  strax   := itogo3 * k_strah / 100;
  risk    := itogo3 * k_risk / 100;
  itogo4  := itogo3 + strax + risk;
  nds     := itogo4 * k_nds / 100;
  vsego   := itogo4 + nds;
  return jsonb_build_object(
    'pryamye', round(pryamye,2), 'chel', chel, 'mash', mash, 'mat', mat, 'ob', ob, 'kab', kab,
    'tr_mat', round(tr_mat,2), 'skl_mat', round(skl_mat,2), 'tr_kab', round(tr_kab,2),
    'itogo1', round(itogo1,2), 'prochie', round(prochie,2), 'itogo2', round(itogo2,2),
    'tr_ob', round(tr_ob,2), 'zag_ob', round(zag_ob,2), 'itogo3', round(itogo3,2),
    'strax', round(strax,2), 'risk', round(risk,2), 'itogo4', round(itogo4,2),
    'nds', round(nds,2), 'vsego', round(vsego,2));
end $$;

-- Exact per-category marginal coefficient (probe: only that category = 1,
-- everything else = 0 -- exact because the cascade above is linear).
create or replace function public.t2_nakrutka_koef_jadval_v1(p_nk jsonb)
returns jsonb language sql immutable parallel safe as $$
  select jsonb_build_object(
    'ЧЕЛ',      (public.t2_nakrutka_hisobla_v1(jsonb_build_object('chel',1), p_nk)->>'vsego')::numeric,
    'МАШ',      (public.t2_nakrutka_hisobla_v1(jsonb_build_object('mash',1), p_nk)->>'vsego')::numeric,
    'МАТ',      (public.t2_nakrutka_hisobla_v1(jsonb_build_object('mat',1), p_nk)->>'vsego')::numeric,
    'ОБ',       (public.t2_nakrutka_hisobla_v1(jsonb_build_object('ob',1), p_nk)->>'vsego')::numeric,
    'М/К',      (public.t2_nakrutka_hisobla_v1(jsonb_build_object('mat',1,'mk',1), p_nk)->>'vsego')::numeric,
    'КАБ',      (public.t2_nakrutka_hisobla_v1(jsonb_build_object('mat',1,'kab',1), p_nk)->>'vsego')::numeric,
    'БЕЗСКЛАД', (public.t2_nakrutka_hisobla_v1(jsonb_build_object('mat',1,'bez',1), p_nk)->>'vsego')::numeric
  );
$$;

-- ── read: effective coefficients (defaults <- company <- contract) ──────
create or replace function public.t2_nakrutka_koef_ol_v1(
  p_kompaniya_id bigint, p_actor_id bigint, p_shartnoma_id bigint default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_rol text; v_nk jsonb; v_komp_override jsonb; v_shartnoma_override jsonb;
begin
  v_rol := public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id, p_actor_id);
  -- Deterministic 3-tier merge via jsonb `||` (right side wins a key) --
  -- NOT via jsonb_object_agg over a UNION, which has no guaranteed
  -- row-processing order for duplicate keys: T1 hard defaults, then
  -- company defaults override, then this contract's override wins last.
  select coalesce(jsonb_object_agg(koef_kod, to_jsonb(qiymat)), '{}'::jsonb) into v_komp_override
    from public.t2_nakrutka_koef where kompaniya_id = p_kompaniya_id and shartnoma_id is null;
  select coalesce(jsonb_object_agg(koef_kod, to_jsonb(qiymat)), '{}'::jsonb) into v_shartnoma_override
    from public.t2_nakrutka_koef where kompaniya_id = p_kompaniya_id and shartnoma_id = p_shartnoma_id and p_shartnoma_id is not null;
  v_nk := public.t2_nakrutka_default_v1() || v_komp_override || v_shartnoma_override;

  return jsonb_build_object('ok', true, 'shartnoma_id', p_shartnoma_id, 'koeffitsientlar', v_nk,
    'jadval', public.t2_nakrutka_koef_jadval_v1(v_nk));
end $$;
revoke all on function public.t2_nakrutka_koef_ol_v1(bigint,bigint,bigint) from public, anon, authenticated;
grant execute on function public.t2_nakrutka_koef_ol_v1(bigint,bigint,bigint) to service_role;

-- ── write: set one coefficient (company default, or one contract's override) ──
create or replace function public.t2_nakrutka_koef_saqla_v1(
  p_kompaniya_id bigint, p_actor_id bigint, p_shartnoma_id bigint,
  p_koef_kod text, p_qiymat numeric, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_prev jsonb; v_rol text; v_row public.t2_nakrutka_koef;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  select natija into v_prev from public.t2_onboarding_command_log where operation_id = p_operation_id;
  if found then return v_prev; end if;

  v_rol := public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id, p_actor_id);
  if v_rol not in ('admin','superadmin','boss','director','pto') then
    raise exception 'WRITE_ROLE_REQUIRED' using errcode='42501';
  end if;
  if not (public.t2_nakrutka_default_v1() ? p_koef_kod) then
    return jsonb_build_object('ok',false,'code','KOEF_KOD_INVALID');
  end if;
  if p_shartnoma_id is not null and not exists(
      select 1 from public.t2_shartnoma s where s.id=p_shartnoma_id and s.kompaniya_id=p_kompaniya_id) then
    return jsonb_build_object('ok',false,'code','SHARTNOMA_SCOPE_MISMATCH');
  end if;

  insert into public.t2_nakrutka_koef(kompaniya_id, shartnoma_id, koef_kod, qiymat, actor_id)
    values (p_kompaniya_id, p_shartnoma_id, p_koef_kod, p_qiymat, p_actor_id)
    on conflict (kompaniya_id, koef_kod) where shartnoma_id is null
    do update set qiymat = excluded.qiymat, actor_id = excluded.actor_id,
      yangilandi = now(), versiya = t2_nakrutka_koef.versiya + 1
    returning * into v_row;
  if v_row.id is null then
    -- p_shartnoma_id given: the partial index above didn't fire (its WHERE
    -- is shartnoma_id is null); fall back to the composite unique.
    insert into public.t2_nakrutka_koef(kompaniya_id, shartnoma_id, koef_kod, qiymat, actor_id)
      values (p_kompaniya_id, p_shartnoma_id, p_koef_kod, p_qiymat, p_actor_id)
      on conflict (kompaniya_id, shartnoma_id, koef_kod)
      do update set qiymat = excluded.qiymat, actor_id = excluded.actor_id,
        yangilandi = now(), versiya = t2_nakrutka_koef.versiya + 1
      returning * into v_row;
  end if;

  v_prev := jsonb_build_object('ok',true,'id',v_row.id,'koef_kod',v_row.koef_kod,'qiymat',v_row.qiymat,'versiya',v_row.versiya);
  insert into public.t2_onboarding_command_log (operation_id, actor_id, command, natija)
    values (p_operation_id, p_actor_id, 'nakrutka_koef_saqla', v_prev);
  return v_prev;
end $$;
revoke all on function public.t2_nakrutka_koef_saqla_v1(bigint,bigint,bigint,text,numeric,uuid) from public, anon, authenticated;
grant execute on function public.t2_nakrutka_koef_saqla_v1(bigint,bigint,bigint,text,numeric,uuid) to service_role;

-- ── per-object: full cascade from current SMETA category sums ───────────
-- Direct-cost basis = current Smeta (t2_qator.summa grouped by kat) --
-- "ПРЯМЫЕ (xarajat asosi)" in T1's own comment. mk/kab/bez sub-splits use
-- the same kat values (М/К, КАБ) already computed by t2_smeta_import_bulk_v1
-- / the resource category registry; "bez" (БЕЗСКЛАД, no-warehouse material)
-- has no T2 flag yet and is always 0 here -- a real, narrower gap than T1
-- (which read it from a per-resource sheet flag we haven't ported).
create or replace function public.t2_obyekt_nakrutka_v1(p_obyekt_id bigint, p_actor_id bigint, p_shartnoma_id bigint default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  v_komp bigint; v_rol text; v_cats jsonb; v_nk_javob jsonb; v_shartnoma_id bigint := p_shartnoma_id;
begin
  select kompaniya_id into v_komp from public.t2_obyekt where id = p_obyekt_id;
  if v_komp is null then return jsonb_build_object('ok',false,'code','OBYEKT_NOT_FOUND'); end if;
  v_rol := public.t2_actor_kompaniya_azo_tekshir(v_komp, p_actor_id);

  if v_shartnoma_id is null then
    select sb.shartnoma_id into v_shartnoma_id
      from public.t2_shartnoma_bog sb where sb.obyekt_id = p_obyekt_id and sb.holat = 'faol' limit 1;
  end if;

  -- `mat` is the FULL material bucket the cascade formula expects (МАТ +
  -- М/К + КАБ -- mk/kab are subsets of it the formula subtracts back out
  -- for their own transport/warehouse steps, not a separate direct-cost
  -- category the way ОБ is). ОБ (equipment) is its own bucket.
  select jsonb_build_object(
    'chel', coalesce(sum(summa) filter (where kat='ЧЕЛ'), 0),
    'mash', coalesce(sum(summa) filter (where kat='МАШ'), 0),
    'mat',  coalesce(sum(summa) filter (where kat in ('МАТ','М/К','КАБ')), 0),
    'ob',   coalesce(sum(summa) filter (where kat='ОБ'), 0),
    'mk',   coalesce(sum(summa) filter (where kat='М/К'), 0),
    'kab',  coalesce(sum(summa) filter (where kat='КАБ'), 0),
    'bez',  0)
    into v_cats
    from public.t2_qator where obyekt_id = p_obyekt_id and tur in ('rs','mat','ob');

  v_nk_javob := public.t2_nakrutka_koef_ol_v1(v_komp, p_actor_id, v_shartnoma_id);
  return jsonb_build_object('ok', true, 'obyekt_id', p_obyekt_id, 'shartnoma_id', v_shartnoma_id,
    'cats', v_cats, 'koeffitsientlar', v_nk_javob->'koeffitsientlar',
    'nakrutka', public.t2_nakrutka_hisobla_v1(v_cats, v_nk_javob->'koeffitsientlar'),
    'jadval', v_nk_javob->'jadval');
end $$;
revoke all on function public.t2_obyekt_nakrutka_v1(bigint,bigint,bigint) from public, anon, authenticated;
grant execute on function public.t2_obyekt_nakrutka_v1(bigint,bigint,bigint) to service_role;

commit;
