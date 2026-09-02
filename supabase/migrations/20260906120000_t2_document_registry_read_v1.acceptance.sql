-- Behavioral acceptance for the DOCUMENT CENTER registry read model.
-- Run INSIDE a transaction that is ROLLED BACK.
--   begin; \i 20260906120000_t2_document_registry_read_v1.acceptance.sql  rollback;
-- Requires 20260902120000 (canonical columns) applied first.
-- Substitute: :co (company), :boss (active member), :prj (a project in :co).

do $$
declare v jsonb; v_co bigint := :co; v_boss bigint := :boss; v_prj bigint := :prj; v_doc bigint;
begin
  -- seed a canonical doc with a FAILED Drive replica
  insert into public.t2_document_registry
    (kompaniya_id, loyiha_id, provider, external_file_id, external_parent_id, document_type,
     status, created_at, original_filename, mime_type, size_bytes, sha256, sha256_verified,
     canonical_storage_status, drive_sync_status, drive_last_error, r2_key, revision_seq)
  values
    (v_co, v_prj, 'r2', null, null, 'aosr', 'active', now(), 'acc-doc.pdf', 'application/pdf',
     12345, repeat('a',64), true, 'stored', 'failed', 'Drive 500', 'docs/'||v_co||'/_/_/d0/r1', 1)
  returning id into v_doc;

  v := public.t2_document_registry_v1(v_boss, v_co, null, null, 50);
  if (v->>'ok') <> 'true' then raise exception 'FAIL read: %', v; end if;

  -- 1. the seeded doc appears, canonical status READY
  if not exists (select 1 from jsonb_array_elements(v->'documents') d
                 where (d->>'id') = v_doc::text and (d->>'canonicalStatus') = 'READY') then
    raise exception 'FAIL doc not READY in list: %', v->'documents';
  end if;

  -- 2. Drive replica shows FAILED — but the canonical document is still READY (not ERROR)
  if not exists (select 1 from jsonb_array_elements(v->'documents') d,
                     jsonb_array_elements(d->'replicas') r
                 where (d->>'id') = v_doc::text and (r->>'provider') = 'drive' and (r->>'status') = 'FAILED') then
    raise exception 'FAIL drive replica not FAILED';
  end if;

  -- 3. health reports the Drive failure explicitly as replica-only
  if not exists (select 1 from jsonb_array_elements(v->'health') h
                 where (h->>'provider') = 'drive' and (h->>'status') = 'FAILED'
                   and (h->>'message') like '%KANONIK FAYLLAR BUZILMAGAN%') then
    raise exception 'FAIL drive health message: %', v->'health';
  end if;
  if (v->>'drive_replica_failed')::int < 1 then raise exception 'FAIL drive_replica_failed count'; end if;

  -- 4. bounded
  if jsonb_array_length(v->'documents') > 50 then raise exception 'FAIL not bounded'; end if;

  -- 5. a non-member cannot read
  begin
    v := public.t2_document_registry_v1(v_boss + 999999, v_co, null, null, 50);
    if (v->>'ok') = 'true' then raise exception 'FAIL non-member read allowed'; end if;
  exception when others then if sqlstate <> '42501' then raise; end if;
  end;

  raise exception 'DOCUMENT_REGISTRY_ACCEPTANCE_PASS';
end $$;
