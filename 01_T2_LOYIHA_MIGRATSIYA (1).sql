-- 01_T2_LOYIHA_MIGRATSIYA.sql
-- "Loyiha" (Project) darajasini qo'shish uchun SQL migratsiya (UUID orqali Bitcoin-level xavfsizlik)

-- 1. UUID pgcrypto extension (agar yo'q bo'lsa)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Loyiha jadvali yaratish
CREATE TABLE IF NOT EXISTS public.t2_loyiha (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kompaniya_id BIGINT NOT NULL,
    shartnoma_id BIGINT, -- Ixtiyoriy, agar shartnomaga bog'lansa
    nom VARCHAR(255) NOT NULL,
    hudud VARCHAR(255),
    byudjet NUMERIC(20, 2) DEFAULT 0,
    holat VARCHAR(50) DEFAULT 'faol', -- faol, tuxtatilgan, yakunlangan
    izoh TEXT,
    yaratildi TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    yangilandi TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Obyekt jadvaliga loyiha_id qo'shish
ALTER TABLE public.t2_obyekt 
ADD COLUMN IF NOT EXISTS loyiha_id UUID REFERENCES public.t2_loyiha(id) ON DELETE SET NULL;

-- 4. RLS (Row Level Security) qoidalari
ALTER TABLE public.t2_loyiha ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Faqat o'z kompaniyasining loyihalari ko'rinadi"
ON public.t2_loyiha
FOR SELECT
USING (
  kompaniya_id IN (
    SELECT (jsonb_array_elements((current_setting('request.jwt.claims', true)::jsonb)->'kompaniyalar')->>'kompaniya_id')::bigint
  )
);

CREATE POLICY "Faqat o'z kompaniyasiga loyiha yozish"
ON public.t2_loyiha
FOR ALL
USING (
  kompaniya_id IN (
    SELECT (jsonb_array_elements((current_setting('request.jwt.claims', true)::jsonb)->'kompaniyalar')->>'kompaniya_id')::bigint
  )
);
