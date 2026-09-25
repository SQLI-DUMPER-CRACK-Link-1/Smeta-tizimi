# PTO liniyasi — EGASI QARORI kerak bo‘lgan masalalar (2026-09-25)

Vazifa: `PTO-LINIYA-YAKUN-001` · Agent: Claude (server) · Topshiriq:
`ops/handoff/PTO_LINIYA_YAKUNIY_TOPSHIRIQ_2026-09-25.md` §6.

Qoidasi: bu yerdagi hech bir masalani agent o‘zi hal qilmadi. Kodda har biri
**to‘xtatib turilgan** (soxta jami, taxminiy stavka yoki production o‘zgarishi
yo‘q). Har band: nima, dalil, variantlar, tavsiya, qaror qabul qilingandan
keyin nima qilinadi. Javobni shu faylning oxiridagi "Qaror" qatoriga yozing.

---

## Q1. Forma-3 (КС-3 / Справка о стоимости) — yuridik jami qoidasi

**Holat.** `t2_forma3` jadvali va `t2_forma3_yarat_v1` bor, lekin
`qoida_holat = 'FORMA3_RULE_UNRESOLVED'` — hech qanday nakrutka/soliq/to‘lov
jami hisoblanmaydi (`supabase/migrations/20260912120000_t2_forma3_closeout_v1.sql`).
Накопительная ведомость va АКТ Ф-2 hujjatlari ham Forma-3 jamisini
CHIQARMAYDI.

**Misol (bitta davr, bitta obyekt).** Tasdiqlangan F2 (Ф-2) aktlari davr
bo‘yicha to‘g‘ridan-to‘g‘ri xarajatlarda: 10 000 000 so‘m. Obyekt nakrutka
koeffitsientlari (standart): транспорт материалов 5 %, складские 2 %, прочие
подрядчика X %, страхование, риск, НДС 12 %.

| Variant | Forma-3 "за отчетный период" qatori | Misoldagi natija |
|---|---|---|
| **A** | Σ tasdiqlangan F2 summalari (НДС siz) + НДС 12 % | 10 000 000 + 1 200 000 = **11 200 000** |
| **B** | Σ F2 → LRV nakrutka kaskadi (ИТОГО-1…ИТОГО-4, `t2_nakrutka_hisobla_v1` bilan bir xil) → НДС | 10 000 000 × kaskad koeff. → НДС (koeff. obyektdan) |
| **C** | F2 aktlarning o‘zidagi yakuniy "ВСЕГО С НДС" (hujjat qatori sifatida kiritiladi, qayta hisoblanmaydi) | hujjatdagi son aynan |

Qo‘shimcha savollar: (1) avans ushlab qolish (удержание аванса) Forma-3 da
alohida qatormi? (2) "с начала строительства" ustuni qaysi F2 lardan
(faqat `tasdiqlangan`)? (3) Forma-3 bitta obyektmi yoki loyiha (shartnoma)
bo‘yichami?

**Tavsiya:** C (hujjat haqiqati) + nazorat uchun A/B hisobi yonma-yon
ogohlantirish bilan — sayt hech qachon yuridik summani o‘zi "to‘qimaydi".

**Qaror:** _(egasi yozadi)_

---

## Q2. АКТ Ф-2 da НДС qaysi asosdan hisoblanadi

**Holat.** Rasmiy АКТ Ф-2 (`lib/f2-akt-tn-export.ts`, Накопительная
sahifasidagi "Rasmiy Ф2 hujjati") va F2 tayyorlash qoralamasi
(`lib/f2-native-export.ts`) endi "НДС" va "ВСЕГО ПО АКТУ С НДС" qatorlariga
ega. Stavka foydalanuvchi kiritadi (sahifadagi "QQS (НДС) stavkasi, %");
**bo‘sh bo‘lsa** НДС va ВСЕГО С НДС bo‘sh qoladi, hujjatda "ставка НДС не
указана" ogohlantirishi chiqadi. Obyekt nakrutka koeffitsientidan (`НДС`)
avtomatik to‘ldirilMAYDI, chunki F2 qator summalari to‘g‘ridan-to‘g‘ri
xarajatmi yoki allaqachon ustamalar bilanmi — tasdiqlanmagan.

