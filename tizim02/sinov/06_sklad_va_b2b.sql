-- =========================================================================
-- TIZIM_02: Sklad, Faktura va B2B Birja uchun Jadvallar va RPC lar
-- Ushbu skript Antigravity tomonidan yaratilgan UI lar ishlashi uchun kerak.
-- =========================================================================

-- 1. Sklad Qoldiqlari
CREATE TABLE IF NOT EXISTS t2_sklad_qoldiq (
    id BIGSERIAL PRIMARY KEY,
    kompaniya_id BIGINT NOT NULL,
    obyekt_id BIGINT NOT NULL,
    nomi TEXT NOT NULL,
    birligi TEXT NOT NULL,
    qoldiq NUMERIC(15,4) DEFAULT 0,
    oxirgi_harakat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(obyekt_id, nomi)
);

-- 2. Sklad Harakatlari (Tarix)
CREATE TABLE IF NOT EXISTS t2_sklad_harakat (
    id BIGSERIAL PRIMARY KEY,
    kompaniya_id BIGINT NOT NULL,
    obyekt_id BIGINT NOT NULL,
    operatsiya TEXT NOT NULL CHECK (operatsiya IN ('prixod', 'rasxod')),
    turi TEXT,
    sana DATE NOT NULL,
    nomi TEXT NOT NULL,
    birligi TEXT NOT NULL,
    obyomi NUMERIC(15,4) NOT NULL,
    yaratilgan_vaqt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. B2B Birja RFQ (So'rovlar)
CREATE TABLE IF NOT EXISTS t2_birja_rfq (
    id BIGSERIAL PRIMARY KEY,
    kompaniya_id BIGINT NOT NULL,
    nom TEXT NOT NULL,
    birlik TEXT NOT NULL,
    hajm NUMERIC(15,4) NOT NULL,
    izoh TEXT,
    holat TEXT DEFAULT 'ochiq',
    yaratilgan_vaqt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. B2B Birja Takliflar
CREATE TABLE IF NOT EXISTS t2_birja_taklif (
    id BIGSERIAL PRIMARY KEY,
    rfq_id BIGINT REFERENCES t2_birja_rfq(id) ON DELETE CASCADE,
    kompaniya_id BIGINT NOT NULL,
    narx NUMERIC(15,2) NOT NULL,
    izoh TEXT,
    yaratilgan_vaqt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Elektron Fakturalar (Didox EHF)
CREATE TABLE IF NOT EXISTS t2_faktura (
    id BIGSERIAL PRIMARY KEY,
    kompaniya_id BIGINT NOT NULL,
    raqam TEXT NOT NULL,
    sana DATE NOT NULL,
    kontragent TEXT NOT NULL,
    inn TEXT NOT NULL,
    summa NUMERIC(15,2) NOT NULL,
    pdf_url TEXT,
    holat TEXT DEFAULT 'yangi',
    items JSONB DEFAULT '[]'::jsonb,
    yaratilgan_vaqt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(kompaniya_id, raqam, inn)
);


-- =========================================================================
-- RPC (Remote Procedure Calls)
-- =========================================================================

-- Skladga Yozish RPC (Prixod yoki Rasxod)
CREATE OR REPLACE FUNCTION t2_skladga_yozish(
    p_kompaniya_id BIGINT,
    p_operatsiya TEXT,
    p_obyekt_id BIGINT,
    p_turi TEXT,
    p_sana DATE,
    p_nomi TEXT,
    p_birligi TEXT,
    p_obyomi NUMERIC
) RETURNS JSONB AS 
DECLARE
    v_qoldiq NUMERIC;
BEGIN
    IF p_operatsiya = 'rasxod' THEN
        SELECT qoldiq INTO v_qoldiq FROM t2_sklad_qoldiq WHERE obyekt_id = p_obyekt_id AND nomi = p_nomi;
        IF v_qoldiq IS NULL OR v_qoldiq < p_obyomi THEN
            RETURN jsonb_build_object('ok', false, 'error', 'Skladda yetarli qoldiq yo''q: ' || COALESCE(v_qoldiq, 0) || ' ' || p_birligi);
        END IF;
        
        UPDATE t2_sklad_qoldiq SET qoldiq = qoldiq - p_obyomi, oxirgi_harakat = NOW() 
        WHERE obyekt_id = p_obyekt_id AND nomi = p_nomi;
    ELSE
        INSERT INTO t2_sklad_qoldiq (kompaniya_id, obyekt_id, nomi, birligi, qoldiq)
        VALUES (p_kompaniya_id, p_obyekt_id, p_nomi, p_birligi, p_obyomi)
        ON CONFLICT (obyekt_id, nomi) DO UPDATE 
        SET qoldiq = t2_sklad_qoldiq.qoldiq + p_obyomi, oxirgi_harakat = NOW();
    END IF;

    INSERT INTO t2_sklad_harakat (kompaniya_id, obyekt_id, operatsiya, turi, sana, nomi, birligi, obyomi)
    VALUES (p_kompaniya_id, p_obyekt_id, p_operatsiya, p_turi, p_sana, p_nomi, p_birligi, p_obyomi);

    RETURN jsonb_build_object('ok', true);
END;
 LANGUAGE plpgsql SECURITY DEFINER;


-- Faktura Yozish RPC
CREATE OR REPLACE FUNCTION t2_faktura_yoz(
    p_kompaniya_id BIGINT,
    p_raqam TEXT,
    p_sana DATE,
    p_kontragent TEXT,
    p_inn TEXT,
    p_summa NUMERIC,
    p_holat TEXT,
    p_items JSONB,
    p_id BIGINT DEFAULT NULL
) RETURNS JSONB AS 
DECLARE
    v_new_id BIGINT;
BEGIN
    IF p_id IS NOT NULL THEN
        UPDATE t2_faktura SET holat = p_holat, items = p_items
        WHERE id = p_id;
        RETURN jsonb_build_object('ok', true, 'id', p_id);
    ELSE
        INSERT INTO t2_faktura (kompaniya_id, raqam, sana, kontragent, inn, summa, holat, items)
        VALUES (p_kompaniya_id, p_raqam, p_sana, p_kontragent, p_inn, p_summa, p_holat, p_items)
        RETURNING id INTO v_new_id;
        RETURN jsonb_build_object('ok', true, 'id', v_new_id);
    END IF;
END;
 LANGUAGE plpgsql SECURITY DEFINER;


-- Birja RFQ Yaratish RPC
CREATE OR REPLACE FUNCTION t2_birja_rfq_yarat(
    p_kompaniya_id BIGINT,
    p_nom TEXT,
    p_birlik TEXT,
    p_hajm NUMERIC,
    p_izoh TEXT,
    p_holat TEXT
) RETURNS JSONB AS 
DECLARE
    v_id BIGINT;
BEGIN
    INSERT INTO t2_birja_rfq (kompaniya_id, nom, birlik, hajm, izoh, holat)
    VALUES (p_kompaniya_id, p_nom, p_birlik, p_hajm, p_izoh, p_holat)
    RETURNING id INTO v_id;
    RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
 LANGUAGE plpgsql SECURITY DEFINER;

-- Birja Taklif Berish RPC
CREATE OR REPLACE FUNCTION t2_birja_taklif_ber(
    p_rfq_id BIGINT,
    p_kompaniya_id BIGINT,
    p_narx NUMERIC,
    p_izoh TEXT
) RETURNS JSONB AS 
DECLARE
    v_id BIGINT;
BEGIN
    INSERT INTO t2_birja_taklif (rfq_id, kompaniya_id, narx, izoh)
    VALUES (p_rfq_id, p_kompaniya_id, p_narx, p_izoh)
    RETURNING id INTO v_id;
    RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
 LANGUAGE plpgsql SECURITY DEFINER;
