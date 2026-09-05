# T2 Claude — TS type ↔ Supabase schema drift audit

**Rol:** Implementation engineer (Claude), self-initiated after the
resurs-vedomost lane exposed the same bug shape twice in one file.

## Nima topildi

`frontend/src/api/supabase.ts`dagi har bir nomlangan Supabase-o'qish
TS tipini (`T2QatorHolat`, `T2Qator`, `T2Obyekt`, `T2Kompaniya`,
`T2Faktura`, `T2IshTuri`, `T2AktReestr`, `T2SkladQoldiq`) haqiqiy DB
ustunlari bilan Supabase MCP orqali (`information_schema.columns`)
to'g'ridan-to'g'ri solishtirdim. Bu — tasodifiy emas, TIZIMLI naqsh
ekan: 6 tadan 6 tasi (T2AktReestr va T2SkladQoldiq bundan mustasno —
ular to'liq) DB'da bor, lekin TS tipida yo'q ustunlarga ega edi:

| Tip | Yetishmagan ustunlar |
|---|---|
| `T2QatorHolat` | `tur`, `kod`, `birlik`, `kat` (bu sessiyada avvalroq tuzatilgan) |
| `T2Qator` | `kompaniya_id`, `raqam`, `norma` (`versiya` avvalroq tuzatilgan) |
| `T2Obyekt` | `kompaniya_id` |
| `T2Kompaniya` | `yaratildi` |
| `T2Faktura` | `versiya`, `kim`, `yaratildi`, `yangilandi` |
| `T2IshTuri` | `versiya`, `yaratilgan_vaqt` |

**Nega bu muhim**: bu tiplar frontend'ning DB bilan yagona kelishuvi.
Ular yetishmasa, mavjud, to'g'ri, allaqachon qaytarilayotgan ma'lumot
(masalan `t2_qator.kompaniya_id`) hech qachon frontend kodida
ISHLATILMAYDI — chunki TypeScript uni "yo'q" deb ko'rsatadi. Bu xuddi
`versiya`ning yo'qligi Additional/Replacement UI qurishga to'sqinlik
qilgani kabi, kelajakdagi har qanday ishni to'xtatib qo'yishi mumkin edi.

## Nima qilindi

Barcha yetishmagan ustunlar tegishli tiplarga qo'shildi (faqat
qo'shish — hech narsa o'chirilmadi/o'zgartirilmadi). `T2Faktura`/
`T2IshTuri` — bular YOZISH uchun ham ishlatiladi (`sbFakturaYoz`/
`sbIshTuriYoz` `...item`ni spread qiladi) — yangi maydonlar ATAYLAB
**ixtiyoriy** (`?`) qilib qo'shildi, shuning uchun yozish yo'lida
`undefined` xavfsiz e'tiborsiz qoldiriladi (JSON.stringify `undefined`
qiymatli kalitlarni tashlab yuboradi) — mavjud xatti-harakat
o'zgarmadi. `T2Qator`/`T2Obyekt`/`T2Kompaniya`/`T2QatorHolat` — faqat
O'QISH uchun, shuning uchun yangi maydonlar boshqalari kabi MAJBURIY.

## Gates

`tsc -b`, `oxlint`, `vitest` (to'liq to'plam, 234/234), `vite build`,
`node ops/governance-check.cjs` — barchasi toza.

## Qamrov chegarasi

Faqat NOMLANGAN eksport qilingan tiplar tekshirildi. `t2_shaxsiy_smeta`/
`t2_korzinka` kabi anonim inline tiplar (`sbOqi<{...}>`) qamrovga
kirmadi — ular bitta joyda ishlatiladi, xavf ancha past, va bu
sessiyaning vaqt chegarasida ustuvor emas edi. Kelajakda xuddi shu
usul bilan tekshirilishi mumkin.
