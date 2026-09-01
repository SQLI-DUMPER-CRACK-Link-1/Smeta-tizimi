-- DOCUMENT CENTER — canonical registry read model (FILE-TRUTH-001 companion)
-- SOURCE ONLY — NOT applied to production by this task.
-- Depends on 20260902120000_t2_file_truth_r2_canonical_v1.sql (canonical R2 columns).
--
-- Law: Supabase = metadata truth, private R2 = binary truth, Drive = replica.
-- This read model NEVER touches Drive/Sheets/GAS. A failed Drive replica is
-- reported as replica health, never as canonical-document failure.

begin;

create or replace function public.t2_document_registry_v1(
  p_actor_id bigint, p_kompaniya_id bigint,
  p_loyiha_id bigint default null, p_obyekt_id bigint default null,
  p_limit integer default 200)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  v_rol text;
  v_docs jsonb;
  v_health jsonb;
  v_lim integer := least(greatest(coalesce(p_limit,200), 1), 500);
  v_drive_failed integer;
  v_drive_synced integer;
  v_reserved_stuck integer;
begin
  -- membership + company scope (raises 42501 if not a member)
  v_rol := public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id, p_actor_id);

  select coalesce(jsonb_agg(x order by (x->>'updatedAt') desc), '[]'::jsonb) into v_docs from (
    select jsonb_build_object(
      'id', d.id::text,
      'filename', coalesce(d.original_filename, 'hujjat-'||d.id),
      'type', d.document_type,
      'revision', coalesce(d.revision_seq, 1),
      'mime', coalesce(d.mime_type, 'application/octet-stream'),
      'size', coalesce(d.size_bytes, 0),
      'sha256', coalesce(d.sha256, ''),
      'sha256_verified', coalesce(d.sha256_verified, false),
      'canonicalStatus', case coalesce(d.canonical_storage_status,'pending')
                           when 'stored' then 'READY' when 'reserved' then 'UPLOADING'
                           when 'failed' then 'ERROR' else 'REGISTERING' end,
      'metadataStatus', case when d.status = 'failed' then 'ERROR'
                             when coalesce(d.canonical_storage_status,'pending') = 'stored' then 'READY'
                             else 'PENDING' end,
      'updatedAt', coalesce(d.updated_at, d.created_at),
      'createdAt', d.created_at,
      'author', coalesce(d.created_by, 'actor:'||coalesce(d.actor_id::text,'-')),
      'replicas', jsonb_build_array(
        jsonb_build_object('provider','drive',
          'status', case
            when d.status = 'replica_missing' then 'MISSING'
            else upper(coalesce(d.drive_sync_status,'not_configured')) end,
          'externalId', d.drive_file_id, 'lastSyncedAt', d.drive_last_sync_at,
          'error', d.drive_last_error, 'revision', nullif(d.drive_revision,'')::text),
        jsonb_build_object('provider','sheets',
          'status', upper(coalesce(d.sheets_sync_status,'not_configured')),
          'externalId', d.sheets_entity_id, 'lastSyncedAt', d.sheets_last_sync_at)
      )
    ) x
    from public.t2_document_registry d
    where d.kompaniya_id = p_kompaniya_id
      and (p_loyiha_id is null or d.loyiha_id = p_loyiha_id)
      and (p_obyekt_id is null or d.obyekt_id = p_obyekt_id)
      and d.status <> 'superseded'
    order by coalesce(d.updated_at, d.created_at) desc
    limit v_lim
  ) s;

  select
    count(*) filter (where drive_sync_status = 'failed'),
    count(*) filter (where drive_sync_status = 'synced'),
    count(*) filter (where canonical_storage_status = 'reserved' and reserved_at < now() - interval '30 minutes')
    into v_drive_failed, v_drive_synced, v_reserved_stuck
  from public.t2_document_registry
  where kompaniya_id = p_kompaniya_id
    and (p_loyiha_id is null or loyiha_id = p_loyiha_id);

  v_health := jsonb_build_array(
    jsonb_build_object('provider','registry','status','TAYYOR',
      'message','Supabase metadata truth', 'lastCheck', now()),
    jsonb_build_object('provider','r2',
      'status', case when to_regclass('public.t2_document_registry') is not null
                     and exists(select 1 from public.t2_document_registry
                                where kompaniya_id=p_kompaniya_id and canonical_storage_status='stored')
                     then 'TAYYOR' else 'NOT_CONFIGURED' end,
      'message', case when v_reserved_stuck > 0
                      then v_reserved_stuck||' ta yuklash tugallanmagan — reconcile kutilmoqda'
                      else 'Private canonical bucket' end),
    jsonb_build_object('provider','drive',
      'status', case when v_drive_failed > 0 then 'FAILED'
                     when v_drive_synced > 0 then 'SYNCED' else 'NOT_CONFIGURED' end,
      'message', case when v_drive_failed > 0
                      then v_drive_failed||' ta Drive replika xato — KANONIK FAYLLAR BUZILMAGAN'
                      else 'Ikkilamchi sinxron nusxa' end),
    jsonb_build_object('provider','sheets','status','NOT_CONFIGURED',
      'message','Sheets write-back — reference implementation P1')
  );

  return jsonb_build_object(
    'ok', true, 'generated_at', now(), 'rol', v_rol,
    'kompaniya_id', p_kompaniya_id, 'loyiha_id', p_loyiha_id, 'obyekt_id', p_obyekt_id,
    'documents', v_docs,
    'health', v_health,
    'jami', jsonb_array_length(v_docs),
    'drive_replica_failed', coalesce(v_drive_failed,0));
end $$;

revoke all on function public.t2_document_registry_v1(bigint,bigint,bigint,bigint,integer) from public, anon, authenticated;

comment on function public.t2_document_registry_v1(bigint,bigint,bigint,bigint,integer) is
  'DOCUMENT CENTER: bounded canonical registry read model. Membership-checked; no Drive/Sheets/GAS; Drive failure never reported as canonical failure.';

commit;
