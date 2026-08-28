# TASK 1 — Dependency/Contract Map (2026-08-28)

> GPT master rejaning 47-bandi bo'yicha buyurilgan: "barcha T2/Supabase/
> Sheets bridge/Frontend API/F2/Fact/AI qismlarini map qil, yangi
> feature yozma, qaysi core contracts bor/yetishmaydi/zid — jadval
> bilan chiqar." Bu hujjat SHU — kod o'zgarmadi, faqat o'qildi.

## 1. Yozish shartnomasi — `sb-yoz.ts` (60 ta amal)

Bitta darvoza: `POST /api/sb-yoz`, `{amal, ...}` → nomli RPC. Domen
bo'yicha guruhlangan:

| Domen | Amallar |
|---|---|
| Smeta/qator | `qator_qosh`, `qator_tahrir` |
| F2/Fakt/Akt | `akt_tasdiqlash`*, `fakt_yoz`, `fakt_belgila` |
| AOSR | `aosr_yoz/bekor/bog_saqla/bog_ochir` |
| Shartnoma/накрутка | `shartnoma_saqla/ochir/bog_saqla`, `nakrutka_saqla` |
| Buxgalteriya | `tolov_yoz/tahrir/ochir`, `xarajat_yoz/tahrir/ochir` |
| Narx | `narx_belgila`*, `narx_sana_qosh` |
| Sklad | `skladga_yozish`, `sklad_yarat` (mustaqil, YANGI) |
| M:N resurs | `kadr_yarat`, `texnika_yarat`, `resurs_bog_saqla/ochir` |
| Loyiha | `loyiha_yarat/yangila/ochir`, `obyekt_loyihaga_biriktir`, `loyiha_qatnashchi_biriktir/ochir` |
| Kontragent | `kontragent_saqla/ochir` |
| Kompaniya | `kompaniya_yangila` (2026-08-27, bir marta merge'da yo'qolib, 2026-08-28 tiklandi) |
| Hujjat | `obyekt_hujjat_yoz/ochir` |
| Korzinka | `korzinkaga_tashlash/dan_tiklash`, `butunlay_ochirish`, `obyekt_yangila` |
| A'zolik/rol | `azolik_qosh/rol_ozgartir/ochir` |
| Audit | `audit_yoz` |
| Material alias (YANGI) | `material_alias_yoz/ochir` |
| ERP/Grafik/Sozlama/Tizim (generic) | `erp_amal`, `grafik_sozlama_saqla/yangilash`, `sozlama_saqla`, `tizim_amal`, `xato_yoz` |
| Birja/Taklif/Viborka | `birja_rfq_yarat/taklif_ber`, `taklif_yubor/qabul`, `viborka_smetadan_toldir/qabul_yoz` |
| Faktura/Shaxsiy smeta | `faktura_yoz`, `shaxsiy_smeta_yarat` |
| Kirish | `kirish_amal` |

`*` — bir nechta joyda ishlatiladi (masalan `akt_tasdiqlash` ham
F2 ham Fakt hujjatlari uchun umumiy).

**Himoya qatlamlari (barcha amalda umumiy):** sessiya majburiy → boss/
rahbar global bloklangan → **kompaniya a'zoligi tekshiruvi** (agar
`so.kompaniya_id` va `sess.kompaniyalar` bo'lsa) → **shu kompaniyadagi
rol boss/rahbar bo'lsa ham bloklanadi** (polimorfik) → amal-specific
validatsiya → RPC.

## 2. O'qish shartnomasi — `sb.ts` (79 jadval/view + 2 AI RPC)

