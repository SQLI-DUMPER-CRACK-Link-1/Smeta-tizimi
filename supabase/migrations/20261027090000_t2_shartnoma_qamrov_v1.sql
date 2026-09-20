-- T2-PTO: shartnoma bo'yicha qator qamrovi va nakrutka scope'i.
--
-- Canonical truth remains t2_qator.  This table is only a contract-scoped
-- decision over an existing canonical row: omitted = included, explicit
-- 'chiqarilgan' = excluded.  No estimate line is copied or deleted.
--
-- A quantity override is optional and is interpreted proportionally against
-- the source qator.summa.  Thus a source amount that is not hajm*narx is
-- preserved; the override never rewrites t2_qator.

create table if not exists public.t2_shartnoma_qator_qamrov (
  id bigint generated always as identity primary key,
  kompaniya_id bigint not null references public.t2_kompaniya(id),
  shartnoma_id bigint not null references public.t2_shartnoma(id),
  obyekt_id bigint not null references public.t2_obyekt(id),
  qator_id bigint not null references public.t2_qator(id),
  holat text not null default 'kiritilgan'
    check (holat in ('kiritilgan','chiqarilgan')),
  hajm_override numeric null check (hajm_override is null or hajm_override >= 0),
  sabab text not null check (length(btrim(sabab)) between 1 and 500),
  dalil_hujjat_id bigint null,
  actor_id bigint references public.t2_foydalanuvchi(id),
  operation_id uuid not null,
  versiya integer not null default 1 check (versiya > 0),
  yaratildi timestamptz not null default now(),
  yangilandi timestamptz not null default now(),
  unique (shartnoma_id, qator_id),
  unique (operation_id)
);

create index if not exists t2_shartnoma_qamrov_scope_ix
  on public.t2_shartnoma_qator_qamrov (shartnoma_id, obyekt_id, holat);
create index if not exists t2_shartnoma_qamrov_qator_ix
  on public.t2_shartnoma_qator_qamrov (qator_id, shartnoma_id);

alter table public.t2_shartnoma_qator_qamrov enable row level security;
revoke all on table public.t2_shartnoma_qator_qamrov from anon, authenticated;

-- ── Read: all canonical lines of all objects linked to this contract ─────
create or replace function public.t2_shartnoma_qamrov_ol_v1(
  p_shartnoma_id bigint,
  p_actor_id bigint
) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  v_kompaniya_id bigint;
  v_rol text;
begin
  select s.kompaniya_id into v_kompaniya_id
    from public.t2_shartnoma s
   where s.id = p_shartnoma_id and s.holat <> 'bekor';
  if v_kompaniya_id is null then
    return jsonb_build_object('ok',false,'code','SHARTNOMA_NOT_FOUND');
  end if;

  v_rol := public.t2_actor_kompaniya_azo_tekshir(v_kompaniya_id, p_actor_id);

  return (
    with l as (
      select
        q.id as qator_id,
        q.obyekt_id,
        o.nom as obyekt_nom,
        q.tur,
        q.kod,
        q.nom,
        q.birlik,
        q.hajm,
        q.narx,
        q.summa,
        q.kat,
        q.ota_id,
        q.daraja,
        q.tartib,
        q.qoshimcha,
        q.zamena,
        q.versiya as qator_versiya,
        coalesce(c.holat,'kiritilgan') as holat,
        c.id as qamrov_id,
        c.hajm_override,
        c.sabab,
        c.dalil_hujjat_id,
        c.versiya as qamrov_versiya,
        (coalesce(c.holat,'kiritilgan') <> 'chiqarilgan') as amalda_qamrovda,
        (q.tur in ('rs','mat','ob')) as hisobga_kiradi,
        case
          when coalesce(c.holat,'kiritilgan') = 'chiqarilgan' then 0::numeric
          when c.hajm_override is not null and coalesce(q.hajm,0) <> 0
            then coalesce(q.summa,0) * c.hajm_override / q.hajm
          else coalesce(q.summa,0)
        end as summa_amaldagi
      from public.t2_shartnoma_bog b
      join public.t2_obyekt o on o.id = b.obyekt_id
        and o.kompaniya_id = v_kompaniya_id and o.holat <> 'bekor'
      join public.t2_qator q on q.obyekt_id = o.id
        and q.kompaniya_id = v_kompaniya_id
      left join public.t2_shartnoma_qator_qamrov c
        on c.shartnoma_id = p_shartnoma_id and c.qator_id = q.id
      where b.shartnoma_id = p_shartnoma_id and b.holat = 'faol'
    )
    select jsonb_build_object(
      'ok', true,
      'shartnoma_id', p_shartnoma_id,
      'kompaniya_id', v_kompaniya_id,
      'qatorlar', coalesce((select jsonb_agg(to_jsonb(l) order by l.obyekt_id,l.daraja,l.tartib,l.qator_id) from l), '[]'::jsonb),
      'summary', jsonb_build_object(
        'qator_soni', (select count(*) from l),
        'qamrovda', (select count(*) from l where l.amalda_qamrovda),
        'chiqarilgan', (select count(*) from l where not l.amalda_qamrovda),
        'hisobga_kiradigan', (select count(*) from l where l.hisobga_kiradi and l.amalda_qamrovda),
        'jami', (select coalesce(sum(l.summa_amaldagi) filter (where l.hisobga_kiradi),0) from l)
      )
    )
  );
