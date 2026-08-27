-- ==========================================
-- 1. ERP JADVALLARI (Kadrlar, Texnika, Ta'minot, Sifat)
-- ==========================================

-- Kadrlar
CREATE TABLE IF NOT EXISTS t2_erp_kadr (
    id SERIAL PRIMARY KEY,
    kompaniya_id INTEGER NOT NULL,
    obyekt_id INTEGER,
    ism TEXT NOT NULL,
    lavozim TEXT,
    oylik_maosh NUMERIC,
    status TEXT DEFAULT 'ishda',
    yaratilgan_vaqt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Texnika
CREATE TABLE IF NOT EXISTS t2_erp_texnika (
    id SERIAL PRIMARY KEY,
    kompaniya_id INTEGER NOT NULL,
    obyekt_id INTEGER,
    texnika_nomi TEXT NOT NULL,
    raqam TEXT,
    holat TEXT DEFAULT 'ishchi',
    yoqilgi_sarfi NUMERIC,
    yaratilgan_vaqt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ta'minot
CREATE TABLE IF NOT EXISTS t2_erp_taminot (
    id SERIAL PRIMARY KEY,
    kompaniya_id INTEGER NOT NULL,
    obyekt_id INTEGER,
    buyurtma_raqami TEXT,
    maxsulot TEXT NOT NULL,
    miqdor NUMERIC NOT NULL,
    birlik TEXT,
    holat TEXT DEFAULT 'kutilmoqda',
    yaratilgan_vaqt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sifat (Texnadzor)
CREATE TABLE IF NOT EXISTS t2_erp_sifat (
    id SERIAL PRIMARY KEY,
    kompaniya_id INTEGER NOT NULL,
    obyekt_id INTEGER,
    inspektor TEXT NOT NULL,
    xulosa TEXT,
    kamchiliklar TEXT,
    yaratilgan_vaqt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ERP Dashboard VIEW lari (frontend shularni o'qiydi)
CREATE OR REPLACE VIEW v_erp_kadrlar_dashboard AS
SELECT id, kompaniya_id, obyekt_id, ism, lavozim, oylik_maosh, status
FROM t2_erp_kadr;

CREATE OR REPLACE VIEW v_erp_texnika_dashboard AS
SELECT id, kompaniya_id, obyekt_id, texnika_nomi, raqam, holat, yoqilgi_sarfi
FROM t2_erp_texnika;

CREATE OR REPLACE VIEW v_erp_taminot_dashboard AS
SELECT id, kompaniya_id, obyekt_id, buyurtma_raqami, maxsulot, miqdor, birlik, holat
FROM t2_erp_taminot;

CREATE OR REPLACE VIEW v_erp_sifat_dashboard AS
SELECT id, kompaniya_id, obyekt_id, inspektor, xulosa, kamchiliklar, yaratilgan_vaqt AS tekshiruv_sana
FROM t2_erp_sifat;

-- ==========================================
-- 2. AUDIT LOGLAR JADVALI
-- ==========================================

CREATE TABLE IF NOT EXISTS t2_audit_log (
    id SERIAL PRIMARY KEY,
    kompaniya_id INTEGER NOT NULL,
    obyekt_id INTEGER,
    shaxs_id INTEGER,
    shaxs_ismi TEXT,
    amal_turi TEXT NOT NULL,
    modul TEXT NOT NULL,
    tafsilot TEXT,
    ip_manzil TEXT,
    yaratilgan_vaqt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE OR REPLACE VIEW v_audit_logs AS
SELECT id, kompaniya_id, obyekt_id, shaxs_ismi AS user, amal_turi AS action, modul AS source, tafsilot AS details, ip_manzil AS ip, yaratilgan_vaqt AS date
FROM t2_audit_log
ORDER BY yaratilgan_vaqt DESC;
