# ERP talablar va T2 PTO integratsiya matritsasi

**Holat:** `DOCUMENTATION_ONLY / PARTIAL_RESEARCH`
**Sana:** 2026-09-10
**Tayyorlagan:** Hermes, `hermes/t2-pto-closure-v1`

## Chegara

Bu hujjat internetdan topilgan rasmiy manbalarni T2 PTO verticali bilan
solishtiradi. U legal xulosa, soliq maslahati yoki ERP connector design’ini
almashtirmaydi. Rasmiy manbada aniq ko‘rsatilmagan biznes qoida va rekvizitlar
**ixtiro qilinmaydi**. ERP integratsiyasi uchun API, Supabase, migration, auth/RLS yoki
calculation code o‘zgartirilmadi.[unverified]

## Source-backed findings

Lex.uz’dagi 3538-son Nizom axborot tizimlari orqali boshlang‘ich hujjatlar va registrlarni yuritishga yo‘l qo‘yilishini, boshqa normativ talablar ham bajarilishini aytadi.[1]

Shu Nizom buxgalteriyaga keladigan boshlang‘ich hujjatlarni majburiy tekshirishni talab qiladi.[1]

O‘RQ-404 buxgalteriya hisobining to‘liq va ishonchli yuritilishi hamda hisob hujjatlarining saqlanishini talab qiladigan manba sifatida ishlatildi.[2]

O‘RQ-404 buxgalteriya hisobini yuritishda maxfiylikka rioya qilishni ko‘rsatadi.[2]

522-son hujjat EHFni shakllantirish, yuborish, tasdiqlash va undan foydalanish tartibini alohida sxema bilan bog‘laydi.[3]

522-son hujjat EHF oluvchisi uni ERI bilan tasdiqlashi yoki sabab ko‘rsatib rad etishini qayd etadi.[3]

522-son hujjat ikki tomonlama tasdiqdan keyin EHFga QR-kod biriktirilishini ko‘rsatadi.[3]

Ushbu manbalar T2 uchun document provenance va review gate zarurligini asoslaydi.[1][2]

Ushbu manbalar T2 ichidagi F2 lifecycle nomlari yoki ERP vendor API’sini belgilamaydi.[1][2][3]

Vendor endpointi, ERI provideri va QR verification yo‘li bu branchda aniqlanmagan.[unverified]

F2 va EHF statuslari bir xil huquqiy status deb qabul qilinmaydi.[unverified]

ERP connectorning production write yo‘li bu branchda yoqilmagan.[unverified]

## Rasmiy manbalardan ajratilgan talablar

| ID | Rasmiy manba talabi | T2 uchun xavfsiz product implication | Hozirgi holat |
|---|---|---|---|
| ERP-01 | Boshlang‘ich hujjatlar va registrlarni axborot tizimi orqali yuritish mumkin, bunda Nizom va boshqa normativ talablar bajarilishi kerak.[1] | Document registry, source hash, revision, actor va approval provenance har bir hujjatga bog‘langan bo‘lishi kerak; ERP adapter canonical T2 writer o‘rnini bosmaydi. | **Qisman:** canonical document registry/R2 va source provenance mavjud; huquqiy muvofiqlik/ERI production dalili yo‘q. |
| ERP-02 | Buxgalteriyaga kelgan boshlang‘ich hujjatlar majburiy tekshiruvdan o‘tkaziladi.[1] | Import/job/F2 qoralama “review required” holatini saqlaydi; tekshiruv tugamasdan approved ledger/exportga o‘tmasin. | **Source:** F2 preapproval audit va lifecycle draft/review controls bor; production approval evidence yo‘q. |
| ERP-03 | Buxgalteriya hisobi to‘liq va ishonchli yuritilishi hamda hisob hujjatlari but saqlanishi kerak.[2] | Append-only history, immutable approved F2, correction-as-new-revision, soft-cancel va no hard-delete yo‘li talab qilinadi. | **Implemented source contract:** lifecycle/history/correction migration yozildi; DB apply qilinmagan. |
| ERP-04 | Buxgalteriya hisobini yuritishda maxfiylikka rioya qilinadi.[2] | Company/project/object scope, actor membership va server-side tenant check ERP read/write adapterda majburiy. | **Source controls:** company context, gateway actor binding, RLS/security functions mavjud; live cross-tenant test yo‘q. |
| ERP-05 | EHF shakllantirish, yuborish, tasdiqlash va foydalanish tartibi alohida sxema bo‘yicha yuradi.[3] | EHF connector kelajakda explicit state machine, source document ID, delivery/acceptance timestamp va external reference talab qiladi; buni F2 approval state bilan aralashtirmaslik kerak. | **Deferred:** EHF connector/integration contract ishlab chiqilmadi. |
| ERP-06 | EHF oluvchi tomonidan ERI bilan tasdiqlanadi yoki sababi ko‘rsatilgan holda rad etiladi.[3] | External EHF reject reason majburiy bo‘ladi; T2 F2 reject reason bilan alohida domain event sifatida saqlanadi. | **Deferred:** ERI provider, counterparty identity va EHF external IDs authoritative source’dan aniqlanmagan. |
| ERP-07 | Ikki tomonlama tasdiqlangandan keyin EHFga QR-kod biriktiriladi.[3] | ERP connector QR/evidence artifactni faqat external system tasdiqlagandan keyin reference sifatida saqlashi mumkin; QR qiymatini T2 ichida uydirmaslik kerak. | **Deferred:** external EHF/QR verification endpoint va legal retention rule topilmadi. |

