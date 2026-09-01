-- SMETA/F2/NAKOPITELNIY 2/3 — governed Smeta change control (a revision layer, not a 2nd smeta)
-- SOURCE ONLY — NOT applied to production by this task. Depends on 20260910120000.
--
-- REUSE: t2_qator (scope truth), t2_qator_tahrir / t2_qator_qosh (proven line
--        commands: optimistic lock + t2_ozgarish log + rollup), t2_ozgarish
--        (field diff log), t2_smeta_revision (revision ledger), t2_document_registry
--        (evidence link). ADDITIVE: a governed change/revision layer.
--
-- A change order is NOT a competing scope. It carries: reason · type · approval
-- state · evidence · effective period/revision · affected canonical qator IDs ·
-- before/after values. Approval PROJECTS the current approved scope onto t2_qator
-- AND writes a new t2_smeta_revision, while the ORIGINAL baseline (revision seq 0)
-- and the per-order pre-change snapshot both stay reconstructable.

begin;

create table if not exists public.t2_smeta_ozgarish (
  id            bigint generated always as identity primary key,
  obyekt_id     bigint not null references public.t2_obyekt(id),
  kompaniya_id  bigint not null,
  loyiha_id     bigint,
  raqam         text,
  tur           text not null check (tur in (
                  'almashtirish','qoshimcha_ish','olib_tashlash','hajm_ozgarish',
                  'yangi_bolim','yangi_ish','resurs_almashtirish','boshqa')),
  sabab         text,
  -- Codex ParkChange.kind mapping, so the pure engine and this table agree
  kind          text check (kind is null or kind in (
                  'quantity_increase','quantity_decrease','additional_work','removed_work',
                  'replacement','new_section','new_item')),
  holat         text not null default 'qoralama'
                  check (holat in ('qoralama','tasdiqlangan','rad','bekor')),
  effective_oy  date,                       -- first F2 period this entitlement is valid
  evidence_hujjat_id bigint,                -- t2_document_registry link (guarded soft-FK)
  evidence_izoh text,
  baseline_snapshot jsonb not null default '[]'::jsonb,  -- frozen pre-change state of affected rows
  natija_revision_id bigint references public.t2_smeta_revision(id),  -- revision this order produced
  delta_summa   numeric not null default 0,
  qator_soni    integer not null default 0,
  versiya       integer not null default 1,
  operation_id  uuid,
  actor_id      bigint,
  kim           text,
  tasdiq_actor_id bigint,
  tasdiqlandi   timestamptz,
  yaratildi     timestamptz not null default now(),
  yangilandi    timestamptz not null default now()
);
create index if not exists t2_smeta_ozgarish_obyekt_ix on public.t2_smeta_ozgarish (obyekt_id, holat);
create unique index if not exists t2_smeta_ozgarish_op_uq on public.t2_smeta_ozgarish (operation_id) where operation_id is not null;

create table if not exists public.t2_smeta_ozgarish_qator (
  id            bigint generated always as identity primary key,
  ozgarish_id   bigint not null references public.t2_smeta_ozgarish(id) on delete cascade,
  qator_id      bigint,   -- null = a brand-new BOQ line introduced by this change
  amal          text not null check (amal in ('qoshish','olib_tashlash','hajm','narx','nom','almashtirish')),
  eski_nom      text, yangi_nom  text,
  eski_hajm     numeric, yangi_hajm numeric,
  eski_narx     numeric, yangi_narx numeric,
  narx_manba    text,     -- D: approved change/contract price source, when applicable
  birlik        text, kat text, tur text, ota_id bigint, kod text,
  delta_summa   numeric not null default 0,
  yangi_qator_id bigint,  -- set on approval when amal='qoshish'
  izoh          text
);
create index if not exists t2_smeta_ozgarish_qator_ix on public.t2_smeta_ozgarish_qator (ozgarish_id);

-- close the FK now that t2_smeta_ozgarish exists
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 't2_smeta_revision_ozgarish_fk') then
    alter table public.t2_smeta_revision
      add constraint t2_smeta_revision_ozgarish_fk foreign key (ozgarish_id)
      references public.t2_smeta_ozgarish(id);
  end if;
