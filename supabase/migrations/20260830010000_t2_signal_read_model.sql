-- Control-signal read model. Business facts stay in their domain tables;
-- this view only aggregates currently open signals for the mindmap.
CREATE OR REPLACE VIEW public.t2_mindmap_signal_summary AS
SELECT kompaniya_id, entity_id AS obyekt_id,
       count(*)::integer AS signal_count,
       count(*) FILTER (WHERE severity = 'critical')::integer AS critical_count,
       jsonb_agg(jsonb_build_object('type', signal_type, 'severity', severity,
                                    'title', title, 'details', details)
                 ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'error' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
                          detected_at DESC) AS top_signals
  FROM public.t2_signal
 WHERE state = 'open' AND entity_type = 'obyekt'
 GROUP BY kompaniya_id, entity_id;

CREATE OR REPLACE FUNCTION public.t2_signal_reopen(
  p_kompaniya_id bigint, p_operation_id uuid
) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = public, pg_temp AS $$
  UPDATE public.t2_signal
     SET state='open', resolved_at=null, detected_at=now(), updated_at=now()
   WHERE kompaniya_id=p_kompaniya_id AND operation_id=p_operation_id;
$$;

REVOKE ALL ON FUNCTION public.t2_signal_reopen(bigint, uuid) FROM PUBLIC;
GRANT SELECT ON public.t2_mindmap_signal_summary TO service_role;
GRANT EXECUTE ON FUNCTION public.t2_signal_reopen(bigint, uuid) TO service_role;
