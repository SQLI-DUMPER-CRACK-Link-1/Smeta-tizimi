-- Qo'shimcha/zamena: canonical t2_qator, alohida entity truth yo'q.
begin;
create table public.t2_addrepl_command (
 operation_id uuid primary key,
 actor_id bigint not null references public.t2_foydalanuvchi(id),
 kompaniya_id bigint not null references public.t2_kompaniya(id),
 request jsonb not null,
 response jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.t2_addrepl_command enable row level security;
revoke all on public.t2_addrepl_command from public,anon,authenticated;

create function public.t2_addrepl_execute_v1(p_request jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare
 c bigint := (p_request->>'kompaniya_id')::bigint;
 a bigint := (p_request->>'actor_id')::bigint;
 o bigint := (p_request->>'obyekt_id')::bigint;
 parent_id bigint := (p_request->>'ota_qator_id')::bigint;
 old_id bigint := (p_request->>'almashtirilayotgan_qator_id')::bigint;
 op uuid := (p_request->>'operation_id')::uuid;
 expected integer := (p_request->>'kutilgan_versiya')::integer;
 qty numeric := (p_request->>'hajm')::numeric;
 after_id bigint := (p_request->>'keyin_qator_id')::bigint;
 evidence bigint := (p_request->>'dalil_hujjat_id')::bigint;
 mode text := p_request->>'command';
 name text := p_request->>'nom';
 unit text := p_request->>'birlik';
 reason text := p_request->>'sabab';
 role_name text;
 parent public.t2_qator%rowtype;
 old_row public.t2_qator%rowtype;
 previous public.t2_addrepl_command%rowtype;
 kind text; ordering integer; new_id bigint; change_id bigint; result jsonb;
begin
 role_name := public.t2_actor_kompaniya_azo_tekshir(c,a);
 if role_name not in ('admin','superadmin','boss','director','pto') then
   raise exception 'WRITE_ROLE_REQUIRED' using errcode='42501';
 end if;
 if op is null or expected is null or expected < 1 then raise exception 'OPERATION_AND_VERSION_REQUIRED' using errcode='22023'; end if;
 if mode not in ('additional','replacement','resource') or mode is null then raise exception 'COMMAND_INVALID'; end if;
 if nullif(btrim(name),'') is null or nullif(btrim(unit),'') is null or nullif(btrim(reason),'') is null then raise exception 'NAME_UNIT_REASON_REQUIRED'; end if;
 if qty is not null and qty::text in ('NaN','Infinity','-Infinity') then raise exception 'QUANTITY_INVALID'; end if;
 if mode <> 'resource' and qty is null then raise exception 'QUANTITY_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(op::text,0));
 select * into previous from public.t2_addrepl_command where operation_id=op;
 if found then
   if previous.actor_id<>a or previous.kompaniya_id<>c or previous.request<>p_request then raise exception 'OPERATION_CONFLICT' using errcode='23505'; end if;
   return previous.response || '{"takror":true}'::jsonb;
 end if;
 perform 1 from public.t2_obyekt where id=o and kompaniya_id=c for update;
 if not found then raise exception 'OBJECT_ACCESS_DENIED' using errcode='42501'; end if;
 select * into parent from public.t2_qator where id=parent_id and obyekt_id=o and kompaniya_id=c for update;
 if not found then raise exception 'PARENT_NOT_FOUND'; end if;
 if parent.versiya<>expected then raise exception 'STALE_VERSION' using errcode='40001'; end if;
 if old_id=parent_id then raise exception 'REPLACEMENT_PARENT_INVALID'; end if;
 if mode='replacement' then
   select * into old_row from public.t2_qator where id=old_id and obyekt_id=o and kompaniya_id=c for share;
   if not found or old_row.ota_id is distinct from parent_id or old_row.tur='rz' then raise exception 'REPLACEMENT_SCOPE_INVALID'; end if;
   kind := old_row.tur;
 elsif mode='additional' then kind := 'bl';
 else kind := p_request->>'tur';
 end if;
 if kind is null or kind not in ('bl','rs','mat','ob') or
    (kind='bl' and parent.tur<>'rz') or
    (kind<>'bl' and parent.tur not in ('rz','bl')) then raise exception 'TREE_STRUCTURE_INVALID'; end if;
 if evidence is not null and not exists(select 1 from public.t2_obyekt_hujjat where id=evidence and obyekt_id=o) then raise exception 'EVIDENCE_SCOPE_INVALID'; end if;
 if exists(select 1 from public.t2_qator where operation_id=op) then raise exception 'OPERATION_CONFLICT'; end if;
 if after_id is not null then
   select tartib+1 into ordering from public.t2_qator where id=after_id and obyekt_id=o and ota_id=parent_id;
   if not found then raise exception 'ORDERING_SCOPE_INVALID'; end if;
   if exists(select 1 from public.t2_qator where obyekt_id=o and tartib=ordering) then
     raise exception 'ORDERING_GAP_REQUIRED';
   end if;
 else select coalesce(max(tartib),0)+1 into ordering from public.t2_qator where obyekt_id=o;
 end if;
 insert into public.t2_smeta_ozgarish(obyekt_id,kompaniya_id,tur,kind,sabab,holat,evidence_hujjat_id,actor_id,kim,operation_id)
 values(o,c,case when mode='replacement' then 'almashtirish' else 'qoshimcha_ish' end,
   case when mode='replacement' then 'replacement' else 'additional_work' end,reason,'qoralama',evidence,a,'actor:'||a,op)
 returning id into change_id;
 insert into public.t2_qator(obyekt_id,kompaniya_id,ota_id,daraja,tartib,tur,kod,nom,birlik,hajm,
   narx,summa,qoshimcha,zamena,change_type,replaces_line_id,change_id,operation_id,kat)
 values(o,c,parent_id,parent.daraja+1,ordering,kind,p_request->>'kod',name,unit,qty,
   null,null,true,mode='replacement',case when mode='replacement' then 'REPLACEMENT' else 'ADDITIONAL' end,
   case when mode='replacement' then old_id end,change_id,op,
   case when kind<>'bl' then public.t2_kat_birlik(unit,name) end)
 returning id into new_id;
 -- Faqat ota versiyasi yangilanadi; almashtirilayotgan qator mutlaqo o'zgarmaydi.
 update public.t2_qator set yangilandi=clock_timestamp() where id=parent_id;
 perform public.t2_audit_yoz(c,mode||'_create','smeta',o,'qator:'||new_id||'; '||reason,'actor:'||a,null);
 result := jsonb_build_object('ok',true,'qator_id',new_id,'change_id',change_id,'holat','qoralama',
   'parent_version',(select versiya from public.t2_qator where id=parent_id));
 insert into public.t2_addrepl_command values(op,a,c,p_request,result,now());
 return result;
end $fn$;
revoke all on function public.t2_addrepl_execute_v1(jsonb) from public,anon,authenticated;

create function public.t2_qoshimcha_ish_yarat_v1(p_kompaniya_id bigint,p_actor_id bigint,p_obyekt_id bigint,p_ota_qator_id bigint,p_nom text,p_birlik text,p_hajm numeric,p_kod text,p_keyin_qator_id bigint,p_sabab text,p_dalil_hujjat_id bigint,p_operation_id uuid,p_kutilgan_versiya integer) returns jsonb language sql security definer set search_path=public,pg_temp as $fn$
 select public.t2_addrepl_execute_v1(jsonb_build_object('command','additional','kompaniya_id',p_kompaniya_id,'actor_id',p_actor_id,'obyekt_id',p_obyekt_id,'ota_qator_id',p_ota_qator_id,'nom',p_nom,'birlik',p_birlik,'hajm',p_hajm,'kod',p_kod,'keyin_qator_id',p_keyin_qator_id,'sabab',p_sabab,'dalil_hujjat_id',p_dalil_hujjat_id,'operation_id',p_operation_id,'kutilgan_versiya',p_kutilgan_versiya));
$fn$;
revoke all on function public.t2_qoshimcha_ish_yarat_v1(bigint,bigint,bigint,bigint,text,text,numeric,text,bigint,text,bigint,uuid,integer) from public,anon,authenticated;
grant execute on function public.t2_qoshimcha_ish_yarat_v1(bigint,bigint,bigint,bigint,text,text,numeric,text,bigint,text,bigint,uuid,integer) to service_role;

create function public.t2_zamena_ish_yarat_v1(p_kompaniya_id bigint,p_actor_id bigint,p_obyekt_id bigint,p_almashtirilayotgan_qator_id bigint,p_ota_qator_id bigint,p_nom text,p_birlik text,p_hajm numeric,p_kod text,p_keyin_qator_id bigint,p_sabab text,p_dalil_hujjat_id bigint,p_operation_id uuid,p_kutilgan_versiya integer) returns jsonb language sql security definer set search_path=public,pg_temp as $fn$
 select public.t2_addrepl_execute_v1(jsonb_build_object('command','replacement','kompaniya_id',p_kompaniya_id,'actor_id',p_actor_id,'obyekt_id',p_obyekt_id,'almashtirilayotgan_qator_id',p_almashtirilayotgan_qator_id,'ota_qator_id',p_ota_qator_id,'nom',p_nom,'birlik',p_birlik,'hajm',p_hajm,'kod',p_kod,'keyin_qator_id',p_keyin_qator_id,'sabab',p_sabab,'dalil_hujjat_id',p_dalil_hujjat_id,'operation_id',p_operation_id,'kutilgan_versiya',p_kutilgan_versiya));
$fn$;
revoke all on function public.t2_zamena_ish_yarat_v1(bigint,bigint,bigint,bigint,bigint,text,text,numeric,text,bigint,text,bigint,uuid,integer) from public,anon,authenticated;
grant execute on function public.t2_zamena_ish_yarat_v1(bigint,bigint,bigint,bigint,bigint,text,text,numeric,text,bigint,text,bigint,uuid,integer) to service_role;

create function public.t2_resurs_bola_qosh_v1(p_kompaniya_id bigint,p_actor_id bigint,p_obyekt_id bigint,p_ota_qator_id bigint,p_tur text,p_nom text,p_birlik text,p_hajm numeric,p_kod text,p_keyin_qator_id bigint,p_sabab text,p_dalil_hujjat_id bigint,p_operation_id uuid,p_kutilgan_versiya integer) returns jsonb language sql security definer set search_path=public,pg_temp as $fn$
 select public.t2_addrepl_execute_v1(jsonb_build_object('command','resource','kompaniya_id',p_kompaniya_id,'actor_id',p_actor_id,'obyekt_id',p_obyekt_id,'ota_qator_id',p_ota_qator_id,'tur',p_tur,'nom',p_nom,'birlik',p_birlik,'hajm',p_hajm,'kod',p_kod,'keyin_qator_id',p_keyin_qator_id,'sabab',p_sabab,'dalil_hujjat_id',p_dalil_hujjat_id,'operation_id',p_operation_id,'kutilgan_versiya',p_kutilgan_versiya));
$fn$;
revoke all on function public.t2_resurs_bola_qosh_v1(bigint,bigint,bigint,bigint,text,text,text,numeric,text,bigint,text,bigint,uuid,integer) from public,anon,authenticated;
grant execute on function public.t2_resurs_bola_qosh_v1(bigint,bigint,bigint,bigint,text,text,text,numeric,text,bigint,text,bigint,uuid,integer) to service_role;

commit;
