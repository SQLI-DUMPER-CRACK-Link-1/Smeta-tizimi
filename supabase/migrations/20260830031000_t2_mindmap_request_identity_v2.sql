-- Adds typed node identity without changing the existing overview function.
-- Request nodes are opt-in only for Ta'minot/object drilldown; the boss
-- overview remains an aggregate graph.
create or replace function public.t2_mindmap_grafi_v2(
  p_kompaniya_id bigint,
  p_mode text default 'overview',
  p_obyekt_id bigint default null
) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $function$
declare v_base jsonb; v_nodes jsonb; v_edges jsonb; v_requests jsonb := '[]'::jsonb; v_request_edges jsonb := '[]'::jsonb;
begin
  if p_mode not in ('overview','taminot','obyekt') then
    raise exception 'mindmap mode noto''g''ri' using errcode='22023';
  end if;
  v_base:=t2_mindmap_grafi(p_kompaniya_id);
  select coalesce(jsonb_agg(n || jsonb_build_object(
    'node_key',n->>'id','entity_type',n->>'tur',
    'entity_id',case when (n->>'id') ~ '^[a-z_]+:[0-9]+$' then split_part(n->>'id',':',2)::bigint else null end
  )),'[]'::jsonb) into v_nodes
  from jsonb_array_elements(coalesce(v_base->'tugunlar','[]'::jsonb)) n;
  v_edges:=coalesce(v_base->'bogichlar','[]'::jsonb);
  if p_mode in ('taminot','obyekt') and p_obyekt_id is not null then
    if not exists(select 1 from t2_obyekt where id=p_obyekt_id and kompaniya_id=p_kompaniya_id and holat<>'bekor') then
      raise exception 'obyekt boshqa tenantga tegishli yoki faol emas' using errcode='42501';
    end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'id','zayavka:'||r.id,'node_key','zayavka:'||r.id,'tur','zayavka','entity_type','zayavka','entity_id',r.id,
      'nom',coalesce(nullif(r.item_text,''),'Zayavka #'||r.id),
      'meta',jsonb_build_object('status',r.status,'item',r.item_text,'requested_qty',r.requested_qty,
        'delivered_qty',r.delivered_qty,'remaining_qty',r.requested_qty-r.delivered_qty,
        'required_date',r.required_date,'priority',r.priority,'version',r.version),
      'x',null,'y',null
    ) order by r.id),'[]'::jsonb) into v_requests
    from t2_erp_taminot r where r.kompaniya_id=p_kompaniya_id and r.obyekt_id=p_obyekt_id and r.status not in ('closed','cancelled');
    select coalesce(jsonb_agg(jsonb_build_object('manba','obyekt:'||r.obyekt_id,'maqsad','zayavka:'||r.id,'tur','obyekt_zayavka','uzsa_boladi',false)),'[]'::jsonb) into v_request_edges
    from t2_erp_taminot r where r.kompaniya_id=p_kompaniya_id and r.obyekt_id=p_obyekt_id and r.status not in ('closed','cancelled');
  end if;
  return jsonb_build_object('tugunlar',v_nodes || v_requests,'bogichlar',v_edges || v_request_edges,'jamlanma',v_base->'jamlanma');
end;
$function$;

revoke all on function public.t2_mindmap_grafi_v2(bigint,text,bigint) from public, anon, authenticated;
grant execute on function public.t2_mindmap_grafi_v2(bigint,text,bigint) to service_role;
