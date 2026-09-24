-- ACCEPTANCE T2_QATOR_HOLAT_OBYEKT_FILTR_V1
do $$
declare v_def text; v_q bigint; v_h bigint; v_farq bigint;
begin
  v_def := pg_get_viewdef('public.t2_qator_holat'::regclass, true);
  if v_def !~* 'not materialized' then raise exception 'QABUL XATO: CTE hali materialize'; end if;
  if v_def !~* 'parent\.obyekt_id = d\.obyekt_id' then raise exception 'QABUL XATO: ota obyekt filtri yo''q'; end if;
  -- Har qator aynan bir marta (ota join qatorlarni ko'paytirmaydi).
  select count(*) into v_q from public.t2_qator;
  select count(*) into v_h from public.t2_qator_holat;
  if v_q <> v_h then raise exception 'QABUL XATO: t2_qator % <> t2_qator_holat %', v_q, v_h; end if;
  -- Obyekt bo'yicha ham.
  select count(*) into v_farq from (
    select obyekt_id, count(*) c from public.t2_qator group by obyekt_id
    except select obyekt_id, count(*) from public.t2_qator_holat group by obyekt_id) x;
  if v_farq <> 0 then raise exception 'QABUL XATO: % obyektda qator soni farq qiladi', v_farq; end if;
  raise notice 'T2_QATOR_HOLAT_OBYEKT_FILTR_V1_ACCEPTANCE_PASS (% qator)', v_h;
end $$;
