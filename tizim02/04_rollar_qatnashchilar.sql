-- Tizim_01 da rollar tizimi (Sub-pudrat, Bosh pudrat, Buyurtmachi) muhim bo'lgan.
-- Tizim_02 da kompaniyaning roliga qarab logikalar ajralishi uchun quyidagi jadval yangilanadi.

ALTER TABLE t2_kompaniya
ADD COLUMN IF NOT EXISTS rol TEXT DEFAULT 'Bosh Pudratchi',
ADD COLUMN IF NOT EXISTS sub_pudratchilar JSONB DEFAULT '[]'::jsonb;

-- Yoki mustaqil Tashkilotlar jadvali (Obyekt ichidagi qatnashchilar uchun):
CREATE TABLE IF NOT EXISTS t2_obyekt_qatnashchilar (
    id SERIAL PRIMARY KEY,
    obyekt_id INTEGER NOT NULL REFERENCES t2_obyekt(id) ON DELETE CASCADE,
    kompaniya_id INTEGER NOT NULL REFERENCES t2_kompaniya(id) ON DELETE CASCADE,
    rol TEXT NOT NULL, -- 'Buyurtmachi', 'Bosh Pudratchi', 'Sub Pudratchi', 'Loyihachi'
    holat TEXT DEFAULT 'faol'
);
