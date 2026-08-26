# Tizim Bo'ylab O'chirish, Tahrirlash va "Korzinka" (Trash) Arxitexturasi

Kompaniyadagi barcha modullar (Obyektlar, Smetalar, Sklad, Fakturalar) uchun yagona tahrirlash va xavfsiz o'chirish (Soft Delete / Korzinka) tizimini joriy etish.

## 1. Database (Supabase) Qatlami (Backend - Claude uchun)
Barcha ma'lumotlarni tasodifiy o'chib ketishidan saqlash uchun "Soft Delete" (Yashirin o'chirish) mantiqini qo'llaymiz.
*   **Jadvallarga qo'shimcha:** Barcha 	2_* jadvallariga is_deleted BOOLEAN DEFAULT FALSE yoki holat TEXT ustuni qo'shilishi kerak.
*   **Yangi RPC funksiyalar:**
    *   	2_korzinkaga_tashlash(p_jadval TEXT, p_id BIGINT) - yozuvni korzinkaga o'tkazadi (is_deleted = true).
    *   	2_korzinkadan_tiklash(p_jadval TEXT, p_id BIGINT) - yozuvni qayta faollashtiradi.
    *   	2_butunlay_ochirish(p_jadval TEXT, p_id BIGINT) - yozuvni bazadan butunlay (hard delete) qilib o'chirib tashlaydi.
    *   Tahrirlash uchun RPC lar (	2_obyekt_yangila, 	2_smeta_yangila).
*   **O'qish filtri:** 	2_obyektlar_ol va boshqa barcha olib beruvchi RPC lar faqat is_deleted = false bo'lganlarini qaytarishi kerak.

## 2. Frontend (React) Qatlami (Antigravity uchun)
*   **Yangi Korzinka Sahifasi (TestKorzinka.tsx):**
    *   Foydalanuvchi barcha o'chirilgan obyektlar, smetalar va hujjatlarni bitta joyda ko'radi.
    *   "Tiklash" (Restore) va "Tozalash" (Permanent Delete) tugmalari bo'ladi.
*   **Obyektlar Sahifasi (TestObyektlar.tsx):**
    *   Har bir obyekt yonida qalamcha (Tahrirlash) va axlat qutisi (Korzinkaga tashlash) tugmalari qo'shiladi.
    *   Tahrirlash bosilganda Modal ochilib, obyekt nomini o'zgartirishga ruxsat beradi.
*   **Smeta Daraxti (TestDaraxt.tsx):**
    *   Smeta qatorlari (Narxlar, Hujjatlar) uchun ham tahrirlash (Edit) va o'chirish tugmalari biriktiriladi.
*   **Marshrutizatsiya:** App.tsx va TestShell.tsx ga Korzinka marshruti qo'shiladi.

## Tasdiqlash
Siz ushbu rejani tasdiqlaganingizdan so'ng, men frontenddagi barcha sahifalarga (Obyekt, Smeta, Sklad) Tahrirlash/O'chirish tugmalarini hamda **Korzinka** modulini yaratishni boshlayman. 
Va Claude'ga o'zining Backend qismini (is_deleted) qo'shishini aytaman.
