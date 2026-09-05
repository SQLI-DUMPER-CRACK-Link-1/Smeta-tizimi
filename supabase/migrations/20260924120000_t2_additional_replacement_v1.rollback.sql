begin;
do $$ begin
 if exists(select 1 from public.t2_addrepl_command) then raise exception 'PRE_USE_ROLLBACK_ONLY'; end if;
end $$;
drop function public.t2_qoshimcha_ish_yarat_v1(bigint,bigint,bigint,bigint,text,text,numeric,text,bigint,text,bigint,uuid,integer);
drop function public.t2_zamena_ish_yarat_v1(bigint,bigint,bigint,bigint,bigint,text,text,numeric,text,bigint,text,bigint,uuid,integer);
drop function public.t2_resurs_bola_qosh_v1(bigint,bigint,bigint,bigint,text,text,text,numeric,text,bigint,text,bigint,uuid,integer);
drop function public.t2_addrepl_execute_v1(jsonb);
drop table public.t2_addrepl_command;
commit;
