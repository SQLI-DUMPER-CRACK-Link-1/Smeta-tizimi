-- ==========================================
-- 3. MUSTAQIL RESURSLAR VA MANY-TO-MANY (M:N) BOG'LANISHLARI
-- ==========================================
-- Qoida: Sklad, Kadrlar va Texnika bitta Obyektga to'g'ridan-to'g'ri (obyekt_id) ulanmaydi.
-- Ular umumiy kompaniya doirasida mustaqil yaratiladi va bog'lovchi (Junction) jadvallar
-- orqali bir yoki bir nechta obyektlarga ulanadi.

-- ---------------------------------------------------------
-- 3.1. SKLAD (Mustaqil Ombor)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS t2_sklad_mustaqil (
    id SERIAL PRIMARY KEY,
    kompaniya_id INTEGER NOT NULL,
    nomi TEXT NOT NULL, -- Masalan: "Asosiy Sklad - 32 gektar park uchun"
    manzil TEXT,
    masul_shaxs TEXT,
    holat TEXT DEFAULT 'faol', -- 'bekor' qilinganda o'chirilgan hisoblanadi (Soft Delete)
    yaratilgan_vaqt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Skladni Obyektlarga bog'lash (Junction Table)
CREATE TABLE IF NOT EXISTS t2_sklad_bog (
    id SERIAL PRIMARY KEY,
    sklad_id INTEGER NOT NULL REFERENCES t2_sklad_mustaqil(id) ON DELETE CASCADE,
    obyekt_id INTEGER NOT NULL, -- Obyektlar jadvaliga havola
    boglangangan_vaqt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(sklad_id, obyekt_id)
);

-- Eski t2_sklad_qoldiq va t2_sklad_harakat ni ushbu Sklad ga moslash kerak (obyekt_id o'rniga sklad_id)
-- ALTER TABLE t2_sklad_harakat ADD COLUMN sklad_id INTEGER;

-- ---------------------------------------------------------
-- 3.2. KADRLAR VA DAVOMAT
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS t2_kadr_mustaqil (
    id SERIAL PRIMARY KEY,
    kompaniya_id INTEGER NOT NULL,
    ism_sharif TEXT NOT NULL,
    lavozim TEXT NOT NULL,
    oylik_maosh NUMERIC,
    valyuta TEXT DEFAULT 'UZS',
    holat TEXT DEFAULT 'faol',
    yaratilgan_vaqt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Kadrlarni Obyektlarga bog'lash (Junction Table)
CREATE TABLE IF NOT EXISTS t2_kadr_bog (
    id SERIAL PRIMARY KEY,
    kadr_id INTEGER NOT NULL REFERENCES t2_kadr_mustaqil(id) ON DELETE CASCADE,
    obyekt_id INTEGER NOT NULL,
    boglangangan_vaqt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(kadr_id, obyekt_id)
);

-- ---------------------------------------------------------
-- 3.3. TEXNIKA BAZASI
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS t2_texnika_mustaqil (
    id SERIAL PRIMARY KEY,
    kompaniya_id INTEGER NOT NULL,
    nomi TEXT NOT NULL,
    davlat_raqami TEXT,
    yoqilgi_mejori NUMERIC, -- 1 soat/km uchun yoqilg'i sarfi
    holat TEXT DEFAULT 'faol',
    yaratilgan_vaqt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Texnikani Obyektlarga bog'lash (Junction Table)
CREATE TABLE IF NOT EXISTS t2_texnika_bog (
    id SERIAL PRIMARY KEY,
    texnika_id INTEGER NOT NULL REFERENCES t2_texnika_mustaqil(id) ON DELETE CASCADE,
    obyekt_id INTEGER NOT NULL,
    boglangangan_vaqt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(texnika_id, obyekt_id)
);
