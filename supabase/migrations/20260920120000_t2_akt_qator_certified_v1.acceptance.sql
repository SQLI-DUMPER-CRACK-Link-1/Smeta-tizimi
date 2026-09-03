-- Behavioral acceptance for t2_akt_qator certified columns. Run inside a
-- transaction that is ROLLED BACK. Uses the EXACT example from the
-- owner's spec: qty=10, price=123.45, amount=1234.49 (NOT 10*123.45=1234.50).

do $$
declare v_row public.t2_akt_qator%rowtype; v_id bigint; v_akt_id bigint; v_calc numeric;
begin
  if exists (select 1 from public.t2_akt_qator limit 1) then
    perform 1 from public.t2_akt_qator where provenance_status <> 'unknown_provenance' limit 1;
    if found then raise exception 'FAIL pre-existing rows should all default to unknown_provenance'; end if;
    perform 1 from public.t2_akt_qator where certified_amount is not null limit 1;
    if found then raise exception 'FAIL pre-existing rows must not have fabricated certified_amount'; end if;
  end if;

  select id, akt_id into v_id, v_akt_id from public.t2_akt_qator limit 1;
  if v_id is not null then
    -- integrity constraint: source_certified requires all three fields
    begin
      update public.t2_akt_qator set provenance_status = 'source_certified',
        certified_quantity = 1, certified_unit_price = null, certified_amount = null where id = v_id;
      raise exception 'FAIL integrity constraint should have rejected source_certified with null price/amount';
    exception when check_violation then null; end;

    -- the exact P0 case
    update public.t2_akt_qator set
      certified_quantity = 10, certified_unit_price = 123.45, certified_amount = 1234.49,
      provenance_status = 'source_certified'
    where id = v_id;
    select * into v_row from public.t2_akt_qator where id = v_id;
    if v_row.certified_amount <> 1234.49 then
      raise exception 'FAIL certified_amount was not preserved exactly: %', v_row.certified_amount;
    end if;
    v_calc := v_row.certified_quantity * v_row.certified_unit_price;
    if v_calc = v_row.certified_amount then
      raise exception 'FAIL test fixture invalid: 10*123.45 should differ from 1234.49';
    end if;

    -- price_intentionally_absent: quantity present, price/amount null -- allowed
    update public.t2_akt_qator set provenance_status = 'price_intentionally_absent',
      certified_quantity = 5, certified_unit_price = null, certified_amount = null where id = v_id;

    -- legacy generated summa (compatibility) unaffected
    if v_row.summa is distinct from (case when v_row.narx is null then null else v_row.hajm * v_row.narx end) then
      raise exception 'FAIL legacy generated summa formula regressed';
    end if;
  end if;

  raise exception 'T2_AKT_QATOR_CERTIFIED_V1_ACCEPTANCE_PASS';
end $$;
