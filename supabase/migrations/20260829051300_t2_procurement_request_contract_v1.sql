-- ============================================================================
-- TIZIM_02 PROCUREMENT REQUEST CONTRACT V1
--
-- Canonical truth remains public.t2_erp_taminot.  This migration deliberately
-- does NOT create a second procurement-request table: legacy ERP data is
-- evolved in place and t2_zayavka_royxat supplies read-only compatibility
-- aliases for the A2 frontend.
--
-- Apply only to a disposable/dev Supabase database first.  It has deliberate
-- preflight failures for rows that cannot be migrated without a human data
-- decision; never replace unknown values with 0 or a guessed status.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.t2_erp_taminot') IS NULL THEN
    RAISE EXCEPTION 't2_erp_taminot is required before Procurement Request V1';
  END IF;

  -- A prior partial migration that left both names is a schema-drift event,
  -- not a licence to choose one column or overwrite values automatically.
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 't2_erp_taminot' AND column_name = 'maxsulot')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 't2_erp_taminot' AND column_name = 'item_text') THEN
    RAISE EXCEPTION 'Schema drift: both maxsulot and item_text exist; reconcile before V1 migration';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 't2_erp_taminot' AND column_name = 'miqdor')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 't2_erp_taminot' AND column_name = 'requested_qty') THEN
    RAISE EXCEPTION 'Schema drift: both miqdor and requested_qty exist; reconcile before V1 migration';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 't2_erp_taminot' AND column_name = 'holat')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 't2_erp_taminot' AND column_name = 'status') THEN
    RAISE EXCEPTION 'Schema drift: both holat and status exist; reconcile before V1 migration';
  END IF;

  -- Rename legacy stored truth rather than copying it into shadow columns.
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 't2_erp_taminot' AND column_name = 'maxsulot')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 't2_erp_taminot' AND column_name = 'item_text') THEN
    ALTER TABLE public.t2_erp_taminot RENAME COLUMN maxsulot TO item_text;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 't2_erp_taminot' AND column_name = 'miqdor')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 't2_erp_taminot' AND column_name = 'requested_qty') THEN
    ALTER TABLE public.t2_erp_taminot RENAME COLUMN miqdor TO requested_qty;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 't2_erp_taminot' AND column_name = 'birlik')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 't2_erp_taminot' AND column_name = 'unit') THEN
    ALTER TABLE public.t2_erp_taminot RENAME COLUMN birlik TO unit;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 't2_erp_taminot' AND column_name = 'holat')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 't2_erp_taminot' AND column_name = 'status') THEN
    ALTER TABLE public.t2_erp_taminot RENAME COLUMN holat TO status;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 't2_erp_taminot' AND column_name = 'yaratilgan_vaqt')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 't2_erp_taminot' AND column_name = 'created_at') THEN
    ALTER TABLE public.t2_erp_taminot RENAME COLUMN yaratilgan_vaqt TO created_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 't2_erp_taminot' AND column_name = 'buyurtma_raqami')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 't2_erp_taminot' AND column_name = 'request_number') THEN
    ALTER TABLE public.t2_erp_taminot RENAME COLUMN buyurtma_raqami TO request_number;
  END IF;
END;
$$;

ALTER TABLE public.t2_erp_taminot
  ADD COLUMN IF NOT EXISTS material_id BIGINT NULL,
  ADD COLUMN IF NOT EXISTS required_date DATE NULL,
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS note TEXT NULL,
  ADD COLUMN IF NOT EXISTS requested_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS approved_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS delivered_qty NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS operation_id UUID NULL,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Only known legacy states may be mapped.  Any unknown value stops migration
-- instead of silently changing the business history.
UPDATE public.t2_erp_taminot
SET status = CASE status
  WHEN 'kutilmoqda' THEN 'submitted'
  WHEN 'tasdiqlandi' THEN 'approved'
  WHEN 'yopildi' THEN 'closed'
  WHEN 'rad' THEN 'cancelled'
  WHEN 'rejected' THEN 'cancelled'
  WHEN 'past' THEN 'draft'
  ELSE status
