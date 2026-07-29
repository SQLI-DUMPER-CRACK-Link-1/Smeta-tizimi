# ✍️ FAZA 2 — YOZISH (Ҳолат таҳрирлаш)

> **Oldingi shart:** Faza 1 qabul mezonlari bajarilgan.
> **Mo'ljal:** 2 sessiya · **Xavf darajasi:** 🔴 YUQORI — bu haqiqiy moliyaviy
> ma'lumotga yozadi.

---

## 0. ⚠️ AVVAL O'QING — bu faza boshqacha

Faza 1 da eng yomoni «sahifa ochilmadi» edi. Faza 2 da eng yomoni —
**buxgalteriya ma'lumoti buzilishi**. Obyektlarda 467 mlrd so'mlik smeta bor.

Shuning uchun bu fazada uchta qat'iy qoida:

1. **Har yozuvdan oldin tasdiq.** Foydalanuvchi nima o'zgarayotganini
   raqam bilan ko'rsin.
2. **CONSTANTA qoidasi.** Foydalanuvchining so'zi bilan:
   *«1 млрд обём киритсам аниқ 1 млрд киритилиши керакда»*.
   Yaxlitlash, taqsimlash, «taxminan» — **yo'q**. Kiritilgan son aynan o'sha
   son bo'lib tushsin.
3. **Sinash faqat kichik obyektda.** Amfiteatr yoki Suniy ko'lda sinamang —
   ular eng katta. Kichik obyekt tanlang.

---

## 1. API — HAQIQIY PARAMETRLAR

> Bular `30_Panel.js` kodidan **o'qib olingan**, taxmin emas.

### 1.1 `apiHolatSaqla(obyekt, edits)` — fakt/oy qiymatlarini saqlash

```ts
type Edit = {
  varaq: string;    // "Локальная смета 1"  YOKI  "SubObyekt||Локальная смета 1"
  row: number;      // LRV_PLUS dagi qator raqami (1 dan)
  fakt?: number;    // yangi FAKT qiymati
  oylar?: Record<string, number>;   // { "05.2026": 1200, "06.2026": 800 }
};

await gas<{jami:number, qatorlar:number}>('apiHolatSaqla', obyekt, edits);
```

**⚠️ `varaq` dagi `||`:** ko'p smetali obyektda daraxt bir nechta fayldan
yig'iladi. `apiHolatOl` qaytargan `varaq` qiymatini **o'zgartirmasdan**
qaytaring — server uni o'zi ajratadi. Uni «tozalashga» urinmang.

