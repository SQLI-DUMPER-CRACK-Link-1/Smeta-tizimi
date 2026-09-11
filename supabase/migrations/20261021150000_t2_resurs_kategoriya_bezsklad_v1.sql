-- T2-RESURS-BEZSKLAD-V1: canonical no-warehouse resource category.
--
-- SOURCE ONLY. This additive migration is intentionally later than the actual
-- latest migration in this checkout: 20261021140000.
--
-- The owner rule is deterministic and server-side:
--   * unit-derived ЧЕЛ/МАШ always wins;
--   * name-derived БЕЗСКЛАД is next for ВОДА/SUV, БЕТОН/BETON, and
--     РАСТВОР/RASTVOR;
--   * a confirmed tenant registry entry is next;
--   * t2_kat_birlik remains the final fallback.
--
-- Storable aggregates (ПЕСОК/QUM, ЩЕБЕНЬ/SHEBEN, КВАРЦ/KVARS) and obvious
-- concrete products/dry mortar are explicitly excluded from name detection.
-- Existing tenant/auth/idempotency/audit behavior is preserved in the exact
-- inspected writer signatures below; only category selection is delegated to
-- the new precedence helper.
--
-- BLOCKED (intentional, not guessed): this checkout has no source definition
-- for the legacy t2_qator_qosh signature/body and no live catalog connection
-- is available. It is not replaced here. It is outside the canonical Smeta
-- import writer path; both inspected final import writers are replaced below.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Deterministic name classifier.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.t2_resurs_bozsklad_nomi_v1(p_nom text)
returns text
language sql
immutable
parallel safe
as $fn$
with n as (
  select btrim(
           regexp_replace(
             regexp_replace(
               upper(translate(coalesce(p_nom, ''),
                 U&'\FF21\FF22\FF23\FF24\FF25\FF26\FF27\FF28\FF29\FF2A\FF2B\FF2C\FF2D\FF2E\FF2F\FF30\FF31\FF32\FF33\FF34\FF35\FF36\FF37\FF38\FF39\FF3A\FF41\FF42\FF43\FF44\FF45\FF46\FF47\FF48\FF49\FF4A\FF4B\FF4C\FF4D\FF4E\FF4F\FF50\FF51\FF52\FF53\FF54\FF55\FF56\FF57\FF58\FF59\FF5A\FF10\FF11\FF12\FF13\FF14\FF15\FF16\FF17\FF18\FF19\3000\00A0\0401\0451\0301',
                 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789  Ее')),
               '[^0-9A-ZА-Я]+', ' ', 'g'),
             '[[:space:]]+', ' ', 'g')) as nom
)
select case
  when nom = '' then null::text

  -- Storable aggregates are never inferred as БЕЗСКЛАД.
  when nom ~ '(^| )(ПЕСОК|QUM|ЩЕБЕНЬ|SHEBEN|КВАРЦ|KVARS)( |$)'
    then null::text

  -- Clearly storable/precast concrete products are never inferred as a
  -- liquid/placed concrete input merely because their name contains бетон.
  when nom ~ '(^| )(ЖБИ|ЖЕЛЕЗОБЕТОН|ПЕНОБЕТОН|ГАЗОБЕТОН|ARMATURBETON|PENOBETON|GAZOBETON)( |$)'
    then null::text
  -- Uzbek/Russian reinforced-concrete product wording is also storable.
  when nom ~ '(^| )(TEMIR BETON|TEMIRBETON)( |$)'
    then null::text
  when nom ~ '(^| )(БЕТОН|BETON)( |$)'
       and nom ~ '(^| )(БЛОК|БЛОКИ|БЛОКОВ|ПЛИТА|ПЛИТЫ|ПАНЕЛЬ|ПАНЕЛИ|БОРДЮР|БОРДЮРЫ|КОЛЬЦО|КОЛЬЦА|ТРУБА|ТРУБЫ|ЛОТОК|ЛОТКИ|СТУПЕНЬ|СТУПЕНИ|ФБС|FBS|BLOK|BLOKI|BLOCK|BLOCKS|PLITA|PLITY|PANEL|PANELS|BORDYUR|BORDUR|KOLSO|HALQA|TRUBA|SMES|СМЕСЬ|ИЗДЕЛИЕ|ИЗДЕЛИЯ|КАМЕНЬ|КАМНИ|КИРПИЧ|КОНСТРУКЦИЯ|ARALASHMA|QORISHMA)( |$)'
    then null::text

  -- Dry/mixed mortar is a storable product, not the generic wet
  -- mortar input covered by the owner rule.
  when nom ~ '(^| )(РАСТВОР|RASTVOR)( |$)'
       and (
         nom ~ '(^| )(СУХОЙ|СУХАЯ|СУХОЕ|DRY|QURUQ)( |$)'
         or nom ~ '(^| )(СМЕСЬ|SMES|ARALASHMA|QORISHMA)( |$)'
       )
    then null::text

  -- Exact owner vocabulary. Separators were normalized to spaces above, so
  -- these are token matches rather than unsafe substring matches.
  when nom ~ '(^| )(ВОДА|SUV|БЕТОН|BETON|РАСТВОР|RASTVOR)( |$)'
    then 'БЕЗСКЛАД'::text

  else null::text
end
from n
$fn$;

comment on function public.t2_resurs_bozsklad_nomi_v1(text) is
  'Deterministic owner-rule classifier: returns БЕЗСКЛАД only for ВОДА/SUV, БЕТОН/BETON, РАСТВОР/RASTVOR after excluding storable aggregates, precast concrete products, and dry/mixed mortar.';

revoke all on function public.t2_resurs_bozsklad_nomi_v1(text) from public, anon, authenticated;
grant execute on function public.t2_resurs_bozsklad_nomi_v1(text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Expand both category vocabularies without touching unrelated checks.
--    Old vocabulary-only CHECKs are replaced in this forward migration; any
--    other CHECK on the table is retained. Existing invalid data is a clear
--    blocker rather than silently rewritten.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_old_ck text;
  v_old_ck_count integer;
begin
  if to_regclass('public.t2_resurs_kategoriya') is null then
    raise exception 'BLOCKED: public.t2_resurs_kategoriya is missing';
  end if;

  if exists (
    select 1 from public.t2_resurs_kategoriya
    where kategoriya not in ('ЧЕЛ','МАШ','МАТ','ОБ','М/К','КАБ','БЕЗСКЛАД')
  ) then
    raise exception 'BLOCKED: t2_resurs_kategoriya contains a category outside the canonical vocabulary';
  end if;

  execute 'alter table public.t2_resurs_kategoriya drop constraint if exists t2_resurs_kategoriya_kategoriya_ck';

  select count(*) into v_old_ck_count
  from pg_constraint c
  where c.conrelid = 'public.t2_resurs_kategoriya'::regclass
    and c.contype = 'c'
    and c.conname <> 't2_resurs_kategoriya_kategoriya_ck'
    and position('kategoriya' in lower(pg_get_constraintdef(c.oid))) > 0
    and position('БЕЗСКЛАД' in pg_get_constraintdef(c.oid)) = 0
    and (
      position('ЧЕЛ' in pg_get_constraintdef(c.oid)) > 0
      or position('МАШ' in pg_get_constraintdef(c.oid)) > 0
      or position('МАТ' in pg_get_constraintdef(c.oid)) > 0
    );
  if v_old_ck_count > 1 then
    raise exception 'BLOCKED: multiple legacy t2_resurs_kategoriya category checks require manual review';
  end if;

  select c.conname into v_old_ck
  from pg_constraint c
  where c.conrelid = 'public.t2_resurs_kategoriya'::regclass
    and c.contype = 'c'
    and c.conname <> 't2_resurs_kategoriya_kategoriya_ck'
    and position('kategoriya' in lower(pg_get_constraintdef(c.oid))) > 0
    and position('БЕЗСКЛАД' in pg_get_constraintdef(c.oid)) = 0
    and (
      position('ЧЕЛ' in pg_get_constraintdef(c.oid)) > 0
      or position('МАШ' in pg_get_constraintdef(c.oid)) > 0
      or position('МАТ' in pg_get_constraintdef(c.oid)) > 0
    )
  limit 1;
  if v_old_ck is not null then
    execute format(
      'alter table public.t2_resurs_kategoriya drop constraint %I', v_old_ck);
  end if;

  execute 'alter table public.t2_resurs_kategoriya add constraint t2_resurs_kategoriya_kategoriya_ck check (kategoriya in (''ЧЕЛ'',''МАШ'',''МАТ'',''ОБ'',''М/К'',''КАБ'',''БЕЗСКЛАД''))';
end;
$$;

do $$
declare
  v_old_ck text;
  v_old_ck_count integer;
begin
  if to_regclass('public.t2_qator') is null then
    raise exception 'BLOCKED: public.t2_qator is missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 't2_qator' and column_name = 'kat'
  ) then
    raise exception 'BLOCKED: public.t2_qator.kat is missing; category expansion cannot be applied safely';
  end if;

  if exists (
    select 1 from public.t2_qator
    where kat is not null
      and kat not in ('ЧЕЛ','МАШ','МАТ','ОБ','М/К','КАБ','БЕЗСКЛАД')
  ) then
    raise exception 'BLOCKED: t2_qator contains a category outside the canonical vocabulary';
  end if;

  execute 'alter table public.t2_qator drop constraint if exists t2_qator_kat_vocab_ck';

  select count(*) into v_old_ck_count
  from pg_constraint c
  where c.conrelid = 'public.t2_qator'::regclass
    and c.contype = 'c'
    and c.conname <> 't2_qator_kat_vocab_ck'
    and position('kat' in lower(pg_get_constraintdef(c.oid))) > 0
    and position('tur' in lower(pg_get_constraintdef(c.oid))) = 0
    and position('БЕЗСКЛАД' in pg_get_constraintdef(c.oid)) = 0
    and (
      position('ЧЕЛ' in pg_get_constraintdef(c.oid)) > 0
      or position('МАШ' in pg_get_constraintdef(c.oid)) > 0
      or position('МАТ' in pg_get_constraintdef(c.oid)) > 0
    );
  if v_old_ck_count > 1 then
    raise exception 'BLOCKED: multiple legacy t2_qator category checks require manual review';
  end if;

  select c.conname into v_old_ck
  from pg_constraint c
  where c.conrelid = 'public.t2_qator'::regclass
    and c.contype = 'c'
    and c.conname <> 't2_qator_kat_vocab_ck'
    and position('kat' in lower(pg_get_constraintdef(c.oid))) > 0
    and position('tur' in lower(pg_get_constraintdef(c.oid))) = 0
    and position('БЕЗСКЛАД' in pg_get_constraintdef(c.oid)) = 0
    and (
      position('ЧЕЛ' in pg_get_constraintdef(c.oid)) > 0
      or position('МАШ' in pg_get_constraintdef(c.oid)) > 0
      or position('МАТ' in pg_get_constraintdef(c.oid)) > 0
    )
  limit 1;
  if v_old_ck is not null then
    execute format('alter table public.t2_qator drop constraint %I', v_old_ck);
  end if;

  execute 'alter table public.t2_qator add constraint t2_qator_kat_vocab_ck check (kat is null or kat in (''ЧЕЛ'',''МАШ'',''МАТ'',''ОБ'',''М/К'',''КАБ'',''БЕЗСКЛАД''))';
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Registry writer accepts the widened category. Its membership, idempotency,
--    and command-log behavior is copied from the inspected canonical function.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.t2_resurs_kategoriya_belgila_v1(
  p_kompaniya_id bigint, p_actor_id bigint, p_nom text, p_birlik text,
  p_kategoriya text, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_prev jsonb; v_rol text; v_row public.t2_resurs_kategoriya;
  v_nom_key text; v_bir_key text;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  select natija into v_prev from public.t2_onboarding_command_log where operation_id = p_operation_id;
  if found then return v_prev; end if;

  v_rol := public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id, p_actor_id);
  if v_rol not in ('admin','superadmin','boss','director','pto') then
    raise exception 'WRITE_ROLE_REQUIRED' using errcode='42501';
  end if;
  if p_kategoriya not in ('ЧЕЛ','МАШ','МАТ','ОБ','М/К','КАБ','БЕЗСКЛАД') then
    return jsonb_build_object('ok',false,'code','KATEGORIYA_INVALID');
  end if;
  v_nom_key := public.t2_resurs_nom_kalit(p_nom);
  v_bir_key := public.t2_resurs_birlik_kalit(p_birlik);
  if v_nom_key = '' or v_bir_key = '' then
    return jsonb_build_object('ok',false,'code','NOM_BIRLIK_REQUIRED');
  end if;

  insert into public.t2_resurs_kategoriya(kompaniya_id, nom_key, birlik_key, kategoriya, actor_id)
    values (p_kompaniya_id, v_nom_key, v_bir_key, p_kategoriya, p_actor_id)
    on conflict (kompaniya_id, nom_key, birlik_key)
    do update set kategoriya = excluded.kategoriya, actor_id = excluded.actor_id,
      yangilandi = now(), versiya = t2_resurs_kategoriya.versiya + 1
    returning * into v_row;

  perform public.t2_audit_yoz(
    p_kompaniya_id, 'resurs_kategoriya_belgila', 'resurs_kategoriya', v_row.id,
    format('nom_key=%s; birlik_key=%s; kategoriya=%s; versiya=%s',
      v_row.nom_key, v_row.birlik_key, v_row.kategoriya, v_row.versiya),
    'actor:' || p_actor_id, null);

  v_prev := jsonb_build_object('ok',true,'id',v_row.id,'kategoriya',v_row.kategoriya,'versiya',v_row.versiya);
  insert into public.t2_onboarding_command_log (operation_id, actor_id, command, natija)
    values (p_operation_id, p_actor_id, 'resurs_kategoriya_belgila', v_prev);
  return v_prev;
end $$;

revoke all on function public.t2_resurs_kategoriya_belgila_v1(bigint,bigint,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.t2_resurs_kategoriya_belgila_v1(bigint,bigint,text,text,text,uuid) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Import precedence helper. The import writers call this only after their
--    existing tenant/role checks; registry lookup is explicitly tenant-scoped.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.t2_resurs_kategoriya_import_kat_v1(
  p_kompaniya_id bigint, p_nom text, p_birlik text)
returns text language sql stable security definer set search_path=public,pg_temp as $$
with birlik as (
  select public.t2_kat_birlik(p_birlik, p_nom) as kat
)
select case
  -- PRECEDENCE 1: unit-derived labour/equipment identity is authoritative.
  when birlik.kat in ('ЧЕЛ','МАШ') then birlik.kat
  -- PRECEDENCE 2: owner-rule name classification.
  when public.t2_resurs_bozsklad_nomi_v1(p_nom) is not null then 'БЕЗСКЛАД'
  -- PRECEDENCE 3: confirmed tenant registry, then legacy fallback.
  else coalesce(
    (
      select rk.kategoriya
      from public.t2_resurs_kategoriya rk
      where rk.kompaniya_id = p_kompaniya_id
        and rk.nom_key = public.t2_resurs_nom_kalit(p_nom)
        and rk.birlik_key = public.t2_resurs_birlik_kalit(p_birlik)
    ),
    birlik.kat
  )
end
from birlik
$$;

comment on function public.t2_resurs_kategoriya_import_kat_v1(bigint,text,text) is
  'Canonical Smeta import precedence: ЧЕЛ/МАШ from unit first; name-based БЕЗСКЛАД second; confirmed tenant registry third; t2_kat_birlik fallback last.';

revoke all on function public.t2_resurs_kategoriya_import_kat_v1(bigint,text,text) from public, anon, authenticated;
grant execute on function public.t2_resurs_kategoriya_import_kat_v1(bigint,text,text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Latest inspected canonical writers, signature-preserving replacement.
--    Unrelated validation, tenant/auth, idempotency, audit, signal, ordering,
--    parent/depth, norma, source-document and timeout behavior is unchanged.
-- ─────────────────────────────────────────────────────────────────────────────

-- Chunked final writer from 20261021100000_t2_smeta_norma_cascade_v1.sql.
create or replace function public.t2_smeta_import_yakunla_v1(
  p_kompaniya_id bigint, p_actor_id bigint, p_sessiya_id bigint)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_sessiya public.t2_smeta_import_sessiya; v_prev jsonb; v_soni integer;
begin
  perform public.t2_smeta_import_ruxsat(p_kompaniya_id, p_actor_id);

  select * into v_sessiya from public.t2_smeta_import_sessiya
   where id = p_sessiya_id and kompaniya_id = p_kompaniya_id;
  if not found then return jsonb_build_object('ok',false,'code','IMPORT_SESSION_NOT_FOUND'); end if;

  select natija into v_prev from public.t2_onboarding_command_log where operation_id = v_sessiya.operation_id;
  if found then return v_prev; end if;
  if v_sessiya.holat <> 'ochiq' then return jsonb_build_object('ok',false,'code','IMPORT_SESSION_CLOSED'); end if;

  if not exists (select 1 from public.t2_smeta_import_bolak where sessiya_id = p_sessiya_id) then
    return jsonb_build_object('ok',false,'code','IMPORT_EMPTY');
  end if;
  if exists (select 1 from public.t2_qator where obyekt_id = v_sessiya.obyekt_id) then
    return jsonb_build_object('ok',false,'code','SMETA_ALREADY_EXISTS');
  end if;

  perform set_config('t2.manba', 'import', true);

  create temporary table t2_imp_qator(
    local_id text primary key, parent_local_id text, tur text, kod text, nom text,
    birlik text, hajm numeric, narx numeric, summa numeric, kat text, norma numeric,
    ordinal integer, new_id bigint, ota_id bigint, daraja integer
  ) on commit drop;

  insert into t2_imp_qator(local_id, parent_local_id, tur, kod, nom, birlik,
                           hajm, narx, summa, kat, norma, ordinal, new_id)
  select x->>'local_id', nullif(x->>'parent_local_id',''), x->>'tur',
         nullif(x->>'kod',''), nullif(x->>'nom',''), nullif(x->>'birlik',''),
         public.t2_son_tez(x->>'hajm'), public.t2_son_tez(x->>'narx'), public.t2_son_tez(x->>'summa'),
         case when (x->>'tur') in ('rs','mat','ob') then
           public.t2_resurs_kategoriya_import_kat_v1(
             p_kompaniya_id, x->>'nom', x->>'birlik') end,
         -- Faqat 'rs' qatorida ma'noli; 0/manfiy/bo'sh -- haqiqiy norma emas.
         case when (x->>'tur') = 'rs' and public.t2_son_tez(x->>'norma') > 0
              then public.t2_son_tez(x->>'norma') end,
         (row_number() over (order by b.bolak, t.ordinality))::integer,
         nextval(pg_get_serial_sequence('public.t2_qator','id'))
  from public.t2_smeta_import_bolak b
  cross join lateral jsonb_array_elements(b.qatorlar) with ordinality as t(x, ordinality)
  where b.sessiya_id = p_sessiya_id;

  update t2_imp_qator m set ota_id = p.new_id
    from t2_imp_qator p where p.local_id = m.parent_local_id;

  with recursive d as (
    select local_id, 0 as lvl from t2_imp_qator where parent_local_id is null
    union all
    select r.local_id, d.lvl + 1 from t2_imp_qator r join d on r.parent_local_id = d.local_id
  )
  update t2_imp_qator m set daraja = d.lvl from d where d.local_id = m.local_id;

  insert into public.t2_qator(id, obyekt_id, kompaniya_id, tur, kod, nom, birlik,
    hajm, narx, summa, source_document_id, tartib, daraja, kat, ota_id, norma)
  overriding system value
  select new_id, v_sessiya.obyekt_id, p_kompaniya_id, tur, kod, nom, birlik,
    hajm, narx, summa, v_sessiya.source_document_id, ordinal, coalesce(daraja,0), kat, ota_id, norma
  from t2_imp_qator order by ordinal;

  select count(*) into v_soni from t2_imp_qator;

  update public.t2_smeta_import_sessiya
     set holat = 'yakunlandi', qator_soni = v_soni, yangilandi = now()
   where id = p_sessiya_id;
  delete from public.t2_smeta_import_bolak where sessiya_id = p_sessiya_id;

  if v_soni < 5000 then
    begin
      perform public.t2_signal_refresh_object(p_kompaniya_id, v_sessiya.obyekt_id);
    exception when others then
      raise warning 't2_smeta_import_yakunla_v1: signal refresh failed (non-fatal): %', sqlerrm;
    end;
  end if;

  perform public.t2_audit_yoz(p_kompaniya_id,'smeta_import_bolakli','smeta',v_sessiya.obyekt_id,
    format('qator_soni=%s; source_document_id=%s',v_soni,v_sessiya.source_document_id),'actor:'||p_actor_id,null);

  v_prev := jsonb_build_object('ok',true,'obyekt_id',v_sessiya.obyekt_id,'qator_soni',v_soni);
  insert into public.t2_onboarding_command_log (operation_id, actor_id, command, natija)
    values (v_sessiya.operation_id, p_actor_id, 'smeta_import_bolakli', v_prev);
  return v_prev;
end $$;

-- Single-pass final writer from the same latest migration.
create or replace function public.t2_smeta_import_bulk_v1(
  p_kompaniya_id bigint, p_actor_id bigint, p_obyekt_id bigint, p_operation_id uuid,
  p_source_document_id bigint, p_qatorlar jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_prev jsonb; v_rol text; v_soni integer;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  select natija into v_prev from public.t2_onboarding_command_log where operation_id = p_operation_id;
  if found then return v_prev; end if;

  v_rol := public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id, p_actor_id);
  if v_rol not in ('admin','superadmin','boss','director','pto') then
    raise exception 'WRITE_ROLE_REQUIRED' using errcode='42501';
  end if;

  if not exists (select 1 from public.t2_obyekt where id=p_obyekt_id and kompaniya_id=p_kompaniya_id) then
    return jsonb_build_object('ok',false,'code','OBJECT_ACCESS_DENIED');
  end if;
  if exists (select 1 from public.t2_qator where obyekt_id=p_obyekt_id) then
    return jsonb_build_object('ok',false,'code','SMETA_ALREADY_EXISTS');
  end if;
  if p_source_document_id is not null and not exists(
      select 1 from public.t2_document_registry d
      where d.id=p_source_document_id and d.kompaniya_id=p_kompaniya_id
        and (d.obyekt_id is null or d.obyekt_id=p_obyekt_id)) then
    return jsonb_build_object('ok',false,'code','SOURCE_DOCUMENT_SCOPE_MISMATCH');
  end if;
  if p_qatorlar is null or jsonb_typeof(p_qatorlar) <> 'array' or jsonb_array_length(p_qatorlar) = 0
     or jsonb_array_length(p_qatorlar) > 60000 then
    return jsonb_build_object('ok',false,'code','BAD_PAYLOAD');
  end if;

  perform set_config('t2.manba', 'import', true);

  create temporary table t2_imp_qator(
    local_id text primary key, parent_local_id text, tur text, kod text, nom text,
    birlik text, hajm numeric, narx numeric, summa numeric, kat text, norma numeric,
    ordinal integer, new_id bigint, ota_id bigint, daraja integer
  ) on commit drop;

  insert into t2_imp_qator(local_id, parent_local_id, tur, kod, nom, birlik,
                           hajm, narx, summa, kat, norma, ordinal, new_id)
  select x->>'local_id', nullif(x->>'parent_local_id',''), x->>'tur',
         nullif(x->>'kod',''), nullif(x->>'nom',''), nullif(x->>'birlik',''),
         public.t2_son_tez(x->>'hajm'), public.t2_son_tez(x->>'narx'), public.t2_son_tez(x->>'summa'),
         case when (x->>'tur') in ('rs','mat','ob') then
           public.t2_resurs_kategoriya_import_kat_v1(
             p_kompaniya_id, x->>'nom', x->>'birlik') end,
         case when (x->>'tur') = 'rs' and public.t2_son_tez(x->>'norma') > 0
              then public.t2_son_tez(x->>'norma') end,
         (ordinality)::integer,
         nextval(pg_get_serial_sequence('public.t2_qator','id'))
  from jsonb_array_elements(p_qatorlar) with ordinality as t(x, ordinality);

  update t2_imp_qator m set ota_id = p.new_id
    from t2_imp_qator p where p.local_id = m.parent_local_id;

  with recursive d as (
    select local_id, 0 as lvl from t2_imp_qator where parent_local_id is null
    union all
    select r.local_id, d.lvl + 1 from t2_imp_qator r join d on r.parent_local_id = d.local_id
  )
  update t2_imp_qator m set daraja = d.lvl from d where d.local_id = m.local_id;

  insert into public.t2_qator(id, obyekt_id, kompaniya_id, tur, kod, nom, birlik,
    hajm, narx, summa, source_document_id, tartib, daraja, kat, ota_id, norma)
  overriding system value
  select new_id, p_obyekt_id, p_kompaniya_id, tur, kod, nom, birlik,
    hajm, narx, summa, p_source_document_id, ordinal, coalesce(daraja,0), kat, ota_id, norma
  from t2_imp_qator order by ordinal;

  select count(*) into v_soni from t2_imp_qator;

  if v_soni < 5000 then
    begin
      perform public.t2_signal_refresh_object(p_kompaniya_id, p_obyekt_id);
    exception when others then
      raise warning 't2_smeta_import_bulk_v1: signal refresh failed (non-fatal): %', sqlerrm;
    end;
  end if;

  perform public.t2_audit_yoz(p_kompaniya_id,'smeta_import_bulk','smeta',p_obyekt_id,
    format('qator_soni=%s; source_document_id=%s',v_soni,p_source_document_id),'actor:'||p_actor_id,null);

  v_prev := jsonb_build_object('ok',true,'obyekt_id',p_obyekt_id,'qator_soni',v_soni);
  insert into public.t2_onboarding_command_log (operation_id, actor_id, command, natija)
    values (p_operation_id, p_actor_id, 'smeta_import_bulk', v_prev);
  return v_prev;
end $$;

-- CREATE OR REPLACE preserves the existing grants on both inspected writer
-- signatures. Reassert the canonical service-role-only boundary explicitly.
revoke all on function public.t2_smeta_import_bulk_v1(bigint,bigint,bigint,uuid,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.t2_smeta_import_bulk_v1(bigint,bigint,bigint,uuid,bigint,jsonb) to service_role;
revoke all on function public.t2_smeta_import_yakunla_v1(bigint,bigint,bigint) from public, anon, authenticated;
grant execute on function public.t2_smeta_import_yakunla_v1(bigint,bigint,bigint) to service_role;

commit;
