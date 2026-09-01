-- SHEETS REPLICA — write-back REFERENCE implementation (FILE-TRUTH-001 §8)
-- SOURCE ONLY — NOT applied to production by this task.
--
-- One real, reusable reference path for Google Sheets -> canonical write-back.
-- Remaining legacy per-sheet migrations stay DEFERRED-P1 (see
-- docs/architecture/FILE_TRUTH_AND_SECONDARY_REPLICA_V1.md §8).
--
-- INVARIANTS (identical to the Drive replica engine):
--   * identity is a STABLE entity id (sheets_entity_id), NEVER a row number.
--     A row that moves, sorts, or is re-inserted keeps its id.
--   * base_version guards every write-back  -> SHEETS_CONFLICT on drift.
--   * operation_id makes every write-back idempotent (replay-safe).
--   * a Sheets failure is replica-only; canonical metadata/R2 are untouched
--     unless the write-back actually succeeds.

begin;

create table if not exists public.t2_sheets_writeback_log (
  operation_id uuid primary key,
  kompaniya_id bigint not null,
  actor_id     bigint not null,
  entity_ref   text   not null,
  natija       jsonb  not null,
  created_at   timestamptz not null default now()
);
alter table public.t2_sheets_writeback_log enable row level security;

-- Reference write-back: a single canonical field for one document, addressed by
-- the STABLE sheets_entity_id. This is the template every other Sheets entity
-- write-back copies (contracts_sheet, resource_sheet, …).
create or replace function public.t2_document_sheets_writeback_v1(
  p_kompaniya_id bigint, p_actor_id bigint, p_document_id bigint,
  p_sheets_entity_id text, p_field text, p_new_value text,
  p_base_version integer, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.t2_document_registry; v_prev jsonb;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  select natija into v_prev from public.t2_sheets_writeback_log where operation_id = p_operation_id;
  if found then return v_prev; end if;

  perform public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id, p_actor_id);

  select * into d from public.t2_document_registry
    where id = p_document_id and kompaniya_id = p_kompaniya_id for update;
  if not found then return jsonb_build_object('ok',false,'code','DOCUMENT_NOT_FOUND'); end if;

  -- STABLE ID match — a Sheets row number is never accepted as identity
  if coalesce(nullif(btrim(p_sheets_entity_id),''), '') = '' then
    return jsonb_build_object('ok',false,'code','SHEETS_ENTITY_ID_REQUIRED');
  end if;
  if p_sheets_entity_id ~ '^\d+$' then
    return jsonb_build_object('ok',false,'code','SHEETS_ROW_NUMBER_REJECTED',
      'xato','sheets_entity_id stable identifier bo''lishi kerak, qator raqami emas');
  end if;
  if d.sheets_entity_id is not null and d.sheets_entity_id <> p_sheets_entity_id then
    return jsonb_build_object('ok',false,'code','SHEETS_ENTITY_MISMATCH');
  end if;

  if p_base_version is null or d.versiya <> p_base_version then
    return jsonb_build_object('ok',false,'code','SHEETS_CONFLICT','version',d.versiya);
  end if;

  if p_field not in ('original_filename','document_type') then
    return jsonb_build_object('ok',false,'code','SHEETS_FIELD_NOT_WRITEBACKABLE');
  end if;

  if p_field = 'original_filename' then
    update public.t2_document_registry
       set original_filename = btrim(p_new_value),
           sheets_entity_id = coalesce(sheets_entity_id, p_sheets_entity_id),
           sheets_sync_status = 'synced', sheets_last_sync_at = now(),
           versiya = versiya + 1, updated_at = now()
     where id = d.id;
  else
    update public.t2_document_registry
       set document_type = btrim(p_new_value),
           sheets_entity_id = coalesce(sheets_entity_id, p_sheets_entity_id),
           sheets_sync_status = 'synced', sheets_last_sync_at = now(),
           versiya = versiya + 1, updated_at = now()
     where id = d.id;
  end if;

  perform public.t2_audit_yoz(p_kompaniya_id, 'document_sheets_writeback', 'file_truth', d.obyekt_id,
    format('document_id=%s; entity=%s; field=%s; actor_id=%s', d.id, p_sheets_entity_id, p_field, p_actor_id),
    'actor:'||p_actor_id, null);

  v_prev := jsonb_build_object('ok',true,'document_id',d.id,'field',p_field,'versiya',d.versiya + 1);
  insert into public.t2_sheets_writeback_log (operation_id, kompaniya_id, actor_id, entity_ref, natija)
    values (p_operation_id, p_kompaniya_id, p_actor_id, 'document:'||p_sheets_entity_id, v_prev);
  return v_prev;
end $$;

revoke all on function public.t2_document_sheets_writeback_v1(bigint,bigint,bigint,text,text,text,integer,uuid) from public, anon, authenticated;

comment on function public.t2_document_sheets_writeback_v1(bigint,bigint,bigint,text,text,text,integer,uuid) is
  'SHEETS write-back REFERENCE: stable sheets_entity_id (never a row number) + base_version + operation_id. Template for all Sheets entity write-backs.';

commit;