end $$;

alter table public.t2_smeta_ozgarish        enable row level security;
alter table public.t2_smeta_ozgarish_qator  enable row level security;

comment on table public.t2_smeta_ozgarish is
  'SMETA/F2 CONTROL: governed change/revision layer over t2_qator. reason/type/approval/evidence/effective-period/affected-IDs/before-after. Approval writes t2_smeta_revision; original baseline stays reconstructable.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Draft — snapshot the current state of every affected line
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.t2_smeta_ozgarish_yarat_v1(
  p_obyekt_id bigint, p_actor_id bigint, p_tur text, p_sabab text,
  p_qatorlar jsonb, p_raqam text, p_operation_id uuid,
  p_effective_oy date default null, p_kind text default null,
  p_evidence_hujjat_id bigint default null, p_evidence_izoh text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_komp bigint; v_loyiha bigint; v_rol text; v_id bigint;
  v_snap jsonb; v_delta numeric := 0; v_n integer := 0;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  select id into v_id from public.t2_smeta_ozgarish where operation_id = p_operation_id;
  if found then return jsonb_build_object('ok',true,'takror',true,'ozgarish_id',v_id); end if;

  select kompaniya_id, loyiha_id into v_komp, v_loyiha from public.t2_obyekt where id = p_obyekt_id;
  if v_komp is null then return jsonb_build_object('ok',false,'code','OBYEKT_NOT_FOUND'); end if;
  v_rol := public.t2_actor_kompaniya_azo_tekshir(v_komp, p_actor_id);   -- raises 42501

  if p_tur not in ('almashtirish','qoshimcha_ish','olib_tashlash','hajm_ozgarish',
                   'yangi_bolim','yangi_ish','resurs_almashtirish','boshqa') then
    return jsonb_build_object('ok',false,'code','CHANGE_TYPE_INVALID');
  end if;
  if p_qatorlar is null or jsonb_array_length(p_qatorlar) = 0 then
    return jsonb_build_object('ok',false,'code','CHANGE_LINES_REQUIRED');
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_qatorlar) x
    where nullif(x->>'qator_id','') is not null
      and not exists (select 1 from public.t2_qator q
                      where q.id = (x->>'qator_id')::bigint and q.obyekt_id = p_obyekt_id)
  ) then
    return jsonb_build_object('ok',false,'code','SCOPE_TENANT_MISMATCH');
  end if;
  -- evidence link (soft, guarded — FILE-TRUTH table may not be applied)
  if p_evidence_hujjat_id is not null and to_regclass('public.t2_document_registry') is not null then
    if not exists (select 1 from public.t2_document_registry d
                   where d.id = p_evidence_hujjat_id and d.kompaniya_id = v_komp) then
      return jsonb_build_object('ok',false,'code','EVIDENCE_NOT_FOUND');
    end if;
  end if;

  -- ensure the object has a sealed original baseline before any change
  perform public.t2_smeta_baseline_kafolat_v1(p_obyekt_id, p_actor_id);

  insert into public.t2_smeta_ozgarish
    (obyekt_id, kompaniya_id, loyiha_id, raqam, tur, kind, sabab, holat,
     effective_oy, evidence_hujjat_id, evidence_izoh, operation_id, actor_id, kim)
  values (p_obyekt_id, v_komp, v_loyiha, p_raqam, p_tur, p_kind, p_sabab, 'qoralama',
          p_effective_oy, p_evidence_hujjat_id, p_evidence_izoh, p_operation_id, p_actor_id, 'actor:'||p_actor_id)
  returning id into v_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'qator_id', q.id, 'nom', q.nom, 'birlik', q.birlik, 'kat', q.kat, 'tur', q.tur, 'ota_id', q.ota_id,
           'hajm', q.hajm, 'narx', q.narx, 'summa', q.summa, 'versiya', q.versiya,
           'qoshimcha', q.qoshimcha, 'zamena', q.zamena)), '[]'::jsonb)
    into v_snap
  from public.t2_qator q
  where q.obyekt_id = p_obyekt_id
    and q.id in (select (x->>'qator_id')::bigint from jsonb_array_elements(p_qatorlar) x
                 where nullif(x->>'qator_id','') is not null);

  insert into public.t2_smeta_ozgarish_qator
    (ozgarish_id, qator_id, amal, eski_nom, yangi_nom, eski_hajm, yangi_hajm,
     eski_narx, yangi_narx, narx_manba, birlik, kat, tur, ota_id, kod, delta_summa, izoh)
  select v_id, nullif(x->>'qator_id','')::bigint, x->>'amal',
         q.nom, nullif(x->>'yangi_nom',''),
         q.hajm, nullif(x->>'yangi_hajm','')::numeric,
         q.narx, nullif(x->>'yangi_narx','')::numeric,
         nullif(x->>'narx_manba',''),
         coalesce(nullif(x->>'birlik',''), q.birlik),
         coalesce(nullif(x->>'kat',''), q.kat),
         coalesce(nullif(x->>'tur',''), 'rs'),
         nullif(x->>'ota_id','')::bigint, nullif(x->>'kod',''),
         coalesce(nullif(x->>'yangi_hajm','')::numeric, q.hajm, 0)
           * coalesce(nullif(x->>'yangi_narx','')::numeric, q.narx, 0)
         - coalesce(q.summa, 0),
         nullif(x->>'izoh','')
  from jsonb_array_elements(p_qatorlar) x
  left join public.t2_qator q on q.id = nullif(x->>'qator_id','')::bigint;

  select count(*), coalesce(sum(delta_summa),0) into v_n, v_delta
  from public.t2_smeta_ozgarish_qator where ozgarish_id = v_id;

  update public.t2_smeta_ozgarish
     set baseline_snapshot = v_snap, delta_summa = v_delta, qator_soni = v_n, yangilandi = now()
   where id = v_id;

  perform public.t2_audit_yoz(v_komp, 'smeta_ozgarish_yarat', 'smeta', p_obyekt_id,
    format('ozgarish_id=%s tur=%s qatorlar=%s delta=%s', v_id, p_tur, v_n, round(v_delta,2)),
    'actor:'||p_actor_id, null);

  return jsonb_build_object('ok',true,'takror',false,'ozgarish_id',v_id,'tur',p_tur,
    'qator_soni',v_n,'delta_summa',v_delta,'holat','qoralama');
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Approve — apply to t2_qator via the proven commands, then write a new revision.
-- Scope-level optimistic lock: each affected row must still be at its snapshot
-- version, else SCOPE_DRIFT.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.t2_smeta_ozgarish_tasdiqlash_v1(
  p_ozgarish_id bigint, p_actor_id bigint, p_kutilgan_versiya integer, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  o public.t2_smeta_ozgarish%rowtype; v_rol text; r record; v_cur_ver integer;
  v_new_id bigint; v_applied integer := 0; v_snap_ver integer; v_qosh jsonb;
  v_seq integer; v_rev_id bigint; v_snap jsonb; v_jami numeric;
  v_xatolar jsonb := '[]'::jsonb; v_ota public.t2_qator%rowtype; v_new_tur text;
begin
  -- idempotent replay
  if p_operation_id is not null then
    select id into v_seq from public.t2_smeta_revision where ozgarish_id = p_ozgarish_id and tur = 'ozgarish';
  end if;

  select * into o from public.t2_smeta_ozgarish where id = p_ozgarish_id for update;
  if not found then return jsonb_build_object('ok',false,'code','CHANGE_NOT_FOUND'); end if;
  if o.holat = 'tasdiqlangan' then
    return jsonb_build_object('ok',true,'takror',true,'ozgarish_id',o.id,'holat','tasdiqlangan','natija_revision_id',o.natija_revision_id);
  end if;
  if o.holat in ('rad','bekor') then
    return jsonb_build_object('ok',false,'code','CHANGE_CLOSED','holat',o.holat);
  end if;
  v_rol := public.t2_actor_kompaniya_azo_tekshir(o.kompaniya_id, p_actor_id);
  if v_rol not in ('boss','superadmin','rahbar') then
    return jsonb_build_object('ok',false,'code','CHANGE_APPROVAL_DENIED','xato','faqat rahbar/boss tasdiqlaydi');
  end if;
  if p_kutilgan_versiya is not null and o.versiya <> p_kutilgan_versiya then
    return jsonb_build_object('ok',false,'code','STALE_VERSION','versiya',o.versiya);
  end if;

  -- ═══ PHASE 1 — PREFLIGHT: validate EVERY line, ZERO mutation ═══════════════
  -- Lock every affected existing row so nothing can drift between preflight and apply.
  perform 1 from public.t2_qator
   where id in (select qator_id from public.t2_smeta_ozgarish_qator where ozgarish_id = p_ozgarish_id and qator_id is not null)
   for update;

  for r in select * from public.t2_smeta_ozgarish_qator where ozgarish_id = p_ozgarish_id loop
    if r.amal = 'qoshish' or r.qator_id is null then
      v_new_tur := coalesce(r.tur, case when o.tur='yangi_bolim' then 'rz' else 'rs' end);
      if v_new_tur not in ('rz','bl','rs','mat','ob') then
        v_xatolar := v_xatolar || jsonb_build_object('ozgarish_qator_id',r.id,'code','NEW_LINE_TUR_INVALID','tur',v_new_tur);
      elsif r.kat is not null and r.kat not in ('ЧЕЛ','МАШ','МАТ','ОБ','М/К','КАБ') then
        v_xatolar := v_xatolar || jsonb_build_object('ozgarish_qator_id',r.id,'code','NEW_LINE_KAT_INVALID','kat',r.kat);
      elsif coalesce(btrim(r.yangi_nom, ''),'') = '' and coalesce(btrim(r.eski_nom,''),'') = '' then
        v_xatolar := v_xatolar || jsonb_build_object('ozgarish_qator_id',r.id,'code','NEW_LINE_NOM_REQUIRED');
      elsif v_new_tur = 'rz' then
        if r.ota_id is not null then
          v_xatolar := v_xatolar || jsonb_build_object('ozgarish_qator_id',r.id,'code','NEW_SECTION_NO_PARENT');
        end if;
      else
        if r.ota_id is null then
          v_xatolar := v_xatolar || jsonb_build_object('ozgarish_qator_id',r.id,'code','NEW_LINE_PARENT_REQUIRED');
        else
          select * into v_ota from public.t2_qator where id = r.ota_id and obyekt_id = o.obyekt_id;
          if not found then
            v_xatolar := v_xatolar || jsonb_build_object('ozgarish_qator_id',r.id,'code','NEW_LINE_PARENT_NOT_FOUND','ota_id',r.ota_id);
          elsif v_new_tur = 'bl' and v_ota.tur <> 'rz' then
            v_xatolar := v_xatolar || jsonb_build_object('ozgarish_qator_id',r.id,'code','NEW_LINE_HIERARCHY','xato','bl faqat rz ostiga');
          elsif v_new_tur in ('rs','mat','ob') and v_ota.tur not in ('rz','bl') then
            v_xatolar := v_xatolar || jsonb_build_object('ozgarish_qator_id',r.id,'code','NEW_LINE_HIERARCHY','xato','resurs faqat rz/bl ostiga');
          end if;
        end if;
      end if;
    else
      select * into v_ota from public.t2_qator where id = r.qator_id and obyekt_id = o.obyekt_id;
      if not found then
        v_xatolar := v_xatolar || jsonb_build_object('ozgarish_qator_id',r.id,'code','QATOR_NOT_IN_OBJECT','qator_id',r.qator_id);
      else
        select (s->>'versiya')::integer into v_snap_ver
        from jsonb_array_elements(o.baseline_snapshot) s where (s->>'qator_id')::bigint = r.qator_id;
        if v_snap_ver is not null and v_ota.versiya is distinct from v_snap_ver then
          v_xatolar := v_xatolar || jsonb_build_object('ozgarish_qator_id',r.id,'code','SCOPE_DRIFT','qator_id',r.qator_id,
            'snapshot_versiya',v_snap_ver,'joriy_versiya',v_ota.versiya);
        end if;
        if r.amal in ('hajm','olib_tashlash') and r.yangi_hajm is null and r.amal <> 'olib_tashlash' then
          v_xatolar := v_xatolar || jsonb_build_object('ozgarish_qator_id',r.id,'code','YANGI_HAJM_REQUIRED');
        end if;
        if r.amal = 'narx' and r.yangi_narx is null then
          v_xatolar := v_xatolar || jsonb_build_object('ozgarish_qator_id',r.id,'code','YANGI_NARX_REQUIRED');
        end if;
        if r.amal = 'nom' and coalesce(btrim(r.yangi_nom,''),'') = '' then
          v_xatolar := v_xatolar || jsonb_build_object('ozgarish_qator_id',r.id,'code','YANGI_NOM_REQUIRED');
        end if;
      end if;
    end if;
  end loop;

  if jsonb_array_length(v_xatolar) > 0 then
    -- ZERO business mutation performed
    return jsonb_build_object('ok',false,'code','CHANGE_PREFLIGHT_FAILED','ozgarish_id',o.id,'xatolar',v_xatolar);
  end if;

  -- ═══ PHASE 2 — APPLY: preflight passed, mutations cannot fail on validation ═
  for r in select * from public.t2_smeta_ozgarish_qator where ozgarish_id = p_ozgarish_id loop
    if r.amal = 'qoshish' or r.qator_id is null then
      v_qosh := public.t2_qator_qosh(o.obyekt_id, coalesce(r.tur, case when o.tur='yangi_bolim' then 'rz' else 'rs' end),
                  coalesce(r.yangi_nom, r.eski_nom, 'Yangi ish'),
                  r.ota_id, r.kod, r.birlik, r.yangi_hajm, r.yangi_narx,
                  true, r.kat, null, gen_random_uuid(), 'baza', 'actor:'||p_actor_id);
      if (v_qosh->>'ok') <> 'true' then
        -- pathological (post-preflight race): force rollback, never partial-commit
        raise exception 'CHANGE_APPLY_RACE: %', coalesce(v_qosh->>'xabar', v_qosh->>'sabab');
      end if;
      v_new_id := (v_qosh->>'qator_id')::bigint;
      update public.t2_qator set qoshimcha = true where id = v_new_id;
      update public.t2_smeta_ozgarish_qator set yangi_qator_id = v_new_id where id = r.id;
      v_applied := v_applied + 1;
    else
      select versiya into v_cur_ver from public.t2_qator where id = r.qator_id;
      if r.amal in ('hajm','almashtirish','olib_tashlash') and (r.yangi_hajm is not null or r.amal='olib_tashlash') then
        perform public.t2_qator_tahrir(r.qator_id, 'hajm',
          (case when r.amal='olib_tashlash' then 0 else r.yangi_hajm end)::text,
          v_cur_ver, 'baza', 'actor:'||p_actor_id);
        select versiya into v_cur_ver from public.t2_qator where id = r.qator_id;
      end if;
      if r.amal in ('narx','almashtirish','resurs_almashtirish') and r.yangi_narx is not null then
        perform public.t2_qator_tahrir(r.qator_id, 'narx', r.yangi_narx::text, v_cur_ver, 'baza', 'actor:'||p_actor_id);
        select versiya into v_cur_ver from public.t2_qator where id = r.qator_id;
      end if;
      if r.amal in ('nom','almashtirish') and r.yangi_nom is not null then
        perform public.t2_qator_tahrir(r.qator_id, 'nom', r.yangi_nom, v_cur_ver, 'baza', 'actor:'||p_actor_id);
      end if;
      if o.tur in ('almashtirish','resurs_almashtirish') then
        update public.t2_qator set zamena = true where id = r.qator_id;
      end if;
      v_applied := v_applied + 1;
    end if;
  end loop;

  -- write the new revision (seq+1) = the CURRENT APPROVED ENTITLEMENT snapshot
  select coalesce(max(seq),0) + 1 into v_seq from public.t2_smeta_revision where obyekt_id = o.obyekt_id;
  select coalesce(jsonb_agg(jsonb_build_object(
           'qator_id', q.id, 'nom', q.nom, 'birlik', q.birlik, 'kat', q.kat, 'tur', q.tur, 'ota_id', q.ota_id,
           'hajm', q.hajm, 'narx', q.narx, 'summa', q.summa)), '[]'::jsonb),
         coalesce(sum(q.summa) filter (where q.tur in ('rs','mat','ob')), 0)
    into v_snap, v_jami
  from public.t2_qator q where q.obyekt_id = o.obyekt_id;
  insert into public.t2_smeta_revision (obyekt_id, kompaniya_id, seq, tur, ozgarish_id, snapshot, jami_summa, actor_id, izoh)
  values (o.obyekt_id, o.kompaniya_id, v_seq, 'ozgarish', o.id, v_snap, v_jami, p_actor_id,
          format('Change order #%s (%s)', o.id, o.tur))
  returning id into v_rev_id;

  update public.t2_smeta_ozgarish
     set holat = 'tasdiqlangan', tasdiq_actor_id = p_actor_id, tasdiqlandi = now(),
         natija_revision_id = v_rev_id, versiya = versiya + 1, yangilandi = now()
   where id = p_ozgarish_id;

  perform public.t2_audit_yoz(o.kompaniya_id, 'smeta_ozgarish_tasdiqlash', 'smeta', o.obyekt_id,
    format('ozgarish_id=%s applied=%s revision=%s delta=%s', o.id, v_applied, v_rev_id, round(o.delta_summa,2)),
    'actor:'||p_actor_id, null);

  return jsonb_build_object('ok',true,'takror',false,'ozgarish_id',o.id,'holat','tasdiqlangan',
    'qollandi',v_applied,'natija_revision_id',v_rev_id,'revision_seq',v_seq,'delta_summa',o.delta_summa);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Reject (draft) / REVERSE (approved) — a GOVERNED compensating forward event.
-- Reversing an approved change: restore each affected line to its frozen
-- pre-change value (forward t2_qator_tahrir events -> logged in t2_ozgarish),
-- soft-remove any qator this order added (hajm=0, never a delete), then write a
-- COMPENSATING revision (seq+1). History is never destroyed: the original
-- baseline (seq 0) and every revision — including the reversed one and its
-- compensator — stay reconstructable.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.t2_smeta_ozgarish_qaytar_v1(
  p_ozgarish_id bigint, p_actor_id bigint, p_sabab text, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  o public.t2_smeta_ozgarish%rowtype; v_rol text; s jsonb; v_ver integer; v_n integer := 0;
  v_seq integer; v_rev_id bigint; v_snap jsonb; v_jami numeric; v_added bigint;
begin
  select * into o from public.t2_smeta_ozgarish where id = p_ozgarish_id for update;
  if not found then return jsonb_build_object('ok',false,'code','CHANGE_NOT_FOUND'); end if;
  v_rol := public.t2_actor_kompaniya_azo_tekshir(o.kompaniya_id, p_actor_id);
  if v_rol not in ('boss','superadmin','rahbar') then
    return jsonb_build_object('ok',false,'code','CHANGE_APPROVAL_DENIED');
  end if;
  if o.holat in ('rad','bekor') then
    return jsonb_build_object('ok',true,'takror',true,'ozgarish_id',o.id,'holat',o.holat);
  end if;

  if o.holat = 'tasdiqlangan' then
    -- restore affected existing lines to the frozen pre-change state
    for s in select * from jsonb_array_elements(o.baseline_snapshot) loop
      select versiya into v_ver from public.t2_qator where id = (s->>'qator_id')::bigint;
      if v_ver is not null then
        perform public.t2_qator_tahrir((s->>'qator_id')::bigint, 'hajm', (s->>'hajm'), v_ver, 'baza', 'actor:'||p_actor_id);
        select versiya into v_ver from public.t2_qator where id = (s->>'qator_id')::bigint;
        perform public.t2_qator_tahrir((s->>'qator_id')::bigint, 'narx', (s->>'narx'), v_ver, 'baza', 'actor:'||p_actor_id);
        select versiya into v_ver from public.t2_qator where id = (s->>'qator_id')::bigint;
        perform public.t2_qator_tahrir((s->>'qator_id')::bigint, 'nom', (s->>'nom'), v_ver, 'baza', 'actor:'||p_actor_id);
        v_n := v_n + 1;
      end if;
    end loop;
    -- soft-remove any line this order ADDED (hajm=0, keeps the row + its history)
    for v_added in select yangi_qator_id from public.t2_smeta_ozgarish_qator
                   where ozgarish_id = p_ozgarish_id and yangi_qator_id is not null loop
      select versiya into v_ver from public.t2_qator where id = v_added;
      if v_ver is not null then
        perform public.t2_qator_tahrir(v_added, 'hajm', '0', v_ver, 'baza', 'actor:'||p_actor_id);
        v_n := v_n + 1;
      end if;
    end loop;
    -- compensating revision — the CURRENT (post-reversal) approved entitlement
    select coalesce(max(seq),0) + 1 into v_seq from public.t2_smeta_revision where obyekt_id = o.obyekt_id;
    select coalesce(jsonb_agg(jsonb_build_object('qator_id', q.id, 'nom', q.nom, 'hajm', q.hajm, 'narx', q.narx, 'summa', q.summa)), '[]'::jsonb),
           coalesce(sum(q.summa) filter (where q.tur in ('rs','mat','ob')), 0)
      into v_snap, v_jami from public.t2_qator q where q.obyekt_id = o.obyekt_id;
    insert into public.t2_smeta_revision (obyekt_id, kompaniya_id, seq, tur, ozgarish_id, snapshot, jami_summa, actor_id, izoh)
    values (o.obyekt_id, o.kompaniya_id, v_seq, 'ozgarish', o.id, v_snap, v_jami, p_actor_id,
            format('Change order #%s REVERSED (compensating)', o.id))
    returning id into v_rev_id;
  end if;

  update public.t2_smeta_ozgarish
     set holat = case when o.holat = 'qoralama' then 'rad' else 'bekor' end,
         sabab = trim(both ' |' from coalesce(sabab,'') || ' | qaytarildi: ' || coalesce(p_sabab,'')),
         versiya = versiya + 1, yangilandi = now()
   where id = p_ozgarish_id;

  perform public.t2_audit_yoz(o.kompaniya_id,
    case when o.holat='qoralama' then 'smeta_ozgarish_rad' else 'smeta_ozgarish_reverse' end,
    'smeta', o.obyekt_id,
    format('ozgarish_id=%s restored_lines=%s compensating_revision=%s', o.id, v_n, coalesce(v_rev_id::text,'-')),
    'actor:'||p_actor_id, null);

  return jsonb_build_object('ok',true,'ozgarish_id',o.id,
    'holat',(select holat from public.t2_smeta_ozgarish where id = p_ozgarish_id),
    'tiklandi',v_n,'kompensatsiya_revision_id',v_rev_id);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Read models
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.t2_smeta_ozgarish_royxat_v1(
  p_obyekt_id bigint, p_actor_id bigint, p_limit integer default 200)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_komp bigint; v_rol text; v_rows jsonb;
begin
  select kompaniya_id into v_komp from public.t2_obyekt where id = p_obyekt_id;
  if v_komp is null then return jsonb_build_object('ok',false,'code','OBYEKT_NOT_FOUND'); end if;
  v_rol := public.t2_actor_kompaniya_azo_tekshir(v_komp, p_actor_id);
  -- bound the list first (subquery), THEN aggregate — an aggregate in the
  -- select list cannot share a FROM with an outer ORDER BY / LIMIT on o.*.
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', o.id, 'raqam', o.raqam, 'tur', o.tur, 'kind', o.kind, 'sabab', o.sabab, 'holat', o.holat,
           'effective_oy', o.effective_oy, 'evidence_hujjat_id', o.evidence_hujjat_id, 'evidence_izoh', o.evidence_izoh,
           'delta_summa', o.delta_summa, 'qator_soni', o.qator_soni, 'versiya', o.versiya,
           'natija_revision_id', o.natija_revision_id,
           'yaratildi', o.yaratildi, 'tasdiqlandi', o.tasdiqlandi,
           'baseline_recoverable', jsonb_array_length(o.baseline_snapshot) > 0,
           'qatorlar', (select coalesce(jsonb_agg(jsonb_build_object(
                          'qator_id', z.qator_id, 'yangi_qator_id', z.yangi_qator_id, 'amal', z.amal,
                          'eski_nom', z.eski_nom, 'yangi_nom', z.yangi_nom,
                          'eski_hajm', z.eski_hajm, 'yangi_hajm', z.yangi_hajm,
                          'eski_narx', z.eski_narx, 'yangi_narx', z.yangi_narx, 'narx_manba', z.narx_manba,
                          'delta_summa', z.delta_summa)), '[]'::jsonb)
                        from public.t2_smeta_ozgarish_qator z where z.ozgarish_id = o.id)
         ) order by o.yaratildi desc), '[]'::jsonb)
    into v_rows
  from (
    select * from public.t2_smeta_ozgarish
    where obyekt_id = p_obyekt_id
    order by yaratildi desc
    limit least(greatest(coalesce(p_limit,200),1),500)
  ) o;
  return jsonb_build_object('ok',true,'obyekt_id',p_obyekt_id,'ozgarishlar',v_rows,
    'jami', jsonb_build_object(
      'ochiq', (select count(*) from public.t2_smeta_ozgarish where obyekt_id=p_obyekt_id and holat='qoralama'),
      'tasdiqlangan', (select count(*) from public.t2_smeta_ozgarish where obyekt_id=p_obyekt_id and holat='tasdiqlangan'),
      'delta_tasdiqlangan', (select coalesce(sum(delta_summa),0) from public.t2_smeta_ozgarish where obyekt_id=p_obyekt_id and holat='tasdiqlangan'),
      'delta_ochiq', (select coalesce(sum(delta_summa),0) from public.t2_smeta_ozgarish where obyekt_id=p_obyekt_id and holat='qoralama')));
