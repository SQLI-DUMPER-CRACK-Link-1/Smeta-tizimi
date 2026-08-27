# ENTERPRISE CONSTRUCTION AI OS — 1 dan 100 gacha Master Reja

> Manba: foydalanuvchi tomonidan 2026-08-27 da yuborilgan to'liq texnik
> spetsifikatsiya (ushbu fayl uning to'liq matni — o'zgartirilmagan).
> Bu hujjat **maqsad xaritasi** — Tizim_02 (`tizim02/`) shu tomon
> rivojlanadi, lekin bir yo'la emas, FAZA-FAZA, har qadam Supabase MCP
> orqali jonli sinalib, commit qilinib boriladi (loyihaning "hech narsa
> to'qib chiqarilmaydi, har narsa tekshiriladi" qoidasiga muvofiq).
>
> ⚠️ **Muhim moslashtirish**: hujjat "Next.js" deb yozilgan, lekin
> haqiqiy stack **Vite + React + Cloudflare Pages Functions** (bu
> loyihada Next.js ISHLATILMAYDI — almashtirish katta va keraksiz
> qayta yozish bo'lardi). Arxitektura g'oyalari (RLS, RBAC, polimorfik
> tashkilot, M:N resurslar, audit, AOSR, va h.k.) TO'LIQ qabul
> qilinadi — texnologiya nomi emas, printsip muhim.

---

## I QISM: ME'MORIY FALSAFA (asl matn)

### 1. Polimorfik Tashkilot Modeli (Party Role Polymorphism)
Bitta kompaniya turli loyihalarda turli rol o'ynaydi: Buyurtmachi/Developer,
Bosh pudratchi, Subpudratchi, Loyihachi, Ta'minotchi. Kompaniya (Organization)
va uning Loyihadagi Roli (Project Party Role) bazada ANIQ ajratiladi.

**Holat (2026-08-27):** `t2_kompaniya.mavqe` ustuni bor, lekin bu HALI
"bir kompaniya — bitta doimiy rol" modeli (polimorfik emas — bir xil
kompaniya ikki loyihada ikki xil rolda bo'la olmaydi). To'liq polimorfik
modelga o'tish uchun `t2_loyiha_qatnashchi` (loyiha_id, kompaniya_id,
rol) jadvali kerak — FAZA 3 bilan birga qilinadi.

### 2. To'liq Domen Iyerarxiyasi (10 bosqich)
Kompaniya → Shartnoma/Investitsion Dastur → **Loyiha** → Obyekt → Bino/Blok →
Qavat/Otmetka → Bo'lim(Razdel) → Ish Bloki → Resurslar → Operatsiyalar.

**Holat:** Tizim_02 da hozir Kompaniya → Obyekt → Razdel/Blok/Resurs bor,
lekin **"Loyiha" (Project) darajasi umuman yo'q** — bir nechta obyekt bir
loyihaga (masalan "32 gektarlik park") guruhlanmaydi. Bu ENG MUHIM
yetishmayotgan bosqich — foydalanuvchining "5 shartnoma, 40 obyekt, bitta
park" gapi aynan shu qatlamni so'ragan edi. **Keyingi ustuvor ish shu.**
"Bino/Blok" va "Qavat/Otmetka" oraliq darajalari ham yo'q (hozir Razdel
to'g'ridan-to'g'ri Obyektga osilgan).

### 3. STIR/INN Avtomatlashtirish
`t2_kompaniya.inn` ustuni bor, lekin Soliq/Didox API orqali avto-to'ldirish
YO'Q — INN qo'lda kiritiladi, qolgan rekvizitlar ham qo'lda.

### 4. Bilim Yaratish va O'rganish Sikli (AI/Knowledge Graph)
Hali boshlanmagan — kelajak FAZA (10-band, AI Agentlar klasteri).

---

## II QISM: 1 dan 100 gacha FAZA ro'yxati

*(asl 10 FAZA, 100 band — to'liq matn quyida, o'zgartirilmagan)*

### FAZA 1: Platform Foundation, Multi-Tenancy va Xavfsizlik (1–10)
1. Monorepo/paketlar (Turborepo, apps/web, packages/domain/db/ai/integrations)
2. Multi-Tenant Master Sxema (core.organizations, core.tenants, identity.*)
3. Granular RBAC + ABAC
4. STIR (INN) Enrichment Servisi
5. PostgreSQL RLS siyosatlari
6. Autentifikatsiya va sessiya (Supabase Auth + JWT)
7. Universal Audit Jurnali (audit.events, audit.field_changes, triggerlar)
8. Cloudflare R2 Object Storage (imzolangan URL)
9. Telemetriya/Observability (trace_id, Sentry)
10. CI/CD va sifat darvozalari

### FAZA 2: Master Data, Me'yoriy Baza (SHNQ/KMQ), Hududiy Narxlar (11–20)
11. Birliklar universal katalogi (unit_registry, unit_aliases)
12. Resurslar yagona milliy klassifikatori
13. SHNQ/KMQ rasenkalar kutubxonasi
14. 14 hududiy bozor narxlari kliringi
15. Hududiy koeffitsientlar/logistika
16. B2B kontragentlar federativ reestri
17. Banklar/MFO katalogi
18. Mashina-mexanizmlar normativ stavkalari
19. Materiallar texnik xususiyatlari
20. Golden Benchmark Dataset (20+ real obyekt)

### FAZA 3: Polimorfik Shartnomalar va B2B Kontrakt Boshqaruvi (21–30)
21. Shartnomalar master sxema (contracts.contracts, clauses)
22. Bosh pudrat shartnomasi
23. Subpudrat taqsimot modeli
24. Qo'shimcha kelishuvlar (Dop. Soglasheniye), versiyalash
25. 20-qatorli накрутка hisoblagichi
26. Kafolat depoziti (Retention 5%)
27. Bo'nak/Avans bosqichma-bosqich chegirish
28. B2B huquqiy izolyatsiya (subpudratchi faqat o'zinikini ko'radi)
29. E-IMZO integratsiyasi (shartnoma)
30. Shartnoma limit buzilishi radari

### FAZA 4: Smeta va Byudjetlashtirish Yadrosi (31–40)
31. Smeta master sxema
32. Excel (ABC-4/TN/LRV) parser
33. Markirovka dvigateli (rz/bl/rs/mat/ob)
34. Resurs miqdori hisobi (Ota Blok × Norma)
35. CONSTANTA narxlash (Nom+Birlik to'liq moslik)
36. Narx topilmagan resurslar registri
37. Generated NULL himoyasi (narx NULL → summa NULL, 0 emas)
38. Ierarxik jamlash (rollup) SQL
39. Ikki tomonlama Google Sheets ko'zgusi (optimistik qulf)
40. Smeta versiyalari/variantlar tahlili

### FAZA 5: Fakt va Forma-2 (КС-2) Boshqaruvi (41–50)
41. Maydondan kunlik fakt kiritish (mobil)
42. Oylik Forma-2 master sxema
43. Invariant: Forma-2 ≤ Fakt ≤ Smeta
44. Qoldiq va накопительная ведомость
45. Перерасчёт (manfiy hajm) qabuli
46. Tashqi Excel F2 moslashtirish dvigateli
47. F2_REESTR kafolati (Hujjat Jami − Yozilgan Jami = 0)
48. Forma-3 (КС-3) avto-generatsiya
49. B2B F2 tasdiqlash zanjiri (Sub→BoshPudrat→Buyurtmachi→E-IMZO)
50. Overbilling radari

### FAZA 6: Viborka, Zayavkalar, Xarid Birjasi (51–60)
51. Avtomatik moddiy ehtiyoj (Viborka)
52. AI material entity normalizatori
53. Maydon zayavkalar oqimi (Prorab→PTO→Ta'minot)
54. Defitsit/zaxira kalkulyatori
55. B2B xarid birjasi (RFQ ko'p zavodga)
56. Tijoriy takliflar taqqoslash
57. Xarid shartnomalari boshqaruvi
58. Yetkazib berish grafiklari monitoringi
59. Zamena (material almashtirish) nazorati
60. Xarid anti-fraud monitoringi

### FAZA 7: Sklad, Tranzaksion Ledger, Didox (61–70)
61. Omborlar master sxema
62. Didox.uz API (EHF avto-o'qish)
63. Kirim tranzaksion ledger
64. Chiqim tranzaksion ledger
65. Haqiqiy ombor qoldig'i (Kirim − Chiqim)
66. M-29 material sarfi hujjati
67. Ovozli Telegram sklad boti
68. Ombor inventarizatsiyasi
69. Sifat pasportlari/QR-kod
70. Ombor anomaliyalari radari

### FAZA 8: AOSR, Ijroiy Sxemalar, Lab Sinovlari (71–80)
71. AOSR master sxema — ✅ QISMAN BOR (`t2_aosr_reestr`, 2026-08-27)
72. Barqaror bog'lanish (SMETA_REF) — ✅ BOR (`t2_aosr_bog`)
73. Komissiya tarkibi avto-shabloni
74. AOSR avtomatik qoralamasi
75. Lab sinov xulosalari biriktirish
76. Ijroiy chizmalar/fotofiksatsiya
77. B2B ko'p tomonlama E-IMZO zanjiri
78. GOST/Davlat standart PDF eksport
79. AOSR Coverage radari — ✅ BOR (`t2_aosr_coverage`)
80. Ijroiy hujjatlar to'liq arxivi

### FAZA 9: Gantt, Mexanizatsiya, Kadrlar (81–90)
81. Kalendar reja master sxema (WBS)
82. Interaktiv Web Gantt
83. CPM/kechikish prognozi
84. Texnika parki pasporti — ✅ QISMAN (`t2_texnika_mustaqil`, 2026-08-27)
85. Motochas/YoMM nazorati
86. TO va ta'mirlash grafigi
87. Kadrlar/brigadalar hisobi — ✅ QISMAN (`t2_kadr_mustaqil`, 2026-08-27)
88. Kunlik davomat tabeli (Face ID/QR/geo)
89. Ishbay/vaqtbay ish haqi
90. HSE jurnali

### FAZA 10: 1C, Cashflow, Dizayn, AI Agentlar (91–100)
91. 1C:Korxona API ko'prigi
92. To'lovlar reestri/bank integratsiyasi — ✅ QISMAN (`t2_tolov`)
93. Debitorlik/kreditorlik aging tahlili — ✅ QISMAN (`t2_debitor_aging`)
94. Cashflow prognozi
95. Dark Luxury UI dizayn tizimi
96. Bento Grid rahbariyat dashboardi
97. AI Agentlar orkesratori
98. Command Palette (Cmd+K) — ✅ BOR (`CommandPalette.tsx`)
99. Multi-tenant SaaS billing/onboarding
100. Production stress test / Go-Live

---

## Joriy holat xulosasi (2026-08-28 yangilandi, Claude tomonidan)

Tizim_02 **FAZA 4-8** ning parcha-parcha qismlarini qamrab oladi
(smeta/F2/sklad/shartnoma/AOSR/M:N resurslar). **FAZA 1-3 poydevori**
holati:

| Band | Nima | Holat |
|---|---|---|
| 2. Multi-Tenant Master Sxema | `t2_kompaniya`, `t2_foydalanuvchi`, `t2_azolik` | ✅ BOR |
| 1. Polimorfik tashkilot modeli | `t2_loyiha_qatnashchi` (kompaniya/kontragent × loyiha × rol) | ✅ BOR (2026-08-28) |
| — | "Loyiha" darajasi — Kompaniya→Loyiha→Obyekt | ✅ BOR |
| — | Polimorfik ODAM roli — bitta odam kompaniya A da admin, B da rahbar | ✅ BOR (`sess.kompaniyalar: {kompaniya_id, rol}[]`) |
| 3. Granular RBAC + ABAC | Har amal uchun aniq rol-ruxsat xaritasi | ⚠️ QISMAN — faqat "boss/rahbar yoza olmaydi" (global) + 2 joyda admin/superadmin tekshiruvi. Boshqa yozuvchi rollar (prorab/pto/bugalter) orasida farq YO'Q |
| 4. STIR/INN enrichment | Kontragent/kompaniya rekvizitini avto-to'ldirish | ❌ YO'Q — API kalit kerak (foydalanuvchi qarori) |
| 5. RLS siyosatlari | Bazaning o'zida qator darajasidagi xavfsizlik | ❌ YO'Q, **ATAYLAB** — barcha so'rov `service_role` orqali o'tadi, u RLS'ni avtomatik bypass qiladi (Supabase'da BYPASSRLS). RLS policy yozish hozircha **funksional foydasiz** bo'lardi — haqiqiy foyda faqat Supabase Auth + anon key arxitekturasiga o'tilsa (band 6) ma'noli bo'ladi, bu katta refaktor |
| 6. Auth/session (Supabase Auth+JWT) | Hozir custom cookie (GAS login orqali) | ❌ YO'Q, band 5 bilan bog'liq |
| 7. Audit jurnali | `t2_audit_log`/`t2_audit_reestr` | ✅ BOR |
| 8. R2 Object Storage | Obyekt hujjatlari (`t2_obyekt_hujjat`) | ✅ BOR |

**Tavsiya etilgan navbatdagi qadam — Granular RBAC (band 3):**
Hozir istalgan yozuvchi rol (prorab, pto, bugalter...) bitta kompaniya
ichida BARCHA amalni bajara oladi — faqat "boss/rahbar" global bloklangan
va 2 ta amal (majburiy invariant o'tkazish, shartnoma-tashqi ish)
admin/superadmin'ga cheklangan. Masalan hozir istalgan yozuvchi rol
`loyiha_yarat`/`kontragent_saqla`/`t2_azolik` boshqaruvi kabi ADMINISTRATIV
amallarni ham bajara oladi — bu noto'g'ri, lekin **to'g'ri rol xaritasi
odam (foydalanuvchi) biznes qarori** (qaysi rol nima qila olishi kerak),
Claude buni o'zicha noldan o'ylab belgilamaydi — buzilish xavfi bor.

RLS/Auth (band 5-6) atayLAB **oxiriga qoldiriladi** — sabab tepada
yozilgan (funksional foyda yo'q hozirgi arxitekturada).

Bu reja `tizim02/MULOQOT.md` da Antigravity bilan ham baham ko'rilgan.

## 0. "BITCOIN-LEVEL SECURITY" - Kriptografik ID lar va RLS (YANGI QO'SHIMCHA)
**DIQQAT: Tizim xavfsizligi va raqobatbardoshligi uchun qabul qilingan qat'iy standart.**

Hozirgi sinov (test) siklida kompaniya ID lari, obyekt ID lari oddiy tartib raqam (masalan, id: 1, id: 2) ko'rinishida turibdi. Bu ochiq va bashorat qilib bo'ladigan bemanilikdir. Raqamli ID'lar yordamida tashqi hujumchilar yoki boshqa tenantlar tizim ko'lamini osongina bilib olishi yoki Insecure Direct Object Reference (IDOR) orqali boshqa mijozlarning ma'lumotlariga kirishga urinishi mumkin.

Shu sababli, **keyingi qadamlarda (Production'ga o'tish arafasida) barcha ID'lar "Bitcoin xavfsizligi" darajasiga ko'tarilishi SHART:**

1. **UUIDv4 yoki ULID:** Barcha asosiy jadvallar (Kompaniya, Obyekt, Shartnoma, Tranzaksiya) identifikatorlari BIGINT dan UUID (Universally Unique Identifier) yoki kripotografik tasodifiy string'larga o'tkaziladi. Hech qachon brauzer tarmog'ida yoki URL'da id=1 degan yozuv chiqmasligi kerak (huddi Bitcoin hamyon manzili kabi: id=f47ac10b-58cc-4372-a567-0e02b2c3d479).
2. **Kriptografik RLS (Row Level Security):** Supabase RLS yordamida har bir so'rovda foydalanuvchining sessiya tokeni (JWT) tekshiriladi. Token ichida uning shifrlangan kompaniya_id (UUID)si bo'ladi va ma'lumotlar bazasi faqat shu UUID ga tegishli qatorlarni qaytaradi. Birovning UUID'sini topib olish ehtimoli nolga teng (2^122 kombinatsiya).
3. **Imzolangan URL'lar (Signed URLs):** Fayllar, shartnoma nusxalari va PDF aktlar faqatgina vaqtinchalik kriptografik imzolangan havolalar orqali o'qiladi.
