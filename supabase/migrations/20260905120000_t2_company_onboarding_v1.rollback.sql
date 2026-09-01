-- Rollback for 20260905120000_t2_company_onboarding_v1.sql
-- Restores the ORIGINAL t2_kirish_royxatga_ol (incl. its auto-join-all behaviour)
-- and drops every function/table this migration introduced.
-- Membership rows created via the new commands are NOT deleted (real business data);
-- only the code paths are reverted.
begin;

drop function if exists public.t2_royxat_sorov_qabul_v2(bigint,text,text,text,text,text);
drop function if exists public.t2_azolik_ochir_v1(bigint,bigint,uuid);
drop function if exists public.t2_azolik_rol_ozgartir_v1(bigint,bigint,text,uuid);
drop function if exists public.t2_azolik_qosh_v1(bigint,bigint,text,text,text,text,uuid);
drop function if exists public.t2_azo_actor_director_tekshir(bigint,bigint);
drop function if exists public.t2_men_v1(bigint);
drop function if exists public.t2_kompaniya_yarat_v1(bigint,text,text,text,uuid);
drop function if exists public.t2_kompaniya_kod_yasa(text,bigint);
drop table if exists public.t2_onboarding_command_log;

-- original body (pre-2026-09) restored verbatim
create or replace function public.t2_kirish_royxatga_ol(p_login text, p_rol text, p_email text default null)
returns jsonb language plpgsql security definer as $$
DECLARE v_id bigint; v_azolik_soni integer; v_komp jsonb;
BEGIN
  INSERT INTO t2_foydalanuvchi (login, email)
  VALUES (p_login, p_email)
  ON CONFLICT (login) DO UPDATE SET email = coalesce(EXCLUDED.email, t2_foydalanuvchi.email)
  RETURNING id INTO v_id;

  SELECT count(*) INTO v_azolik_soni FROM t2_azolik WHERE foydalanuvchi_id = v_id AND holat = 'faol';

  IF v_azolik_soni = 0 THEN
    INSERT INTO t2_azolik (foydalanuvchi_id, kompaniya_id, rol)
    SELECT v_id, k.id, p_rol FROM t2_kompaniya k WHERE k.faol = true;
  END IF;

  SELECT jsonb_agg(jsonb_build_object('kompaniya_id', a.kompaniya_id, 'rol', a.rol))
    INTO v_komp
  FROM t2_azolik a WHERE a.foydalanuvchi_id = v_id AND a.holat = 'faol';

  RETURN jsonb_build_object('ok', true, 'foydalanuvchi_id', v_id, 'azoliklar', coalesce(v_komp, '[]'::jsonb));
END; $$;

commit;