end $$;

-- Reconstruct the ORIGINAL baseline (revision seq 0) for an object
create or replace function public.t2_smeta_baseline_asl_v1(p_obyekt_id bigint, p_actor_id bigint)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_komp bigint; v_rol text; v_r public.t2_smeta_revision%rowtype;
begin
  select kompaniya_id into v_komp from public.t2_obyekt where id = p_obyekt_id;
  if v_komp is null then return jsonb_build_object('ok',false,'code','OBYEKT_NOT_FOUND'); end if;
  v_rol := public.t2_actor_kompaniya_azo_tekshir(v_komp, p_actor_id);
  select * into v_r from public.t2_smeta_revision where obyekt_id = p_obyekt_id and seq = 0;
  if not found then return jsonb_build_object('ok',true,'muhrlanmagan',true,
    'izoh','Original baseline hali muhrlanmagan (birinchi F2 yoki o''zgarishda avtomatik muhrlanadi)'); end if;
  return jsonb_build_object('ok',true,'revision_id',v_r.id,'seq',0,'jami_summa',v_r.jami_summa,
    'yaratildi',v_r.yaratildi,'snapshot',v_r.snapshot,
    'revisiyalar', (select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'seq',x.seq,'tur',x.tur,
                      'ozgarish_id',x.ozgarish_id,'jami_summa',x.jami_summa,'yaratildi',x.yaratildi,'izoh',x.izoh)
                      order by x.seq), '[]'::jsonb)
                    from public.t2_smeta_revision x where x.obyekt_id = p_obyekt_id));
end $$;

revoke all on function public.t2_smeta_ozgarish_yarat_v1(bigint,bigint,text,text,jsonb,text,uuid,date,text,bigint,text) from public, anon, authenticated;
revoke all on function public.t2_smeta_ozgarish_tasdiqlash_v1(bigint,bigint,integer,uuid) from public, anon, authenticated;
revoke all on function public.t2_smeta_ozgarish_qaytar_v1(bigint,bigint,text,uuid) from public, anon, authenticated;
revoke all on function public.t2_smeta_ozgarish_royxat_v1(bigint,bigint,integer) from public, anon, authenticated;
revoke all on function public.t2_smeta_baseline_asl_v1(bigint,bigint) from public, anon, authenticated;

commit;