**Variantlar:** A — НДС = ВСЕГО ПО АКТУ × stavka (hozirgi xatti-harakat,
stavka kiritilganda); B — avval nakrutka kaskadi, keyin НДС (Q1-B bilan bir
xil); C — НДС F2 hujjatning o‘zidan olinadi.

**Tavsiya:** A, stavka obyekt nakrutkasidagi `НДС` bilan oldindan
to‘ldirilsin (tahrirlanadigan).

**Qaror:** _(egasi yozadi)_

---

## Q3. `t2_nakopitelniy_v1` jamilarida smeta summasi ikki-uch marta sanaladi (YANGI TOPILMA)

**Dalil (production, faqat o‘qish, 2026-09-25):**

| obyekt | barglar (rs/mat/ob) summasi | bl summasi | rz summasi | RPC `jami.smeta_summa` (hammasi) |
|---|---:|---:|---:|---:|
| 6 (Amfiteatr) | 43 596 859 620,62 | 13 393 640 976,62 | 43 596 859 620,62 | **100 587 360 217,86** |
| 84 / 91 / 77 | = hammasi | 0 | NULL | to‘g‘ri |

RPC `jami.smeta_summa = sum(q.summa)` BARCHA turlar bo‘yicha; bl/rz
qatorlarining `summa` si bolalarining takrori bo‘lgan obyektlarda (6) jami
2,3 barobar oshib ketadi. Накопительная sahifasidagi "Smeta jami" va
"Bajarilish %" shu sababli noto‘g‘ri bo‘lishi mumkin.

**Hujjat tomoni allaqachon to‘g‘ri:** yangi Накопительная ведомость hujjati
jamilarni faqat barglar bo‘yicha formulalar bilan quradi
(`nakopitelniyJamilar`).

**Tuzatish (production migratsiya — ruxsatingiz kerak):** RPC agg da
`where q.tur in ('rs','mat','ob')` filtri (additive `create or replace`,
rollback — eski ta’rif). Migratsiya yozilmagan va qo‘llanmagan.

**Qaror:** _(egasi yozadi)_

---

## Q4. Katta obyektda Накопительная/АКТ Ф-2 hujjati: 3 000 qator chegarasi (YANGI TOPILMA)

`t2_nakopitelniy_v1` bir so‘rovda ko‘pi bilan 3 000 qator qaytaradi (gateway
sukuti 500). Ilgari eksport JIMGINA birinchi 500 qatordan hujjat yasardi.
Endi: sahifa 3 000 bilan qayta so‘raydi; baribir `truncated` bo‘lsa hujjat
**yasalmaydi** va sabab ko‘rsatiladi. Suniy Ko‘l (27 000+ qator) uchun
hujjat hozir chiqmaydi.

**Variantlar:** A — RPC ga sahifalash (`p_offset`) qo‘shish (additive,
production migratsiya); B — hujjat uchun alohida "faqat davrda harakat bo‘lgan
qatorlar + ularning rz/bl otalari" RPC si; C — hozirgidek bloklash.

**Tavsiya:** B (Ф-2 akti uchun kichik va aniq), Накопительная uchun A.

**Qaror:** _(egasi yozadi)_

---

## Q5. `t2_qator_holat` ga anon SELECT grant, view `security_invoker` emas

Yopish tavsiya etiladi (`revoke select on t2_qator_holat from anon`;
`alter view … set (security_invoker = on)`). Production DDL — ruxsat kerak.

**Qaror:** _(egasi yozadi)_

## Q6. `/api/agent/call` (Hermes) marshruti

Hermes ishlatilmaydi. Marshrutni olib tashlash tavsiya etiladi
(`frontend/functions/api/agent/`). Tasdiqlang.

**Qaror:** _(egasi yozadi)_