## T2 bilan mapping qilinadigan canonical portlar

1. **Company / project / object:** ERP payloaddagi tenant va lineage T2
   `kompaniya_id → loyiha_id → obyekt_id` bilan tekshiriladi. Nomi bo‘yicha
   avtomatik bind qilish mumkin emas.[unverified]
2. **Source document:** faqat canonical document registry/R2 `document_id`,
   revision va SHA-256. Drive/Sheets nusxa canonical identity emas.[unverified]
3. **Approval:** F2 `draft → submitted → checked → approved/rejected/cancelled`
   lifecycle’i ERP external acceptance state bilan birlashtirilmaydi.[unverified]
4. **History:** external ERP/EHF response append-only event sifatida saqlanadi;
   mavjud T2 qator yoki approved F2 in-place tahrir qilinmaydi.[unverified]
5. **Unknown:** ERP javobida summa, sana, ERI, QR yoki external ID yo‘q bo‘lsa,
   qiymat `NULL/unknown` qoladi; `0`, “tasdiqlangan” yoki fake reference
   bilan almashtirilmaydi.[unverified]

## Integratsiya uchun deferred checklist

- [ ] ERP/EHF provayderi va rasmiy API specification owner tomonidan tanlansin.[unverified]
- [ ] ERI/QR verification, retention va external status mapping uchun rasmiy
  manbalar tasdiqlansin.[unverified]
- [ ] Counterparty identity va company/project/object lineage mappingi
  alohida contract bilan review qilinsin.[unverified]
- [ ] Connector uchun sandbox credentials va read-only smoke owner tomonidan
  berilsin; unattended login/secret entry qilinmaydi.[unverified]
- [ ] ERP adapter write path faqat named RPC, actor session, operation ID,
  expected version va audit bilan chiqsin.[unverified]
- [ ] Migration/deploy/live EHF test production approvalsiz bajarilmasin.[unverified]

## Dalil holati va cheklovlar

Search backendning ayrim providerlari 403/DNS/response-shape xatolari bilan
ishlamadi. Shu sabab bu matrix faqat extract qilingan Lex.uz manbalariga
suyanadi; ERP vendor API, qurilishdagi F-2/F-3 maxsus rekvizitlari yoki ERI
provider qoidalari bo‘yicha xulosa chiqarilmaydi. Hujjat T2 source tree’ga
integratsiya qilinmadi; u documentation-level handoff hisoblanadi.[unverified]

## Sources

[1] https://lex.uz/docs/-7041901 — 3538-son: Buxgalteriya hisobida hujjatlar va hujjatlar aylanishi
    > "Tegishli texnik vositalar mavjud boʻlganda, boshlangʻich hujjatlarni va registrlarni, shuningdek tovar-moddiy zaxiralar, pul mablagʻlari hamda ish beruvchining xodimlari bilan bogʻliq boʻlgan ichki xoʻjalik operatsiyalari boʻyicha qatnashchilarni identifikatsiyalashni taʼminlagan holda tuzilgan hisob hujjatlarini axborot tizimlari xizmatlari va axborot texnologiyalari orqali yuritishga yoʻl qoʻyiladi. Bunda, mazkur Nizom va boshqa normativ-huquqiy hujjatlar talablariga rioya qilinishi lozim."
    > "Buxgalteriyaga kelib tushadigan boshlangʻich hujjatlar majburiy tekshiruvdan oʻtkaziladi."
[2] https://lex.uz/acts/-2931253 — O‘RQ-404: Buxgalteriya hisobi to‘g‘risida
    > "buxgalteriya hisobi toʻliq va ishonchli yuritilishini;"
    > "hisob hujjatlarining but saqlanishini;"
    > "Buxgalteriya hisobini yuritishda maxfiylikka rioya qilinadi."
[3] https://lex.uz/uz/docs/-4386769?ONDATE=19.03.2025&action=compare — 522-son: Elektron hisobvaraq-fakturalar
    > "EHFlarni shakllantirish, yuborish, tasdiqlash va ulardan foydalanish tartibi ushbu Nizomga ilovaga muvofiq sxemaga asosan amalga oshiriladi."
    > "Kelib tushgan EHF sotib oluvchi tomonidan elektron raqamli imzo bilan tasdiqlanadi yoki sababi koʻrsatilgan holda rad etiladi."
    > "Shu paytdan boshlab EHF ikki tomonlama tasdiqlangan hisoblanadi va rouming operatori tomonidan EHFga QR-kod biriktiriladi."
