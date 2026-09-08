# T2 PTO hujjat zanjiri — Codex poydevori

**Base:** `origin/integration/next-main-release-v1 @ 50e1fb72a81e187ba495865ce8515b13603dd9be`
**Branch:** `codex/t2-pto-document-chain-v1`
**Production/main/deploy:** yo‘q

## Nima aniq topildi

1. Fakt, F-2 va nakopitelniy mavjud, biroq ular foydalanuvchi tilida bitta
   aniq hujjat zanjiri bo‘lib ko‘rinmagan.
2. `fakt_summa` kanonik read modelda bor. Hozirgi native Fakt komandasi esa
   foydalanuvchidan hajm qabul qiladi; summa qaysi narx-asosdan kelishi
   aniq kontraktga bog‘lanmagan. Uni `actualProcurementPrice` yoki F-2
   summasi bilan almashtirish taqiqlanadi.
3. Forma-3 generatoriga avval oddiy `vatRatePercent` berishning o‘zi yetarli
   edi. Bu huquqiy qoida qaysi shartnoma dalilidan kelganini isbotlamasdi.
4. Slichitelniy generatori yo‘q edi.
5. Forma-2dagi joriy davr analitik farqi avval kumulyativ qiymat bilan
   solishtirilishi mumkin edi. Endi u faqat joriy davr `hajm × sertifikat
   narxi` bilan tekshiriladi; original sertifikat summasi mustaqil qoladi.

## Kiritilgan hujjat qoidalari

- Nakopitelniy endi oldingi/joriy/jami F-2ning **hajmi** va original
  **manba summasi**ni alohida ko‘rsatadi. `Qoldiq summa` aniq sertifikat
  summasi emas, `smeta nazorati` deb belgilanadi.
- Slichitelniy (`TPL-08`) ichki reconciliation: A = smeta limiti,
  B = tasdiqlangan F-2ning muzlatilgan qiymati. Kalit `lineId`; Excel satr
  raqami yoki nom bo‘yicha auto-match yo‘q. Farq faqat ko‘rsatiladi,
  hech bir manba avtomatik tahrir qilinmaydi.
- Forma-3 faqat `documentId`, `ruleVersion` va `vatRatePercent`ni birga
  beradigan tasdiqlangan shartnoma/buxgalteriya qoida dalili bilan yaratiladi.
  Bunday dalil read-modelda yo‘qligi sabab UI uni `FORMA3_RULE_UNRESOLVED`
  sifatida bloklaydi. Bu vaqtinchalik soxta QQS yoki to‘lov jami chiqishini
  oldini oladi.

## Fakt summa bo‘yicha keyingi kanonik bo‘lak

Avval yangi ekran ochish emas, alohida backend kontrakt kerak:

```text
Fakt manba hujjati / dalil ID
  + qator ID
  + fakt hajmi
  + fakt summa yoki haqiqiy narx-asos
  + operation_id / versiya / actor
  -> append-only Fakt akt qatori
```

`fakt_summa` faqat shu hujjat manbasi bilan yoziladi. F2 `certified_amount`,
smeta narxi va xarid narxi o‘zaro substitute emas.

## Tekshiruv mezoni

- Forma-2 original certified amountni o‘zgartirmaydi.
- Forma-3 evidence-siz rad etiladi.
- Slichitelniy barqaror ID bilan chiqadi va `OCHIQ` farqni yopmaydi.
- Nakopitelniyda unknown qiymat `0` emas, `NOANIQ` bo‘lib qoladi.