end;
$$;

revoke all on function public.t2_shartnoma_qamrov_ol_v1(bigint,bigint) from public, anon, authenticated;
grant execute on function public.t2_shartnoma_qamrov_ol_v1(bigint,bigint) to service_role;

-- ── Write: include/exclude one existing canonical line ───────────────────
create or replace function public.t2_shartnoma_qamrov_saqla_v1(
  p_kompaniya_id bigint,
  p_actor_id bigint,
  p_shartnoma_id bigint,
  p_obyekt_id bigint,
  p_qator_id bigint,
  p_holat text,
  p_hajm_override numeric,
  p_sabab text,
  p_dalil_hujjat_id bigint,
  p_operation_id uuid,
  p_kutilgan_versiya integer
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_rol text;
  v_old public.t2_shartnoma_qator_qamrov;
  v_new public.t2_shartnoma_qator_qamrov;
  v_result jsonb;
begin
  if p_operation_id is null then
    return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED');
  end if;
  select natija into v_result from public.t2_onboarding_command_log where operation_id = p_operation_id;
  if found then return v_result; end if;

  if p_holat not in ('kiritilgan','chiqarilgan') then
    return jsonb_build_object('ok',false,'code','QAMROV_HOLAT_INVALID');
  end if;
  if p_sabab is null or length(btrim(p_sabab)) = 0 or length(p_sabab) > 500 then
    return jsonb_build_object('ok',false,'code','SABAB_REQUIRED');
  end if;
  if p_hajm_override is not null and p_hajm_override < 0 then
    return jsonb_build_object('ok',false,'code','HAJM_OVERRIDE_INVALID');
  end if;
  if p_kutilgan_versiya is null or p_kutilgan_versiya < 1 then
    return jsonb_build_object('ok',false,'code','EXPECTED_VERSION_REQUIRED');
  end if;

  v_rol := public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id, p_actor_id);
  if v_rol not in ('admin','superadmin','boss','director','pto') then
    raise exception 'WRITE_ROLE_REQUIRED' using errcode='42501';
  end if;

  if not exists (
    select 1 from public.t2_shartnoma s
     where s.id=p_shartnoma_id and s.kompaniya_id=p_kompaniya_id and s.holat <> 'bekor'
  ) then
    return jsonb_build_object('ok',false,'code','SHARTNOMA_SCOPE_MISMATCH');
  end if;
  if not exists (
    select 1 from public.t2_shartnoma_bog b
     where b.shartnoma_id=p_shartnoma_id and b.obyekt_id=p_obyekt_id and b.holat='faol'
  ) then
    return jsonb_build_object('ok',false,'code','SHARTNOMA_OBYEKT_SCOPE_MISMATCH');
  end if;
  if not exists (
    select 1 from public.t2_qator q
     where q.id=p_qator_id and q.obyekt_id=p_obyekt_id and q.kompaniya_id=p_kompaniya_id
  ) then
    return jsonb_build_object('ok',false,'code','QATOR_SCOPE_MISMATCH');
  end if;

  select * into v_old
    from public.t2_shartnoma_qator_qamrov
   where shartnoma_id=p_shartnoma_id and qator_id=p_qator_id
   for update;

  if found then
    if v_old.versiya <> p_kutilgan_versiya then
      return jsonb_build_object('ok',false,'code','VERSION_CONFLICT','bordagi_versiya',v_old.versiya);
    end if;
    update public.t2_shartnoma_qator_qamrov
       set kompaniya_id=p_kompaniya_id, obyekt_id=p_obyekt_id, holat=p_holat,
           hajm_override=p_hajm_override, sabab=btrim(p_sabab),
           dalil_hujjat_id=p_dalil_hujjat_id, actor_id=p_actor_id,
           versiya=versiya+1, yangilandi=now()
     where id=v_old.id
     returning * into v_new;
  else
    insert into public.t2_shartnoma_qator_qamrov(
      kompaniya_id,shartnoma_id,obyekt_id,qator_id,holat,hajm_override,
      sabab,dalil_hujjat_id,actor_id,operation_id
    ) values (
      p_kompaniya_id,p_shartnoma_id,p_obyekt_id,p_qator_id,p_holat,
      p_hajm_override,btrim(p_sabab),p_dalil_hujjat_id,p_actor_id,p_operation_id
    ) returning * into v_new;
  end if;

  perform public.t2_audit_yoz(
    p_kompaniya_id, 'shartnoma_qamrov_saqlandi', 'shartnoma', p_obyekt_id,
    format('actor_id=%s; rol=%s; shartnoma_id=%s; qator_id=%s; holat=%s; hajm_override=%s',
      p_actor_id,v_rol,p_shartnoma_id,p_qator_id,p_holat,p_hajm_override),
    'actor:'||p_actor_id, null
  );
  v_result := jsonb_build_object(
    'ok',true,'id',v_new.id,'shartnoma_id',v_new.shartnoma_id,
    'obyekt_id',v_new.obyekt_id,'qator_id',v_new.qator_id,
    'holat',v_new.holat,'hajm_override',v_new.hajm_override,'versiya',v_new.versiya
  );
  insert into public.t2_onboarding_command_log(operation_id,actor_id,command,natija)
    values (p_operation_id,p_actor_id,'shartnoma_qamrov_saqla',v_result);
  return v_result;
