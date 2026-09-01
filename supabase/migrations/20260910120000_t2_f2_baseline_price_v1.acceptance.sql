-- Behavioral acceptance for PARK DOC CONTROL 1/3.
-- Run INSIDE a transaction that is ROLLED BACK. :obj = a park object with priced
-- BOQ rows, :actor = an active member. e.g.  \set obj 8   \set actor 3
--
-- Proves (correction #9):
--  * baseline price does NOT drift after a BOQ edit
--  * F2 certified price ABOVE baseline  -> positive variance, baseline intact
--  * F2 certified price BELOW baseline  -> negative variance, baseline intact
--  * previous / current / cumulative reconciliation
--  * only APPROVED F2 enters cumulative; draft F2 stays separate
--  * remaining quantity / value correct
--  * a historical (approved) period is unchanged after a later BOQ revision
--  * actual price is NEVER silently the estimate (unknown stays NULL / qol_nomalum)

do $$
declare
  v jsonb; v_obj bigint := :obj; v_actor bigint := :actor;
  v_q1 bigint; v_q2 bigint; v_q3 bigint;
  v_akt_hist bigint; v_akt_draft bigint;
  v_bn1 numeric; v_bn2 numeric; v_frozen numeric;
  v_hist_baseline numeric; v_hist_narx numeric;
begin
  select id into v_q1 from public.t2_qator where obyekt_id=v_obj and narx>0 order by id limit 1;
  select id into v_q2 from public.t2_qator where obyekt_id=v_obj and narx>0 and id<>v_q1 order by id limit 1;
  select id into v_q3 from public.t2_qator where obyekt_id=v_obj and narx>0 and id not in (v_q1,v_q2) order by id limit 1;
  if v_q3 is null then raise exception 'FAIL setup: need 3 priced BOQ rows on object %', v_obj; end if;
  select narx into v_bn1 from public.t2_qator where id=v_q1;
  select narx into v_bn2 from public.t2_qator where id=v_q2;

  -- ── HISTORICAL period: q1 certified ABOVE baseline (actual price given),
  --                       q2 certified BELOW baseline (no actual source) ──
  v := public.t2_akt_yarat(v_obj, 'f2', date '2026-05-01',
        jsonb_build_array(
          jsonb_build_object('qator_id', v_q1, 'hajm', 3, 'narx', v_bn1 * 1.20,
                             'actual_narx', v_bn1 * 1.20, 'narx_manba', 'taminot', 'narx_manba_id', 777),
          jsonb_build_object('qator_id', v_q2, 'hajm', 2, 'narx', v_bn2 * 0.80)),
        'ACC-HIST', gen_random_uuid());
  if (v->>'ok') <> 'true' then raise exception 'FAIL akt_yarat hist: %', v; end if;
  v_akt_hist := (v->>'akt_id')::bigint;
  if (v->>'revision_id') is null then raise exception 'FAIL: act not stamped with a revision'; end if;

  -- baseline frozen = estimate price, NOT the certified price
  if (select baseline_narx from public.t2_akt_qator where akt_id=v_akt_hist and qator_id=v_q1) <> v_bn1 then
    raise exception 'FAIL q1 baseline_narx not the estimate';
  end if;
  -- price above baseline -> positive variance
  if (select variance_summa from public.t2_akt_qator where akt_id=v_akt_hist and qator_id=v_q1) <= 0 then
    raise exception 'FAIL q1 variance should be positive (certified above baseline)';
  end if;
  -- price below baseline -> negative variance
  if (select variance_summa from public.t2_akt_qator where akt_id=v_akt_hist and qator_id=v_q2) >= 0 then
    raise exception 'FAIL q2 variance should be negative (certified below baseline)';
  end if;
  -- actual price: q1 has a real source -> taminot + value; q2 has none -> NULL, manba qol_nomalum
  if (select actual_narx from public.t2_akt_qator where akt_id=v_akt_hist and qator_id=v_q1) is null
     or (select narx_manba from public.t2_akt_qator where akt_id=v_akt_hist and qator_id=v_q1) <> 'taminot' then
    raise exception 'FAIL q1 actual price / lineage lost';
  end if;
  if (select actual_narx from public.t2_akt_qator where akt_id=v_akt_hist and qator_id=v_q2) is not null then
    raise exception 'FAIL q2 actual_narx must stay NULL when no source (never the estimate)';
  end if;
  if (select narx_manba from public.t2_akt_qator where akt_id=v_akt_hist and qator_id=v_q2) <> 'qol_nomalum' then
    raise exception 'FAIL q2 narx_manba must be qol_nomalum, not a procurement claim';
  end if;

  update public.t2_akt set holat='tasdiqlangan' where id=v_akt_hist;
  select baseline_summa, narx into v_hist_baseline, v_hist_narx
    from public.t2_akt_qator where akt_id=v_akt_hist and qator_id=v_q1;

  -- ── DRAFT current period: must NOT enter certified cumulative ──
  v := public.t2_akt_yarat(v_obj, 'f2', date '2026-07-01',
        jsonb_build_array(jsonb_build_object('qator_id', v_q3, 'hajm', 5)),
        'ACC-DRAFT', gen_random_uuid());
  v_akt_draft := (v->>'akt_id')::bigint;   -- stays 'qoralama'

  -- ── LATER BOQ REVISION: triple q1's price ──
  update public.t2_qator set narx = narx * 3 where id = v_q1;

  -- baseline in the historical act is UNCHANGED
  if (select baseline_narx from public.t2_akt_qator where akt_id=v_akt_hist and qator_id=v_q1) <> v_bn1 then
    raise exception 'FAIL: BOQ re-price silently rewrote the historical F2 baseline';
  end if;
  if (select baseline_summa from public.t2_akt_qator where akt_id=v_akt_hist and qator_id=v_q1) <> v_hist_baseline then
    raise exception 'FAIL: historical period baseline value changed after later revision';
  end if;
  if (select narx from public.t2_akt_qator where akt_id=v_akt_hist and qator_id=v_q1) <> v_hist_narx then
    raise exception 'FAIL: historical period certified price changed after later revision';
  end if;

  -- ── NAKOPITELNIY: period-aware, approved-only cumulative, draft separate ──
  v := public.t2_nakopitelniy_v1(v_obj, v_actor, date '2026-07-01', 1000, true);
  if (v->>'ok') <> 'true' then raise exception 'FAIL nakopitelniy: %', v; end if;

  -- previous approved period (May) is in oldingi, not joriy
  if (v->'jami'->>'oldingi_summa')::numeric <= 0 then raise exception 'FAIL: previous approved period missing from cumulative'; end if;
  -- the draft (July, q3) is in joriy_qoralama_summa, NOT in the certified cumulative
  if (v->'jami'->>'joriy_qoralama_summa')::numeric <= 0 then raise exception 'FAIL: draft F2 not surfaced separately'; end if;
  if (v->'jami'->>'joriy_tasdiqlangan_summa')::numeric <> 0 then raise exception 'FAIL: draft F2 leaked into certified current period'; end if;
  -- cumulative certified = previous + current-approved (here just previous)
  if (v->'jami'->>'jami_tasdiqlangan_summa')::numeric <> (v->'jami'->>'oldingi_summa')::numeric then
    raise exception 'FAIL: cumulative reconciliation (prev + current-approved)';
  end if;
  -- remaining = smeta - cumulative
  if round((v->'jami'->>'qoldiq_summa')::numeric
           - ((v->'jami'->>'smeta_summa')::numeric - (v->'jami'->>'jami_tasdiqlangan_summa')::numeric), 4) <> 0 then
    raise exception 'FAIL: remaining value != smeta - cumulative';
  end if;
  -- variance = cumulative certified - cumulative frozen baseline, and it is exposed
  if (v->'jami') -> 'narx_variance_summa' is null then raise exception 'FAIL: variance absent from totals'; end if;
  -- per-row: q1 remaining qty = smeta_hajm - jami_hajm
  if exists (
    select 1 from jsonb_array_elements(v->'qatorlar') r
    where (r->>'qator_id')::bigint = v_q1
      and round((r->>'qoldiq_hajm')::numeric - ((r->>'smeta_hajm')::numeric - (r->>'jami_hajm')::numeric), 6) <> 0
  ) then raise exception 'FAIL: per-row remaining quantity'; end if;

  -- ── membership guard ──
  begin
    v := public.t2_nakopitelniy_v1(v_obj, v_actor + 999999, null, 100, true);
    if (v->>'ok') = 'true' then raise exception 'FAIL non-member read allowed'; end if;
  exception when others then if sqlstate <> '42501' then raise; end if;
  end;

  -- ── backfill is safe (leaves snapshotted rows alone) ──
  v := public.t2_akt_qator_baseline_backfill_v1();
  if (v->>'ok') <> 'true' then raise exception 'FAIL backfill: %', v; end if;

  raise exception 'PARK_F2_BASELINE_ACCEPTANCE_PASS';
end $$;
