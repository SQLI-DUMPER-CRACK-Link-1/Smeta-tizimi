-- T2-PTO-OWNER-CRITICAL-CLOSURE P0-3: t2_nakopitelniy_v1 is missing Fakt
-- entirely -- its "qoldiq_hajm" is Smeta-baseline-relative
-- (smeta_hajm - jami_hajm), never what a PTO specialist actually needs day
-- to day: "Faktdan F2ga olish mumkin qancha qoldi?" = Fakt - cumulative
-- approved F2. Fakt is already canonical (t2_qator_holat view,
-- 20260923120000_t2_qator_holat_certified_v1.sql, sums t2_akt_qator where
-- the parent t2_akt.tur='fakt' and holat<>'bekor' -- Fakt has no
-- draft/approved gate the way F2 does). This migration additively extends
-- t2_nakopitelniy_v1's per-row output with fakt_hajm/fakt_summa and the
-- Fakt-relative remaining (f2_mumkin_hajm), and adds fakt_summa to totals.
-- Same function name/signature -- create or replace only, no breaking change
-- for any existing caller of the RPC.

begin;

create or replace function public.t2_nakopitelniy_v1(
  p_obyekt_id bigint, p_actor_id bigint, p_davr date default null,
  p_limit integer default 500, p_faqat_faol boolean default true)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  v_komp bigint; v_rol text; v_davr date; v_obnom text; v_loyiha bigint;
  v_lim integer := least(greatest(coalesce(p_limit,500),1),3000);
  v_qatorlar jsonb; v_jami jsonb; v_davrlar jsonb; v_qcount integer;
  v_pending numeric := 0;
