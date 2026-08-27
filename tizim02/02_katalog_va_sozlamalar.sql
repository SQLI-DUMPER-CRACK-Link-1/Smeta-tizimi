-- ==========================================
-- 1. RESURSLAR KATALOGI (Sobiq 'Spravochnik')
-- ==========================================

CREATE TABLE IF NOT EXISTS t2_resurs_katalog (
    id SERIAL PRIMARY KEY,
    kompaniya_id INTEGER NOT NULL,
    kategoriya TEXT NOT NULL, -- Masalan: 'Material', 'Texnika', 'Ish_Kuchi'
    kod TEXT,
    nomi TEXT NOT NULL,
    olchov_birligi TEXT,
    bazaviy_narx NUMERIC,
    valyuta TEXT DEFAULT 'UZS',
    yaratilgan_vaqt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 2. TIZIM SOZLAMALARI (Settings)
-- ==========================================

CREATE TABLE IF NOT EXISTS t2_kompaniya_sozlamalar (
    kompaniya_id INTEGER PRIMARY KEY,
    avto_sinxronizatsiya BOOLEAN DEFAULT true,
    qattiq_nazorat_rejimi BOOLEAN DEFAULT false,
    standart_valyuta TEXT DEFAULT 'UZS',
    tahrirlangan_vaqt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE OR REPLACE VIEW v_resurslar_katalogi AS
SELECT id, kompaniya_id, kategoriya, kod, nomi, olchov_birligi, bazaviy_narx, valyuta
FROM t2_resurs_katalog;
