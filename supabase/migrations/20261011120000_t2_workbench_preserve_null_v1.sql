-- T2-PTO-DAILY-WORKFLOW-RELIABILITY: preserve canonical NULL baseline facts.
--
-- The original t2_workbench_v1 used coalesce(q.hajm,0) and coalesce(q.narx,0)
-- for baseline fields.  That changed "unknown" into a false numeric zero in
-- the read model.  This forward correction leaves the historical migration
-- immutable and replaces only the function body: JSONB now carries null for
-- missing baseline quantity/price, while certified/F2 fields keep their
-- existing independent semantics.
--
-- PRODUCTION_WRITE_ALLOWED = FALSE for this source checkpoint.

begin;

-- Keep an exact pre-migration definition so the rollback can restore the
-- already deployed function without guessing which historical migration was
-- last applied.  The table is private to this migration and is removed by
-- the rollback after restoration.
create table if not exists public.t2_workbench_v1_definition_backup_v1(
  backup_id boolean primary key default true,
  function_sql text not null,
  backed_up_at timestamptz not null default now()
);
insert into public.t2_workbench_v1_definition_backup_v1(backup_id, function_sql)
select true, pg_get_functiondef('public.t2_workbench_v1(bigint,bigint,date,integer)'::regprocedure)
where not exists (select 1 from public.t2_workbench_v1_definition_backup_v1);

create or replace function public.t2_workbench_v1(
  p_obyekt_id bigint, p_actor_id bigint, p_davr date default null,
  p_limit integer default 800)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  v_komp bigint; v_loyiha bigint; v_rol text; v_nom text; v_loyiha_nom text;
  v_lim integer := least(greatest(coalesce(p_limit,800),1),3000);
  v_davrlar date[]; v_through integer; v_cur_rev bigint;
  v_lines jsonb; v_changes jsonb; v_periods jsonb; v_revisions jsonb;
  v_yakun jsonb;
