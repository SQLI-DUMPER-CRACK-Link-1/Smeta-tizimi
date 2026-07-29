# 🧾 FAZA 3 — Ф2 ИМПОРТ ва ТАЙЁРЛАШ

> **Mo'ljal:** 2–3 sessiya · **Xavf:** 🔴 ENG YUQORI
> **Bu tizimning eng murakkab va eng ko'p ishlatiladigan qismi.**

---

## 0. ⚠️ ENG MUHIM QOIDA — ALGORITMNI YOZMANG

`01_API_SHARTNOMA.md` §7 ni qayta o'qing.

**Ф2 моslashtirish mantiqi saytda YOZILMAYDI.** Kod solishtirish, fuzzy
o'xshashlik, birlik tekshiruvi, razdel doirasi — birortasi ham.

Sabab: bu mantiq hozir `Panel.html` da ~8000 satr va juda nozik sozlangan
(Т↔КГ qalqoni, ПК≠ПБ farqi, razdel-doirali unikallik, 0.86 Dice chegarasi).
Ikkinchi nusxa yozilsa — panelda 1466 ta moslik, saytda 1201 ta chiqadi va
foydalanuvchi qaysiga ishonishni bilmaydi.

**Claude uni GAS'ga ko'chiradi:**

```ts
apiF2AvtoMoslash(aktDaraxt, obyekt, opts)
  → { mosliklar: Moslik[], dopps: Dop[], statistika: Stat }
```

⏳ **Bu funksiya hali yozilmagan.** Claude uni Faza 2 davomida yozadi va
`01_API_SHARTNOMA.md` ga qo'shadi. **Tayyor bo'lmaguncha bu fazani boshlamang** —
`JAVOB_SAVOL.md` ga «Faza 3 ga tayyorman, apiF2AvtoMoslash kerak» deb yozing.

**Sizning ishingiz — natijani ko'rsatish.** Aql GAS'da, go'zallik saytda.

---

## 1. MAVJUD API

| Funksiya | Vazifa | Vaqt |
|---|---|---|
| `apiF2LokalkaRoyxat(obyekt)` | lokalkalar ro'yxati | tez |
| `apiF2FaylOqi(fileId, varaq, colConfig)` | akt faylini daraxt qilib o'qish | 5–20 s |
| `apiF2OySkan(obyekt, oyNom, subFilter)` | oydagi mavjud summa (solishtirish uchun) | 5–15 s |
| `apiF2QollaNavbatga(obyekt, oyNom, edits, dopps, aktJami)` | **fon rejimida yozish** | darhol qaytadi |
| `apiF2JobHolat()` | yozish jarayoni holati | tez |
| `apiF2QollaProgress()` | progress foizi | tez |
| `apiF2QollaLog()` | batafsil log | tez |

---

## 2. ⭐ YOZISH — FAQAT FON REJIMIDA

**`apiF2Qolla` ni to'g'ridan-to'g'ri chaqirmang.**

Sabab: katta obyektda yozish 4–10 daqiqa oladi, GAS chegarasi esa 6 daqiqa.
Ilgari yozuv yarmida uzilib qolgan (foydalanuvchi: *«5 дақиқадан бери
турибдида»*). Shuning uchun **navbat (job) tizimi** qurilgan.

### To'g'ri naqsh

```ts
// 1. Navbatga qo'yish — DARHOL qaytadi
const { jobId } = await gas<{jobId:string}>(
  'apiF2QollaNavbatga', obyekt, oyNom, edits, dopps, aktJami
);

// 2. Holatni so'rab turish — har 3 soniyada
const holat = useQuery({
  queryKey: ['f2job'],
  queryFn: () => gas<F2Holat>('apiF2JobHolat'),
  refetchInterval: (q) => q.state.data?.tugadi ? false : 3000,
});
```

### Foydalanuvchi uchun ko'rinish

```
┌─────────────────────────────────────────────────┐
│ 🔄 Ф2 ёзилмоқда                                  │
│                                                  │
│ ████████████████░░░░░░░░░  64%                  │
│ 780 / 1 220 қатор · 2-босқич (таҳрирлар)        │
│ Ўтган вақт: 3 дақ 12 сон                        │
│                                                  │
│ ✅ Компьютерни ўчирсангиз ҳам ёзув давом этади.  │
│    Кейин қайтиб келиб шу саҳифадан кузатасиз.    │
└─────────────────────────────────────────────────┘
```

