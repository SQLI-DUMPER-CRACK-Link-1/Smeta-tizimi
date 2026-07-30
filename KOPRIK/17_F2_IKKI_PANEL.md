# 🔀 Ф2 ЭКРАНЛАРИ — ИККИ ПАНЕЛЛИ ТУЗИЛИШ (қайта қуриш)

> **Claude · 2026-07-30** · Foydalanuvchi: *«nima uchun paneldagidaka strukturada
> ishlamayapdi... f2 yasash ham xuddi shunday, ekranni bir chetida qilayapdi,
> mantiq noto'g'ri»*

---

## 0. XATO NIMADA EDI

Men ikkala ekranni **bosqichma-bosqich wizard** qilib qurdim:

```
① Fayl → ② Moslashtirish → ③ Tekshirish → ④ Yozish
```

Panelda esa **ikki panel bir vaqtda** ko'rinadi va foydalanuvchi ular orasida
ishlaydi. Wizard'da bir vaqtda faqat bitta tomon ko'rinadi — shuning uchun
qo'lda bog'lash, tekshirish, tuzatish **jismonan mumkin emas**.

**Sabab:** ekranni API shaklidan kelib chiqib loyihalashtirdim, panelning
ishlayotgan joylashuvini takrorlamadim. Funksiyalarni o'qidim — **joylashuvni
o'qimadim**. Bu takrorlanuvchi xato: avval ham API maydonlarini tekshirmasdan
taxmin qilganman.

---

## 1. Ф2 ИМПОРТ — to'g'ri tuzilish

```
┌─ Yuqori panel (sticky) ───────────────────────────────────────────────┐
│ Obyekt ▾   Oy [07.2026]   Fayl ▾   Varaq ▾   [🤖 Avto-moslashtirish]  │
│ Akt jami 1 240 500 000 · Bog'langan 1 190 200 000 · Farq 0 ✅          │
│ Filtr: Hammasi | Bog'lanmagan | Ishonchsiz | Доп | Замена             │
│                                            [💾 Смeta'ga yozish]        │
└───────────────────────────────────────────────────────────────────────┘
┌─ AKT (fayldan) ──────────────┐  ┌─ SMETA (LRV_PLUS) ─────────────────┐
│ ▸ Раздел 1                   │  │ ▸ Раздел 1                         │
│   🔧 Бетон М300  120 м3  ●───┼──┼──● 🔧 Бетон М300      120 м3       │
│     🧱 Цемент     24 т   ●───┼──┼──● 🧱 Цемент М400      24 т        │
│   🔧 Арматура      8 т   ○   │  │   🔧 Арматура А500     8 т         │
│      ↳ сметада мос код йўқ   │  │                                    │
└──────────────────────────────┘  └────────────────────────────────────┘
   MUSTAQIL skroll                    MUSTAQIL skroll
```

### Qat'iy talablar

1. **Ikki daraxt bir vaqtda ko'rinadi**, har biri mustaqil skroll qiladi
2. **Bog'lanish belgisi** har qatorda: `●───●` bog'langan · `○` bog'lanmagan
3. Bog'langan juftlik ustiga kursor kelsa — **ikkala tomon ham yoritiladi**
4. **Qo'lda bog'lash:** chapdagi qatorni o'ngdagiga sudrab tashlash (drag&drop)
5. **Bekor qilish:** bog'lanish belgisiga bosish
6. Bog'lanmagan qator ostida **sabab** ko'rinadi (`sabablar[uid]`)
7. Yuqoridagi panel **sticky** — Akt jami / Bog'langan / Farq doim ko'z oldida
8. **Farq ≠ 0 → «Yozish» o'chirilgan** (CONSTANTA qoidasi)
9. Filtr tugmalari ikkala daraxtga ham ta'sir qiladi
10. Ikkala daraxt **virtualizatsiyalangan** (10 000+ qator, 60 fps)

### Wizard'dan nima qoladi

Faqat **fayl tanlash** bosqichi — u modal bo'ladi:
`Obyekt → Fayl (Drive ro'yxati yoki yuklash) → Varaq → Ustunlar → OK`.
Tasdiqlangach modal yopiladi va **asosiy ikki panelli ekran** ochiladi.

---

## 2. Ф2 ТАЙЁРЛАШ — to'g'ri tuzilish

