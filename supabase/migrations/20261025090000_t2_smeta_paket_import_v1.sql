-- T2-PTO-SMETA-PAKET-IMPORT-001
--
-- Bitta obyektning boshlang'ich smetasi ko'pincha bitta hujjat emas:
-- 4 uchastka + EO qismi kabi bir nechta mustaqil LRV hamda ularning RES
-- manbalari bo'ladi. Avvalgi t2_smeta_import_*_v1 bitta source_document_id
-- bilan ishlaydi va birinchi importdan keyin obyektni SMETA_ALREADY_EXISTS
-- bilan yopadi. Bu migration V1 ni o'zgartirmaydi; ko'p-manbali boshlang'ich
-- import uchun yangi, atomik paket kontraktini qo'shadi.
--
-- Qonunlar:
-- * t2_qator yagona qator haqiqati bo'lib qoladi -- parallel qator jadvali yo'q.
-- * har qator aniq LRV hujjati hamda paket a'zosiga bog'lanadi.
-- * RES hujjati faqat uning egasi bo'lgan paket a'zosiga biriktiriladi.
-- * bir manbadagi xato yakunlashni rad etadi; yarim t2_qator ko'rinmaydi.
-- * eski bitta-faylli import RPC lar o'zgarmaydi.

begin;

-- Canonical document registry avval document_type bo'yicha revision yuritardi.
-- Beshta LRVni bir xil `smeta_lrv` turi bilan saqlash ularni bir-birining
-- revisioni deb supersede qilmasligi uchun yangi, faqat kerak bo'lganda
-- ishlatiladigan logical slot qo'shiladi.
alter table public.t2_document_registry
  add column if not exists source_slot_key text;

alter table public.t2_document_registry
  drop constraint if exists t2_document_registry_source_slot_key_check;
alter table public.t2_document_registry
  add constraint t2_document_registry_source_slot_key_check
  check (source_slot_key is null or source_slot_key ~ '^[a-z0-9][a-z0-9._:-]{0,180}$');

comment on column public.t2_document_registry.source_slot_key is
  'Optional logical source slot. Documents with different non-null slots are independent active revisions even when company/project/object/document_type are equal. Used by multi-file smeta packages.';

create index if not exists t2_document_registry_slot_revision_idx
  on public.t2_document_registry(kompaniya_id, loyiha_id, obyekt_id, document_type, source_slot_key, revision_seq desc);