Oxirgi satr **muhim** — foydalanuvchi buni alohida so'ragan
(*«компьютерни ўчириб кетсам ҳам маълумотларни ёзиб тура олади»*).

### Qayta ulanish

Sahifa qayta ochilganda `apiF2JobHolat()` ni chaqiring — agar ish davom
etayotgan bo'lsa, **darhol progress ekranini ko'rsating**. Foydalanuvchi
qayerda qolganini yo'qotmasin.

---

## 3. EKRAN — 4 QADAM

Yuqorida qadam ko'rsatkichi:

```
① Файл  →  ② Мослаштириш  →  ③ Текшириш  →  ④ Ёзиш
```

### ① Файл танлаш

- Drag & drop maydoni + «Компьютердан танлаш»
- Yoki Drive'dagi mavjud Ф2 fayllar ro'yxatidan
- Yuklangach: varaq tanlash (agar bir nechta bo'lsa)
- Lokalka tanlash — **ixtiyoriy**

> ⚠️ **Lokalka tanlashni MAJBURIY qilmang.** Bu ilgari qilingan va
> foydalanuvchi rad etgan: *«битта ф2 да ҳамма разделда қисмлар бўлиши
> мумкинда»*. Tanlanmasa — butun obyekt bo'yicha qidirilsin.

O'qilgach darhol xulosa:

```
✅ Ўқилди:  1 220 та қатор · 47 та раздел · Ф2 жами 1 240 500 000 сўм
```

### ② Мослаштириш — asosiy ekran

**Ikki panelli ko'rinish:**

```
┌── АКТ (файлдан) ──────────┐  ┌── СМЕТА (LRV_PLUS) ─────────┐
│ ▸ Раздел 1                 │  │ ▸ Раздел 1                  │
│   🔧 Бетон М300   120 м3 ●─┼──┼─● 🔧 Бетон М300    120 м3   │
│     🧱 Цемент      24 т  ●─┼──┼─● 🧱 Цемент М400    24 т    │
│   🔧 Арматура      8 т   ○ │  │   🔧 Арматура А500  8 т     │
└────────────────────────────┘  └─────────────────────────────┘
```

**Bog'lanish belgilari:**

| Belgi | Ma'no | Rang |
|---|---|---|
| ● ─── ● | bog'langan | `--ok` |
| ● ─ ? ─ ● | ishonchsiz moslik (< 90%) | `--warn` |
| ○ | bog'lanmagan | `--text-mute` |
| ➕ | qo'shimcha bo'lib ketadi | `--ok` |
| 🔄 | zamena | `--t-bl` |

**Har moslikda ishonch foizi** ko'rsatilsin va **nima uchun** mos kelgani
tushuntirilsin:

```
92%  ✓ шифр мос  ✓ бирлик мос  ✓ раздел ичида ягона
71%  ✓ ном 0.88  ⚠ шифр йўқ    ✓ бирлик мос
```

Bu shaffoflik foydalanuvchining ishonchini qozonadi. Hozirgi panelning
eng katta muammosi — **nima uchun bog'langani ko'rinmasligi**.

**Qo'lda tuzatish:**
- Bog'lanishni bekor qilish (bitta bosish)
- Chapdagi qatorni o'ngdagiga sudrab bog'lash
- Bog'lanmaganni ➕ qo'shimcha yoki 🔄 zamena qilish

**Filtrlar** (yuqorida bir qatorda):
`Ҳаммаси` · `Боғланмаган` · `Ишончсиз` · `Доп` · `Замена`

### ③ Текшириш — CONSTANTA nazorati

Bu ekran **eng muhim**. Foydalanuvchining asosiy talabi:

> *«1 млрд обём киритсам аниқ 1 млрд киритилиши керакда»*

```
┌── СОЛИШТИРУВ ────────────────────────────────────┐
│                                                   │
│  Акт жами:        1 240 500 000 сўм              │
│  Ёзилади:         1 240 500 000 сўм              │
│  ────────────────────────────────────            │
│  Фарқ:            0 сўм            ✅            │
│                                                   │
│  Боғланган:  1 180 та  ·  1 190 200 000 сўм      │
│  Доп:           40 та  ·     50 300 000 сўм      │
│  Боғланмаган:    0 та                             │
└───────────────────────────────────────────────────┘
```

**Farq ≠ 0 bo'lsa — «Ёзиш» tugmasi O'CHIRILGAN** va sabab ko'rsatiladi:

```
⛔ Фарқ: 2 340 000 сўм

   Сабаб: 3 та қатор боғланмаган ва доп ҳам қилинмаган.
   [ Уларни кўрсат ]
```

Shuningdek razdel bo'yicha moslik:

```
🗂 Раздел мослиги:  44 / 47 та раздел тўғри жойлашди
                     3 та раздел аниқланмади  [ кўрсат ]
```

### ④ Ёзиш

2-bo'limdagi fon rejimi. Tugagach:

```
✅ Ёзилди
   1 220 та қатор · 1 240 500 000 сўм · 4 дақ 18 сон
   📚 Иш турлари кутубхонасига 12 та янги иш ёзилди

   [ Смета ҳолатини кўриш ]
```

---

## 4. Ф2 ТАЙЁРЛАШ (teskari yo'nalish)

Bu — smetadan yangi Ф2 hujjati yasash.

- Chapda: `f2mum` (Ф2 ga olish mumkin) bo'lgan qatorlar daraxti
- Har qator oldida checkbox; razdel checkboxi bolalarini tanlaydi
- Yuqorida jonli hisob: `Танланди: 340 та · 890 400 000 сўм`
- «Ҳужжат яратиш» → Google Sheets'da КС-2 ko'rinishida yaratiladi
- Yaratilgach havola + «Очиш» tugmasi

**Qo'shimcha imkoniyat** (foydalanuvchi so'ragan): shu ekranda ham
zamena/qo'shimcha ish va resurs qo'sha olish. *«биридa бор нарса
бошқасида бўлмаса ундан ёмони йўқда»* — ikkala ekran ham bir xil
imkoniyatga ega bo'lsin.