## Q7. "Suniy Ko‘l" (obyekt 84) — 2 413 vedomost qatori ish sifatida ikki marta

Eski import `ВЕДОМОСТЬ РЕСУРСОВ` blokini ish sifatida kiritgan. "Suniy Ko‘l 2"
(91) to‘g‘ri: 24 324 barg. Variant: 84 ni arxivlash (soft) va 91 ni asosiy
qilish, yoki 84 ga qayta import. Real ma’lumotga yozish — faqat sizning
ruxsatingiz bilan.

**Qaror:** _(egasi yozadi)_

## Q8. ТЕПЛОТРАССА 02-04 / 02-05 — svod bilan −1,70 чел-ч farq

Anatomiya svod tekshiruvi farqni ko‘rsatadi; manba faylda xato yoki
yaxlitlash. Ofis PC da real fayl bilan ko‘rib chiqish kerak (UNKNOWN).

**Qaror:** _(egasi yozadi)_

## Q9. Faravon РАЗМЕТКА joylashuvi; TN va ABC4 ishora (belgi) farqi

Qaysi bo‘limga tegishli ekanini va TN/ABC4 dagi manfiy/musbat ishora
konvensiyasini real fayl bilan tasdiqlang (UNKNOWN).

**Qaror:** _(egasi yozadi)_

## Q10. Additional/Replacement migratsiyasi

Tekshiruv natijasi `ops/handoff/PTO_LINIYA_YAKUN_HISOBOT_2026-09-25.md` (P9)
da. Agar prodda qo‘llanmagan bo‘lsa — qo‘llash uchun ruxsatingiz kerak.

**Qaror:** _(egasi yozadi)_

## Q11. Narxlar GAS → native o‘tkazish strategiyasi

Tavsiya: feature flag bilan bosqichma-bosqich — native sukut bo‘yicha, eski
GAS yo‘li flag ortida; siz ikkala natijani solishtirgach GAS yo‘li o‘chiriladi.
Holat: P9 bo‘limida.

**Qaror:** _(egasi yozadi)_

---

## Q12. Ijro hujjatlari: АОСР (скрытые работы), промежуточная приемка ответственных конструкций, акты испытаний, лаборатория — smeta bilan integratsiya (egasi so'rovi, 2026-09-25)

**Egasi:** "AKT SKRITI RABOT, AKT PROMEJUTOCHNIY OTVETSTVENNOY KONSTRUKSIYA,
ISPITANIYA AKTLARI, LABORATORIYA HUJJATLARI … smeta va hujjatlar integratsiya
bo'lishi kerak. T1 da akt generator bor edi, lekin GAS da ishlaydi —
T2 ga integratsiya qilamizmi yoki xuddi shu shaklda qoldiramizmi?"

