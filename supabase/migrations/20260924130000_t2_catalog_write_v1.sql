begin;
-- Observation identity/provenance. Narx qiymatlari bu qatlamda saqlanmaydi.
alter table public.t2_work_type_observation add column source_line_key text;
alter table public.t2_resource_observation add column source_line_key text;
create table public.t2_catalog_ingest_command(
 operation_id uuid primary key, actor_id bigint not null, company_id bigint not null,
 request_hash text not null, response jsonb not null, created_at timestamptz not null default now()
);
alter table public.t2_catalog_ingest_command enable row level security;
revoke all on public.t2_catalog_ingest_command from public,anon,authenticated;
create index t2_ish_turi_identity_exact_ix on public.t2_ish_turi
 (kompaniya_id, lower(regexp_replace(btrim(kod),'\s+',' ','g')),
 lower(regexp_replace(btrim(nomi),'\s+',' ','g')),lower(regexp_replace(btrim(birligi),'\s+',' ','g')));
create function public.t2_catalog_observation_yoz_v1(
 p_kompaniya_id bigint,p_actor_id bigint,p_scope jsonb,p_observations jsonb,p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare
 o bigint := (p_scope->>'objectId')::bigint;
 project bigint := (p_scope->>'projectId')::bigint;
 doc bigint := (p_scope->>'documentId')::bigint;
 revision bigint := (p_scope->>'revisionId')::bigint;
 source text := p_scope->>'sourceType';
 x jsonb; prior public.t2_catalog_ingest_command%rowtype;
 fingerprint text := md5(jsonb_build_array(p_scope,p_observations)::text);
 observation bigint; candidates bigint; candidate_code text; linked integer:=0; pending integer:=0; result jsonb;
 role_name text;
begin
 role_name:=public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id,p_actor_id);
 if role_name not in ('admin','superadmin','boss','director','pto') then raise exception 'WRITE_ROLE_REQUIRED' using errcode='42501'; end if;
 if p_operation_id is null then raise exception 'OPERATION_ID_REQUIRED'; end if;
 if (p_scope->>'companyId')::bigint is distinct from p_kompaniya_id or source is null or source not in ('smeta','f2','other') then raise exception 'SCOPE_INVALID'; end if;
 if not exists(select 1 from public.t2_obyekt where id=o and kompaniya_id=p_kompaniya_id and (project is null or loyiha_id=project)) then raise exception 'OBJECT_ACCESS_DENIED' using errcode='42501'; end if;
 if doc is not null then
   if source='smeta' and not exists(select 1 from public.t2_manba where id=doc and obyekt_id=o and kompaniya_id=p_kompaniya_id) then raise exception 'DOCUMENT_SCOPE_INVALID'; end if;
   if source='f2' and not exists(select 1 from public.t2_akt where id=doc and obyekt_id=o) then raise exception 'DOCUMENT_SCOPE_INVALID'; end if;
   if source='other' then raise exception 'OTHER_DOCUMENT_CONTRACT_REQUIRED'; end if;
 end if;
 if revision is not null and not exists(select 1 from public.t2_smeta_revision where id=revision and obyekt_id=o and kompaniya_id=p_kompaniya_id) then raise exception 'REVISION_SCOPE_INVALID'; end if;
 if jsonb_typeof(p_observations) is distinct from 'array' then raise exception 'OBSERVATIONS_REQUIRED'; end if;
 if jsonb_array_length(p_observations) not between 1 and 1000 then raise exception 'BATCH_LIMIT_1000'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,0));
 select * into prior from public.t2_catalog_ingest_command where operation_id=p_operation_id;
 if found then
   if prior.actor_id<>p_actor_id or prior.company_id<>p_kompaniya_id or prior.request_hash<>fingerprint then raise exception 'OPERATION_CONFLICT' using errcode='23505'; end if;
   return prior.response||'{"takror":true}'::jsonb;
 end if;
 if exists(select 1 from jsonb_array_elements(p_observations) z group by z->>'kind',z->>'sourceLineKey' having count(*)>1) then raise exception 'DUPLICATE_SOURCE_LINE'; end if;
 for x in select value from jsonb_array_elements(p_observations) loop
   if x->'scope' is distinct from p_scope then raise exception 'OBSERVATION_SCOPE_MISMATCH' using errcode='42501'; end if;
   if x->>'kind' is null or x->>'kind' not in ('work_type','resource') or nullif(btrim(x->>'name'),'') is null or nullif(btrim(x->>'sourceLineKey'),'') is null then raise exception 'OBSERVATION_INVALID'; end if;
   if x->>'kind'='resource' and (x->>'resourceKind' is null or x->>'resourceKind' not in ('labor','machine','material','equipment','other')) then raise exception 'RESOURCE_KIND_INVALID'; end if;
 end loop;
 for x in select value from jsonb_array_elements(p_observations) loop
   candidates:=0; candidate_code:=null;
   if x->>'kind'='work_type' then
     insert into public.t2_work_type_observation(company_id,project_id,object_id,document_id,revision_id,source_line_key,code,name,unit,source_type)
     values(p_kompaniya_id,project,o,doc,revision,x->>'sourceLineKey',x->>'code',x->>'name',x->>'unit',source) returning id into observation;
     if nullif(btrim(x->>'code'),'') is not null and nullif(btrim(x->>'unit'),'') is not null then
       select count(*),min(kod) into candidates,candidate_code from public.t2_ish_turi
       where kompaniya_id=p_kompaniya_id
         and lower(regexp_replace(btrim(kod),'\s+',' ','g'))=lower(regexp_replace(btrim(x->>'code'),'\s+',' ','g'))
         and lower(regexp_replace(btrim(nomi),'\s+',' ','g'))=lower(regexp_replace(btrim(x->>'name'),'\s+',' ','g'))
         and lower(regexp_replace(btrim(birligi),'\s+',' ','g'))=lower(regexp_replace(btrim(x->>'unit'),'\s+',' ','g'));
     end if;
   else
     insert into public.t2_resource_observation(company_id,project_id,object_id,document_id,revision_id,source_line_key,resource_kind,code,name,unit,source_type)
     values(p_kompaniya_id,project,o,doc,revision,x->>'sourceLineKey',x->>'resourceKind',x->>'code',x->>'name',x->>'unit',source) returning id into observation;
     -- t2_narx va material_alias'da CODE yo'q. Exact uchlikni isbotlab bo'lmaydi.
     -- Ularning narxini yoki taxminiy kodini bu yerga ko'chirish taqiqlanadi.
   end if;
   insert into public.t2_catalog_match_candidate(company_id,observation_type,observation_id,candidate_canonical_kod,holat,confidence)
   values(p_kompaniya_id,x->>'kind',observation,case when candidates=1 then candidate_code end,
     case when candidates=1 then 'tasdiqlangan' else 'kutmoqda' end,case when candidates=1 then 1 end);
   if candidates=1 then linked:=linked+1; else pending:=pending+1; end if;
 end loop;
 result:=jsonb_build_object('ok',true,'written',linked+pending,'auto_linked',linked,'pending',pending,'prices_stored',false);
 perform public.t2_audit_yoz(p_kompaniya_id,'catalog_observation_yoz_v1','catalog',o,'observations:'||(linked+pending),'actor:'||p_actor_id,null);
 insert into public.t2_catalog_ingest_command values(p_operation_id,p_actor_id,p_kompaniya_id,fingerprint,result,now());
 return result;
end $fn$;
revoke all on function public.t2_catalog_observation_yoz_v1(bigint,bigint,jsonb,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.t2_catalog_observation_yoz_v1(bigint,bigint,jsonb,jsonb,uuid) to service_role;
commit;
