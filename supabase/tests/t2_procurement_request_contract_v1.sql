-- Run only in a disposable/dev database after 13_procurement_request_contract_v1.sql.
-- Required session settings identify a dedicated test tenant and one object it owns:
--   SET t2.test_kompaniya_id = '...';
--   SET t2.test_obyekt_id = '...';
-- Every write is inside a transaction that ends with ROLLBACK.

BEGIN;

DO $$
DECLARE
  v_kompaniya_id BIGINT := current_setting('t2.test_kompaniya_id')::BIGINT;
  v_obyekt_id BIGINT := current_setting('t2.test_obyekt_id')::BIGINT;
  v_request_id BIGINT;
  v_created JSONB;
  v_retry JSONB;
  v_step JSONB;
  v_version INTEGER;
  v_remaining NUMERIC;
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM public.t2_obyekt WHERE id = v_obyekt_id AND kompaniya_id = v_kompaniya_id
  ), 'configured test object must belong to configured test tenant';

  -- Create is idempotent and starts only in draft.
  v_created := public.t2_procurement_request_create(
    v_kompaniya_id, v_obyekt_id, 'PROCUREMENT_V1_TEST_ITEM', 10, 'dona',
    '00000000-0000-0000-0000-000000000131'::UUID, 'procurement-test@example.invalid',
    NULL, CURRENT_DATE + 7, 'high', 'rollback-only acceptance test'
  );
  v_request_id := (v_created->>'id')::BIGINT;
  ASSERT v_created->>'status' = 'draft', 'new request must be draft';
  ASSERT (v_created->>'version')::INTEGER = 1, 'new request version must be 1';

  v_retry := public.t2_procurement_request_create(
    v_kompaniya_id, v_obyekt_id, 'PROCUREMENT_V1_TEST_ITEM', 10, 'dona',
    '00000000-0000-0000-0000-000000000131'::UUID, 'procurement-test@example.invalid'
  );
  ASSERT (v_retry->>'id')::BIGINT = v_request_id AND (v_retry->>'idempotent')::BOOLEAN,
    'same create operation_id must return the original request';

  -- No arbitrary jump: draft cannot become ordered.
  BEGIN
    PERFORM public.t2_procurement_request_transition(
      v_kompaniya_id, v_request_id, 1, 'ordered',
      '00000000-0000-0000-0000-000000000132'::UUID, 'procurement-test@example.invalid'
    );
    RAISE EXCEPTION 'draft -> ordered was incorrectly accepted';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL;
  END;

  -- Allowed path through the lifecycle, with version increments on every write.
  v_step := public.t2_procurement_request_transition(v_kompaniya_id, v_request_id, 1, 'submitted', '00000000-0000-0000-0000-000000000133', 'procurement-test@example.invalid');
  v_step := public.t2_procurement_request_transition(v_kompaniya_id, v_request_id, (v_step->>'version')::INTEGER, 'approved', '00000000-0000-0000-0000-000000000134', 'approver@example.invalid');
  v_step := public.t2_procurement_request_transition(v_kompaniya_id, v_request_id, (v_step->>'version')::INTEGER, 'procurement', '00000000-0000-0000-0000-000000000135', 'procurement-test@example.invalid');
  v_step := public.t2_procurement_request_transition(v_kompaniya_id, v_request_id, (v_step->>'version')::INTEGER, 'ordered', '00000000-0000-0000-0000-000000000136', 'procurement-test@example.invalid');
  v_step := public.t2_procurement_request_transition(v_kompaniya_id, v_request_id, (v_step->>'version')::INTEGER, 'partially_delivered', '00000000-0000-0000-0000-000000000137', 'warehouse@example.invalid', 4);
  ASSERT (v_step->>'remaining_qty')::NUMERIC = 6, 'remaining_qty must be derived from 10 - 4';
  v_version := (v_step->>'version')::INTEGER;
  v_step := public.t2_procurement_request_transition(v_kompaniya_id, v_request_id, v_version, 'delivered', '00000000-0000-0000-0000-000000000138', 'warehouse@example.invalid', 10);
  v_step := public.t2_procurement_request_transition(v_kompaniya_id, v_request_id, (v_step->>'version')::INTEGER, 'closed', '00000000-0000-0000-0000-000000000139', 'procurement-test@example.invalid');
  ASSERT v_step->>'status' = 'closed', 'delivered -> closed must be allowed';

  -- Same transition operation is idempotent; stale *new* operations conflict.
  v_retry := public.t2_procurement_request_transition(v_kompaniya_id, v_request_id, (v_step->>'version')::INTEGER - 1, 'closed', '00000000-0000-0000-0000-000000000139', 'procurement-test@example.invalid');
  ASSERT (v_retry->>'idempotent')::BOOLEAN, 'same transition operation_id must be idempotent';
  BEGIN
    PERFORM public.t2_procurement_request_transition(v_kompaniya_id, v_request_id, 1, 'closed', '00000000-0000-0000-0000-000000000140', 'procurement-test@example.invalid');
    RAISE EXCEPTION 'stale version was incorrectly accepted';
  EXCEPTION WHEN SQLSTATE '40001' THEN NULL;
  END;

  SELECT remaining_qty INTO v_remaining FROM public.t2_zayavka_royxat WHERE id = v_request_id;
  ASSERT v_remaining = 0, 'view remaining_qty must be derived, not stored';

  -- Tenant boundary: the request must not be visible through another tenant.
  ASSERT NOT EXISTS (
    SELECT 1 FROM public.t2_zayavka_royxat
    WHERE id = v_request_id AND kompaniya_id <> v_kompaniya_id
  ), 'tenant boundary must hold in the read view';

  BEGIN
    PERFORM public.t2_hodisa_obyekt_lenta(-1, v_obyekt_id, 5);
    RAISE EXCEPTION 'cross-tenant object event query was incorrectly accepted';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
END;
$$;

ROLLBACK;