END
WHERE status IN ('kutilmoqda', 'tasdiqlandi', 'yopildi', 'rad', 'rejected', 'past');

UPDATE public.t2_erp_taminot
SET status = 'draft'
WHERE status IS NULL;

UPDATE public.t2_erp_taminot
SET priority = CASE priority
  WHEN 'past' THEN 'low'
  WHEN 'orta' THEN 'normal'
  WHEN 'yuqori' THEN 'high'
  ELSE priority
END
WHERE priority IN ('past', 'orta', 'yuqori');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.t2_erp_taminot
    WHERE status NOT IN ('draft', 'submitted', 'approved', 'procurement', 'ordered',
                         'partially_delivered', 'delivered', 'closed', 'cancelled')
  ) THEN
    RAISE EXCEPTION 'Unmapped legacy procurement status exists; reconcile it before V1 migration';
  END IF;
  IF EXISTS (SELECT 1 FROM public.t2_erp_taminot WHERE obyekt_id IS NULL) THEN
    RAISE EXCEPTION 'Procurement request without obyekt_id exists; assign its real owner before V1 migration';
  END IF;
  IF EXISTS (SELECT 1 FROM public.t2_erp_taminot WHERE requested_qty IS NULL OR requested_qty <= 0) THEN
    RAISE EXCEPTION 'Invalid requested_qty exists; do not convert NULL/invalid quantity to 0';
  END IF;
  IF EXISTS (SELECT 1 FROM public.t2_erp_taminot WHERE delivered_qty < 0 OR delivered_qty > requested_qty) THEN
    RAISE EXCEPTION 'Invalid delivered_qty exists; reconcile over/negative delivery before V1 migration';
  END IF;
END;
$$;

ALTER TABLE public.t2_erp_taminot
  ALTER COLUMN obyekt_id SET NOT NULL,
  ALTER COLUMN requested_qty SET NOT NULL,
  ALTER COLUMN requested_qty DROP DEFAULT,
  ALTER COLUMN status SET DEFAULT 'draft';

ALTER TABLE public.t2_erp_taminot DROP CONSTRAINT IF EXISTS t2_erp_taminot_status_v1;
ALTER TABLE public.t2_erp_taminot ADD CONSTRAINT t2_erp_taminot_status_v1
  CHECK (status IN ('draft', 'submitted', 'approved', 'procurement', 'ordered',
                    'partially_delivered', 'delivered', 'closed', 'cancelled'));
ALTER TABLE public.t2_erp_taminot DROP CONSTRAINT IF EXISTS t2_erp_taminot_priority_v1;
ALTER TABLE public.t2_erp_taminot ADD CONSTRAINT t2_erp_taminot_priority_v1
  CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
ALTER TABLE public.t2_erp_taminot DROP CONSTRAINT IF EXISTS t2_erp_taminot_qty_v1;
ALTER TABLE public.t2_erp_taminot ADD CONSTRAINT t2_erp_taminot_qty_v1
  CHECK (requested_qty > 0 AND delivered_qty >= 0 AND delivered_qty <= requested_qty);
ALTER TABLE public.t2_erp_taminot DROP CONSTRAINT IF EXISTS t2_erp_taminot_version_v1;
ALTER TABLE public.t2_erp_taminot ADD CONSTRAINT t2_erp_taminot_version_v1 CHECK (version > 0);

CREATE UNIQUE INDEX IF NOT EXISTS t2_erp_taminot_operation_id_uq
  ON public.t2_erp_taminot (kompaniya_id, operation_id)
  WHERE operation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS t2_erp_taminot_tenant_object_status_idx
  ON public.t2_erp_taminot (kompaniya_id, obyekt_id, status, created_at DESC);

