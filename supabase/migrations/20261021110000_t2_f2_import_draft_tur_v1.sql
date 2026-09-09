-- T2-F2-IMPORT-TUR-CASCADE-001: haqiqiy hodisa -- "F2 importda oddiy
-- resurs (rs) bilan ob (jihoz) ni ajratib ko'rsatib bo'lmayapti".
--
-- Ildiz sabab: F2 import RESUMABLE (`t2_f2_import_job`/`_draft_qator`) --
-- katta fayl bo'laklab saqlanadi, foydalanuvchi keyinroq davom ettirishi
-- mumkin. Lekin `t2_f2_import_draft_qator` jadvalida qatorning ASL TURI
-- (rz/bl/rs/mat/ob) UMUMAN saqlanmagan -- faqat uid/hajm/narx/summa/kod.
-- Sessiya YANGI (hech qachon uzilmagan) bo'lsa muammo yo'q: frontend hali
-- ham original daraxtni (`sourceTree`, to'g'ri turlari bilan) xotirada
-- ushlab turadi. Lekin foydalanuvchi sahifani yopib, KEYINROQ davom
-- ettirsa (`resume()`), original daraxt YO'QOLADI -- faqat tekis
-- (flat) qoralama qatorlari tiklanadi, ularda tur yo'q. Shu daqiqada
-- `F2TwoPaneWorkbench.tsx`ning `flatSourceNodes()` fallback funksiyasi
-- HAMMA qatorni majburan 'rs' deb belgilaydi -- ob (jihoz, ⚙️) ham,
-- mat (material, 🧱) ham "oddiy resurs" (🔹) bo'lib ko'rinadi.
--
-- Tuzatish: `tur`ni ham draft qatoriga saqlaymiz, saqlash/o'qish
-- RPC'lariga qo'shamiz. Frontend tomoni (F2ImportNative.tsx,
-- F2TwoPaneWorkbench.tsx) alohida commit'da.

begin;

alter table public.t2_f2_import_draft_qator
  add column if not exists tur text;

create or replace function public.t2_f2_import_draft_saqla_v1(p_job_id bigint, p_actor_id bigint, p_qatorlar jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_komp bigint; v_obyekt bigint; v_soni integer;
begin
  select kompaniya_id, obyekt_id into v_komp, v_obyekt from public.t2_f2_import_job where id = p_job_id;
  if v_komp is null then return jsonb_build_object('ok',false,'code','JOB_NOT_FOUND'); end if;
  perform public.t2_actor_kompaniya_azo_tekshir(v_komp, p_actor_id);

  if p_qatorlar is null or jsonb_typeof(p_qatorlar) <> 'array'
     or jsonb_array_length(p_qatorlar) = 0 or jsonb_array_length(p_qatorlar) > 5000 then
    return jsonb_build_object('ok',false,'code','BAD_PAYLOAD');
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_qatorlar) x
    where jsonb_typeof(x) <> 'object'
      or nullif(btrim(x->>'uid'),'') is null
      or x->>'holat' not in ('avto_moslashti','qolda_moslashtirildi','otkazib_yuborildi','hal_qilinmagan')
      or (x ? 'expected_versiya' and (jsonb_typeof(x->'expected_versiya') <> 'number'
          or (x->>'expected_versiya') !~ '^[0-9]+$'))
  ) or exists (
    select 1 from jsonb_array_elements(p_qatorlar) x
    group by x->>'uid' having count(*) > 1
  ) then
    return jsonb_build_object('ok',false,'code','BAD_DRAFT_PAYLOAD');
  end if;

  perform pg_advisory_xact_lock(p_job_id);
  perform 1 from public.t2_f2_import_draft_qator d
    join jsonb_array_elements(p_qatorlar) x on x->>'uid' = d.uid
    where d.job_id = p_job_id
    for update;

  if exists (
    select 1 from public.t2_f2_import_draft_qator d
    join jsonb_array_elements(p_qatorlar) x on x->>'uid' = d.uid
    where d.job_id = p_job_id
      and ((x->>'expected_versiya') is null or (x->>'expected_versiya')::integer <> d.versiya)
  ) then
    return jsonb_build_object('ok',false,'code','STALE_DRAFT_VERSION');
  end if;

  with kir as (
    select
      (x->>'uid') as uid, (x->>'holat') as holat,
      nullif(x->>'expected_versiya','')::integer as expected_versiya,
      nullif(x->>'lrv_varaq','') as lrv_varaq, nullif(x->>'lrv_row','')::integer as lrv_row,
      nullif(x->>'kod','') as kod, nullif(x->>'hajm','')::numeric as hajm,
      nullif(x->>'narx','')::numeric as narx, nullif(x->>'summa','')::numeric as summa,
      nullif(x->>'sabab','') as sabab, nullif(x->>'tur','') as tur
    from jsonb_array_elements(p_qatorlar) x
  )
  insert into public.t2_f2_import_draft_qator
    (job_id, uid, holat, lrv_varaq, lrv_row, kod, hajm, narx, summa, sabab, tur, actor_id)
  select p_job_id, k.uid, k.holat, k.lrv_varaq, k.lrv_row, k.kod, k.hajm, k.narx, k.summa, k.sabab, k.tur, p_actor_id
  from kir k
  where k.uid is not null and k.holat is not null
  on conflict (job_id, uid) do update set
    holat = excluded.holat, lrv_varaq = excluded.lrv_varaq, lrv_row = excluded.lrv_row,
    kod = excluded.kod, hajm = excluded.hajm, narx = excluded.narx, summa = excluded.summa,
    sabab = excluded.sabab, tur = excluded.tur, actor_id = excluded.actor_id,
    versiya = public.t2_f2_import_draft_qator.versiya + 1, yangilandi = now();
  get diagnostics v_soni = row_count;

  perform public.t2_audit_yoz(v_komp, 'f2_import_draft_saqla', 'f2', v_obyekt,
    format('draft_rows=%s', v_soni), 'actor:'||p_actor_id, null);

  return jsonb_build_object('ok',true,'job_id',p_job_id,'saqlandi',v_soni);
end $$;

create or replace function public.t2_f2_import_draft_royxat_v1(p_job_id bigint, p_actor_id bigint)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_komp bigint;
begin
  select kompaniya_id into v_komp from public.t2_f2_import_job where id = p_job_id;
  if v_komp is null then return jsonb_build_object('ok',false,'code','JOB_NOT_FOUND'); end if;
  perform public.t2_actor_kompaniya_azo_tekshir(v_komp, p_actor_id);
  return jsonb_build_object('ok',true,'job_id',p_job_id,'qatorlar',coalesce((
    select jsonb_agg(jsonb_build_object(
      'uid', d.uid, 'holat', d.holat, 'lrv_varaq', d.lrv_varaq,
      'lrv_row', d.lrv_row, 'kod', d.kod, 'hajm', d.hajm, 'narx', d.narx,
      'summa', d.summa, 'sabab', d.sabab, 'tur', d.tur, 'versiya', d.versiya,
      'yangilandi', d.yangilandi
    ) order by d.uid)
    from public.t2_f2_import_draft_qator d where d.job_id = p_job_id
  ), '[]'::jsonb));
end $$;

commit;
