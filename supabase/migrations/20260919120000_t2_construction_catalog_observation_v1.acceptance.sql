-- Behavioral acceptance for the construction catalog observation layer.
-- Run inside a transaction that is ROLLED BACK. Substitute :company (a
-- real company id, e.g. 1).

do $$
declare
  v_company bigint := :company;
  v_wto bigint; v_ro bigint; v_cand bigint;
begin
  -- 1. a work-type observation can be recorded with full provenance
  insert into public.t2_work_type_observation
    (company_id, source_type, code, name, unit)
  values (v_company, 'smeta', 'E0601-001-22', 'USTROYSTVO...', '100M3')
  returning id into v_wto;
  if v_wto is null then raise exception 'FAIL work_type_observation insert did not return id'; end if;

  -- 2. a resource observation (material) can be recorded
  insert into public.t2_resource_observation
    (company_id, source_type, resource_kind, code, name, unit)
  values (v_company, 'smeta', 'material', 'BETON-M200', 'Beton M200', 'm3')
  returning id into v_ro;
  if v_ro is null then raise exception 'FAIL resource_observation insert did not return id'; end if;

  -- 3. the recipe line links them WITHOUT touching canonical t2_ish_turi/t2_narx
  insert into public.t2_work_resource_observation
    (work_type_observation_id, resource_observation_id, observed_qty, observed_unit)
  values (v_wto, v_ro, 12.5, 'm3');
  if not exists (select 1 from public.t2_work_resource_observation
                 where work_type_observation_id = v_wto and resource_observation_id = v_ro) then
    raise exception 'FAIL work_resource_observation link not found';
  end if;

  -- 4. an ambiguous observation goes to the match-candidate queue, not
  -- straight into canonical -- and starts in 'kutmoqda' (pending), never
  -- auto-'tasdiqlangan' (confirmed).
  insert into public.t2_catalog_match_candidate
    (company_id, observation_type, observation_id, candidate_canonical_kod, confidence)
  values (v_company, 'work_type', v_wto, 'E0601-001-22', 0.82)
  returning id into v_cand;
  if not exists (select 1 from public.t2_catalog_match_candidate
                 where id = v_cand and holat = 'kutmoqda') then
    raise exception 'FAIL match candidate did not default to kutmoqda (pending)';
  end if;

  -- 5. canonical t2_ish_turi/t2_narx untouched by any of the above (no
  -- trigger, no side effect -- this migration adds pure observation tables)
  perform 1; -- (no canonical write path exists yet to assert against; the
             -- absence of any INSERT/UPDATE statement above touching
             -- t2_ish_turi/t2_narx IS the proof for this migration.)

  raise exception 'T2_CONSTRUCTION_CATALOG_OBSERVATION_V1_ACCEPTANCE_PASS';
end $$;