-- Slot-aware reserve keeps old reserve_v1 behavior untouched for every
-- existing caller. The caller supplies a deterministic package/member/role
-- slot only after browser-side SHA/R2 upload validation has begun.
create or replace function public.t2_document_canonical_reserve_slot_v1(
  p_kompaniya_id bigint, p_actor_id bigint, p_loyiha_id bigint, p_obyekt_id bigint,
  p_document_type text, p_source_slot_key text, p_original_filename text, p_mime_type text,
  p_expected_size bigint, p_client_sha256 text, p_operation_id uuid, p_revision text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.t2_document_registry; v_seq integer; v_key text; v_slot text;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  v_slot := lower(btrim(coalesce(p_source_slot_key,'')));
  if v_slot !~ '^[a-z0-9][a-z0-9._:-]{0,180}$' then
    return jsonb_build_object('ok',false,'code','SOURCE_SLOT_INVALID');
  end if;
  if btrim(coalesce(p_document_type,'')) not in ('smeta_lrv','smeta_res') then
    return jsonb_build_object('ok',false,'code','SOURCE_DOCUMENT_TYPE_INVALID');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('doccanon:'||p_operation_id::text,0));
  perform public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id,p_actor_id);

  if p_obyekt_id is null or not exists(
      select 1 from public.t2_obyekt o where o.id=p_obyekt_id and o.kompaniya_id=p_kompaniya_id
        and (p_loyiha_id is null or o.loyiha_id=p_loyiha_id)) then
    return jsonb_build_object('ok',false,'code','STORAGE_TENANT_MISMATCH');
  end if;
  if p_loyiha_id is not null and not exists(
      select 1 from public.t2_loyiha l where l.id=p_loyiha_id and l.kompaniya_id=p_kompaniya_id) then
    return jsonb_build_object('ok',false,'code','PROJECT_COMPANY_MISMATCH');
  end if;

  select * into d from public.t2_document_registry
   where kompaniya_id=p_kompaniya_id and operation_id=p_operation_id for update;
  if found then
    if d.loyiha_id is distinct from p_loyiha_id or d.obyekt_id is distinct from p_obyekt_id
       or d.source_slot_key is distinct from v_slot then
      return jsonb_build_object('ok',false,'code','STORAGE_TENANT_MISMATCH');
    end if;
    return jsonb_build_object('ok',true,'document_id',d.id,'revision_seq',d.revision_seq,
      'r2_bucket',d.r2_bucket,'r2_key',d.r2_key,'canonical_storage_status',d.canonical_storage_status,
      'versiya',d.versiya,'retry',true);
  end if;

  select coalesce(max(revision_seq),0)+1 into v_seq from public.t2_document_registry
   where kompaniya_id=p_kompaniya_id and loyiha_id is not distinct from p_loyiha_id
     and obyekt_id is not distinct from p_obyekt_id and document_type=btrim(p_document_type)
     and source_slot_key=v_slot;

  insert into public.t2_document_registry(
      kompaniya_id,loyiha_id,obyekt_id,provider,document_type,source_slot_key,revision,revision_seq,
      original_filename,mime_type,expected_size_bytes,sha256,r2_bucket,
      canonical_storage_status,status,versiya,created_by,actor_id,operation_id,
      reserved_at,drive_sync_status)
    values (p_kompaniya_id,p_loyiha_id,p_obyekt_id,'cloudflare_r2',btrim(p_document_type),v_slot,
      p_revision,v_seq,p_original_filename,p_mime_type,p_expected_size,nullif(btrim(p_client_sha256),''),
      'canonical','reserved','pending',1,'t2-web',p_actor_id,p_operation_id,now(),'not_configured')
    returning * into d;

  v_key := format('docs/%s/%s/%s/d%s/r%s', p_kompaniya_id,
                  coalesce(p_loyiha_id::text,'_'), p_obyekt_id::text, d.id, v_seq);
  update public.t2_document_registry set r2_key=v_key, updated_at=now() where id=d.id returning * into d;

  perform public.t2_audit_yoz(p_kompaniya_id,'document_canonical_reserved','file_truth',d.obyekt_id,
    format('document_id=%s; source_slot_key=%s; r2_key=%s; actor_id=%s',d.id,v_slot,v_key,p_actor_id),'actor:'||p_actor_id,null);
  return jsonb_build_object('ok',true,'document_id',d.id,'revision_seq',d.revision_seq,
    'r2_bucket',d.r2_bucket,'r2_key',v_key,'canonical_storage_status','reserved','versiya',d.versiya);
end $$;

-- Existing generic documents continue grouping only with other NULL-slot
-- documents. Slot documents supersede only their own slot.
create or replace function public.t2_document_canonical_finalize_v1(
  p_kompaniya_id bigint, p_actor_id bigint, p_document_id bigint, p_operation_id uuid,
  p_r2_key text, p_sha256 text, p_size_bytes bigint, p_sha256_verified boolean, p_hash_source text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.t2_document_registry;
begin
  perform pg_advisory_xact_lock(hashtextextended('doccanon:'||p_operation_id::text,0));
  perform public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id,p_actor_id);
  select * into d from public.t2_document_registry
   where id=p_document_id and kompaniya_id=p_kompaniya_id and operation_id=p_operation_id for update;
  if not found then return jsonb_build_object('ok',false,'code','DOCUMENT_NOT_FOUND'); end if;
  if d.canonical_storage_status='stored' then
    return jsonb_build_object('ok',true,'document_id',d.id,'revision_seq',d.revision_seq,
      'r2_key',d.r2_key,'sha256',d.sha256,'versiya',d.versiya,'retry',true); end if;
  if d.r2_key is distinct from btrim(p_r2_key) then
    return jsonb_build_object('ok',false,'code','CANONICAL_KEY_MISMATCH'); end if;
  if nullif(btrim(p_sha256),'') is null then
    return jsonb_build_object('ok',false,'code','DOCUMENT_CONTRACT_INVALID'); end if;
  if d.sha256 is not null and d.sha256 <> btrim(p_sha256) then
    return jsonb_build_object('ok',false,'code','CANONICAL_HASH_MISMATCH'); end if;

  if d.revision_seq>1 then
    update public.t2_document_registry set status='superseded', updated_at=now()
     where kompaniya_id=p_kompaniya_id and loyiha_id is not distinct from d.loyiha_id
       and obyekt_id is not distinct from d.obyekt_id and document_type=d.document_type
       and source_slot_key is not distinct from d.source_slot_key
       and status='active' and id<>d.id;
  end if;

  update public.t2_document_registry
     set sha256=btrim(p_sha256), size_bytes=p_size_bytes, sha256_verified=coalesce(p_sha256_verified,false),
         hash_source=case when p_hash_source in ('server','client') then p_hash_source else 'client' end,
         canonical_storage_status='stored', status='active', finalized_at=now(), updated_at=now()
   where id=d.id returning * into d;

  insert into public.t2_replica_sync_job(kompaniya_id,target,entity_type,entity_id,operation,base_version,source_hash,operation_id)
    values (p_kompaniya_id,'drive','document',d.id,'mirror',d.versiya,d.sha256,p_operation_id)
    on conflict do nothing;
  update public.t2_document_registry set drive_sync_status='pending' where id=d.id and drive_sync_status='not_configured';
  perform public.t2_audit_yoz(p_kompaniya_id,'document_canonical_stored','file_truth',d.obyekt_id,
    format('document_id=%s; sha256=%s; verified=%s; size=%s; actor_id=%s',d.id,d.sha256,d.sha256_verified,d.size_bytes,p_actor_id),
    'actor:'||p_actor_id,null);
  return jsonb_build_object('ok',true,'document_id',d.id,'revision_seq',d.revision_seq,
    'r2_key',d.r2_key,'sha256',d.sha256,'sha256_verified',d.sha256_verified,'versiya',d.versiya);