-- operation log is idempotency/audit metadata, not a second request-state
-- source of truth.  Current status and quantities live only in t2_erp_taminot.
CREATE TABLE IF NOT EXISTS public.t2_procurement_request_operation (
  kompaniya_id BIGINT NOT NULL,
  operation_id UUID NOT NULL,
  request_id BIGINT NOT NULL REFERENCES public.t2_erp_taminot(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('create', 'transition')),
  result_version INTEGER NOT NULL CHECK (result_version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (kompaniya_id, operation_id)
);
CREATE INDEX IF NOT EXISTS t2_procurement_request_operation_request_idx
  ON public.t2_procurement_request_operation (kompaniya_id, request_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.t2_procurement_request_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS t2_erp_taminot_touch ON public.t2_erp_taminot;
CREATE TRIGGER t2_erp_taminot_touch
  BEFORE UPDATE ON public.t2_erp_taminot
  FOR EACH ROW EXECUTE FUNCTION public.t2_procurement_request_touch();

-- Caller identity/role is verified by the Cloudflare gateway.  The database
-- independently verifies that the object belongs to the supplied tenant so an
-- ID from another company cannot be used inside a valid tenant request.
CREATE OR REPLACE FUNCTION public.t2_procurement_request_assert_object(
  p_kompaniya_id BIGINT,
  p_obyekt_id BIGINT
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.t2_obyekt o
    WHERE o.id = p_obyekt_id AND o.kompaniya_id = p_kompaniya_id
  ) THEN
    RAISE EXCEPTION 'obyekt_id % does not belong to kompaniya_id %', p_obyekt_id, p_kompaniya_id
      USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.t2_procurement_request_create(
  p_kompaniya_id BIGINT,
  p_obyekt_id BIGINT,
  p_item_text TEXT,
  p_requested_qty NUMERIC,
  p_unit TEXT,
  p_operation_id UUID,
  p_requested_by TEXT,
  p_material_id BIGINT DEFAULT NULL,
  p_required_date DATE DEFAULT NULL,
  p_priority TEXT DEFAULT 'normal',
  p_note TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_existing public.t2_procurement_request_operation%ROWTYPE;
  v_request public.t2_erp_taminot%ROWTYPE;
BEGIN
  IF p_kompaniya_id IS NULL OR p_kompaniya_id <= 0 OR p_obyekt_id IS NULL OR p_obyekt_id <= 0 THEN
    RAISE EXCEPTION 'kompaniya_id and obyekt_id are required';
  END IF;
  IF p_operation_id IS NULL THEN
    RAISE EXCEPTION 'operation_id is required and must be caller-supplied';
  END IF;
  IF NULLIF(btrim(p_item_text), '') IS NULL OR p_requested_qty IS NULL OR p_requested_qty <= 0 THEN
    RAISE EXCEPTION 'item_text and requested_qty (> 0) are required';
  END IF;
  IF NULLIF(btrim(p_requested_by), '') IS NULL THEN
    RAISE EXCEPTION 'requested_by is required';
  END IF;
  IF p_priority NOT IN ('low', 'normal', 'high', 'urgent') THEN
    RAISE EXCEPTION 'invalid priority: %', p_priority;
  END IF;

  PERFORM public.t2_procurement_request_assert_object(p_kompaniya_id, p_obyekt_id);

  SELECT * INTO v_existing FROM public.t2_procurement_request_operation
  WHERE kompaniya_id = p_kompaniya_id AND operation_id = p_operation_id;
  IF FOUND THEN
    IF v_existing.action <> 'create' THEN
      RAISE EXCEPTION 'operation_id was already used for %', v_existing.action;
    END IF;
    SELECT * INTO v_request FROM public.t2_erp_taminot WHERE id = v_existing.request_id;
    RETURN jsonb_build_object('ok', true, 'id', v_request.id, 'status', v_request.status,
      'version', v_request.version, 'idempotent', true);
  END IF;

  INSERT INTO public.t2_erp_taminot (
    kompaniya_id, obyekt_id, material_id, item_text, requested_qty, unit,
    required_date, priority, note, requested_by, status, delivered_qty,
    operation_id, version
  ) VALUES (
    p_kompaniya_id, p_obyekt_id, p_material_id, btrim(p_item_text), p_requested_qty, NULLIF(btrim(p_unit), ''),
    p_required_date, p_priority, NULLIF(btrim(p_note), ''), btrim(p_requested_by), 'draft', 0,
    p_operation_id, 1
  ) RETURNING * INTO v_request;

  INSERT INTO public.t2_procurement_request_operation (
    kompaniya_id, operation_id, request_id, action, result_version
  ) VALUES (p_kompaniya_id, p_operation_id, v_request.id, 'create', v_request.version);

  RETURN jsonb_build_object('ok', true, 'id', v_request.id, 'status', v_request.status,
    'version', v_request.version, 'idempotent', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.t2_procurement_request_transition(
  p_kompaniya_id BIGINT,
  p_id BIGINT,
  p_kutilgan_versiya INTEGER,
  p_new_status TEXT,
  p_operation_id UUID,
  p_actor TEXT,
  p_delivered_qty NUMERIC DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_existing public.t2_procurement_request_operation%ROWTYPE;
  v_request public.t2_erp_taminot%ROWTYPE;
  v_delivered NUMERIC;
  v_allowed BOOLEAN := false;
BEGIN
  IF p_operation_id IS NULL THEN
    RAISE EXCEPTION 'operation_id is required and must be caller-supplied';
  END IF;
  IF p_kutilgan_versiya IS NULL OR p_kutilgan_versiya <= 0 THEN
    RAISE EXCEPTION 'kutilgan_versiya is required';
  END IF;
  IF NULLIF(btrim(p_actor), '') IS NULL THEN
    RAISE EXCEPTION 'actor is required';
  END IF;
  IF p_new_status NOT IN ('submitted', 'approved', 'procurement', 'ordered',
                          'partially_delivered', 'delivered', 'closed', 'cancelled') THEN
    RAISE EXCEPTION 'invalid target status: %', p_new_status;
  END IF;

  SELECT * INTO v_existing FROM public.t2_procurement_request_operation
  WHERE kompaniya_id = p_kompaniya_id AND operation_id = p_operation_id;
  IF FOUND THEN
    IF v_existing.action <> 'transition' OR v_existing.request_id <> p_id THEN
      RAISE EXCEPTION 'operation_id was already used for another operation';
    END IF;
    SELECT * INTO v_request FROM public.t2_erp_taminot WHERE id = p_id AND kompaniya_id = p_kompaniya_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'request not found in this tenant'; END IF;
    RETURN jsonb_build_object('ok', true, 'id', v_request.id, 'status', v_request.status,
      'version', v_request.version, 'idempotent', true);
  END IF;

  SELECT * INTO v_request FROM public.t2_erp_taminot
  WHERE id = p_id AND kompaniya_id = p_kompaniya_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found in this tenant' USING ERRCODE = '42501'; END IF;
  PERFORM public.t2_procurement_request_assert_object(p_kompaniya_id, v_request.obyekt_id);
  IF v_request.version <> p_kutilgan_versiya THEN
    RAISE EXCEPTION 'version conflict: expected %, actual %', p_kutilgan_versiya, v_request.version
      USING ERRCODE = '40001';
  END IF;

  v_allowed := CASE v_request.status
    WHEN 'draft' THEN p_new_status IN ('submitted', 'cancelled')
    WHEN 'submitted' THEN p_new_status IN ('approved', 'cancelled')
    WHEN 'approved' THEN p_new_status IN ('procurement', 'cancelled')
    WHEN 'procurement' THEN p_new_status IN ('ordered', 'cancelled')
    WHEN 'ordered' THEN p_new_status IN ('partially_delivered', 'delivered', 'cancelled')
    WHEN 'partially_delivered' THEN p_new_status IN ('partially_delivered', 'delivered', 'cancelled')
    WHEN 'delivered' THEN p_new_status = 'closed'
    ELSE false
  END;
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'invalid procurement transition: % -> %', v_request.status, p_new_status;
  END IF;

  v_delivered := COALESCE(p_delivered_qty, v_request.delivered_qty);
  IF v_delivered < 0 OR v_delivered > v_request.requested_qty THEN
    RAISE EXCEPTION 'delivered_qty must be between 0 and requested_qty';
  END IF;
  IF p_new_status = 'partially_delivered'
     AND (v_delivered <= v_request.delivered_qty OR v_delivered >= v_request.requested_qty) THEN
    RAISE EXCEPTION 'partially_delivered requires an increased quantity below requested_qty';
  END IF;
  IF p_new_status = 'delivered' AND v_delivered <> v_request.requested_qty THEN
    RAISE EXCEPTION 'delivered requires delivered_qty equal to requested_qty';
  END IF;

  UPDATE public.t2_erp_taminot
  SET status = p_new_status,
      delivered_qty = v_delivered,
      approved_by = CASE WHEN p_new_status = 'approved' THEN btrim(p_actor) ELSE approved_by END,
      version = version + 1
  WHERE id = v_request.id
  RETURNING * INTO v_request;

  INSERT INTO public.t2_procurement_request_operation (
    kompaniya_id, operation_id, request_id, action, result_version
  ) VALUES (p_kompaniya_id, p_operation_id, v_request.id, 'transition', v_request.version);

  RETURN jsonb_build_object('ok', true, 'id', v_request.id, 'status', v_request.status,
    'version', v_request.version, 'remaining_qty', v_request.requested_qty - v_request.delivered_qty,
    'idempotent', false);
END;
$$;

-- Existing A2 gateway contract adapter.  It accepts legacy field aliases but
-- deliberately requires V1 operation_id and kutilgan_versiya: server-generated
-- idempotency keys would turn retries into duplicate procurement documents.
CREATE OR REPLACE FUNCTION public.t2_erp_amal(
  p_kompaniya_id BIGINT,
  p_operatsiya TEXT,
  p_payload JSONB,
  p_kim TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_operation_id UUID;
  v_version INTEGER;
  v_status TEXT;
BEGIN
  IF p_payload IS NULL THEN RAISE EXCEPTION 'payload is required'; END IF;
  v_operation_id := NULLIF(p_payload->>'operation_id', '')::UUID;
  IF p_operatsiya = 'zayavka_yarat' THEN
    RETURN public.t2_procurement_request_create(
      p_kompaniya_id,
      (p_payload->>'obyekt_id')::BIGINT,
      COALESCE(p_payload->>'item_text', p_payload->>'maxsulot'),
      COALESCE(p_payload->>'requested_qty', p_payload->>'miqdor')::NUMERIC,
      COALESCE(p_payload->>'unit', p_payload->>'birlik'),
      v_operation_id,
      COALESCE(NULLIF(p_payload->>'requested_by', ''), p_kim),
      NULLIF(p_payload->>'material_id', '')::BIGINT,
      NULLIF(COALESCE(p_payload->>'required_date', p_payload->>'kerakli_sana'), '')::DATE,
      CASE COALESCE(p_payload->>'priority', p_payload->>'muhimlik', 'normal')
        WHEN 'past' THEN 'low' WHEN 'orta' THEN 'normal' WHEN 'yuqori' THEN 'high'
        ELSE COALESCE(p_payload->>'priority', p_payload->>'muhimlik', 'normal') END,
      COALESCE(p_payload->>'note', p_payload->>'izoh')
    );
  ELSIF p_operatsiya IN ('zayavka_holat', 'zayavka_ochir') THEN
    v_version := COALESCE(NULLIF(p_payload->>'kutilgan_versiya', ''), NULLIF(p_payload->>'version', ''))::INTEGER;
    v_status := CASE WHEN p_operatsiya = 'zayavka_ochir' THEN 'cancelled'
                     ELSE COALESCE(p_payload->>'status', p_payload->>'holat') END;
    RETURN public.t2_procurement_request_transition(
      p_kompaniya_id, (p_payload->>'id')::BIGINT, v_version, v_status, v_operation_id, p_kim,
      NULLIF(COALESCE(p_payload->>'delivered_qty', p_payload->>'yetkazilgan_miqdor'), '')::NUMERIC
    );
  END IF;
  RAISE EXCEPTION 'Unsupported procurement operation: %', p_operatsiya;
END;
$$;

-- Read DTO: legacy aliases are projection-only. remaining_qty is derived from
-- canonical quantities and is never persisted.
-- The live baseline has a different view column layout; dropping this read-only
-- projection is required before replacing it, while the underlying request
-- table remains untouched.
DROP VIEW IF EXISTS public.t2_zayavka_royxat;
CREATE OR REPLACE VIEW public.t2_zayavka_royxat AS
SELECT
  r.id,
  r.kompaniya_id,
  r.obyekt_id,
  o.nom AS obyekt_nomi,
  r.request_number AS buyurtma_raqami,
  r.item_text AS maxsulot,
  r.requested_qty AS miqdor,
  r.unit AS birlik,
  r.status AS holat,
  r.created_at AS yaratilgan_vaqt,
  r.material_id,
  r.required_date AS kerakli_sana,
  r.priority AS muhimlik,
  r.note AS izoh,
  r.delivered_qty AS yetkazilgan_miqdor,
  r.item_text,
  r.requested_qty,
  r.unit,
  r.required_date,
  r.priority,
  r.note,
  r.requested_by,
  r.approved_by,
  r.status,
  r.delivered_qty,
  r.requested_qty - r.delivered_qty AS remaining_qty,
  r.operation_id,
  r.version,
  r.created_at,
  r.updated_at
FROM public.t2_erp_taminot r
JOIN public.t2_obyekt o ON o.id = r.obyekt_id AND o.kompaniya_id = r.kompaniya_id;

-- Object event access must carry BOTH tenant and object boundaries.  The
-- existing direct view query filtered only obyekt_id; use this RPC from the
-- gateway/client in the follow-up frontend contract change.
CREATE OR REPLACE FUNCTION public.t2_hodisa_obyekt_lenta(
  p_kompaniya_id BIGINT,
  p_obyekt_id BIGINT,
  p_limit INTEGER DEFAULT 20
) RETURNS TABLE (
  id BIGINT, kompaniya_id BIGINT, obyekt_id BIGINT, obyekt_nom TEXT,
  modul TEXT, amal_turi TEXT, tafsilot TEXT, kim TEXT,
  yaratilgan_vaqt TIMESTAMPTZ, satr TEXT
) LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.t2_procurement_request_assert_object(p_kompaniya_id, p_obyekt_id);
  RETURN QUERY
  SELECT h.id, h.kompaniya_id, h.obyekt_id, h.obyekt_nom, h.modul, h.amal_turi,
         h.tafsilot, h.kim, h.yaratilgan_vaqt, h.satr
  FROM public.t2_hodisa_lenta h
  WHERE h.kompaniya_id = p_kompaniya_id AND h.obyekt_id = p_obyekt_id
  ORDER BY h.yaratilgan_vaqt DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
END;
$$;

ALTER TABLE public.t2_erp_taminot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t2_procurement_request_operation ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON FUNCTION public.t2_procurement_request_assert_object(BIGINT, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.t2_procurement_request_create(BIGINT, BIGINT, TEXT, NUMERIC, TEXT, UUID, TEXT, BIGINT, DATE, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.t2_procurement_request_transition(BIGINT, BIGINT, INTEGER, TEXT, UUID, TEXT, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.t2_erp_amal(BIGINT, TEXT, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.t2_hodisa_obyekt_lenta(BIGINT, BIGINT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.t2_procurement_request_create(BIGINT, BIGINT, TEXT, NUMERIC, TEXT, UUID, TEXT, BIGINT, DATE, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.t2_procurement_request_transition(BIGINT, BIGINT, INTEGER, TEXT, UUID, TEXT, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.t2_erp_amal(BIGINT, TEXT, JSONB, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.t2_hodisa_obyekt_lenta(BIGINT, BIGINT, INTEGER) TO service_role;

COMMIT;
