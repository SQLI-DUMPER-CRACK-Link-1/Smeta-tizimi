-- ==============================================================================
-- 08_ish_turi.sql
-- Ish turlari (Spravochnik) jadvali va amallari
-- ==============================================================================

CREATE TABLE IF NOT EXISTS t2_ish_turi (
    id BIGSERIAL PRIMARY KEY,
    kompaniya_id BIGINT NOT NULL,
    kod TEXT NOT NULL,
    nomi TEXT NOT NULL,
    birligi TEXT NOT NULL,
    norma NUMERIC(15,6) DEFAULT 0,
    narx NUMERIC(15,2) DEFAULT 0,
    kategoriya TEXT,
    yaratilgan_vaqt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(kompaniya_id, kod)
);

CREATE OR REPLACE FUNCTION t2_ish_turi_yoz(
    p_kompaniya_id BIGINT,
    p_kod TEXT,
    p_nomi TEXT,
    p_birligi TEXT,
    p_norma NUMERIC,
    p_narx NUMERIC,
    p_kategoriya TEXT,
    p_id BIGINT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_new_id BIGINT;
BEGIN
    IF p_id IS NOT NULL THEN
        UPDATE t2_ish_turi 
        SET kod = p_kod, nomi = p_nomi, birligi = p_birligi, norma = p_norma, narx = p_narx, kategoriya = p_kategoriya
        WHERE id = p_id;
        RETURN jsonb_build_object('ok', true, 'id', p_id);
    ELSE
        INSERT INTO t2_ish_turi (kompaniya_id, kod, nomi, birligi, norma, narx, kategoriya)
        VALUES (p_kompaniya_id, p_kod, p_nomi, p_birligi, p_norma, p_narx, p_kategoriya)
        RETURNING id INTO v_new_id;
        RETURN jsonb_build_object('ok', true, 'id', v_new_id);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