```
┌─ Yuqori panel ────────────────────────────────────────────────────────┐
│ Obyekt ▾  Oy [07.2026]  Qidiruv       Tanlandi: 340 · 890 400 000     │
│                                            [📄 Ҳужжат яратиш]          │
└───────────────────────────────────────────────────────────────────────┘
┌─ Ф2 ГА ОЛИШ МУМКИН ──────────┐  ┌─ ҲУЖЖАТ (йиғилмоқда) ─────────────┐
│ ☑ ▸ Раздел 1      12 400 000 │  │ Раздел 1                          │
│   ☑ 🔧 Бетон  120→[100] м3   │  │   🔧 Бетон М300   100 м3   ...    │
│   ☐ 🧱 Цемент  24 т          │  │   ЖАМИ раздел:      8 200 000     │
│ ☐ ▸ Раздел 2       3 100 000 │  │ ─────────────────────────────     │
│                              │  │ УМУМИЙ:            8 200 000     │
└──────────────────────────────┘  └────────────────────────────────────┘
   tanlash + hajm tahriri            tanlanganlar KS-2 ko'rinishida
```

### Qat'iy talablar

1. **Chap panel** — daraxt: razdel → ish → resurs, checkbox va tahrirlanadigan hajm
2. **O'ng panel** — tanlanganlar **KS-2 hujjat ko'rinishida**, razdel-ЖАМИ bilan
3. Chapda belgilash → **o'ngda darhol paydo bo'ladi** (jonli ko'rinish)
4. Hajm o'zgartirilsa — o'ngdagi summa darhol qayta hisoblanadi
5. O'ng paneldan qatorni **olib tashlash** mumkin (chapdagi belgi ham yechiladi)
6. Razdel checkbox butun guruhni belgilaydi (oraliq holat bilan)
7. `f2mum` dan **katta hajm kiritilsa** — sariq ogohlantirish (bloklanmaydi)

---

## 3. UMUMIY QOIDALAR (ikkalasi uchun)

| Narsa | Talab |
|---|---|
| Panellar kengligi | 50/50, sudrab o'zgartirilsa yaxshi (resizer) |
| Mobil (< 1024px) | ikki panel → yorliqli bitta panel (Akt / Smeta) |
| Tur ranglari | `06 §2.3`: 🔧ИШ #8B5CF6 · 🔹РЕС #0284C7 · 🧱МАТ #059669 · ⚙️ОБ #D97706 |
| Raqamlar | `.num` / `tabular-nums`, o'ngga tekislangan |
| Daraxt qatori | balandlik 32px, chuqurlik `8 + daraja*20` px |
| Yopiq tugun | ichidagi JAMI summa ko'rinsin |
| Skroll | har panel o'z konteynerida, sahifa gorizontal skroll qilmaydi |

---

## 4. API — O'ZGARMAYDI

Barchasi allaqachon bor va ishlaydi:

```
apiF2FayllarOl(obyekt)                  Drive'dagi Ф2 fayllar
apiF2Varaqlar(fileId)                   varaqlar ro'yxati
apiF2FaylOqi(fid, varaq, null)          → {mode:'config', cols}   ← 1-bosqich
apiF2FaylOqi(fid, varaq, colConfig)     → {ok, tree}              ← 2-bosqich
apiHolatOl(obyekt)                      LRV daraxti (o'ng panel)
apiF2AvtoMoslash(aktTree, obyekt, opts) → {mosliklar, sabablar, stat}
apiF2QollaNavbatga(...)                 fon rejimida yozish
apiF2TayyorHujjatYarat(obyekt, oy, items)
```

⚠️ **Deploy qoidasi:** GAS o'zgarsa `clasp push` **VA** `clasp deploy`
(ikkala produksiya ID'siga). Push yolg'iz sayt uchun yetarli emas — sayt
versiyalangan deploy'ni chaqiradi. Bu xato bir marta bo'ldi
(`apiF2Varaqlar` mavjud edi, lekin sayt uni ko'rmadi).

---

## 5. BAJARISH TARTIBI

```
1. Umumiy komponent: IkkiPanel (chap/o'ng + resizer + mobil yorliq)
2. Umumiy komponent: F2Daraxt (virtualizatsiyalangan, checkbox/bog'lanish rejimi)
3. Ф2 импорт    — fayl tanlash MODAL + ikki panelli asosiy ekran
4. Ф2 тайёрлаш  — chap tanlov + o'ng KS-2 ko'rinish
5. Qo'lda bog'lash (drag&drop) va bekor qilish
6. Filtrlar
```

1–2 umumiy bo'lgani uchun ikkala ekran ham shundan foydalanadi — bir marta
qilinadi, ikki joyda ishlaydi.

---

## 6. TUGALLANGANLIK MEZONI

```
[ ] Ikki panel bir vaqtda ko'rinadi, mustaqil skroll
[ ] Bog'lanish belgilari va hover'da ikki tomon yoritilishi
[ ] Qo'lda bog'lash + bekor qilish ishlaydi
[ ] Bog'lanmagan qator ostida SABAB
[ ] Farq ≠ 0 → yozish bloklangan
[ ] Ф2 тайёрлаш: chapda belgilash → o'ngda darhol
[ ] 10 000 qatorda 60 fps
[ ] 1024px dan kichikda yorliqli ko'rinish
[ ] npm run build xatosiz · push + Cloudflare deploy
```
