begin;
do $test$
declare c bigint; a bigint; o bigint; scope jsonb; obs jsonb; r jsonb; op uuid:=gen_random_uuid(); before_count bigint;
begin
 insert into public.t2_kompaniya(nom,kod) values('_TEST_CATALOG_',gen_random_uuid()::text) returning id into c;
 insert into public.t2_foydalanuvchi(login) values('_TEST_CATALOG_'||gen_random_uuid()) returning id into a;
 insert into public.t2_azolik(foydalanuvchi_id,kompaniya_id,rol) values(a,c,'pto');
 insert into public.t2_obyekt(nom,kompaniya_id) values('_TEST_CATALOG_',c) returning id into o;
 insert into public.t2_ish_turi(kompaniya_id,kod,nomi,birligi) values(c,'W1','Beton ishlari','m3');
 scope:=jsonb_build_object('companyId',c,'objectId',o,'sourceType','smeta');
 obs:=jsonb_build_array(
 jsonb_build_object('scope',scope,'kind','work_type','sourceLineKey','uid:work','code','W1','name','Beton ishlari','unit','m3','sourcePrice',150000),
 jsonb_build_object('scope',scope,'kind','resource','resourceKind','material','sourceLineKey','uid:material','code','M1','name','Beton','unit','m3','sourcePrice',999999));
 r:=public.t2_catalog_observation_yoz_v1(c,a,scope,obs,op);
 if (r->>'written')::int<>2 or (r->>'auto_linked')::int<>1 or (r->>'pending')::int<>1 or (r->>'prices_stored')::boolean then raise exception 'CATALOG_RESULT_FAILED'; end if;
 if not (public.t2_catalog_observation_yoz_v1(c,a,scope,obs,op)->>'takror')::boolean then raise exception 'REPLAY_FAILED'; end if;
 if (select count(*) from public.t2_work_type_observation where company_id=c)<>1 then raise exception 'DUPLICATE_WRITE'; end if;
 begin perform public.t2_catalog_observation_yoz_v1(c,a,scope,obs||obs,gen_random_uuid()); raise exception 'DUPLICATE_NOT_BLOCKED'; exception when raise_exception then if sqlerrm<>'DUPLICATE_SOURCE_LINE' then raise; end if; end;
 begin perform public.t2_catalog_observation_yoz_v1(c,a,scope,jsonb_build_array((obs->0)||jsonb_build_object('scope',scope||'{"companyId":0}'::jsonb)),gen_random_uuid()); raise exception 'TENANT_NOT_BLOCKED'; exception when insufficient_privilege then null; end;
 if exists(select 1 from public.t2_narx where kompaniya_id=c) then raise exception 'PRICE_LEAK'; end if;
 update public.t2_azolik set holat='bekor' where kompaniya_id=c and foydalanuvchi_id=a;
 begin perform public.t2_catalog_observation_yoz_v1(c,a,scope,obs,op); raise exception 'REVOKE_NOT_BLOCKED'; exception when insufficient_privilege then null; end;
end $test$;

rollback;
