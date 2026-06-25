# SMETA DASHBOARD — Loyiha Ma'lumotnomasi
> Oxirgi yangilangan: 2026-yil 14-iyun, soat 04:39
> Muallif: Antigravity AI yordamchisi

---

## 📋 LOYIHA MAQSADI

Google Apps Script (GAS) da ishlayotgan **Panel.html** va **Boss.html** — qurilish smeta boshqaruv tizimini zamonaviy **Next.js + Supabase** platformasiga ko'chirish. Natijada:
- Internetda ishlaydi (localhost emas)
- Tezkor, chiroyli, premium dizaynli
- Har kim havolani ochib foydalana oladi
- Sheets bilan ikki tomonlama sinxronlashadi

---

## ✅ BAJARILGAN ISHLAR

### 1. Next.js Loyiha Yaratildi
- **Joylashuv:** `D:\frontend\`
- **Texnologiyalar:** Next.js 14.2.3, React 18, TypeScript, Tailwind CSS, Recharts, Lucide Icons
- **Ishga tushirish:** `D:\frontend\boshlash.bat` (ikki marta bosish yetarli)

### 2. Supabase Baza Ulandi
- **URL:** `https://tuoyrzadkgoltpqkdiyx.supabase.co`
- **Key:** `.env.local` faylida saqlangan
- **Muhim:** Supabase JS client `sb_publishable_` formatdagi kalitni qabul qilmadi, shuning uchun **to'g'ridan-to'g'ri REST API** (`fetch`) orqali ulanish yozildi (`src/lib/supabase.ts`)

### 3. Dashboard Sahifasi Ishlayapti
- **9 ta obyekt** Supabase'dan yuklanadi (Amfiteatr, GAME CLUB, Karting, Otalar choyxonasi, Sovg'alar do'koni, Stella, Sun'iy ko'l, Turk oshxonasi 2sht, YEVROPA OSXONASI)
- **KPI kartochkalari:** Jami Smeta (75.95 mlrd), CHEL, MAT, MASH
- **Stacked Bar Chart:** Har obyektning xarajat tarkibi
- **Donut Pie Chart:** Umumiy xarajat taqsimoti
- **Jadval:** Barcha obyektlar, summalar, locked holati
- **Premium dizayn:** Glassmorphism, dark theme, smooth animatsiyalar

### 4. Tuzatilgan Muammolar
- Google Drive (G:) da `npm install` ishlamadi → loyiha `D:\frontend\` ga ko'chirildi
- `autoprefixer` moduli yo'q edi → `package.json` ga qo'shildi
- Recharts SSR hydration xatosi → `isMounted` pattern bilan tuzatildi
- Template literal syntax xatosi → to'g'irlandi
- Supabase JS client `sb_publishable_` kalitni tanlamadi → REST API `fetch` ga o'tildi
- `fakt`, `progress`, `qoldiq` ustunlari bazada yo'q edi → haqiqiy ustunlar (`smeta`, `chel`, `mash`, `mat`, `ob`) ga moslashtildi

---

## 📁 MUHIM FAYLLAR

```
D:\frontend\
├── boshlash.bat                    # Loyihani ishga tushirish (ikki marta bosing)
├── .env.local                      # Supabase URL va API key
├── package.json                    # Dependensiyalar ro'yxati
├── tailwind.config.ts              # Tailwind CSS sozlamalari
├── postcss.config.mjs              # PostCSS + Autoprefixer
├── src/
│   ├── app/
│   │   ├── page.tsx                # ⭐ ASOSIY DASHBOARD sahifasi
│   │   ├── layout.tsx              # Sidebar + Header layout
│   │   ├── globals.css             # Global stillar, glassmorphism
│   │   └── favicon.ico
│   └── lib/
│       └── supabase.ts             # ⭐ Supabase REST API helper (supabaseQuery funksiyasi)