begin
  select o.kompaniya_id, o.loyiha_id, o.nom, l.nom
    into v_komp, v_loyiha, v_nom, v_loyiha_nom
  from public.t2_obyekt o left join public.t2_loyiha l on l.id = o.loyiha_id
  where o.id = p_obyekt_id;
  if v_komp is null then return jsonb_build_object('ok',false,'code','OBYEKT_NOT_FOUND'); end if;
  v_rol := public.t2_actor_kompaniya_azo_tekshir(v_komp, p_actor_id);

  select array_agg(oy order by oy) into v_davrlar
  from (select distinct date_trunc('month', a.oy)::date oy
        from public.t2_akt a where a.obyekt_id = p_obyekt_id and a.tur = 'f2' and a.holat = 'tasdiqlangan') s;
  v_davrlar := coalesce(v_davrlar, array[]::date[]);
  if array_length(v_davrlar,1) is null then
    v_through := 0;
  else
    v_through := coalesce(
      array_position(v_davrlar, date_trunc('month', coalesce(p_davr, v_davrlar[array_length(v_davrlar,1)]))::date) - 1,
      array_length(v_davrlar,1) - 1);
  end if;
  select id into v_cur_rev from public.t2_smeta_revision where obyekt_id = p_obyekt_id order by seq desc limit 1;

  -- Baseline facts intentionally remain nullable.  A missing price is not a
  -- zero price and a missing quantity is not a zero entitlement.
  select coalesce(jsonb_agg(x order by (x->>'_tartib')::numeric), '[]'::jsonb) into v_lines from (
    select jsonb_build_object('lineId', q.id::text, 'sectionId', coalesce(q.ota_id::text,'root'),
      'description', q.nom, 'unit', coalesce(q.birlik,''),
      'baselineQuantity', q.hajm, 'baselineReferencePrice', q.narx,
      '_tartib', q.tartib) x
    from public.t2_qator q
    where q.obyekt_id = p_obyekt_id and q.tur in ('rs','mat','ob')
    order by q.tartib, q.id limit v_lim) s;

  select coalesce(jsonb_agg(jsonb_build_object(
      'changeId', o.id::text, 'kind',
        case o.tur when 'almashtirish' then 'substitution' when 'qoshimcha_ish' then 'additional_work'
             when 'olib_tashlash' then 'removal' when 'hajm_ozgarish' then 'quantity_increase'
             when 'yangi_bolim' then 'new_section' when 'yangi_ish' then 'new_item'
             when 'resurs_almashtirish' then 'resource_replacement' else 'additional_work' end,
      'status', case o.holat when 'tasdiqlangan' then 'approved' when 'qoralama' then 'pending' else 'rejected' end,
      'lineId', coalesce((select z.qator_id::text from public.t2_smeta_ozgarish_qator z
                          where z.ozgarish_id = o.id and z.qator_id is not null limit 1),
                         (select z.yangi_qator_id::text from public.t2_smeta_ozgarish_qator z
                          where z.ozgarish_id = o.id and z.yangi_qator_id is not null limit 1), 'na'),
      'revisionId', 'rev-'||coalesce(o.natija_revision_id::text,'pending'),
      'effectivePeriodIndex', coalesce(array_position(v_davrlar, date_trunc('month', o.effective_oy)::date) - 1, 0),
      'quantityDelta', coalesce((select sum(coalesce(z.yangi_hajm,0) - coalesce(z.eski_hajm,0))
                                 from public.t2_smeta_ozgarish_qator z where z.ozgarish_id = o.id), 0),
      'reason', coalesce(o.sabab,''),
      'evidenceIds', case when o.evidence_hujjat_id is not null then jsonb_build_array('hujjat-'||o.evidence_hujjat_id) else '[]'::jsonb end,
      'actorId', o.actor_id::text
    ) order by o.yaratildi), '[]'::jsonb) into v_changes
  from public.t2_smeta_ozgarish o where o.obyekt_id = p_obyekt_id;

  select coalesce(jsonb_agg(p order by (p->>'_oy')), '[]'::jsonb) into v_periods from (
    select jsonb_build_object(
      'periodId', to_char(a.oy,'YYYY-MM'), 'label', to_char(a.oy,'YYYY-MM'),
      'revisionId', 'rev-'||coalesce(max(a.revision_id)::text,'0'), 'frozen', true,
      'documentIds', jsonb_agg(distinct 'akt-'||a.id),
      'lines', jsonb_agg(jsonb_build_object(
        'lineId', aq.qator_id::text, 'quantity', aq.hajm,
        'f2ValuationPrice', aq.narx, 'actualProcurementPrice', aq.actual_narx,
        'referencePriceSourceId', 'baseline-'||coalesce(aq.revision_id::text,'0'),
        'actualPriceSourceId', case when aq.actual_narx is not null
          then coalesce(aq.narx_manba,'qol')||'-'||coalesce(aq.narx_manba_id::text,'?') else null end)),
      '_oy', a.oy) p
    from public.t2_akt a join public.t2_akt_qator aq on aq.akt_id = a.id
    where a.obyekt_id = p_obyekt_id and a.tur = 'f2' and a.holat = 'tasdiqlangan'
    group by a.oy) s;

  select coalesce(jsonb_agg(jsonb_build_object(
      'revisionId', 'rev-'||r.id, 'kind', case when r.seq = 0 then 'baseline' else 'change' end,
      'status', case when r.seq = 0 then 'certified' else 'approved' end,
      'actorId', r.actor_id::text, 'occurredAt', r.yaratildi, 'reason', coalesce(r.izoh,''),
      'evidenceIds', '[]'::jsonb, 'immutable', true) order by r.seq), '[]'::jsonb) into v_revisions
  from public.t2_smeta_revision r where r.obyekt_id = p_obyekt_id;

  v_yakun := public.t2_obyekt_yakunlash_v1(p_obyekt_id, p_actor_id);

  return jsonb_build_object(
    'ok', true, 'generated_at', now(),
    'projectId', v_loyiha::text, 'objectId', p_obyekt_id::text,
    'projectName', coalesce(v_loyiha_nom,''), 'objectName', v_nom,
    'currentPeriodId', case when array_length(v_davrlar,1) is not null
      then to_char(v_davrlar[v_through + 1],'YYYY-MM') else null end,
    'valuation', jsonb_build_object(
      'projectId', v_loyiha::text, 'objectId', p_obyekt_id::text,
      'estimateRevisionId', 'rev-'||coalesce(v_cur_rev::text,'0'),
      'currency', 'UZS', 'throughPeriod', v_through,
      'lines', (select coalesce(jsonb_agg(l - '_tartib'), '[]'::jsonb) from jsonb_array_elements(v_lines) l),
      'changes', v_changes,
      'periods', (select coalesce(jsonb_agg(pp - '_oy'), '[]'::jsonb) from jsonb_array_elements(v_periods) pp)),
    'requirements', v_yakun->'requirements',
    'documents', v_yakun->'documents',
    'revisions', v_revisions,
    'lines_truncated', jsonb_array_length(v_lines) >= v_lim,
    'forma3_unresolved', v_yakun->'forma3_unresolved');
end $$;

revoke all on function public.t2_workbench_v1(bigint,bigint,date,integer) from public, anon, authenticated;

comment on function public.t2_workbench_v1(bigint,bigint,date,integer) is
  'SMETA/F2 CONTROL: bounded aggregate; baseline NULLs stay NULL (unknown is not zero); membership-checked; no Drive/Sheets/GAS.';

commit;
