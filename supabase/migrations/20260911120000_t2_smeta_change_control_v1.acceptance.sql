-- Behavioral acceptance for SMETA/F2/NAKOPITELNIY 2/3 (governed change control).
-- Run INSIDE a transaction that is ROLLED BACK. :obj = object with priced BOQ, :actor = rahbar/boss.
--
-- Proves:
--  * change order carries reason / type / evidence / effective period / affected IDs / before-after
--  * ATOMIC APPROVAL: a preflight failure on line 2 leaves ZERO mutation on line 1
--  * approval applies to t2_qator AND writes revision seq 1
--  * ORIGINAL baseline (revision seq 0) stays reconstructable
--  * REVERSAL is a governed compensating revision (history not destroyed)
--  * newly-added qator is soft-removed on reversal (hajm=0, not deleted)
--  * scope-level optimistic lock -> SCOPE_DRIFT (as a preflight error, no mutation)
--  * only rahbar/boss can approve

do $$
declare
  v jsonb; v_obj bigint := :obj; v_actor bigint := :actor;
  v_q1 bigint; v_q2 bigint; v_h1 numeric; v_h2 numeric; v_parent bigint;
  v_chg bigint; v_seq0_jami numeric; v_op uuid := gen_random_uuid();
  v_added bigint; v_h1_after numeric;
