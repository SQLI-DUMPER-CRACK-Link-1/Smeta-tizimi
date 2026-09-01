-- SMETA/F2/NAKOPITELNIY — hotfix for t2_smeta_ozgarish_royxat_v1 (from 20260911120000).
-- The list query put jsonb_agg(... ) in the select list AND an outer
-- `order by o.yaratildi / limit` on the same FROM — Postgres rejects the
-- un-grouped column reference (42803). Bound the list in a subquery, then
-- aggregate. Pure read model; additive; no data change.

begin;

create or replace function public.t2_smeta_ozgarish_royxat_v1(
  p_obyekt_id bigint, p_actor_id bigint, p_limit integer default 200)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_komp bigint; v_rol text; v_rows jsonb;
begin
  select kompaniya_id into v_komp from public.t2_obyekt where id = p_obyekt_id;
  if v_komp is null then return jsonb_build_object('ok',false,'code','OBYEKT_NOT_FOUND'); end if;
  v_rol := public.t2_actor_kompaniya_azo_tekshir(v_komp, p_actor_id);
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

revoke all on function public.t2_smeta_ozgarish_royxat_v1(bigint,bigint,integer) from public, anon, authenticated;

commit;
