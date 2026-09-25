-- ROLLBACK T2_OBYEKT_NAKRUTKA_KAB_MK — eski ta'rif (КАБ/М/К hisobga olinmagan). Ustunlar kamaygani uchun drop + create.
begin;
drop view public.t2_obyekt_nakrutka;
create view public.t2_obyekt_nakrutka as
 WITH kat AS NOT MATERIALIZED (
         SELECT t2_qator.obyekt_id,
            COALESCE(sum(t2_qator.summa) FILTER (WHERE t2_qator.kat = 'ЧЕЛ'::text), 0::numeric) AS chel,
            COALESCE(sum(t2_qator.summa) FILTER (WHERE t2_qator.kat = 'МАШ'::text), 0::numeric) AS mash,
            COALESCE(sum(t2_qator.summa) FILTER (WHERE t2_qator.kat = 'МАТ'::text), 0::numeric) AS mat,
            COALESCE(sum(t2_qator.summa) FILTER (WHERE t2_qator.kat = 'ОБ'::text), 0::numeric) AS ob
           FROM t2_qator
          WHERE t2_qator.tur = ANY (ARRAY['rs'::text, 'mat'::text, 'ob'::text])
          GROUP BY t2_qator.obyekt_id
        ), bog AS (
         SELECT t2_shartnoma_bog.obyekt_id,
            t2_shartnoma_bog.shartnoma_id
           FROM t2_shartnoma_bog
        ), nk_shartnoma AS (
         SELECT ob.obyekt_id,
            ob.shartnoma_id,
            jsonb_object_agg(n.koef, n.qiymat) AS nk
           FROM bog ob
             JOIN t2_nakrutka n ON n.shartnoma_id = ob.shartnoma_id
          GROUP BY ob.obyekt_id, ob.shartnoma_id
        ), nk_default AS (
         SELECT o.id AS obyekt_id,
            jsonb_object_agg(n.koef, n.qiymat) AS nk
           FROM t2_obyekt o
             JOIN t2_nakrutka n ON n.kompaniya_id = o.kompaniya_id AND n.shartnoma_id IS NULL
          GROUP BY o.id
        ), resolved AS NOT MATERIALIZED (
         SELECT k_1.obyekt_id,
            bog.shartnoma_id,
            COALESCE(nks.nk, nkd.nk, '{}'::jsonb) AS nk
           FROM kat k_1
             LEFT JOIN bog ON bog.obyekt_id = k_1.obyekt_id
             LEFT JOIN nk_shartnoma nks ON nks.obyekt_id = k_1.obyekt_id
             LEFT JOIN nk_default nkd ON nkd.obyekt_id = k_1.obyekt_id
        )
 SELECT k.obyekt_id,
    r.shartnoma_id,
    k.chel,
    k.mash,
    k.mat,
    k.ob,
    (hh.h ->> 'pryamye'::text)::numeric AS pryamye,
    (hh.h ->> 'tr_mat'::text)::numeric AS tr_mat,
    (hh.h ->> 'skl_mat'::text)::numeric AS skl_mat,
    (hh.h ->> 'tr_kab'::text)::numeric AS tr_kab,
    (hh.h ->> 'itogo1'::text)::numeric AS itogo1,
    (hh.h ->> 'prochie'::text)::numeric AS prochie,
    (hh.h ->> 'itogo2'::text)::numeric AS itogo2,
    (hh.h ->> 'tr_ob'::text)::numeric AS tr_ob,
    (hh.h ->> 'zag_ob'::text)::numeric AS zag_ob,
    (hh.h ->> 'itogo3'::text)::numeric AS itogo3,
    (hh.h ->> 'strax'::text)::numeric AS strax,
    (hh.h ->> 'risk'::text)::numeric AS risk,
    (hh.h ->> 'itogo4'::text)::numeric AS itogo4,
    (hh.h ->> 'nds'::text)::numeric AS nds,
    (hh.h ->> 'vsego'::text)::numeric AS vsego,
    (kk.kf ->> 'ЧЕЛ'::text)::numeric AS kf_chel,
    (kk.kf ->> 'МАШ'::text)::numeric AS kf_mash,
    (kk.kf ->> 'МАТ'::text)::numeric AS kf_mat,
    (kk.kf ->> 'ОБ'::text)::numeric AS kf_ob,
    (kk.kf ->> 'М/К'::text)::numeric AS kf_mk,
    (kk.kf ->> 'КАБ'::text)::numeric AS kf_kab,
    (kk.kf ->> 'БЕЗСКЛАД'::text)::numeric AS kf_bezsklad
   FROM kat k
     JOIN resolved r ON r.obyekt_id = k.obyekt_id
     CROSS JOIN LATERAL ( SELECT t2_nakrutka_hisob(k.chel, k.mash, k.mat, k.ob, 0::numeric, 0::numeric, 0::numeric, r.nk) AS h) hh
     CROSS JOIN LATERAL ( SELECT t2_nakrutka_koef(r.nk) AS kf) kk;
grant all on public.t2_obyekt_nakrutka to anon, authenticated, service_role;
commit;