end $$;

-- R2 yozilib, finalize javobi uzilib qolgan holatda reconcile ham xuddi
-- finalize kabi slot chegarasini saqlaydi. Aks holda kam uchraydigan retry
-- poygasida bitta slot uchun ikki `active` revision qolishi mumkin.
create or replace function public.t2_document_canonical_reconcile_v1(
  p_document_id bigint, p_r2_key_exists boolean, p_sha256 text default null, p_size bigint default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.t2_document_registry;
begin
  select * into d from public.t2_document_registry where id=p_document_id for update;
  if not found then return jsonb_build_object('ok',false,'code','DOCUMENT_NOT_FOUND'); end if;
  if d.canonical_storage_status<>'reserved' then
    return jsonb_build_object('ok',true,'document_id',d.id,'no_action',d.canonical_storage_status); end if;
  if d.reserved_at > now() - interval '15 minutes' then
    return jsonb_build_object('ok',true,'document_id',d.id,'no_action','too_recent'); end if;
  if p_r2_key_exists and coalesce(nullif(btrim(p_sha256),''),d.sha256) is not null then
    if d.revision_seq>1 then
      update public.t2_document_registry set status='superseded',updated_at=now()
       where kompaniya_id=d.kompaniya_id and loyiha_id is not distinct from d.loyiha_id
         and obyekt_id is not distinct from d.obyekt_id and document_type=d.document_type
         and source_slot_key is not distinct from d.source_slot_key and status='active' and id<>d.id;
    end if;
    update public.t2_document_registry
       set canonical_storage_status='stored',status='active',finalized_at=now(),
           sha256=coalesce(nullif(btrim(p_sha256),''),d.sha256),size_bytes=coalesce(p_size,d.size_bytes),
           sha256_verified=false,hash_source='client',updated_at=now()
     where id=d.id returning * into d;
    insert into public.t2_replica_sync_job(kompaniya_id,target,entity_type,entity_id,operation,base_version,source_hash)
      values(d.kompaniya_id,'drive','document',d.id,'mirror',d.versiya,d.sha256) on conflict do nothing;
    return jsonb_build_object('ok',true,'document_id',d.id,'action','finalized_from_r2');
  else
    update public.t2_document_registry set canonical_storage_status='failed',status='failed',updated_at=now() where id=d.id;
    return jsonb_build_object('ok',true,'document_id',d.id,'action','failed_no_binary','r2_key',d.r2_key);
  end if;
end $$;

create table if not exists public.t2_smeta_paket (
  id bigint generated by default as identity primary key,
  kompaniya_id bigint not null,
  loyiha_id bigint,
  obyekt_id bigint not null references public.t2_obyekt(id),
  paket_kalit text not null check (paket_kalit ~ '^[a-z0-9][a-z0-9._-]{0,79}$'),
  nom text not null check (length(btrim(nom)) between 1 and 240),
  holat text not null default 'qoralama' check (holat in ('qoralama','faol','arxiv')),
  operation_id uuid not null unique,
  actor_id bigint not null,
  versiya integer not null default 1 check (versiya > 0),
  yaratildi timestamptz not null default now(),
  yangilandi timestamptz not null default now(),
  unique (kompaniya_id, obyekt_id, paket_kalit)
);

create table if not exists public.t2_smeta_paket_manba (
  id bigint generated by default as identity primary key,
  paket_id bigint not null references public.t2_smeta_paket(id),
  manba_kalit text not null check (manba_kalit ~ '^[a-z0-9][a-z0-9._-]{0,79}$'),
  nom text not null check (length(btrim(nom)) between 1 and 240),
  lrv_document_id bigint not null references public.t2_document_registry(id),
  versiya integer not null default 1 check (versiya > 0),
  yaratildi timestamptz not null default now(),
  yangilandi timestamptz not null default now(),
  unique (paket_id, manba_kalit),
  unique (paket_id, lrv_document_id)
);

create table if not exists public.t2_smeta_paket_res_manba (
  paket_manba_id bigint not null references public.t2_smeta_paket_manba(id),
  res_document_id bigint not null references public.t2_document_registry(id),
  yaratildi timestamptz not null default now(),
  primary key (paket_manba_id, res_document_id)
);

create table if not exists public.t2_smeta_paket_import_sessiya (
  id bigint generated by default as identity primary key,
  paket_id bigint not null references public.t2_smeta_paket(id),
  kompaniya_id bigint not null,
  obyekt_id bigint not null references public.t2_obyekt(id),
  actor_id bigint not null,
  operation_id uuid not null unique,
  holat text not null default 'ochiq' check (holat in ('ochiq','yakunlandi','bekor')),
  qator_soni integer not null default 0 check (qator_soni >= 0),
  yaratildi timestamptz not null default now(),
  yangilandi timestamptz not null default now()
);

create table if not exists public.t2_smeta_paket_import_bolak (
  sessiya_id bigint not null references public.t2_smeta_paket_import_sessiya(id),
  bolak integer not null check (bolak >= 0),
  qatorlar jsonb not null check (jsonb_typeof(qatorlar)='array'),
  yaratildi timestamptz not null default now(),
  primary key (sessiya_id, bolak)
);

alter table public.t2_qator
  add column if not exists smeta_paket_manba_id bigint references public.t2_smeta_paket_manba(id);
comment on column public.t2_qator.smeta_paket_manba_id is
  'Multi-file smeta package member that owns this canonical row. source_document_id remains the exact LRV source document.';

create index if not exists t2_qator_paket_manba_idx on public.t2_qator(smeta_paket_manba_id, id);
create index if not exists t2_smeta_paket_object_idx on public.t2_smeta_paket(kompaniya_id, obyekt_id, holat);

alter table public.t2_smeta_paket enable row level security;
alter table public.t2_smeta_paket_manba enable row level security;
alter table public.t2_smeta_paket_res_manba enable row level security;
alter table public.t2_smeta_paket_import_sessiya enable row level security;
alter table public.t2_smeta_paket_import_bolak enable row level security;
revoke all on table public.t2_smeta_paket, public.t2_smeta_paket_manba, public.t2_smeta_paket_res_manba,
  public.t2_smeta_paket_import_sessiya, public.t2_smeta_paket_import_bolak from anon, authenticated;

create or replace function public.t2_smeta_paket_import_boshla_v1(
  p_kompaniya_id bigint, p_actor_id bigint, p_obyekt_id bigint, p_operation_id uuid,
  p_paket_kalit text, p_paket_nom text, p_manbalar jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_session public.t2_smeta_paket_import_sessiya; v_paket public.t2_smeta_paket;
  v_loyiha_id bigint; v_key text; v_count integer;
begin
  perform public.t2_smeta_import_ruxsat(p_kompaniya_id,p_actor_id);
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  v_key := lower(btrim(coalesce(p_paket_kalit,'')));
  if v_key !~ '^[a-z0-9][a-z0-9._-]{0,79}$' or length(btrim(coalesce(p_paket_nom,'')))=0 then
    return jsonb_build_object('ok',false,'code','PACKAGE_CONTRACT_INVALID');
  end if;
  if p_manbalar is null or jsonb_typeof(p_manbalar)<>'array' then
    return jsonb_build_object('ok',false,'code','PACKAGE_SOURCE_REQUIRED');
  end if;
  v_count := jsonb_array_length(p_manbalar);
  if v_count < 1 or v_count > 20 then return jsonb_build_object('ok',false,'code','PACKAGE_SOURCE_COUNT_INVALID'); end if;

  select o.loyiha_id into v_loyiha_id from public.t2_obyekt o
   where o.id=p_obyekt_id and o.kompaniya_id=p_kompaniya_id;
  if not found then return jsonb_build_object('ok',false,'code','OBJECT_ACCESS_DENIED'); end if;

  select * into v_session from public.t2_smeta_paket_import_sessiya
   where operation_id=p_operation_id and kompaniya_id=p_kompaniya_id for update;
  if found then
    if v_session.obyekt_id<>p_obyekt_id or v_session.actor_id<>p_actor_id then
      return jsonb_build_object('ok',false,'code','OPERATION_SCOPE_MISMATCH');
    end if;
    return jsonb_build_object('ok',true,'sessiya_id',v_session.id,'paket_id',v_session.paket_id,
      'qator_soni',v_session.qator_soni,'holat',v_session.holat,'takror',true);
  end if;

  if exists(select 1 from public.t2_qator where obyekt_id=p_obyekt_id) then
    return jsonb_build_object('ok',false,'code','SMETA_ALREADY_EXISTS');
  end if;
  -- Bir obyekt uchun boshlang'ich smeta paketi bitta bo'ladi. UUID tasodifan
  -- boshqa operation_id bilan qayta yuborilgan taqdirda ham raw UNIQUE xato
  -- emas, boshqariladigan kontrakt qaytamiz.
  if exists(
    select 1 from public.t2_smeta_paket
    where kompaniya_id=p_kompaniya_id and obyekt_id=p_obyekt_id and paket_kalit=v_key
  ) then return jsonb_build_object('ok',false,'code','PACKAGE_ALREADY_EXISTS'); end if;
  if exists(
    select 1 from jsonb_array_elements(p_manbalar) x
    where coalesce(x->>'kalit','') !~ '^[a-z0-9][a-z0-9._-]{0,79}$'
       or length(btrim(coalesce(x->>'nom','')))=0
       or coalesce(x->>'lrv_document_id','') !~ '^[1-9][0-9]*$'
  ) then return jsonb_build_object('ok',false,'code','PACKAGE_SOURCE_INVALID'); end if;
  if exists(
    select 1 from (
      select x->>'kalit' k, count(*) n from jsonb_array_elements(p_manbalar) x group by x->>'kalit'
    ) d where d.n>1
  ) then return jsonb_build_object('ok',false,'code','PACKAGE_SOURCE_DUPLICATE'); end if;
  if exists(
    select 1 from jsonb_array_elements(p_manbalar) x
    left join public.t2_document_registry d on d.id=(x->>'lrv_document_id')::bigint
    where d.id is null or d.kompaniya_id<>p_kompaniya_id or d.obyekt_id is distinct from p_obyekt_id
      or d.document_type<>'smeta_lrv' or d.status<>'active' or d.canonical_storage_status<>'stored'
      or d.source_slot_key is distinct from ('smeta-paket:'||v_key||':'||(x->>'kalit')||':lrv')
  ) then return jsonb_build_object('ok',false,'code','PACKAGE_LRV_SOURCE_MISMATCH'); end if;
  -- Avval JSON turini alohida tekshiramiz: scalar qiymatni
  -- jsonb_array_elements ga berish Postgres istisnosini chiqaradi, biz esa
  -- mijozga boshqariladigan kontrakt kodi qaytishini xohlaymiz.
  if exists(
    select 1 from jsonb_array_elements(p_manbalar) x
    where jsonb_typeof(coalesce(x->'res_document_ids','[]'::jsonb))<>'array'
  ) then return jsonb_build_object('ok',false,'code','PACKAGE_RES_SOURCE_INVALID'); end if;
  if exists(
    select 1 from jsonb_array_elements(p_manbalar) x
    cross join lateral jsonb_array_elements(coalesce(x->'res_document_ids','[]'::jsonb)) r
    where coalesce(r#>>'{}','') !~ '^[1-9][0-9]*$'
  ) then return jsonb_build_object('ok',false,'code','PACKAGE_RES_SOURCE_INVALID'); end if;
  if exists(
    select 1 from jsonb_array_elements(p_manbalar) x
    cross join lateral jsonb_array_elements(coalesce(x->'res_document_ids','[]'::jsonb)) r
    left join public.t2_document_registry d on d.id=(r#>>'{}')::bigint
    where d.id is null or d.kompaniya_id<>p_kompaniya_id or d.obyekt_id is distinct from p_obyekt_id
      or d.document_type<>'smeta_res' or d.status<>'active' or d.canonical_storage_status<>'stored'
      or d.source_slot_key not like ('smeta-paket:'||v_key||':'||(x->>'kalit')||':res:%')
  ) then return jsonb_build_object('ok',false,'code','PACKAGE_RES_SOURCE_MISMATCH'); end if;
  if exists(
    select 1 from (
      select r#>>'{}' id, count(*) n
      from jsonb_array_elements(p_manbalar) x cross join lateral jsonb_array_elements(coalesce(x->'res_document_ids','[]'::jsonb)) r
      group by r#>>'{}'
    ) d where d.n>1
  ) then return jsonb_build_object('ok',false,'code','PACKAGE_RES_SOURCE_DUPLICATE'); end if;

  insert into public.t2_smeta_paket(kompaniya_id,loyiha_id,obyekt_id,paket_kalit,nom,operation_id,actor_id)
    values (p_kompaniya_id,v_loyiha_id,p_obyekt_id,v_key,btrim(p_paket_nom),p_operation_id,p_actor_id)
    returning * into v_paket;
  insert into public.t2_smeta_paket_manba(paket_id,manba_kalit,nom,lrv_document_id)
    select v_paket.id, x->>'kalit', btrim(x->>'nom'), (x->>'lrv_document_id')::bigint
    from jsonb_array_elements(p_manbalar) x;
  insert into public.t2_smeta_paket_res_manba(paket_manba_id,res_document_id)
    select pm.id,(r#>>'{}')::bigint from jsonb_array_elements(p_manbalar) x
    join public.t2_smeta_paket_manba pm on pm.paket_id=v_paket.id and pm.manba_kalit=x->>'kalit'
    cross join lateral jsonb_array_elements(coalesce(x->'res_document_ids','[]'::jsonb)) r;
  insert into public.t2_smeta_paket_import_sessiya(paket_id,kompaniya_id,obyekt_id,actor_id,operation_id)
    values(v_paket.id,p_kompaniya_id,p_obyekt_id,p_actor_id,p_operation_id) returning * into v_session;
  perform public.t2_audit_yoz(p_kompaniya_id,'smeta_paket_import_boshla','smeta',p_obyekt_id,
    format('paket_id=%s; manba_soni=%s',v_paket.id,v_count),'actor:'||p_actor_id,null);
  return jsonb_build_object('ok',true,'sessiya_id',v_session.id,'paket_id',v_paket.id,'manba_soni',v_count);
end $$;

create or replace function public.t2_smeta_paket_import_bolak_v1(
  p_kompaniya_id bigint, p_actor_id bigint, p_sessiya_id bigint, p_bolak integer, p_qatorlar jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_session public.t2_smeta_paket_import_sessiya; v_n integer; v_jami integer;
begin
  perform public.t2_smeta_import_ruxsat(p_kompaniya_id,p_actor_id);
  select * into v_session from public.t2_smeta_paket_import_sessiya
   where id=p_sessiya_id and kompaniya_id=p_kompaniya_id for update;
  if not found or v_session.actor_id<>p_actor_id then return jsonb_build_object('ok',false,'code','IMPORT_SESSION_NOT_FOUND'); end if;
  if v_session.holat<>'ochiq' then return jsonb_build_object('ok',false,'code','IMPORT_SESSION_CLOSED'); end if;
  if p_bolak is null or p_bolak<0 or p_qatorlar is null or jsonb_typeof(p_qatorlar)<>'array' then
    return jsonb_build_object('ok',false,'code','BAD_CHUNK'); end if;
  v_n:=jsonb_array_length(p_qatorlar);
  if v_n<1 or v_n>10000 then return jsonb_build_object('ok',false,'code','BAD_CHUNK_SIZE'); end if;
  if exists(
    select 1 from jsonb_array_elements(p_qatorlar) x
    left join public.t2_smeta_paket_manba pm on pm.paket_id=v_session.paket_id and pm.manba_kalit=x->>'source_key'
    where nullif(x->>'local_id','') is null or nullif(x->>'source_key','') is null or pm.id is null
  ) then return jsonb_build_object('ok',false,'code','PACKAGE_ROW_SOURCE_MISMATCH'); end if;
  insert into public.t2_smeta_paket_import_bolak(sessiya_id,bolak,qatorlar) values(p_sessiya_id,p_bolak,p_qatorlar)
    on conflict(sessiya_id,bolak) do update set qatorlar=excluded.qatorlar, yaratildi=now();
  select coalesce(sum(jsonb_array_length(qatorlar)),0)::integer into v_jami
    from public.t2_smeta_paket_import_bolak where sessiya_id=p_sessiya_id;
  update public.t2_smeta_paket_import_sessiya set qator_soni=v_jami,yangilandi=now() where id=p_sessiya_id;
  return jsonb_build_object('ok',true,'bolak',p_bolak,'qator_soni',v_n,'jami',v_jami);
end $$;

create or replace function public.t2_smeta_paket_import_yakunla_v1(
  p_kompaniya_id bigint, p_actor_id bigint, p_sessiya_id bigint)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_session public.t2_smeta_paket_import_sessiya; v_prev jsonb; v_soni integer;
begin
  perform public.t2_smeta_import_ruxsat(p_kompaniya_id,p_actor_id);
  select * into v_session from public.t2_smeta_paket_import_sessiya
   where id=p_sessiya_id and kompaniya_id=p_kompaniya_id for update;
  if not found or v_session.actor_id<>p_actor_id then return jsonb_build_object('ok',false,'code','IMPORT_SESSION_NOT_FOUND'); end if;
  select natija into v_prev from public.t2_onboarding_command_log where operation_id=v_session.operation_id;
  if found then return v_prev; end if;
  if v_session.holat<>'ochiq' then return jsonb_build_object('ok',false,'code','IMPORT_SESSION_CLOSED'); end if;
  if not exists(select 1 from public.t2_smeta_paket_import_bolak where sessiya_id=p_sessiya_id) then
    return jsonb_build_object('ok',false,'code','IMPORT_EMPTY'); end if;
  if exists(select 1 from public.t2_qator where obyekt_id=v_session.obyekt_id) then
    return jsonb_build_object('ok',false,'code','SMETA_ALREADY_EXISTS'); end if;

  -- PK xatosini mijozga sizdirmaymiz: barcha bolaklar bo'ylab local_id
  -- takrorlanishini insertdan OLDIN kontrakt darajasida tekshiramiz.
  if exists(
    select 1 from (
      select x->>'local_id' as local_id, count(*) as n
      from public.t2_smeta_paket_import_bolak b
      cross join lateral jsonb_array_elements(b.qatorlar) x
      where b.sessiya_id=p_sessiya_id
      group by x->>'local_id'
    ) d where d.local_id is null or d.local_id='' or d.n>1
  ) then return jsonb_build_object('ok',false,'code','PACKAGE_DUPLICATE_LOCAL_ID'); end if;

  create temporary table t2_pkg_imp_qator(
    local_id text primary key, parent_local_id text, source_member_id bigint, source_document_id bigint,
    tur text, kod text, nom text, birlik text, hajm numeric, narx numeric, summa numeric, norma numeric,
    kat text, ordinal integer, new_id bigint, ota_id bigint, daraja integer
  ) on commit drop;

  insert into t2_pkg_imp_qator(local_id,parent_local_id,source_member_id,source_document_id,tur,kod,nom,birlik,hajm,narx,summa,norma,kat,ordinal,new_id)
  select x->>'local_id',nullif(x->>'parent_local_id',''),pm.id,pm.lrv_document_id,
    x->>'tur',nullif(x->>'kod',''),nullif(x->>'nom',''),nullif(x->>'birlik',''),
    public.t2_son_tez(x->>'hajm'),public.t2_son_tez(x->>'narx'),public.t2_son_tez(x->>'summa'),public.t2_son_tez(x->>'norma'),
    case when x->>'tur' in ('rs','mat','ob') then coalesce(
      (select rk.kategoriya from public.t2_resurs_kategoriya rk where rk.kompaniya_id=p_kompaniya_id
        and rk.nom_key=public.t2_resurs_nom_kalit(x->>'nom') and rk.birlik_key=public.t2_resurs_birlik_kalit(x->>'birlik')),
      public.t2_kat_birlik(x->>'birlik',x->>'nom')) end,
    row_number() over(order by b.bolak,t.ordinality)::integer,nextval(pg_get_serial_sequence('public.t2_qator','id'))
  from public.t2_smeta_paket_import_bolak b
  cross join lateral jsonb_array_elements(b.qatorlar) with ordinality t(x,ordinality)
  join public.t2_smeta_paket_manba pm on pm.paket_id=v_session.paket_id and pm.manba_kalit=x->>'source_key'
  where b.sessiya_id=p_sessiya_id;

  -- Parent manbada bo'lishi shart; yo'qolgan parentni nullga aylantirib
  -- yashirish mumkin emas.
  if exists(
    select 1 from t2_pkg_imp_qator c
    left join t2_pkg_imp_qator p on p.local_id=c.parent_local_id
    where c.parent_local_id is not null and p.local_id is null
  ) then return jsonb_build_object('ok',false,'code','PACKAGE_PARENT_NOT_FOUND'); end if;
  if exists(
    select 1 from public.t2_smeta_paket_manba pm
    where pm.paket_id=v_session.paket_id
      and not exists(select 1 from t2_pkg_imp_qator q where q.source_member_id=pm.id)
  ) then return jsonb_build_object('ok',false,'code','PACKAGE_MEMBER_EMPTY'); end if;
  if exists(select 1 from t2_pkg_imp_qator c join t2_pkg_imp_qator p on p.local_id=c.parent_local_id where c.source_member_id<>p.source_member_id) then
    return jsonb_build_object('ok',false,'code','PACKAGE_CROSS_SOURCE_PARENT'); end if;
  update t2_pkg_imp_qator c set ota_id=p.new_id from t2_pkg_imp_qator p where p.local_id=c.parent_local_id;
  with recursive depth as (
    select local_id,0 as lvl from t2_pkg_imp_qator where parent_local_id is null
    union all select c.local_id,depth.lvl+1 from t2_pkg_imp_qator c join depth on c.parent_local_id=depth.local_id
  ) update t2_pkg_imp_qator q set daraja=depth.lvl from depth where q.local_id=depth.local_id;

  perform set_config('t2.manba','import',true);
  insert into public.t2_qator(id,obyekt_id,kompaniya_id,tur,kod,nom,birlik,hajm,narx,summa,source_document_id,smeta_paket_manba_id,tartib,daraja,kat,ota_id,norma)
  overriding system value
  select new_id,v_session.obyekt_id,p_kompaniya_id,tur,kod,nom,birlik,hajm,narx,summa,source_document_id,source_member_id,ordinal,coalesce(daraja,0),kat,ota_id,
    case when tur='rs' then norma else null end
  from t2_pkg_imp_qator order by ordinal;
  select count(*) into v_soni from t2_pkg_imp_qator;
  update public.t2_smeta_paket_import_sessiya set holat='yakunlandi',qator_soni=v_soni,yangilandi=now() where id=p_sessiya_id;
  update public.t2_smeta_paket set holat='faol',yangilandi=now(),versiya=versiya+1 where id=v_session.paket_id;
  delete from public.t2_smeta_paket_import_bolak where sessiya_id=p_sessiya_id;
  if v_soni<5000 then
    begin
      perform public.t2_rollup(v_session.obyekt_id);
      perform public.t2_signal_refresh_object(p_kompaniya_id,v_session.obyekt_id);
    exception when others then raise warning 't2_smeta_paket_import_yakunla_v1: rollup/signal failed: %',sqlerrm;
    end;
  end if;
  perform public.t2_audit_yoz(p_kompaniya_id,'smeta_paket_import','smeta',v_session.obyekt_id,
    format('paket_id=%s; qator_soni=%s',v_session.paket_id,v_soni),'actor:'||p_actor_id,null);
  v_prev:=jsonb_build_object('ok',true,'obyekt_id',v_session.obyekt_id,'paket_id',v_session.paket_id,'qator_soni',v_soni);
  insert into public.t2_onboarding_command_log(operation_id,actor_id,command,natija)
    values(v_session.operation_id,p_actor_id,'smeta_paket_import',v_prev);
  return v_prev;
end $$;

revoke all on function public.t2_document_canonical_reserve_slot_v1(bigint,bigint,bigint,bigint,text,text,text,text,bigint,text,uuid,text),
  public.t2_smeta_paket_import_boshla_v1(bigint,bigint,bigint,uuid,text,text,jsonb),
  public.t2_smeta_paket_import_bolak_v1(bigint,bigint,bigint,integer,jsonb),
  public.t2_smeta_paket_import_yakunla_v1(bigint,bigint,bigint)
from public, anon, authenticated;
grant execute on function public.t2_document_canonical_reserve_slot_v1(bigint,bigint,bigint,bigint,text,text,text,text,bigint,text,uuid,text),
  public.t2_smeta_paket_import_boshla_v1(bigint,bigint,bigint,uuid,text,text,jsonb),
  public.t2_smeta_paket_import_bolak_v1(bigint,bigint,bigint,integer,jsonb),
  public.t2_smeta_paket_import_yakunla_v1(bigint,bigint,bigint)
to service_role;

commit;