**⚠️ Qaytadigan `jami`:** bu **katak** soni, qator emas. Foydalanuvchiga
qatorlar sonini ko'rsating (`qatorlar`), aks holda «231 yubordim, 671 yozildi»
degan chalkashlik chiqadi (bu ilgari bo'lgan).

### 1.2 `apiBlQosh(params)` — yangi ish / material / uskuna qatori

```ts
type BlQosh = {
  obyekt: string;
  varaq: string;          // "sub||varaq" ham bo'lishi mumkin
  afterRow: number;       // shu qatordan KEYIN qo'shiladi
  nom: string;            // majburiy
  kod?: string;           // шифр
  birlik?: string;
  hajm: number;           // > 0 bo'lishi SHART
  tur?: 'bl' | 'mat' | 'ob';   // default 'bl' (ИШ)
  zamena?: boolean;       // true → 🔄 ЗАМЕНА, false/yo'q → ➕ ҚЎШИМЧА
  droppedOnRow?: number;  // zamena bo'lsa — nima o'rniga (eski qator)
  f?: number;
};
```

**⚠️ `tur` ni to'g'ri yuboring.** Ilgari hamma narsa `bl` (ИШ) bo'lib
qo'shilardi va foydalanuvchi shikoyat qilgan edi: *«resurs qo'shsam ham
+иш деб қўшади»*. Material tashlansa `tur:'mat'`, uskuna bo'lsa `tur:'ob'`.

**⚠️ `zamena` va `droppedOnRow` birga.** Server `droppedOnRow` dagi qatorni
o'qib, izohga «nima o'rniga» yozadi va `_ЗАМЕНА_ТАРИХ` varag'iga qayd qiladi.
`droppedOnRow` bo'lmasa tarix yo'qoladi.

**⛔ NOM ga hech narsa qo'shmang.** `«Бетон (Замена: Цемент)»` kabi qilmang —
bu constanta ustunini buzadi. Zamena faqat marker + izoh + tarix orqali
belgilanadi. Bu qoida ilgari buzilgan va tuzatilgan.

### 1.3 `apiRsQosh(params)` — ish ichiga resurs qo'shish

```ts
type RsQosh = {
  obyekt: string;
  varaq: string;
  blRow: number;      // qaysi ISH ichiga (bl qatori raqami)
  nom: string;
  kod?: string;
  birlik?: string;
  narx?: number;
  norm?: number;
  kat?: string;       // kategoriya
  f?: number;
};
```

### 1.4 `apiOyQosh(obyekt, oyNom)` — yangi oy ustuni

```ts
await gas<string>('apiOyQosh', obyekt, '07.2026');
```

**⚠️ Sekin — 4 daqiqagacha.** Katta obyektda GAS'ning 6 daqiqalik chegarasiga
yaqinlashadi. UI'da: «Янги ой устуни яратилмоқда, 1-4 дақиқа…» va
progress ko'rsating. Foydalanuvchi sahifani yopmasin deb ogohlantiring.

### 1.5 Qulf (bir vaqtda ikki kishi yozmasligi uchun)

```ts
await gas('apiLockOl', obyekt);            // holat: bo'shmi?
await gas('apiLockBos', obyekt, 'Ф2 ёзиш'); // band qilish
// … ish …
await gas('apiLockOch', obyekt, 'тугади');  // bo'shatish
```

Yozishdan oldin `apiLockOl` bilan tekshiring. Band bo'lsa — kim va qachon
band qilganini ko'rsatib, yozishni **bloklang**.

---

## 2. UI — TAHRIRLASH TAJRIBASI

### 2.1 Tahrir rejimi

Daraxt sukut bo'yicha **faqat o'qish**. Yuqoridagi «✏️ Таҳрирлаш» tugmasi
rejimni yoqadi:

```
[👁 Кўриш]  ⇄  [✏️ Таҳрирлаш]
```

Tahrir rejimida:
- FAKT va oy kataklari `contentEditable` emas — **haqiqiy `<input>`**
- Har o'zgargan katak **sariq chap chiziq** oladi (`inset 3px 0 0 var(--warn)`)
- Yuqorida yopishqoq panel chiqadi:

```
┌──────────────────────────────────────────────────────────┐
│ ⚠ 14 та қатор ўзгарди · +1 240 500 000 сўм               │
│                        [ Бекор қилиш ]  [ 💾 Сақлаш ]     │
└──────────────────────────────────────────────────────────┘
```

### 2.2 Katak tahriri

- Faqat raqam qabul qilinadi; vergul → nuqta
- Bo'sh qoldirilsa → `0` emas, **o'zgarmagan** deb hisoblansin
- `Enter` → keyingi qatorning shu ustuni; `Esc` → bekor
- `Tab` → o'ngdagi katak
- Manfiy son **ruxsat** (перерасчёт bo'ladi) — lekin sariq ogohlantirish bilan
- Kiritilgan qiymat `smeta` dan katta bo'lsa → qizil chegara + izoh:
  «Сметадан ошиқ: 120 > 100» — **lekin bloklamang**, faqat ogohlantiring

### 2.3 Saqlashdan oldin — tasdiq modali

**Majburiy.** Hech qachon to'g'ridan-to'g'ri yozmang.

```
Ўзгаришларни сақлаш

  Қаторлар:        14 та
  ФАКТ ўзгариши:   +1 240 500 000 сўм
  Ойлар:           05.2026 (8), 06.2026 (6)
  Объект:          Амфитеатр

  ┌─ Ўзгаришлар рўйхати ──────────────────────┐
  │ Бетон М300      100,00 → 120,00   +20,00  │
  │ Цемент М400      24,00 →  30,00    +6,00  │
  │ …                                          │
  └────────────────────────────────────────────┘

              [ Бекор ]  [ Сақлаш ]
```

### 2.4 Optimistik UI — lekin ehtiyotkorlik bilan

```ts
const saqla = useMutation({
  mutationFn: (edits: Edit[]) => gas('apiHolatSaqla', obyekt, edits),

  onMutate: async (edits) => {
    await qc.cancelQueries({ queryKey: ['holat', obyekt] });
    const oldingi = qc.getQueryData(['holat', obyekt]);
    qc.setQueryData(['holat', obyekt], (eski) => qoll(eski, edits));
    return { oldingi };
  },

  onError: (xato, _v, ctx) => {
    qc.setQueryData(['holat', obyekt], ctx?.oldingi);   // qaytarish
    toast.xato('Сақланмади: ' + xato.message);
  },

  onSuccess: (r) => {
    toast.ok(`✅ ${r.qatorlar} та қатор сақланди`);
  },

  onSettled: () => {
    qc.invalidateQueries({ queryKey: ['holat', obyekt] });  // haqiqatni tekshirish
  },
});
```

**`onSettled` dagi `invalidateQueries` — majburiy.** Optimistik ko'rsatish
foydalanuvchini xursand qiladi, lekin **haqiqat serverda**. Yozuvdan keyin
qayta o'qilsin.

### 2.5 Yozish paytida sahifa yopilishidan himoya

```ts
useEffect(() => {
  if (!saqla.isPending) return;
  const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
  addEventListener('beforeunload', h);
  return () => removeEventListener('beforeunload', h);
}, [saqla.isPending]);
```

---

## 3. ZAMENA VA QO'SHIMCHA — sudrab tashlash

### 3.1 Ikki holat

| Harakat | Natija |
|---|---|
| Bo'sh joyga tashlash | ➕ **ҚЎШИМЧА** — smetada yo'q edi |
| Mavjud qator ustiga tashlash | 🔄 **ЗАМЕНА** — nimadir o'rniga |

Zamena bo'lsa **modal chiqadi** va eski/yangi yonma-yon ko'rsatiladi:

```
🔄 ЗАМЕНА

  Ўрнига:   ГРАВИЙНО-ПЕСЧАНАЯ СМЕСЬ   (С124-3)   120 м3
  Янги:     ҚАЗИШ ИШЛАРИ              (Е1-2-57-1) [___] м3

  ℹ️ Эски қатор ЎЗГАРМАЙДИ. Янги қатор 🔄 маркери билан
     қўшилади, изоҳда «нима ўрнига» ёзилади.

              [ Бекор ]  [ Замена қилиш ]
```

### 3.2 Ish tashlanganda ichidagilar ham ko'chsin

Foydalanuvchi shikoyati: *«агар bl ни тортиб келсам ичидаги ҳамма mat rs ob
билан келиши керак»*.

Ya'ni ИШ tashlansa — uning barcha bolalari ham ko'chirilsin:
1. `apiBlQosh` bilan ish qatori qo'shiladi → qaytgan qator raqami olinadi
2. Har bola uchun `apiRsQosh` chaqiriladi (`blRow` = yangi qator)
3. Jarayon **ketma-ket**, parallel emas (GAS bir vaqtda ko'p chaqiruvni yoqtirmaydi)
4. UI'da progress: «3 / 12 ресурс кўчирилмоқда…»

### 3.3 Yolg'iz resurs tashlansa

Faqat `rs`/`mat`/`ob` tashlansa — u **ish emas, resurs** ekanini tushunsin va
`tur` ni to'g'ri yuborsin (1.2-bo'limga qarang).

---

## 4. TEKSHIRUVLAR — saqlashdan oldin

Barchasi mijoz tomonda, saqlash tugmasi bosilganda:

| Tekshiruv | Xatti-harakat |
|---|---|
| Bo'sh nom | ⛔ bloklash |
| Hajm ≤ 0 | ⛔ bloklash |
| `afterRow` topilmadi | ⛔ bloklash |
| Fakt > smeta | ⚠️ ogohlantirish, ruxsat |
| Manfiy fakt | ⚠️ ogohlantirish, ruxsat |
| Obyekt qulflangan | ⛔ bloklash, kim qulflagani bilan |
| Hech narsa o'zgarmagan | tugma o'chirilgan |

---

## 5. QABUL MEZONLARI

```
[ ] npm run build xatosiz
[ ] Tahrir rejimi yoqiladi/o'chiriladi, o'zgargan kataklar belgilanadi
[ ] Tasdiq modali aniq raqamlar bilan chiqadi
[ ] Saqlangach toast, keyin daraxt qayta o'qiladi
[ ] Xato bo'lsa eski qiymatlar QAYTADI (optimistik rollback)
[ ] Ko'p smetali obyektda "sub||varaq" to'g'ri ishlaydi
[ ] Zamena modali eski/yangi ni yonma-yon ko'rsatadi
[ ] Ish tashlanganda bolalari ham ko'chadi, progress ko'rinadi
[ ] Qulf tekshiriladi
[ ] Yozish paytida sahifa yopilsa ogohlantiradi
[ ] KICHIK obyektda sinaldi, summa AYNAN to'g'ri tushdi
```

### ⭐ Yakuniy sinov — CONSTANTA

Kichik obyektda:
1. Bitta qatorga aniq **1 000 000** kirit
2. Saqla
3. Google Sheets'da LRV_PLUS faylini och
4. Katakda **aynan 1 000 000** turishi kerak — 999 999.99 ham, 1 000 000.01 ham emas

Bu sinovdan o'tmasa — faza tugamagan.
