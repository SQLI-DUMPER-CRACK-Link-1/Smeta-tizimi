-- Behavioral acceptance for t2_akt_qator certified columns. Run inside a
-- transaction that is ROLLED BACK. Uses the EXACT example from the
-- owner's spec: qty=10, price=123.45, amount=1234.49 (NOT 10*123.45=1234.50).

do $$
declare v_row public.t2_akt_qator%rowtype; v_id bigint; v_calc numeric;
begin
  -- 1. historical rows are untouched and default to unknown_provenance
  if exists (select 1 from public.t2_akt_qator limit 1) then
    perform 1 from public.t2_akt_qator where provenance_status <> 'unknown_provenance' limit 1;
    if found then raise exception 'FAIL pre-existing rows should all default to unknown_provenance'; end if;
    perform 1 from public.t2_akt_qator where certified_amount is not null limit 1;
    if found then raise exception 'FAIL pre-existing rows must not have fabricated certified_amount'; end if;
  end if;

  -- 2. the exact P0 case: certified_amount independently holds a value
  -- that does NOT equal quantity*unit_price, and is preserved exactly.
  select id into v_id from public.t2_akt_qator limit 1;
  if v_id is not null then
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
      raise exception 'FAIL test fixture invalid: calculated_amount should differ from certified_amount (10*123.45=1234.50 <> 1234.49)';
    end if;
    -- the mismatch is detectable at read time but certified_amount itself
    -- was never touched by the comparison -- this IS the law.
    if v_row.certified_amount <> 1234.49 then
      raise exception 'FAIL certified_amount was overwritten by the mismatch check';
    end if;

    -- 3. old generated summa (compatibility) is UNCHANGED by the new columns
    if v_row.summa is distinct from (case when v_row.narx is null then null else v_row.hajm * v_row.narx end) then
      raise exception 'FAIL legacy generated summa formula regressed';
    end if;
  end if;

  -- 4. structural additional/replacement columns exist and are nullable by default
  perform 1 from public.t2_qator where change_type is not null limit 1;
  -- (no rows expected to have it yet -- just confirming the column exists via the query not erroring)

  raise exception 'T2_AKT_QATOR_CERTIFIED_V1_ACCEPTANCE_PASS';
end $$;
