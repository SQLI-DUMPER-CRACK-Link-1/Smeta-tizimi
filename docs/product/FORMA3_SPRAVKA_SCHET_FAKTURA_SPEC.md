# FORMA-3 (СПРАВКА-СЧЕТ-ФАКТУРА) — haqiqiy shakl va rekvizitlar

**Manba:** egasining Drive'idagi TASDIQLANGAN F2 fayllari ichidagi
`СЧЁТ-ФАКТ.` varag'i. O'rganilgan fayl:
`Amfiteatr F2 Dekabr-2025 (GS)` (`1vYcrj_IoS18Gu9xSThKjI0PRux0cytTRcZquuOo6GII`),
varaqlar: `СЧЁТ-ФАКТ. (Амфитеатр)` · `ф2 Амфитеатр (fakt) (2)` · `ОБЛОЖКА тер)`.

Bu hujjat — **o'lchangan haqiqat**, taxmin emas: har bir katak manzili
bilan quyida keltirilgan.

---

## 1. Hujjatning haqiqiy tuzilishi

### 1.1 Sarlavha bloki

| Katak | Mazmun |
|---|---|
| `A3` | `СПРАВКА-СЧЕТ-ФАКТУРА О СТОИМОСТИ ВЫПОЛНЕННЫХ РАБОТ (ПОНЕСЕННЫХ ЗАТРАТ)` |
| `B4` | `ЗА <ОЙ> МЕСЯЦ <ЙИЛ> ГОДА` |
| `E6` / `G6` / `J6` | `Номер документа` · `Дата составления` · `Отчетный период` |
| `J7` / `L7` | `с` · `по` |
| `E8` / `G8` / `J8` / `L8` | hujjat №, tuzilgan sana, davr boshi, davr oxiri |

### 1.2 Rekvizitlar — IKKI USTUN

Chapda (`B` ustuni) **Подрядчик**, o'ngda (`I` ustuni) **Заказчик**:

| Qator | Подрядчик (B) | Заказчик (I) |
|---|---|---|
| 10 | `Подрядчик: ООО "New Temes Buildings"` | `Заказчик: "Янги Навоий шахарчаси" Ишбилармонлик маркази дирекцияси ДМ` |
| 11 | `Адрес: г.Ташкент Янгихаят р-н ул. Турсунзода дом 60` | `Адрес: г.Навои ул.И.Каримова дом 77` |
| 12 | `Телефон: (90) 233-97-07` | `Телефон: 95-246-70-70 / 224-08-81` |
| 13 | `р/с: 2020 8000 8008 3155 6001` | `Основной счёт: 4600 1086 0124 0117 0139 9001 8001` |
| 14 | `Банк: АК "Ипотека Банк" Шайхонтохур филиали` | `Банк: Марказий банк Тошкент ш. ХККМ` |
| 15 | `МФО: 00425` | `МФО: 00014` |
| 16 | `ИНН: 305 238 901` | `ИНН: 311 311 785` |
| 17 | `ОКЕД 41201` | `ОКЭД 84130` |

### 1.3 Obyekt va shartnoma

| Katak | Mazmun |
|---|---|
| `A19` | `Наименование объекта и его адрес: …` |
| `B20` | `Договор №… от …; №… от …. Общая договорная …` |
| `J20` / `K20` | shartnoma umumiy summasi · `сўм` |

### 1.4 Jadval sarlavhasi — IKKI QAVATLI (r23–r24), A..P

| Ust. | 1-qavat (r23) | 2-qavat (r24) |
|---|---|---|
| A | `№` | — |
| B | `Наименование объектов, этапов, вид работ и оборудование` | — |
| C | `Ед. изм` | — |
| D–E | `Объём работ и затрат физических показателях` | D `Всего` · E `в т.ч. на текущий год` |
| F–G | `Стоимость в текущих показателях` | F `Всего` · G `в т.ч. на текущий год` |
| H–J | `Сначала проведённых работ` | H `в физических показателях` · I `в % к объёму всего работ` · J `в договорных текущих ценах` |
| K–M | `Сначала года` | K `физ.` · L `%` · M `в договорных текущих ценах` |
| N–P | `в т.ч. за отчётный месяц` | N `физ.` · O `%` · P `в договорных текущих ценах` |

`r25` — ustunlarni raqamlash qatori: `1.0 … 16.0`.

### 1.5 Tana va yakun

