-- T2_NAKOPITELNIY_V2 — egasi qarori (2026-09-25, PTO_EGASI_QARORLARI Q3 + Q4):
--
--  Q3 "Ha, tuzat. Amfiteatr foizlari bilan 56 mlrd bo'lishi kerak."
--     t2_nakopitelniy_v1 jami.smeta_summa = sum(q.summa) HAMMA tur bo'yicha —
--     rz va bl qatorlari o'z bolalari summasini takrorlaydi, natijada
--     Amfiteatr (obyekt 6) 100,6 mlrd ko'rinardi (barglar 43,6 mlrd).
--     Endi smeta summasi faqat BARGLARDAN (rs, mat, ob) yig'iladi — xuddi
--     t2_smeta_ozgarish_tasdiqlash_v1 revision jami_summa kabi. Summasi
--     noma'lum (NULL) barglar sanaladi: `smeta_summa_nomalum` (NULL ≠ 0).
--     Qo'shimcha: `smeta_nakrutka` — t2_obyekt_nakrutka (pryamye → ИТОГО-4 →
--     НДС → ВСЕГО) — shu yerda Amfiteatr ВСЕГО = 56 623 606 614,37.
--     Akt summalari (fakt/F2) o'zgarmaydi: har akt qatori alohida yozuv,
--     ierarxik takror yo'q.
--
--  Q4 "3000 qator chegarasi — serverning o'zida to'g'rila, keyingi ishlarda
--     avtomat ishlashi shart."
--     p_offset qo'shildi: mijoz `keyingi_offset` null bo'lguncha sahifalab
--     o'qiydi (sahifa ≤ 5000). `truncated` endi aniq: keyingi sahifa bormi
--     (limit+1 qator o'qiladi). Jami (butun obyekt) faqat birinchi sahifada
--     (p_offset = 0) hisoblanadi — keyingi sahifalar tez.
--
-- Additiv: yangi funksiya t2_nakopitelniy_v2 (imzo boshqa — PostgREST
-- noaniqligi yo'q); t2_nakopitelniy_v1 imzosi o'zgarmaydi, v2 ga o'raladi
-- (bir manba). Rollback: *.rollback.sql.
-- Prod: 2026-09-25 egasi ruxsati bilan qo'llandi (schema_migrations version
-- 20260925151924, nom t2_nakopitelniy_v2_sahifa_barg_jami).

begin;

create or replace function public.t2_nakopitelniy_v2(
  p_obyekt_id bigint, p_actor_id bigint, p_davr date default null,
  p_limit integer default 500, p_faqat_faol boolean default true,
  p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  v_komp bigint; v_rol text; v_davr date; v_obnom text; v_loyiha bigint;
  v_lim integer := least(greatest(coalesce(p_limit,500),1),5000);
  v_off integer := greatest(coalesce(p_offset,0),0);
  v_faol boolean := coalesce(p_faqat_faol,true);
  v_qatorlar jsonb; v_jami jsonb := null; v_davrlar jsonb; v_qcount integer;
  v_pending numeric := 0; v_olindi integer; v_keyingi boolean;
  v_nak jsonb := null;
begin
  select kompaniya_id, nom, loyiha_id into v_komp, v_obnom, v_loyiha from public.t2_obyekt where id = p_obyekt_id;
  if v_komp is null then return jsonb_build_object('ok',false,'code','OBYEKT_NOT_FOUND'); end if;
  v_rol := public.t2_actor_kompaniya_azo_tekshir(v_komp, p_actor_id);  -- raises 42501

  v_davr := date_trunc('month', coalesce(
              p_davr,
              (select max(a.oy) from public.t2_akt a where a.obyekt_id = p_obyekt_id and a.tur='f2' and a.holat='tasdiqlangan'),
              (select max(a.oy) from public.t2_akt a where a.obyekt_id = p_obyekt_id and a.tur='f2'),
              now()::date))::date;

  -- DETAIL (sahifa): limit+1 qator — keyingi sahifa bormi aniq bilinadi.
  -- faqat_faol=false: sahifa t2_qator indeksida kesiladi (lateral faqat
  -- sahifadagi qatorlar uchun); faqat_faol=true: filtr lateral natijasiga
  -- bog'liq, shuning uchun offset filtrdan keyin.
  select
    coalesce(jsonb_agg(d.r order by d.tartib, d.id), '[]'::jsonb), count(*)
  into v_qatorlar, v_olindi
  from (
    select q.tartib, q.id, jsonb_build_object(
      'qator_id', q.id, 'tartib', q.tartib, 'kod', q.kod, 'nom', q.nom, 'birlik', q.birlik,
      'tur', q.tur, 'kat', q.kat, 'qoshimcha', q.qoshimcha, 'zamena', q.zamena,
      'smeta_hajm', q.hajm, 'smeta_narx', q.narx, 'smeta_summa', q.summa,
      'fakt_hajm', coalesce(p.fakt_hajm,0), 'fakt_summa', coalesce(p.fakt_summa,0),
      'oldingi_hajm',  coalesce(p.oldingi_hajm,0),  'oldingi_summa',  coalesce(p.oldingi_summa,0),
      'joriy_hajm',    coalesce(p.joriy_hajm,0),    'joriy_summa',    coalesce(p.joriy_summa,0),
      'joriy_qoralama_summa', coalesce(p.joriy_qoralama_summa,0),
      'jami_hajm',  coalesce(p.oldingi_hajm,0) + coalesce(p.joriy_hajm,0),
      'jami_summa', coalesce(p.oldingi_summa,0) + coalesce(p.joriy_summa,0),
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
    from (
      select * from public.t2_qator b
      where b.obyekt_id = p_obyekt_id
      order by b.tartib, b.id
      offset case when v_faol then 0 else v_off end
      limit case when v_faol then null else v_lim + 1 end
    ) q
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
    where (not v_faol or coalesce(p.oldingi_hajm,0) <> 0 or coalesce(p.joriy_hajm,0) <> 0
           or coalesce(p.joriy_qoralama_summa,0) <> 0 or coalesce(p.fakt_hajm,0) <> 0 or q.qoshimcha or q.zamena)
    order by q.tartib, q.id
    offset case when v_faol then v_off else 0 end
    limit v_lim + 1
  ) d;

  v_keyingi := v_olindi > v_lim;
  if v_keyingi then
    -- ortiqcha (limit+1-chi) qatorni olib tashlash
    v_qatorlar := v_qatorlar - (jsonb_array_length(v_qatorlar) - 1);
  end if;

  select count(*) into v_qcount from public.t2_qator where obyekt_id = p_obyekt_id;

  -- TOTALS — faqat birinchi sahifada (butun obyekt, sahifaga bog'liq emas).
  if v_off = 0 then
    if to_regclass('public.t2_smeta_ozgarish') is not null then
      execute 'select coalesce(sum(delta_summa),0) from public.t2_smeta_ozgarish where obyekt_id=$1 and holat=''qoralama'''
        into v_pending using p_obyekt_id;
    end if;

    with agg as (
      select
        -- Q3: faqat barglar (rz/bl summasi bolalarini takrorlaydi).
        coalesce(sum(q.summa) filter (where q.tur in ('rs','mat','ob')),0) as smeta_summa,
        count(*) filter (where q.tur in ('rs','mat','ob') and q.summa is null) as smeta_summa_nomalum,
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
      'smeta_summa_asos', 'barglar',
      'smeta_summa_nomalum', smeta_summa_nomalum,
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

    -- Smeta nakrutka kaskadi (t2_obyekt_nakrutka): to'g'ri xarajat → ВСЕГО.
    if to_regclass('public.t2_obyekt_nakrutka') is not null then
      execute $q$
        select jsonb_build_object(
          'pryamye', round(n.pryamye, 2),
          'itogo4', round(n.itogo4, 2),
          'nds', round(n.nds, 2),
          'nds_foiz', case when coalesce(n.itogo4,0) <> 0 then round(n.nds / n.itogo4 * 100, 2) end,
          'vsego', round(n.vsego, 2))
        from public.t2_obyekt_nakrutka n where n.obyekt_id = $1 limit 1 $q$
        into v_nak using p_obyekt_id;
    end if;
    v_jami := v_jami || jsonb_build_object('smeta_nakrutka', v_nak);
  end if;

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
    'offset', v_off,
    'limit', v_lim,
    'keyingi_offset', case when v_keyingi then v_off + v_lim end,
    'truncated', v_keyingi,
    'jami', v_jami,
    'davrlar', v_davrlar);
end $$;

revoke all on function public.t2_nakopitelniy_v2(bigint,bigint,date,integer,boolean,integer) from public, anon, authenticated;

comment on function public.t2_nakopitelniy_v2(bigint,bigint,date,integer,boolean,integer) is
  'Nakopitelniy vedomost (sahifali). Q3: smeta_summa faqat barglar (rs/mat/ob) + smeta_nakrutka (t2_obyekt_nakrutka). Q4: p_offset / keyingi_offset — mijoz to''liq ro''yxatni avtomat sahifalab oladi; jami faqat p_offset=0 da.';

-- v1: imzo o'zgarmaydi, bitta manba — v2 (birinchi sahifa, v1 chegarasi 3000).
create or replace function public.t2_nakopitelniy_v1(
  p_obyekt_id bigint, p_actor_id bigint, p_davr date default null,
  p_limit integer default 500, p_faqat_faol boolean default true)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  return public.t2_nakopitelniy_v2(p_obyekt_id, p_actor_id, p_davr,
    least(greatest(coalesce(p_limit,500),1),3000), p_faqat_faol, 0);
end $$;

revoke all on function public.t2_nakopitelniy_v1(bigint,bigint,date,integer,boolean) from public, anon, authenticated;

comment on function public.t2_nakopitelniy_v1(bigint,bigint,date,integer,boolean) is
  'Moslik o''rami: t2_nakopitelniy_v2(..., p_offset => 0). Yangi mijozlar v2 ni sahifalab chaqiradi.';

commit;