begin
  select kompaniya_id, nom, loyiha_id into v_komp, v_obnom, v_loyiha from public.t2_obyekt where id = p_obyekt_id;
  if v_komp is null then return jsonb_build_object('ok',false,'code','OBYEKT_NOT_FOUND'); end if;
  v_rol := public.t2_actor_kompaniya_azo_tekshir(v_komp, p_actor_id);  -- raises 42501

  v_davr := date_trunc('month', coalesce(
              p_davr,
              (select max(a.oy) from public.t2_akt a where a.obyekt_id = p_obyekt_id and a.tur='f2' and a.holat='tasdiqlangan'),
              (select max(a.oy) from public.t2_akt a where a.obyekt_id = p_obyekt_id and a.tur='f2'),
              now()::date))::date;

  -- pending approved-change projection (migration 2/3 table; guarded)
  if to_regclass('public.t2_smeta_ozgarish') is not null then
    execute 'select coalesce(sum(delta_summa),0) from public.t2_smeta_ozgarish where obyekt_id=$1 and holat=''qoralama'''
      into v_pending using p_obyekt_id;
  end if;

  -- DETAIL (bounded): one indexed pass, per-row period-split from a bounded lateral
  select
    coalesce(jsonb_agg(r order by (r->>'tartib')::numeric, (r->>'qator_id')::bigint), '[]'::jsonb)
  into v_qatorlar
  from (
    select jsonb_build_object(
      'qator_id', q.id, 'tartib', q.tartib, 'kod', q.kod, 'nom', q.nom, 'birlik', q.birlik,
      'tur', q.tur, 'kat', q.kat, 'qoshimcha', q.qoshimcha, 'zamena', q.zamena,
      'smeta_hajm', q.hajm, 'smeta_narx', q.narx, 'smeta_summa', q.summa,
      'fakt_hajm', coalesce(p.fakt_hajm,0), 'fakt_summa', coalesce(p.fakt_summa,0),
      'oldingi_hajm',  coalesce(p.oldingi_hajm,0),  'oldingi_summa',  coalesce(p.oldingi_summa,0),
      'joriy_hajm',    coalesce(p.joriy_hajm,0),    'joriy_summa',    coalesce(p.joriy_summa,0),
      'joriy_qoralama_summa', coalesce(p.joriy_qoralama_summa,0),
      'jami_hajm',  coalesce(p.oldingi_hajm,0) + coalesce(p.joriy_hajm,0),
      'jami_summa', coalesce(p.oldingi_summa,0) + coalesce(p.joriy_summa,0),
      -- F2 eligible remaining -- Fakt-relative, NOT Smeta-baseline-relative.
      -- This is the number a PTO specialist actually needs day to day.
      'f2_mumkin_hajm', coalesce(p.fakt_hajm,0) - (coalesce(p.oldingi_hajm,0) + coalesce(p.joriy_hajm,0)),
      'qoldiq_hajm',  coalesce(q.hajm,0) - (coalesce(p.oldingi_hajm,0) + coalesce(p.joriy_hajm,0)),
      'qoldiq_summa', coalesce(q.summa,0) - (coalesce(p.oldingi_summa,0) + coalesce(p.joriy_summa,0)),
      'jami_baseline_summa', coalesce(p.oldingi_baseline,0) + coalesce(p.joriy_baseline,0),
      'jami_actual_summa',   p.jami_actual_summa,
      'narx_variance_summa',
        (coalesce(p.oldingi_summa,0) + coalesce(p.joriy_summa,0))
        - (coalesce(p.oldingi_baseline,0) + coalesce(p.joriy_baseline,0)),
      'bajarilish_foiz', case when coalesce(q.hajm,0) <> 0
        then round((coalesce(p.oldingi_hajm,0) + coalesce(p.joriy_hajm,0)) / q.hajm * 100, 1) end
    ) as r
    from public.t2_qator q
    left join lateral (
      select
        sum(aq.hajm)  filter (where a.tur='fakt') as fakt_hajm,
        sum(aq.summa) filter (where a.tur='fakt') as fakt_summa,
        sum(aq.hajm)  filter (where a.tur='f2' and a.holat='tasdiqlangan' and a.oy <  v_davr) as oldingi_hajm,
        sum(aq.summa) filter (where a.tur='f2' and a.holat='tasdiqlangan' and a.oy <  v_davr) as oldingi_summa,
        sum(aq.baseline_summa) filter (where a.tur='f2' and a.holat='tasdiqlangan' and a.oy < v_davr) as oldingi_baseline,
        sum(aq.hajm)  filter (where a.tur='f2' and a.holat='tasdiqlangan' and a.oy = v_davr) as joriy_hajm,
        sum(aq.summa) filter (where a.tur='f2' and a.holat='tasdiqlangan' and a.oy = v_davr) as joriy_summa,
        sum(aq.baseline_summa) filter (where a.tur='f2' and a.holat='tasdiqlangan' and a.oy = v_davr) as joriy_baseline,
        sum(aq.summa) filter (where a.tur='f2' and a.holat='qoralama' and a.oy = v_davr) as joriy_qoralama_summa,
        case when count(*) filter (where a.tur='f2' and a.holat='tasdiqlangan' and aq.actual_narx is null) > 0
             then null
             else sum(aq.hajm * aq.actual_narx) filter (where a.tur='f2' and a.holat='tasdiqlangan')
        end as jami_actual_summa
      from public.t2_akt_qator aq
      join public.t2_akt a on a.id = aq.akt_id and a.holat <> 'bekor'
      where aq.qator_id = q.id
    ) p on true
    where q.obyekt_id = p_obyekt_id
      and (not p_faqat_faol or coalesce(p.oldingi_hajm,0) <> 0 or coalesce(p.joriy_hajm,0) <> 0
           or coalesce(p.joriy_qoralama_summa,0) <> 0 or coalesce(p.fakt_hajm,0) <> 0 or q.qoshimcha or q.zamena)
    order by q.tartib, q.id
    limit v_lim
  ) d;

  select count(*) into v_qcount from public.t2_qator where obyekt_id = p_obyekt_id;

  -- TOTALS (all rows): one aggregate, no per-row work
  with agg as (
    select
      coalesce(sum(q.summa),0) as smeta_summa,
      coalesce(sum(x.fakt_summa),0) as fakt_summa,
      coalesce(sum(x.oldingi_summa),0) as oldingi_summa,
      coalesce(sum(x.joriy_summa),0)   as joriy_summa,
      coalesce(sum(x.joriy_qoralama_summa),0) as joriy_qoralama_summa,
      coalesce(sum(x.oldingi_summa),0) + coalesce(sum(x.joriy_summa),0) as jami_summa,
      coalesce(sum(x.oldingi_baseline),0) + coalesce(sum(x.joriy_baseline),0) as baseline_summa
    from public.t2_qator q
    left join lateral (
      select
        sum(aq.summa) filter (where a.tur='fakt') as fakt_summa,
        sum(aq.summa) filter (where a.tur='f2' and a.holat='tasdiqlangan' and a.oy <  v_davr) as oldingi_summa,
        sum(aq.baseline_summa) filter (where a.tur='f2' and a.holat='tasdiqlangan' and a.oy < v_davr) as oldingi_baseline,
        sum(aq.summa) filter (where a.tur='f2' and a.holat='tasdiqlangan' and a.oy = v_davr) as joriy_summa,
        sum(aq.baseline_summa) filter (where a.tur='f2' and a.holat='tasdiqlangan' and a.oy = v_davr) as joriy_baseline,
        sum(aq.summa) filter (where a.tur='f2' and a.holat='qoralama' and a.oy = v_davr) as joriy_qoralama_summa
      from public.t2_akt_qator aq
      join public.t2_akt a on a.id = aq.akt_id and a.holat <> 'bekor'
      where aq.qator_id = q.id
    ) x on true
    where q.obyekt_id = p_obyekt_id
  )
  select jsonb_build_object(
    'smeta_summa', smeta_summa,
    'fakt_summa', fakt_summa,
    'oldingi_summa', oldingi_summa,
    'joriy_tasdiqlangan_summa', joriy_summa,
    'joriy_qoralama_summa', joriy_qoralama_summa,
    'jami_tasdiqlangan_summa', jami_summa,
    'qoldiq_summa', smeta_summa - jami_summa,
    'f2_mumkin_summa', fakt_summa - jami_summa,
    'baseline_summa', baseline_summa,
    'narx_variance_summa', jami_summa - baseline_summa,
    'pending_ozgarish_delta', v_pending,
    'bajarilish_foiz', case when smeta_summa <> 0 then round(jami_summa / smeta_summa * 100, 1) end)
    into v_jami from agg;

  select coalesce(jsonb_agg(jsonb_build_object(
           'oy', to_char(a.oy,'YYYY-MM'), 'akt_id', a.id, 'raqam', a.raqam,
           'holat', a.holat, 'hujjat_jami', a.hujjat_jami, 'davr_muhr', a.davr_muhr,
           'revision_id', a.revision_id,
           'joriy', a.oy = v_davr, 'oldingi', a.oy < v_davr,
           'certified', a.holat = 'tasdiqlangan') order by a.oy, a.id), '[]'::jsonb)
    into v_davrlar
  from public.t2_akt a where a.obyekt_id = p_obyekt_id and a.tur = 'f2' and a.holat <> 'bekor';

  return jsonb_build_object(
    'ok', true, 'generated_at', now(),
    'obyekt', jsonb_build_object('id', p_obyekt_id, 'nom', v_obnom, 'kompaniya_id', v_komp, 'loyiha_id', v_loyiha),
    'davr', to_char(v_davr,'YYYY-MM'),
    'joriy_revision_id', (select id from public.t2_smeta_revision where obyekt_id=p_obyekt_id order by seq desc limit 1),
    'qatorlar', v_qatorlar,
    'qatorlar_jami', v_qcount,
    'qatorlar_korsatildi', jsonb_array_length(v_qatorlar),
    'truncated', jsonb_array_length(v_qatorlar) >= v_lim,
    'jami', v_jami,
    'davrlar', v_davrlar);
end $$;

revoke all on function public.t2_nakopitelniy_v1(bigint,bigint,date,integer,boolean) from public, anon, authenticated;

comment on function public.t2_nakopitelniy_v1(bigint,bigint,date,integer,boolean) is
  'T2-PTO-OWNER-CRITICAL-CLOSURE P0-3: adds fakt_hajm/fakt_summa (t2_akt tur=fakt, holat<>bekor -- no draft/approved gate) and f2_mumkin_hajm/f2_mumkin_summa (Fakt - cumulative approved F2), the PTO-daily remaining number, alongside the pre-existing Smeta-baseline-relative qoldiq_hajm/qoldiq_summa.';

commit;
