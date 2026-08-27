-- ==============================================================================
-- 09_qator_holat.sql
-- F2 (akt) lar bo'yicha har bir qatorning joriy holatini (fakt va qoldiq) hisoblab beruvchi view
-- ==============================================================================

-- Barcha tasdiqlangan (holat='tasdiqlangan' yoki shunga o'xshash, lekin biz soddalashtirib
-- is_deleted=false bo'lgan aktlarga qaraymiz) aktlardagi obyomlarni qatorlar bo'yicha jamlash

CREATE OR REPLACE VIEW t2_qator_holat AS
SELECT 
    q.id AS qator_id,
    q.obyekt_id,
    COALESCE(SUM(aq.hajm), 0) AS fakt_hajm,
    COALESCE(SUM(aq.narx * aq.hajm), 0) AS fakt_summa,
    (q.hajm - COALESCE(SUM(aq.hajm), 0)) AS qoldiq_hajm,
    ((q.hajm * q.narx) - COALESCE(SUM(aq.narx * aq.hajm), 0)) AS qoldiq_summa
FROM t2_qator q
LEFT JOIN t2_akt_qator aq ON aq.qator_id = q.id 
LEFT JOIN t2_akt a ON a.id = aq.akt_id AND a.is_deleted = false AND (a.holat = 'tasdiqlangan' OR a.holat IS NULL)
WHERE q.is_deleted = false
GROUP BY q.id, q.obyekt_id, q.hajm, q.narx;

-- O'qish huquqlarini berish
GRANT SELECT ON t2_qator_holat TO anon, authenticated;
