begin;
do $test$
declare c bigint; a bigint; o bigint; parent bigint; oldline bigint; newwork bigint; r jsonb; req jsonb; snap jsonb; op uuid:=gen_random_uuid();
begin
 insert into public.t2_kompaniya(nom,kod) values('_TEST_ADDREPL_',gen_random_uuid()::text) returning id into c;
 insert into public.t2_foydalanuvchi(login) values('_TEST_ADDREPL_'||gen_random_uuid()) returning id into a;
 insert into public.t2_azolik(foydalanuvchi_id,kompaniya_id,rol) values(a,c,'pto');
 insert into public.t2_obyekt(nom,kompaniya_id) values('_TEST_ADDREPL_',c) returning id into o;
 insert into public.t2_qator(obyekt_id,kompaniya_id,tur,nom,tartib) values(o,c,'rz','_TEST_ADDREPL_',1) returning id into parent;
 insert into public.t2_qator(obyekt_id,kompaniya_id,ota_id,tur,nom,birlik,hajm,tartib) values(o,c,parent,'bl','_TEST_ADDREPL_old','m3',10,2) returning id into oldline;
 select to_jsonb(q) into snap from public.t2_qator q where id=oldline;
 req:=jsonb_build_object('command','additional','kompaniya_id',c,'actor_id',a,'obyekt_id',o,'ota_qator_id',parent,'nom','_TEST_ADDREPL_new','birlik','m3','hajm',10,'sabab','test','operation_id',op,'kutilgan_versiya',1);
 r:=public.t2_addrepl_execute_v1(req); newwork:=(r->>'qator_id')::bigint;
 if not (r->>'ok')::boolean then raise exception 'ADDITIONAL_FAILED'; end if;
 if not (public.t2_addrepl_execute_v1(req)->>'takror')::boolean then raise exception 'REPLAY_FAILED'; end if;
 begin perform public.t2_addrepl_execute_v1(req||jsonb_build_object('nom','other')); raise exception 'CONFLICT_NOT_BLOCKED'; exception when unique_violation then null; end;
 begin perform public.t2_addrepl_execute_v1(req||jsonb_build_object('operation_id',gen_random_uuid())); raise exception 'STALE_NOT_BLOCKED'; exception when serialization_failure then null; end;
 r:=public.t2_zamena_ish_yarat_v1(c,a,o,oldline,parent,'_TEST_ADDREPL_replacement','m3',12,null,null,'test',null,gen_random_uuid(),(select versiya from public.t2_qator where id=parent));
 if (select replaces_line_id from public.t2_qator where id=(r->>'qator_id')::bigint)<>oldline then raise exception 'RELATION_FAILED'; end if;
 if snap is distinct from (select to_jsonb(q) from public.t2_qator q where id=oldline) then raise exception 'OLD_CHANGED'; end if;
 r:=public.t2_resurs_bola_qosh_v1(c,a,o,newwork,'rs','_TEST_ADDREPL_child','h',null,null,null,'test',null,gen_random_uuid(),1);
 if (select hajm from public.t2_qator where id=(r->>'qator_id')::bigint) is not null then raise exception 'UNKNOWN_QTY_FABRICATED'; end if;
 update public.t2_azolik set holat='bekor' where kompaniya_id=c and foydalanuvchi_id=a;
 begin perform public.t2_addrepl_execute_v1(req); raise exception 'REVOKE_NOT_BLOCKED'; exception when insufficient_privilege then null; end;
end $test$;

rollback;