---

## 5. DIZAYN TALABLARI

`06_DIZAYN_TIZIMI.md` to'liq amal qiladi, plus:

- Ikki panel **birga skroll qilmasin** — har biri mustaqil
- Bog'langan juftlik ustiga kursor kelsa — **ikkala tomon ham** yoritilsin
- Bog'lash chizig'i SVG bilan, `--ok` rangida, 2px
- 10 000 qatorda ham 60 fps — **ikkala daraxt ham virtualizatsiya qilinsin**
- Qidiruv ikkala panelda ishlasin, topilgan tugun avtomatik ochilsin
- Mobilda ikki panel → yorliqli bitta panel (Акт / Смета)

---

## 6. QABUL MEZONLARI

```
[ ] npm run build xatosiz
[ ] Fayl yuklanadi, daraxt chiqadi, jami summa to'g'ri
[ ] apiF2AvtoMoslash natijasi ko'rsatiladi (algoritm SAYTDA YOZILMAGAN)
[ ] Har moslikda ishonch % va SABAB ko'rinadi
[ ] Qo'lda bog'lash / bekor qilish ishlaydi
[ ] Farq ≠ 0 bo'lsa yozish BLOKLANADI
[ ] Yozish fon rejimida, sahifa yopilsa ham davom etadi
[ ] Qayta kirilganda progress tiklanadi
[ ] Lokalka tanlash IXTIYORIY
[ ] Ikkala daraxt 60 fps
[ ] Ф2 Тайёрлash ishlaydi va hujjat yaratiladi
```

### ⭐ Yakuniy sinov

Haqiqiy Ф2 fayl bilan:
1. Akt jami summasini yozib ol
2. Import qil, yoz
3. `apiF2OySkan` bilan yozilgan summani ol
4. **Ikkalasi tiyingacha teng bo'lishi shart**

Teng bo'lmasa — faza tugamagan.