begin
  select id, hajm into v_q1, v_h1 from public.t2_qator where obyekt_id=v_obj and narx>0 and hajm>0 order by id limit 1;
  select id, hajm into v_q2, v_h2 from public.t2_qator where obyekt_id=v_obj and narx>0 and hajm>0 and id<>v_q1 order by id limit 1;
  select id into v_parent from public.t2_qator where obyekt_id=v_obj and tur in ('rz','bl') order by id limit 1;
  if v_q2 is null or v_parent is null then raise exception 'FAIL setup'; end if;

  perform public.t2_smeta_baseline_kafolat_v1(v_obj, v_actor);
  select jami_summa into v_seq0_jami from public.t2_smeta_revision where obyekt_id=v_obj and seq=0;

  -- ── 1. ATOMICITY: a change with a VALID line 1 and an INVALID line 2 -> zero mutation
  v := public.t2_smeta_ozgarish_yarat_v1(v_obj, v_actor, 'hajm_ozgarish', 'atomicity test',
        jsonb_build_array(
          jsonb_build_object('qator_id', v_q1, 'amal', 'hajm', 'yangi_hajm', v_h1 + 100),        -- valid
          jsonb_build_object('amal', 'qoshish', 'yangi_nom', 'Bad line', 'tur', 'rs')),          -- INVALID: no parent
        'ACC-ATOM', v_op, null, null, null, null);
  if (v->>'ok') <> 'true' then raise exception 'FAIL yarat: %', v; end if;
  v_chg := (v->>'ozgarish_id')::bigint;
  v := public.t2_smeta_ozgarish_tasdiqlash_v1(v_chg, v_actor, null, gen_random_uuid());
  if (v->>'code') <> 'CHANGE_PREFLIGHT_FAILED' then raise exception 'FAIL: preflight should reject: %', v; end if;
  if jsonb_array_length(v->'xatolar') < 1 then raise exception 'FAIL: no preflight errors listed'; end if;
  -- line 1 (v_q1) MUST be untouched
  if (select hajm from public.t2_qator where id=v_q1) <> v_h1 then
    raise exception 'FAIL ATOMICITY: line 1 was mutated despite line 2 preflight failure';
  end if;
  if (select holat from public.t2_smeta_ozgarish where id=v_chg) <> 'qoralama' then
    raise exception 'FAIL: order marked approved despite preflight failure';
  end if;

  -- ── 2. a fully valid change: qty change + a real additional-work line
  v := public.t2_smeta_ozgarish_yarat_v1(v_obj, v_actor, 'hajm_ozgarish', 'Loyihachi ko''rsatmasi',
        jsonb_build_array(
          jsonb_build_object('qator_id', v_q1, 'amal', 'hajm', 'yangi_hajm', v_h1 + 10),
          jsonb_build_object('amal', 'qoshish', 'yangi_nom', 'Qoshimcha ish ACC', 'tur', 'rs',
                             'ota_id', v_parent, 'yangi_hajm', 4, 'yangi_narx', 500000, 'kat', 'ЧЕЛ')),
        'ACC-OK', gen_random_uuid(), date '2026-08-01', 'quantity_increase', null, 'Loyiha hujjati #12');
  v_chg := (v->>'ozgarish_id')::bigint;
  if (select effective_oy from public.t2_smeta_ozgarish where id=v_chg) <> date '2026-08-01' then raise exception 'FAIL effective period'; end if;

  -- non-rahbar cannot approve
  begin
    v := public.t2_smeta_ozgarish_tasdiqlash_v1(v_chg, v_actor + 999999, null, gen_random_uuid());
    if (v->>'ok') = 'true' then raise exception 'FAIL non-member approved'; end if;
  exception when others then if sqlstate <> '42501' then raise; end if;
  end;

  v := public.t2_smeta_ozgarish_tasdiqlash_v1(v_chg, v_actor, null, gen_random_uuid());
  if (v->>'ok') <> 'true' then raise exception 'FAIL tasdiqlash: %', v; end if;
  if (v->>'revision_seq')::int <> 1 then raise exception 'FAIL revision seq'; end if;
  if (select hajm from public.t2_qator where id=v_q1) <> v_h1 + 10 then raise exception 'FAIL qty applied'; end if;
  select yangi_qator_id into v_added from public.t2_smeta_ozgarish_qator where ozgarish_id=v_chg and amal='qoshish';
  if v_added is null or (select hajm from public.t2_qator where id=v_added) <> 4 then raise exception 'FAIL additional line'; end if;

  -- ── 3. ORIGINAL baseline unchanged + revision chain visible
  v := public.t2_smeta_baseline_asl_v1(v_obj, v_actor);
  if (v->>'jami_summa')::numeric <> v_seq0_jami then raise exception 'FAIL: original baseline drifted'; end if;
  if jsonb_array_length(v->'revisiyalar') < 2 then raise exception 'FAIL: revision chain'; end if;

  -- ── 4. REVERSAL = governed compensating revision, added line soft-removed
  v := public.t2_smeta_ozgarish_qaytar_v1(v_chg, v_actor, 'loyihachi rad etdi', gen_random_uuid());
  if (v->>'ok') <> 'true' or (v->>'holat') <> 'bekor' then raise exception 'FAIL qaytar: %', v; end if;
  if (v->>'kompensatsiya_revision_id') is null then raise exception 'FAIL: reversal did not write a compensating revision'; end if;
  if (select hajm from public.t2_qator where id=v_q1) <> v_h1 then raise exception 'FAIL: reversal did not restore qty'; end if;
  if (select hajm from public.t2_qator where id=v_added) <> 0 then raise exception 'FAIL: added line not soft-removed on reversal'; end if;
  -- the added row still EXISTS (soft, not deleted) -> history preserved
  if not exists (select 1 from public.t2_qator where id=v_added) then raise exception 'FAIL: added row hard-deleted (history lost)'; end if;
  -- seq 0 STILL reconstructable, and now there are >= 3 revisions
  v := public.t2_smeta_baseline_asl_v1(v_obj, v_actor);
  if (v->>'jami_summa')::numeric <> v_seq0_jami then raise exception 'FAIL: original baseline lost after reversal'; end if;
  if jsonb_array_length(v->'revisiyalar') < 3 then raise exception 'FAIL: compensating revision not in the chain'; end if;

  -- ── 5. SCOPE_DRIFT surfaces as a preflight error (still zero mutation)
  select hajm into v_h1_after from public.t2_qator where id=v_q1;
  v := public.t2_smeta_ozgarish_yarat_v1(v_obj, v_actor, 'hajm_ozgarish', 'drift',
        jsonb_build_array(jsonb_build_object('qator_id', v_q1, 'amal', 'hajm', 'yangi_hajm', v_h1_after + 3)),
        'ACC-DRIFT', gen_random_uuid(), null, null, null, null);
  v_chg := (v->>'ozgarish_id')::bigint;
  perform public.t2_qator_tahrir(v_q1, 'hajm', (v_h1_after + 1)::text,
    (select versiya from public.t2_qator where id=v_q1), 'baza', 'actor:'||v_actor);
  v := public.t2_smeta_ozgarish_tasdiqlash_v1(v_chg, v_actor, null, gen_random_uuid());
  if (v->>'code') <> 'CHANGE_PREFLIGHT_FAILED'
     or not exists (select 1 from jsonb_array_elements(v->'xatolar') e where e->>'code' = 'SCOPE_DRIFT') then
    raise exception 'FAIL: SCOPE_DRIFT not caught in preflight: %', v;
  end if;
  if (select hajm from public.t2_qator where id=v_q1) <> v_h1_after + 1 then raise exception 'FAIL: drift-preflight mutated a row'; end if;

  raise exception 'SMETA_CHANGE_CONTROL_ACCEPTANCE_PASS';
end $$;