end;
$$;

revoke all on function public.t2_shartnoma_qamrov_saqla_v1(bigint,bigint,bigint,bigint,bigint,text,numeric,text,bigint,uuid,integer) from public, anon, authenticated;
grant execute on function public.t2_shartnoma_qamrov_saqla_v1(bigint,bigint,bigint,bigint,bigint,text,numeric,text,bigint,uuid,integer) to service_role;

-- ── Contract-scope hardening for existing nakrutka reads ────────────────
create or replace function public.t2_nakrutka_koef_ol_v1(
  p_kompaniya_id bigint, p_actor_id bigint, p_shartnoma_id bigint default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_rol text; v_nk jsonb; v_komp_override jsonb; v_shartnoma_override jsonb;
begin
  v_rol := public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id, p_actor_id);
  if p_shartnoma_id is not null and not exists (
    select 1 from public.t2_shartnoma s
     where s.id=p_shartnoma_id and s.kompaniya_id=p_kompaniya_id and s.holat <> 'bekor'
  ) then
    return jsonb_build_object('ok',false,'code','SHARTNOMA_SCOPE_MISMATCH');
  end if;
  select coalesce(jsonb_object_agg(koef_kod,to_jsonb(qiymat)),'{}'::jsonb) into v_komp_override
    from public.t2_nakrutka_koef where kompaniya_id=p_kompaniya_id and shartnoma_id is null;
  select coalesce(jsonb_object_agg(koef_kod,to_jsonb(qiymat)),'{}'::jsonb) into v_shartnoma_override
    from public.t2_nakrutka_koef where kompaniya_id=p_kompaniya_id and shartnoma_id=p_shartnoma_id and p_shartnoma_id is not null;
  v_nk := public.t2_nakrutka_default_v1() || v_komp_override || v_shartnoma_override;
  return jsonb_build_object('ok',true,'shartnoma_id',p_shartnoma_id,
    'koeffitsientlar',v_nk,'jadval',public.t2_nakrutka_koef_jadval_v1(v_nk));
