-- T2-HUJJAT-IDEAL-ZANJIR-001: owner talabi -- "hujjatlarga e'tibor ber,
-- hujjat masalasida muammo bo'lmasligi kerak, ideal zanjir bo'lsin har
-- bir hujjatda". Production'ni to'g'ridan-to'g'ri tekshirdim va HAQIQIY
-- buzilgan zanjir topdim:
--
-- `t2_document_registry` id=2 (obyekt "Fast food 1этаж"): `status='active'`
-- (ya'ni ro'yxatda "jonli hujjat" sifatida ko'rsatiladi), lekin
-- `canonical_storage_status='pending'`, r2_key/sha256/size_bytes/
-- original_filename -- HAMMASI bo'sh, `reserved_at`/`finalized_at` ham
-- yo'q. Bu `t2_document_registry_upsert_v1` (eski, endi ISHLATILMAYDIGAN
-- Drive-storage-provisioning zanjiri -- 20260830 t2_company_storage_
-- foundation_v1 dan, hech qanday Function chaqiruvchisiga ega emas)
-- orqali 2026-08-31 da yaratilgan, keyin hech qachon yakunlanmagan
-- "arvoh" yozuv. Hech qanday smeta/t2_qator unga bog'lanmagan.
--
-- Buning ustiga, `t2_document_registry_v1`ning sog'liq (health) tekshiruvi
-- FAQAT `canonical_storage_status='reserved' and reserved_at < 30 daqiqa`
-- holatini "osilib qolgan" deb hisoblardi -- bu yozuv esa 'pending'
-- holatida, `reserved_at` esa umuman NULL, shuning uchun tekshiruv uni
-- HECH QACHON ko'rmasdi -- "REGISTERING" deb abadiy ko'rsatilaverardi.
--
-- Ikkala narsa ham tuzatiladi: (1) bu aniq yozuv 'superseded' qilinadi
-- (o'chirilmaydi -- audit iz saqlanadi), (2) health tekshiruvi endi
-- `coalesce(reserved_at, created_at)` orqali HAR QANDAY tugallanmagan
-- holatni (nafaqat 'reserved') 30 daqiqadan keyin "osilib qolgan" deb
-- aniqlaydi -- kelajakda shunga o'xshash uzilgan yuklashlar UI'da
-- ko'rinadigan bo'ladi, jim yo'qolib qolmaydi.

begin;

update public.t2_document_registry
set status = 'superseded'
where id = 2
  and canonical_storage_status = 'pending'
  and r2_key is null and sha256 is null
  and not exists (select 1 from public.t2_qator where source_document_id = 2)
  and not exists (select 1 from public.t2_smeta_import_sessiya where source_document_id = 2);

create or replace function public.t2_document_registry_v1(p_actor_id bigint, p_kompaniya_id bigint, p_loyiha_id bigint DEFAULT NULL::bigint, p_obyekt_id bigint DEFAULT NULL::bigint, p_limit integer DEFAULT 200)
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
      -- T2-HUJJAT-IDEAL-ZANJIR-001: 30 daqiqadan ko'proq "stored"/"failed"
      -- bo'lmagan holatda qotib qolgan yozuv -- endi qatorning o'zida ham
      -- ERROR ko'rsatiladi (avval faqat umumiy health-strip xabarida bilinardi).
      'canonicalStatus', case
        when coalesce(d.canonical_storage_status,'pending') not in ('stored','failed')
             and coalesce(d.reserved_at, d.created_at) < now() - interval '30 minutes'
          then 'ERROR'
        when coalesce(d.canonical_storage_status,'pending') = 'stored' then 'READY'
        when coalesce(d.canonical_storage_status,'pending') = 'reserved' then 'UPLOADING'
        when coalesce(d.canonical_storage_status,'pending') = 'failed' then 'ERROR'
        else 'REGISTERING' end,
      'metadataStatus', case when d.status = 'failed' then 'ERROR'
                             when coalesce(d.canonical_storage_status,'pending') not in ('stored','failed')
                                  and coalesce(d.reserved_at, d.created_at) < now() - interval '30 minutes'
                               then 'ERROR'
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

  -- T2-HUJJAT-IDEAL-ZANJIR-001: avval FAQAT 'reserved' holati tekshirilardi.
  -- Endi HAR QANDAY yakunlanmagan (`stored`/`failed` bo'lmagan) holat, agar
  -- 30 daqiqadan ko'proq vaqt o'tgan bo'lsa (reserved_at bo'lmasa, yaratilgan
  -- vaqtidan hisoblanadi) -- "osilib qolgan" deb aniqlanadi.
  select
    count(*) filter (where drive_sync_status = 'failed'),
    count(*) filter (where drive_sync_status = 'synced'),
    count(*) filter (where status <> 'superseded'
                        and coalesce(canonical_storage_status,'pending') not in ('stored','failed')
                        and coalesce(reserved_at, created_at) < now() - interval '30 minutes')
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

commit;
