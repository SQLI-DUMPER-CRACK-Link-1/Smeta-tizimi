-- Behavioral acceptance for COMPANY/AUTH/DIRECTOR P0.
-- Run INSIDE a transaction that is ROLLED BACK — writes nothing permanent.
--   begin; \i 20260905120000_t2_company_onboarding_v1.acceptance.sql  rollback;

do $$
declare
  v jsonb; v_new_user bigint; v_co1 bigint; v_co2 bigint; v_op uuid := gen_random_uuid();
  v_member_azolik bigint; v_dir2 bigint;
begin
  -- fresh user, never a member
  insert into public.t2_foydalanuvchi (login, holat) values ('acc_newuser_'||gen_random_uuid(), 'faol')
    returning id into v_new_user;

  -- 1. P0: login registration must NOT auto-join any company
  v := public.t2_kirish_royxatga_ol((select login from public.t2_foydalanuvchi where id=v_new_user), 'boss', null);
  if jsonb_array_length(v->'azoliklar') <> 0 then
    raise exception 'FAIL P0: new user auto-joined companies: %', v;
  end if;

  -- 2. t2_men_v1 reports onboarding needed
  v := public.t2_men_v1(v_new_user);
  if (v->>'ok') <> 'true' or (v->>'onboarding_kerak') <> 'true' or (v->>'jami') <> '0' then
    raise exception 'FAIL t2_men_v1 onboarding state: %', v;
  end if;

  -- 3. self-service company creation -> creator is director (boss)
  v := public.t2_kompaniya_yarat_v1(v_new_user, 'Acc Test Qurilish', '123456789', '+998900000000', v_op);
  if (v->>'ok') <> 'true' or (v->>'rol') <> 'boss' then raise exception 'FAIL kompaniya_yarat: %', v; end if;
  v_co1 := (v->>'kompaniya_id')::bigint;

  -- 4. idempotent replay of company creation
  v := public.t2_kompaniya_yarat_v1(v_new_user, 'Acc Test Qurilish', '123456789', '+998900000000', v_op);
  if (v->>'kompaniya_id')::bigint <> v_co1 then raise exception 'FAIL kompaniya_yarat idempotency: %', v; end if;
  if (select count(*) from public.t2_kompaniya where nom='Acc Test Qurilish') <> 1 then
    raise exception 'FAIL kompaniya_yarat double insert';
  end if;

  -- 5. now t2_men_v1 shows one director membership
  v := public.t2_men_v1(v_new_user);
  if (v->>'jami') <> '1' or (v->'azoliklar'->0->>'is_director') <> 'true' then
    raise exception 'FAIL t2_men_v1 after create: %', v;
  end if;

  -- 6. a second, unrelated company (created by the same actor for the test)
  v := public.t2_kompaniya_yarat_v1(v_new_user, 'Acc Test Ikki', null, null, gen_random_uuid());
  v_co2 := (v->>'kompaniya_id')::bigint;
  v_dir2 := (v->>'azolik_id')::bigint;

  -- 7. director adds a member by login; superadmin grant is refused
  v := public.t2_azolik_qosh_v1(v_new_user, v_co1, 'acc_member_'||v_co1, 'superadmin', null, null, gen_random_uuid());
  if (v->>'code') <> 'ROLE_INVALID' then raise exception 'FAIL superadmin grant not blocked: %', v; end if;
  v := public.t2_azolik_qosh_v1(v_new_user, v_co1, 'acc_member_'||v_co1, 'prorab', null, 'Ali', gen_random_uuid());
  if (v->>'ok') <> 'true' then raise exception 'FAIL azolik_qosh: %', v; end if;
  v_member_azolik := (v->>'azolik_id')::bigint;

  -- 8. duplicate add rejected
  v := public.t2_azolik_qosh_v1(v_new_user, v_co1, 'acc_member_'||v_co1, 'prorab', null, null, gen_random_uuid());
  if (v->>'code') <> 'ALREADY_MEMBER' then raise exception 'FAIL duplicate member: %', v; end if;

  -- 9. a non-member actor cannot manage company members
  begin
    v := public.t2_azolik_qosh_v1(v_new_user + 999999, v_co1, 'acc_x', 'prorab', null, null, gen_random_uuid());
    if (v->>'ok') = 'true' then raise exception 'FAIL non-member could add: %', v; end if;
  exception when others then if sqlstate <> '42501' then raise; end if;
  end;

  -- 10. cannot demote / remove the last director of a company
  v := public.t2_azolik_rol_ozgartir_v1(v_new_user, v_dir2, 'prorab', gen_random_uuid());
  if (v->>'code') <> 'LAST_DIRECTOR' then raise exception 'FAIL last-director demote guard: %', v; end if;
  v := public.t2_azolik_ochir_v1(v_new_user, v_dir2, gen_random_uuid());
  if (v->>'code') <> 'LAST_DIRECTOR' then raise exception 'FAIL last-director remove guard: %', v; end if;

  -- 11. a normal member CAN be role-changed and soft-removed
  v := public.t2_azolik_rol_ozgartir_v1(v_new_user, v_member_azolik, 'bugalter', gen_random_uuid());
  if (v->>'ok') <> 'true' then raise exception 'FAIL member role change: %', v; end if;
  v := public.t2_azolik_ochir_v1(v_new_user, v_member_azolik, gen_random_uuid());
  if (v->>'ok') <> 'true' or (v->>'holat') <> 'bekor' then raise exception 'FAIL member soft-remove: %', v; end if;

  -- 12. operation_id required on every command
  v := public.t2_kompaniya_yarat_v1(v_new_user, 'X', null, null, null);
  if (v->>'code') <> 'OPERATION_ID_REQUIRED' then raise exception 'FAIL op_id required: %', v; end if;

  raise exception 'ONBOARDING_ACCEPTANCE_PASS';
end $$;
