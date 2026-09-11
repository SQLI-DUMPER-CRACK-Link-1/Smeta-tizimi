-- T2-RESURS-KATEGORIYA-BEZSKLAD-FINAL-001
-- Final migration-order pin. 20261023090000 fixes the bolakli rollup
-- variable but redefines the writer; this version preserves that fix and
-- restores canonical name-based category precedence.

begin;

create or replace function public.t2_smeta_import_yakunla_v1(
  p_kompaniya_id bigint, p_actor_id bigint, p_sessiya_id bigint)
returns jsonb language plpgsql security definer set search_path=public, pg_temp as $$
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
      perform public.t2_rollup(v_sessiya.obyekt_id);
      perform public.t2_signal_refresh_object(p_kompaniya_id, v_sessiya.obyekt_id);
    exception when others then
      raise warning 't2_smeta_import_yakunla_v1: rollup/signal refresh failed (non-fatal): %', sqlerrm;
    end;
  end if;

  perform public.t2_audit_yoz(p_kompaniya_id,'smeta_import_bolakli','smeta',v_sessiya.obyekt_id,
    format('qator_soni=%s; source_document_id=%s',v_soni,v_sessiya.source_document_id),'actor:'||p_actor_id,null);

  v_prev := jsonb_build_object('ok',true,'obyekt_id',v_sessiya.obyekt_id,'qator_soni',v_soni);
  insert into public.t2_onboarding_command_log (operation_id, actor_id, command, natija)
    values (v_sessiya.operation_id, p_actor_id, 'smeta_import_bolakli', v_prev);
  return v_prev;
end $$;

revoke all on function public.t2_smeta_import_yakunla_v1(bigint,bigint,bigint) from public, anon, authenticated;
grant execute on function public.t2_smeta_import_yakunla_v1(bigint,bigint,bigint) to service_role;

do $$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 't2_smeta_import_yakunla_v1';
  if v_def is null or v_def not ilike '%t2_resurs_kategoriya_import_kat_v1%' then
    raise exception 'FINAL CLASSIFIER WIRING MISSING: t2_smeta_import_yakunla_v1';
  end if;
  if v_def not ilike '%t2_rollup(v_sessiya.obyekt_id)%' then
    raise exception 'FINAL ROLLUP WIRING MISSING: t2_smeta_import_yakunla_v1';
  end if;
end $$;

commit;