G:\Другие компьютеры\Компьютер\GAS\
├── Boss.html                       # Eski Boss dashboard (GAS)
├── Panel.html                      # Eski Panel boshqaruv (GAS) — 2970 qator
└── LOYIHA_HOLATI.md                # ⭐ SHU FAYL
```

---

## 🗃️ SUPABASE BAZA TUZILISHI

**Loyiha:** `tuoyrzadkgoltpqkdiyx` (Smet-01, FREE tier)

### `obyektlar` jadvali (9 ta yozuv):
| Ustun | Turi | Izoh |
|-------|------|------|
| nom | text | Obyekt nomi (PK) |
| format | text | TN yoki ABC4 |
| locked | bool | Qulflangan yoki yo'q |
| smeta | numeric | Jami smeta summasi |
| chel | numeric | Ish kuchi (CHEL) xarajati |
| mash | numeric | Mashina/mexanizm (MASH) xarajati |
| mat | numeric | Material (MAT) xarajati |
| ob | numeric | Asbob-uskuna (OB) xarajati |

### Boshqa jadvallar (hali ishlatilmayapti):
- `holat` — Obyekt holati va F2
- `narxlar` — Resurs narxlari
- `oylik_f2` — Oylik F2 ma'lumotlari
- `tarix` — O'zgarishlar tarixi

---

## 🚀 KEYINGI QADAMLAR (BAJARILMAGAN)

### Qadam 1: Vercel'ga Deploy (10 minut)
Saytni internetga chiqarish — boshqalar ham ko'rsin.
1. `D:\frontend\` papkasida `git init` → GitHub'ga push
2. Vercel.com da GitHub bilan kirish → loyihani import
3. `.env.local` dagi kalitlarni Vercel Environment Variables ga qo'shish
4. Deploy → `https://smeta-dashboard.vercel.app` tayyor!
- **Narxi: BEPUL** (Hobby plan)

### Qadam 2: Google Sheets ↔ Supabase Sinxronlash (30 minut)
Sheets'da ma'lumot o'zgarganda Supabase avtomatik yangilansin.
- GAS'da `onEdit` trigger → `UrlFetchApp` orqali Supabase REST API ga POST/PATCH
- Supabase **Service Role Key** kerak bo'ladi (Settings → API)

### Qadam 3: Saytdan Ma'lumot Yozish (1-2 soat)
Panel.html dagi funksiyalarni Next.js ga ko'chirish:
- **Holat va F-2 bo'limi** — fakt hajm kiritish, ierarxik daraxt
- **Narxlar bo'limi** — MAT, MASH, CHEL, OB narxlarini tahrirlash
- **Shartnoma bo'limi** — shartnomalar, nakrutka, qo'shimcha ishlar
- **Hujjatlar** — Akt, Prixod, Viborka

### Qadam 4: Boss.html Funksiyalari (1 soat)
- Gantt diagramma (Frappe Gantt yoki React alternative)
- Oylik F-2 dinamikasi (line chart)
- Obyekt tafsilotlari sahifasi (razdellar, kategoriyalar)

---

## ⚠️ MUHIM ESLATMALAR

1. **Loyiha D: diskda turadi** — G: (Google Drive) da `npm install` ishlamaydi (virtual disk muammosi)
2. **Supabase anon key** formati `sb_publishable_...` — Supabase JS client buni tanlamaydi, shuning uchun `supabaseQuery()` REST API funksiyasi ishlatiladi
3. **RLS (Row Level Security)** — Supabase'da SELECT uchun ruxsat ochilgan, lekin boshqa jadvallar uchun ham ochish kerak bo'lishi mumkin
4. **boshlash.bat** — `D:\frontend\` papkasida, ikki marta bosish bilan server ishga tushadi, brauzerda `http://localhost:3000` ochiladi

---

## 🔑 KALITLAR VA ULANISHLAR

| Nima | Qiymat |
|------|--------|
| Supabase URL | `https://tuoyrzadkgoltpqkdiyx.supabase.co` |
| Supabase Anon Key | `.env.local` faylida |
| Next.js Dev Server | `http://localhost:3000` |
| GitHub | Hali yukllanmagan |
| Vercel | Hali deploy qilinmagan |

---

## 💡 ANTIGRAVITY UCHUN KO'RSATMA

Agar yangi sessiyada davom etmoqchi bo'lsangiz, Antigravity'ga shunday yozing:

```
Men qurilish smeta dashboard loyihasini davom ettirmoqchiman.
Loyiha holati: G:\Другие компьютеры\Компьютер\GAS\LOYIHA_HOLATI.md
Frontend kodi: D:\frontend\
Keyingi qadam: Vercel'ga deploy qilish
```

Bu fayl Antigravity'ga barcha kontekstni tushunishga yordam beradi.