**Hozirgi holat (kod bilan tekshirildi):**
- T1 (GAS): `Smeta tizimi/45_Hujjatlar.js` — akt REYESTR (Google Sheet,
  `DOC_AKT`), `apiAktIshlar` (fakt > 0 ishlar), yashirin ish kalit so'zlari
  (`_YASHIRIN_KW`: ФУНДАМЕНТ, АРМАТУР, ГИДРОИЗОЛ …), `apiAktCoverage`
  ("fakt bor, akt yo'q"), `apiAktSmetadan` (ish nomi/hajm/materiallar
  smetadan), `workKey = obyekt||KOD`; `67_AI_Akt.js` — AOSR matnini AI
  tozalaydi (raqam/material o'ylab topilmaydi, faqat smetadan).
- T2: `docs/architecture/UZ_CONSTRUCTION_DOCUMENT_CATALOG_AND_TEMPLATES_V1.md`
  da `aosr_v1` (ShNQ 3.01.01-22, 6-ilova blanki) va `aosr_register_v1`
  kanonik hujjat turlari rejalashtirilgan, lekin jadval/RPC/UI **yo'q**.
- Laboratoriya/sinov: T2 da faqat umumiy fayl saqlash (R2 `t2_obyekt_hujjat`),
  smeta qatoriga bog'lanish yo'q.

**Variantlar:**

| | A — GAS da qoldirish | B — T2 ga to'liq ko'chirish | C — Bosqichli (tavsiya) |
|---|---|---|---|
| Haqiqat manbai | Google Sheet REYESTR (Konstitutsiyaga zid: Supabase yagona haqiqat) | Supabase | Supabase; T1 REYESTR bir martalik import, keyin faqat o'qish |
| Smeta bog'lanishi | `workKey` matn (kod/nom) — qayta importda uziladi | `t2_qator.id` (kanonik ID) | `t2_qator.id` + eski workKey dan moslash hisoboti |
| Hujjat shakli | GAS shablonlari | hujjat-yozuvchi (H1–H9, A4, imzolar, ShNQ blanki) | shu |
| Nazorat | coverage GAS da | "fakt bor — АОСР yo'q" qizil signal Fakt/LRV/F2 da; F2 ga kiritishdan oldin ogohlantirish | shu |
| Xavf | past (hozir ishlaydi), lekin ikki haqiqat | yangi migratsiya + UI hajmi katta | ish to'xtamaydi |

**Tavsiya — C (T2 native, bosqichma-bosqich):**
1. *Ma'lumot modeli* (additive migratsiya, ruxsatingiz bilan):
   `t2_ijro_hujjat` (tur: `aosr` | `promejutochnaya_priemka` | `ispytanie` |
   `laboratoriya` | `boshqa`; raqam, sana, holat qoralama→imzolangan→bekor,
   komissiya, keyingi ishga ruxsat, fayl R2) + `t2_ijro_hujjat_qator`
   (→ `t2_qator.id`, hajm, materiallar/sertifikatlar) — tenant, audit,
   operation_id, versiya bilan.
2. *Generator*: ish qatoridan (LRV) АОСР qoralamasi — nom, hajm, materiallar
   smetadan; blank ShNQ 6-ilova (subpudratchili/subpudratchisiz); Excel + PDF
   hujjat-yozuvchi orqali. AI faqat matnni tozalaydi (T1 dagi qoida).
3. *Nazorat*: yashirin ishlar ro'yxati (T1 `_YASHIRIN_KW` + operator
   belgilashi), "fakt bor — akt yo'q" hisobi; F2 tayyorlashda ogohlantirish
   (bloklash — sizning qaroringiz bilan).
4. *Laboratoriya/sinov*: fayl yuklanadi va ish qatoriga/АОСР ga bog'lanadi
   (bir protokol — ko'p ish).
5. *T1 dan ko'chish*: REYESTR bir martalik import (dry-run hisoboti bilan),
   GAS generatori faqat o'qish rejimiga o'tadi, keyin o'chiriladi.

**Sizdan kerak:** (a) variant tanlovi (A/B/C); (b) real blanklar
(`AKT_SYSTEM_TEMPLATES`, promejutochnaya priemka, sinov akti namunalari —
ofis PC dan) — shakl o'ylab topilmaydi; (c) АОСР yo'qligida F2 ni bloklash
yoki faqat ogohlantirish; (d) migratsiyani prodga qo'llashga ruxsat.

**Qaror:** _(egasi yozadi)_

---

## Q13. Moslashuvchan ustun aniqlash — sizning qoidangiz tasdig'i

PTO qo'shgan/o'zgartirgan ustunlar endi barcha Excel o'quvchilarida (smeta
anatomiyasi, F2 import, Oferta, RES narxlash) ma'lumot bilan isbotlanadi:
hajm × narx ≈ summa eng ko'p qatorda bajarilgan uchlik tanlanadi; isbot
yetarli bo'lmasa sarlavha natijasi qoladi va "ishonch past" deb ko'rsatiladi.
Savol: isbot bilan sarlavha **farq qilganda** tizim avtomatik ma'lumot
isbotini oladi (hozirgi xatti-harakat, operatorga izoh ko'rsatiladi) — yoki
har safar operator tasdiqlasinmi?

**Qaror:** _(egasi yozadi)_