| Qator | Mazmun |
|---|---|
| `A26` | obyekt nomi (bo'lim sarlavhasi) |
| `B27` | `ИТОГО ЗАТРАТЫ ПО ОБЪЕКТАМ` — F/G/J/M ustunlarida summalar |
| `B28` | `НДС 12%` |
| `B29` | `ВСЕГО ПО ОБЪЕКТУ` (+ H29/K29 da bajarilish ulushi, masalan `0.5089` = 50.89 %) |
| `B31` | izoh: `Стоимость объекта в текущих ценах определяется после разработки ПСД и …` |

### 1.6 Imzolar

| Qator | Chap (ЗАКАЗЧИК) | O'ng (ПОДРЯДЧИК) |
|---|---|---|
| 33 | `ЗАКАЗЧИК` | `ПОДРЯДЧИК` |
| 35 | `Директор: <F.I.Sh.>` | `Директор: <F.I.Sh.>` |
| 37 | `Гл. бухгалтер: ______` | `Гл. бухгалтер: ______` |

> ⚠️ O'rganilgan faylning o'zida `P27`, `U27`, `W27`, `N29`, `W30` kataklarida
> `#REF!` xatolari bor — manba faylda havolalar buzilgan. Yangi tizim buni
> takrorlamasligi kerak.

---

## 2. Bazadagi holat va BO'SHLIQLAR

### 2.1 Allaqachon mavjud

| Jadval | Foydali ustunlar |
|---|---|
| `t2_forma3` | `kompaniya_id, loyiha_id, obyekt_id, shartnoma_id, raqam, davr_boshi, davr_oxiri, holat, bajarilgan_f2_summa, qoida_holat, qoida_manba, izoh, versiya, operation_id, actor_id` |
| `t2_forma3_akt` | `forma3_id ↔ akt_id` (qaysi F2 aktlari kirgan) |
| `t2_kompaniya` (ПОДРЯДЧИК) | `toliq_nom, inn, manzil, rahbar, telefon, bank, hisob_raqam, mfo` |
| `t2_kontragent` (ЗАКАЗЧИК) | `inn, nom, rahbar, manzil, mfo, hisob_raqam, qqs_tolovchi, mavqe` |
| `t2_loyiha_qatnashchi` | `rol` — `zakazchik / bosh_pudratchi / subpudratchi / loyihachi / taminotchi`; buyurtmachi shu orqali topiladi (`kompaniya_id` yoki `kontragent_id`) |

### 2.2 Yetishmayotgan rekvizitlar — MIGRATSIYA KERAK

| Maydon | Qayerda kerak | Holat |
|---|---|---|
| `oked` (ОКЕД/ОКЭД) | `t2_kompaniya` VA `t2_kontragent` | **YO'Q — ikkalasida ham** |
| `telefon` | `t2_kontragent` | **YO'Q** (kompaniyada bor) |
| `bank` (bank nomi) | `t2_kontragent` | **YO'Q** (kompaniyada bor) |
| `bosh_buxgalter` | `t2_kompaniya` VA `t2_kontragent` | **YO'Q** — imzo bloki uchun |
| Shartnoma raqami/sanasi/summasi | `t2_shartnoma` | tekshirilmagan — `shartnoma_id` bor, ustunlari o'rganilmagan |

> Bular **additive** migratsiya (faqat `add column`), mavjud ma'lumotga
> tegmaydi. Lekin production migratsiya — **egasining tasdig'i bilan**.

### 2.3 Hisob-kitob bo'shlig'i

`CURRENT_STATE.md` da qayd etilgan: `t2_forma3` da **UNRESOLVED boundary** —
huquqiy/soliq/to'lov jami ustuni ataylab qo'yilmagan (`qoida_holat`
default `FORMA3_…`). Ya'ni НДС stavkasi va «Всего по объекту» qoidasi
authoritative manbadan tasdiqlanmagan.

Haqiqiy faylda: **НДС 12 %**, `ВСЕГО = ИТОГО + НДС`. Buni canonical qoida
sifatida qabul qilish uchun egasining tasdig'i kerak (shartnomaga bog'liq
bo'lishi mumkin — ba'zi shartnomalarda ҚҚС boshqa stavkada yoki umuman yo'q).

---

## 3. Nakrutka bilan bog'lanish

Egasining ogohlantirishi (2026-09-09): *«bu nakrutka qatorlari aslida
lrv plusda ham bo'lishi hisoblanishi kerak, bo'lmasa butun tizimda
summalar faqat primoy zatratda hisoblanib qoladi»*.

`t2_nakrutka_hisobla_v1` kaskadi (migratsiya `20261014090000`) aynan
Forma-3 dagi «ИТОГО → НДС → ВСЕГО» zanjirining ichki qismi:

```
pryamye = chel + mash + mat + ob
tr_mat  = (mat − kab) × ТРАНСПОРТ_МАТЕРИАЛ %
skl_mat = (mat − bez − mk) × СКЛАДСКИЕ_МАТЕРИАЛ % + mk × СКЛАДСКИЕ_МК %
tr_kab  = kab × ТРАНСПОРТ_КАБЕЛЬ %
itogo1  = pryamye − ob + tr_mat + skl_mat + tr_kab
prochie = itogo1 × ПРОЧИЕ_ПОДРЯДЧИК %
itogo2  = itogo1 + prochie
tr_ob   = ob × ТРАНСПОРТ_ОБОРУД %      zag_ob = ob × ЗАГОТ_СКЛАД_ОБОРУД %
itogo3  = itogo2 + ob + tr_ob + zag_ob
strax   = itogo3 × СТРАХОВАНИЕ %        risk   = itogo3 × РИСК %
itogo4  = itogo3 + strax + risk
nds     = itogo4 × НДС %                vsego  = itogo4 + nds
```

Kategoriya manbai (`t2_obyekt_nakrutka_v1`):
`mat` = `МАТ + М/К + КАБ` (to'liq material bucket; `mk`/`kab` formulada
qaytadan ayriladi), `bez` = 0.

**Xulosa:** LRV_PLUS eksportida ham shu kaskad jadvali bo'lishi kerak,
aks holda hujjatdagi jami faqat **прямые затраты** bo'lib qoladi.

---

## 4. Keyingi qadamlar

1. **Additive migratsiya** (egasining tasdig'i bilan): `oked`,
   `bosh_buxgalter` — `t2_kompaniya` va `t2_kontragent` ga; `telefon`,
   `bank` — `t2_kontragent` ga.
2. `t2_shartnoma` ustunlarini o'rganish (raqam, sana, umumiy summa) —
   `B20`/`J20` uchun.
3. Forma-3 eksporti: yuqoridagi A..P jadval tuzilishi + ikki ustunli
   rekvizit bloki + imzo bloki.
4. НДС stavkasi va «ВСЕГО» qoidasini egasidan tasdiqlatish
   (`qoida_holat` ni `UNRESOLVED` dan chiqarish uchun).
5. LRV_PLUS va Forma-2 eksportlariga nakrutka kaskadi jadvalini qo'shish.