end;
$$;

-- Replace only the calculation body: the cascade formula itself is the
-- accepted existing formula; its direct-cost input now respects contract
-- exclusions and quantity overrides without modifying t2_qator.
create or replace function public.t2_obyekt_nakrutka_v1(
  p_obyekt_id bigint, p_actor_id bigint, p_shartnoma_id bigint default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  v_komp bigint; v_rol text; v_cats jsonb; v_nk_javob jsonb;
  v_shartnoma_id bigint := p_shartnoma_id;
begin
  select kompaniya_id into v_komp from public.t2_obyekt where id=p_obyekt_id;
  if v_komp is null then return jsonb_build_object('ok',false,'code','OBYEKT_NOT_FOUND'); end if;
  v_rol := public.t2_actor_kompaniya_azo_tekshir(v_komp,p_actor_id);

  if v_shartnoma_id is null then
    select b.shartnoma_id into v_shartnoma_id
      from public.t2_shartnoma_bog b
     where b.obyekt_id=p_obyekt_id and b.holat='faol' limit 1;
  end if;
  if v_shartnoma_id is not null and not exists (
    select 1 from public.t2_shartnoma_bog b
     join public.t2_shartnoma s on s.id=b.shartnoma_id
     where b.obyekt_id=p_obyekt_id and b.shartnoma_id=v_shartnoma_id
       and b.holat='faol' and s.kompaniya_id=v_komp and s.holat <> 'bekor'
  ) then
    return jsonb_build_object('ok',false,'code','SHARTNOMA_OBYEKT_SCOPE_MISMATCH');
  end if;

  select jsonb_build_object(
    'chel',coalesce(sum(x.summa) filter (where x.kat='ЧЕЛ'),0),
    'mash',coalesce(sum(x.summa) filter (where x.kat='МАШ'),0),
    'mat',coalesce(sum(x.summa) filter (where x.kat in ('МАТ','М/К','КАБ')),0),
    'ob',coalesce(sum(x.summa) filter (where x.kat='ОБ'),0),
    'mk',coalesce(sum(x.summa) filter (where x.kat='М/К'),0),
    'kab',coalesce(sum(x.summa) filter (where x.kat='КАБ'),0),
    'bez',0)
    into v_cats
    from (
      select q.kat,
        case
          when c.holat='chiqarilgan' then 0::numeric
          when c.hajm_override is not null and coalesce(q.hajm,0) <> 0
            then coalesce(q.summa,0) * c.hajm_override / q.hajm
          else coalesce(q.summa,0)
        end as summa
      from public.t2_qator q
      left join public.t2_shartnoma_qator_qamrov c
        on c.shartnoma_id=v_shartnoma_id and c.qator_id=q.id
      where q.obyekt_id=p_obyekt_id and q.tur in ('rs','mat','ob')
        and coalesce(c.holat,'kiritilgan') <> 'chiqarilgan'
    ) x;

  v_nk_javob := public.t2_nakrutka_koef_ol_v1(v_komp,p_actor_id,v_shartnoma_id);
  if coalesce((v_nk_javob->>'ok')::boolean,false) is not true then return v_nk_javob; end if;
  return jsonb_build_object('ok',true,'obyekt_id',p_obyekt_id,
    'shartnoma_id',v_shartnoma_id,'cats',v_cats,
    'koeffitsientlar',v_nk_javob->'koeffitsientlar',
    'nakrutka',public.t2_nakrutka_hisobla_v1(v_cats,v_nk_javob->'koeffitsientlar'),
    'jadval',v_nk_javob->'jadval');
end;
$$;