`POST /api/sb`, `{jadval, filtr}` → PostgREST GET. Whitelist qat'iy
(`RUXSAT_JADVALLAR`). Alohida yo'l: `{soro: 'ai_kontekst'|'ai_umumiy'}`
→ `t2_ai_kontekst(p_obyekt_id)` / `t2_ai_umumiy(p_kompaniya_id)` —
Postgres `STABLE` funksiya (yozolmaydi, Postgres o'zi majburlaydi),
GET bilan chaqiriladi, kompaniya a'zoligi tekshiriladi.

## 3. GAS ko'prik fayllari (`Smeta tizimi/`)

| Fayl | Vazifa | Egasi |
|---|---|---|
| `10_Engine.js` | Dvigatel — narxlash, rollup, LRV_PLUS yasash | TAQIQ (kelishuvsiz tegilmaydi) |
| `30_Panel.js` | Barcha eski Web UI API endpointlari | TAQIQ |
| `35_F2Moslash.js` | F2 ierarxik moslashtirish | TAQIQ |
| `05_Papka.js` | Drive papka skaneri | TAQIQ |
| `70_Supabase.js` | Sheets→Supabase bir tomonlama sinx | TAQIQ |
| `79_WebAPI.js` | Yagona tashqi API darcha (`apiXxx` router) | Claude |
| `95_ObyektHujjat.js` | R2→Drive dual-storage nusxasi | Claude (2026-08-27) |
| `96_T2Papka(...).js` | Obyekt papka tuzilmasi (YANGI, tekshirilmadi) | noaniq |
| `T2_Kozgu.js` | Postgres→Sheets ko'zgu (ФАКТ ustuni endi bor) | Claude |
| `T2_Import.js` | Raw smeta import qatlami | Claude |
| `40_Telegram.js` | `doPost` — Telegram webhook + `__api` router | Claude/Antigravity aralash |

## 4. F2/Fakt kanonik zanjiri

```
t2_qator (smeta)
   ├─→ t2_akt_qator (F2/Fakt yozuvlari, tur='f2'|'fakt')
   │      ├─ kirish yo'li 1: t2_akt_yarat (to'liq hujjat, F2 ham Fakt ham)
   │      ├─ kirish yo'li 2: t2_fakt_yoz (kunlik/jamlab, faqat Fakt)
   │      └─ kirish yo'li 3: t2_fakt_belgila (ko'zgu varaqdan, faqat Fakt)
   └─→ t2_qator_holat (VIEW: smeta_hajm/fakt_hajm/f2_hajm/qoldiq — 3 iste'molchiga xizmat qiladi: t2_akt_yarat invarianti, T2_Kozgu.js, TestF2.tsx)
```

Ikki tomonlama ko'prik: Postgres yozilsa → trigger `t2_kozgu.holat='farqli'`
→ GAS `t2KozguYangila()` (5 daqiqada bir) Sheetni qayta chizadi. Sheet
tomondan yozilsa (eski yo'l) → `70_Supabase.js` orqali bir tomonlama.

**⚠️ ZID/DUPLIKATSIYA XAVFI (GPT reja ogohlantirgan band):** hisoblash
mantig'i 2 joyda parallel yashaydi — `10_Engine.js` (GAS, LRV_PLUS
uchun to'liq narxlash+rollup) va Postgres (`t2_qator_holat`,
`t2_narx_markaz`, F2/Fakt aggregatsiya). Ular BIR XIL sonni ikki xil
yo'ldan hisoblaydi. Hozircha reconciliation (Tizim_01 vs Tizim_02 solishtirish, `98_SelfTest.js`/f2lab) bu ikkalasi mos kelishini
tekshiradi, lekin RASMIY, muntazam ishlaydigan diff hisobot emas —
TASK 2 shuni yopadi.

## 5. Bir-biriga ZID/DUPLIKAT kontraktlar (aniq topilgan)

| # | Eski/1-yo'l | Yangi/2-yo'l | Holat |
|---|---|---|---|
| 1 | `t2_erp_kadr`/`t2_erp_texnika` (obyekt_id to'g'ridan bog'langan) | `t2_kadr_mustaqil`/`t2_texnika_mustaqil` + `t2_kadr_bog`/`t2_texnika_bog` (M:N) | ❌ HAL QILINMAGAN — ikkalasi ham bor, qaysi UI ishlatadi aniq emas. Tavsiya (2026-08-27 MULOQOT.md da yozilgan): yangisiga o'tish, chunki eskisi aynan foydalanuvchi rad etgan "bitta obyektga qattiq bog'lash" modeli |
| 2 | `t2_sklad_qoldiq`/`t2_sklad_harakat` (obyekt-bog'liq, HAQIQIY qoldiq shu yerda hisoblanadi) | `t2_sklad_mustaqil`/`t2_sklad_bog` (M:N, faqat "qaysi obyektlarga xizmat qiladi" guruhlash) | ⚠️ QISMAN ZID EMAS — ikkalasi turli qatlam (biri stock, biri joylashuv/guruhlash), lekin UI ularni BOG'LAB ko'rsatmaydi hali |
| 3 | GAS `10_Engine.js` narxlash | Postgres `t2_narx_markaz` | ⚠️ Ikkalasi ham "CONSTANTA — Nom+Birlik to'liq moslik" qoidasini mustaqil implementatsiya qiladi. Amalda bir xil natija berishi TEKSHIRILMAGAN muntazam ravishda |
| 4 | `t2_akt_yarat` (to'liq hujjat) | `t2_fakt_yoz`/`t2_fakt_belgila` (tezkor yo'l) | ✅ ZID EMAS — ataylab 3 kirish yo'li, bitta jamlash nuqtasi (`t2_qator_holat`), MULOQOT.md da hujjatlashtirilgan |

## 6. Yetishmayotgan core contractlar (GPT reja bo'yicha, hali yo'q)

- Granular RBAC (rol→amal xaritasi) — global boss/rahbar bloki bor,
  amal-darajasida yo'q (MASTER_REJA'da "foydalanuvchi qarori kerak"
  deb belgilangan).
- RLS / Supabase Auth — ataylab yo'q, sabab MASTER_REJA 0-bo'limda.
- STIR/Didox real API — kalit yo'q.
- Job/Queue rasmiylashtirilgan modeli — `t2_kopruk_navbat` bor, lekin
  faqat F2 fon ishi uchun, umumiy naqsh sifatida hujjatlashtirilmagan.
- 1C, Bank integratsiyasi — yo'q.

---
Keyingi qadam: **TASK 2** — golden dataset (Amfiteatr) reconciliation.
