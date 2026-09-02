-- Behavioral acceptance for the SHEETS write-back REFERENCE.
-- Run INSIDE a transaction that is ROLLED BACK. Requires 20260902120000 applied.
--   begin; \i 20260908120000_t2_sheets_writeback_reference_v1.acceptance.sql  rollback;
-- Substitute :co (company), :actor (active member), :prj (project in :co).

do $$
declare v jsonb; v_doc bigint; v_op uuid := gen_random_uuid();
begin
  insert into public.t2_document_registry
    (kompaniya_id, loyiha_id, document_type, status, created_at, original_filename, sheets_entity_id, versiya)
  values (:co, :prj, 'aosr', 'active', now(), 'old.pdf', 'DOC-STABLE-acc-001', 1)
  returning id into v_doc;

  -- 1. a Sheets ROW NUMBER is never accepted as identity
  v := public.t2_document_sheets_writeback_v1(:co, :actor, v_doc, '42', 'original_filename', 'x', 1, gen_random_uuid());
  if (v->>'code') <> 'SHEETS_ROW_NUMBER_REJECTED' then raise exception 'FAIL row-number guard: %', v; end if;

  -- 2. base_version drift -> SHEETS_CONFLICT (no last-write-wins)
  v := public.t2_document_sheets_writeback_v1(:co, :actor, v_doc, 'DOC-STABLE-acc-001', 'original_filename', 'x', 999, gen_random_uuid());
  if (v->>'code') <> 'SHEETS_CONFLICT' then raise exception 'FAIL base_version guard: %', v; end if;

  -- 3. happy path — stable id + correct base_version + operation_id
  v := public.t2_document_sheets_writeback_v1(:co, :actor, v_doc, 'DOC-STABLE-acc-001', 'original_filename', 'new.pdf', 1, v_op);
  if (v->>'ok') <> 'true' or (v->>'versiya')::int <> 2 then raise exception 'FAIL writeback: %', v; end if;
  if (select original_filename from public.t2_document_registry where id = v_doc) <> 'new.pdf' then
    raise exception 'FAIL value not applied';
  end if;

  -- 4. idempotent replay — same operation_id, no second version bump
  v := public.t2_document_sheets_writeback_v1(:co, :actor, v_doc, 'DOC-STABLE-acc-001', 'original_filename', 'new.pdf', 1, v_op);
  if (v->>'versiya')::int <> 2 then raise exception 'FAIL idempotency: %', v; end if;
  if (select versiya from public.t2_document_registry where id = v_doc) <> 2 then raise exception 'FAIL double version bump'; end if;

  -- 5. a different stable id is rejected (never overwrites the wrong entity)
  v := public.t2_document_sheets_writeback_v1(:co, :actor, v_doc, 'DOC-STABLE-OTHER', 'original_filename', 'x', 2, gen_random_uuid());
  if (v->>'code') <> 'SHEETS_ENTITY_MISMATCH' then raise exception 'FAIL entity mismatch guard: %', v; end if;

  raise exception 'SHEETS_WRITEBACK_ACCEPTANCE_PASS';
end $$;
