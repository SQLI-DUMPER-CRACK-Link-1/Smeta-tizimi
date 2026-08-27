-- ==============================================================================
-- 08_sklad_yaxshilanishi.sql
-- Sklad uchun nomlar taklifi view (avtocompletion)
-- ==============================================================================

CREATE OR REPLACE VIEW v_sklad_nomlar AS
SELECT DISTINCT nomi, birligi, turi
FROM (
  SELECT nomi, birligi, 'mat' as turi FROM t2_sklad_qoldiq
  UNION
  SELECT nom as nomi, birlik as birligi, tur as turi FROM t2_qator WHERE tur = 'mat'
) s;
