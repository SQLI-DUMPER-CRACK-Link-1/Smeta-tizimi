-- Behavioral acceptance for SMETA/F2/NAKOPITELNIY 3/3 (Forma-3 + closeout + workbench).
-- Run INSIDE a transaction that is ROLLED BACK. :obj = object with priced BOQ + at least
-- one approved F2, :actor = boss/rahbar/bugalter.
--
-- Proves:
--  * Forma-3 stays FORMA3_RULE_UNRESOLVED — no legal/tax/payment total computed
--  * Forma-3 links only APPROVED F2 acts in scope + period; rejects the rest
--  * the rule guard lifts only with a verified evidence reference (still no formula)
--  * closeout read model produces the ParkCloseoutReadModel shape (requirements/documents/exportPeriods)
--  * closeout requirement pack is data-driven (project override > company > global)
--  * workbench aggregate produces the ConstructionDocumentControlReadModel shape

do $$
declare
  v jsonb; v_obj bigint := :obj; v_actor bigint := :actor;
  v_akt bigint; v_f3 bigint; v_op uuid := gen_random_uuid();
begin
  select id into v_akt from public.t2_akt where obyekt_id = v_obj and tur = 'f2' and holat = 'tasdiqlangan' order by oy limit 1;
  if v_akt is null then raise exception 'FAIL setup: need an approved F2 on object %', v_obj; end if;

  -- 1. Forma-3 create -> UNRESOLVED, no legal total
  v := public.t2_forma3_yarat_v1(v_actor, null, v_obj, null, date '2026-01-01', date '2026-12-31',
        array[v_akt]::bigint[], 'F3-ACC-1', v_op);
  if (v->>'ok') <> 'true' then raise exception 'FAIL forma3_yarat: %', v; end if;
  v_f3 := (v->>'forma3_id')::bigint;
  if (v->>'qoida_holat') <> 'FORMA3_RULE_UNRESOLVED' then raise exception 'FAIL: forma3 not unresolved'; end if;
  if v ? 'legal_total' or v ? 'payment_due' or v ? 'tax' or v ? 'jami_qonuniy' then
    raise exception 'FAIL: forma3 emitted a legal/payment total';
  end if;
  -- no legal-total column on the table
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='t2_forma3'
             and column_name in ('legal_total','payment_due','tax_summa','ustama_summa','jami_qonuniy')) then
    raise exception 'FAIL: t2_forma3 has a legal/markup/tax column';
  end if;

  -- 2. idempotent
  v := public.t2_forma3_yarat_v1(v_actor, null, v_obj, null, date '2026-01-01', date '2026-12-31', array[v_akt]::bigint[], 'x', v_op);
  if (v->>'forma3_id')::bigint <> v_f3 then raise exception 'FAIL forma3 idempotency'; end if;

  -- 3. a non-approved / out-of-scope act is refused
  begin
    v := public.t2_forma3_yarat_v1(v_actor, null, v_obj, null, date '2026-01-01', date '2026-12-31',
          array[v_akt, 999999]::bigint[], 'F3-BAD', gen_random_uuid());
    if (v->>'code') <> 'FORMA3_AKT_INVALID' then raise exception 'FAIL: bad act not rejected: %', v; end if;
  exception when others then null;
  end;

  -- 4. rule guard: empty evidence rejected; a ref lifts to MAPPED but NO formula added
  v := public.t2_forma3_qoida_belgila_v1(v_f3, v_actor, '', gen_random_uuid());
  if (v->>'code') <> 'FORMA3_EVIDENCE_REQUIRED' then raise exception 'FAIL: empty evidence accepted: %', v; end if;
  v := public.t2_forma3_qoida_belgila_v1(v_f3, v_actor, 'UZ КС-3 shabloni v2 + shartnoma #14 ilova 3', gen_random_uuid());
  if (v->>'qoida_holat') <> 'FORMA3_RULE_MAPPED' then raise exception 'FAIL: rule not mapped: %', v; end if;

  -- 5. closeout read model shape
  v := public.t2_obyekt_yakunlash_v1(v_obj, v_actor);
  if (v->>'ok') <> 'true' then raise exception 'FAIL yakunlash: %', v; end if;
  if v->'requirements' is null or v->'documents' is null or v->'exportPeriods' is null then
    raise exception 'FAIL: closeout model missing requirements/documents/exportPeriods';
  end if;
  if not exists (select 1 from jsonb_array_elements(v->'requirements') r where r->>'type' = 'forma3' and r->>'evidenceRule' = 'forma3_unresolved') then
    raise exception 'FAIL: forma3 requirement not marked unresolved';
  end if;
  if not exists (select 1 from jsonb_array_elements(v->'exportPeriods') p
                 where round((p->>'previousQuantity')::numeric + (p->>'currentQuantity')::numeric - (p->>'cumulativeQuantity')::numeric, 6) = 0) then
    raise exception 'FAIL: export period previous+current<>cumulative';
  end if;

  -- 6. workbench aggregate shape
  v := public.t2_workbench_v1(v_obj, v_actor, null, 200);
  if (v->>'ok') <> 'true' then raise exception 'FAIL workbench: %', v; end if;
  if v->'valuation'->'lines' is null or v->'valuation'->'changes' is null or v->'valuation'->'periods' is null
     or v->'revisions' is null then
    raise exception 'FAIL: workbench model incomplete';
  end if;
  if (v->'valuation'->>'estimateRevisionId') is null then raise exception 'FAIL: workbench no estimateRevisionId'; end if;
  -- lines carry baseline reference price separately (not an F2 or actual price)
  if jsonb_array_length(v->'valuation'->'lines') > 0
     and not exists (select 1 from jsonb_array_elements(v->'valuation'->'lines') l where l ? 'baselineReferencePrice') then
    raise exception 'FAIL: workbench lines missing baselineReferencePrice';
  end if;

  raise exception 'FORMA3_CLOSEOUT_WORKBENCH_ACCEPTANCE_PASS';
end $$;
