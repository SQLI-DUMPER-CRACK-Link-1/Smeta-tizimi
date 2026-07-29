# 🎨 DIZAYN TIZIMI — SMETA GAS

**Egasi:** Claude · **Versiya:** 1 · **2026-07-28**
**Antigravity:** bu hujjat qonun. Har komponent shu yerdagi qiymatlardan foydalanadi. «Chiroyliroq bo'ladi» deb o'zgartirmang — bir joyda o'zgartirilgan qiymat butun tizimni notekis qiladi. O'zgarish kerak bo'lsa → JAVOB_SAVOL.md.

## 0. NIMA UCHUN BU HUJJAT BOR
Foydalanuvchining aniq shikoyati: «нима учун ман билан қилаётган тизимларинг бунақанг суст тизим бўлаяпди, ноқулай хунук дизайн, непрофессионализм»
Sabab «rang yomon» emas. Sabab izchillik yo'qligi: bir oynada 12px, boshqasida 14px; bir joyda raqam o'ngga, boshqasida chapga; bir tugma to'q, boshqasi och. Ko'z buni sezadi, miya «arzon» deb baholaydi.
Professional ko'rinish = 200 ta mayda qarorning bir xilligi. Shuning uchun qarorlar shu yerda bir marta qabul qilingan.

## 1. FALSAFA — 5 qoida
1. **Ma'lumot qahramon, bezak xizmatkor.** Har piksel raqamni o'qishga xizmat qilsin. Gradient, soya, animatsiya — faqat ma'no qo'shsa.
2. **Zichlik — bu hurmat.** Bu buxgalter kuniga 8 soat ishlaydigan tizim. Bo'sh joy sarflash = uni skroll qilishga majburlash.
3. **Tezlik hissi tezlikdan muhim.** GAS 2–20 soniya javob beradi. Buni o'zgartira olmaymiz. Kutishni ko'rinadigan qilamiz — skeleton, progress, jonli matn.
4. **Hech qachon bo'sh oq maydon.** Har holatning ko'rinishi bor: yuklanmoqda, bo'sh, xato, muvaffaqiyat.
5. **Bir marta o'rgansin.** Bitta jadval boshqasiga o'xshasin. Bitta modal boshqasidek yopilsin.

## 2. RANG
### 2.1 Yuza va matn (dark — asosiy rejim)
```css
--bg:        #0B0E14;   /* eng orqa fon */
--surface:   #131722;   /* karta, panel */
--surface-2: #1B2130;   /* ko'tarilgan: hover, tanlangan qator, input */
--surface-3: #232A3B;   /* eng yuqori: modal, dropdown */
--border:    #232A3B;   /* chegara */
--border-2:  #2F3850;   /* kuchli chegara: fokus, tanlov */

--text:      #E6EAF2;   /* asosiy matn */
--text-dim:  #8B93A7;   /* ikkilamchi: sarlavha, izoh */
--text-mute: #5A6377;   /* uchlamchi: placeholder, o'chirilgan */
```

### 2.2 Harakat va holat
```css
--accent:      #4F7BFF;   /* asosiy harakat, havola, fokus */
--accent-soft: rgba(79,123,255,.12);

--ok:      #2ED3A0;   /* bajarilgan, tasdiq */
--warn:    #FFB020;   /* diqqat, qoldiq */
--danger:  #FF5A5A;   /* xato, limitdan oshiq */
--info:    #7DD3FC;   /* neytral xabar */
```
Holat ranglari band. Ularni «to'rtinchi seriya rangi» sifatida hech qachon ishlatmang. Va ular doim ikonka + matn bilan keladi — faqat rang bilan ma'no berilmaydi.

### 2.3 Qator turlari — TASDIQLANGAN palitra
Bu to'rt rang daraxtda va jadvalda ish/resurs/material/uskunani ajratadi.
```css
--t-bl:  #8B5CF6;   /* 🔧 ИШ          (ish turi) */
--t-rs:  #0284C7;   /* 🔹 РЕСУРС      (mehnat, mashina) */
--t-mat: #059669;   /* 🧱 МАТЕРИАЛ    */
--t-ob:  #D97706;   /* ⚙️ ОБОРУДОВАНИЕ */
```
⚠️ MAJBURIY: Har qator ikonka va qisqa yorliq bilan keladi — faqat rang bilan farqlash taqiqlanadi.
✅ `🔧 ИШ Бетон тайёрлаш` ❌ `faqat binafsha nuqta`

### 2.4 Qator holati (zamena / qo'shimcha)
Rang emas, chap chetdagi chiziq + belgi bilan:
```css
.qator-zamena    { box-shadow: inset 3px 0 0 var(--t-bl); }   /* 🔄 */
.qator-qoshimcha { box-shadow: inset 3px 0 0 var(--ok); }     /* ➕ */
```

## 3. TIPOGRAFIKA
```css
--font-ui:  'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
--font-num: 'Inter', system-ui, sans-serif;   /* tabular-nums bilan */
--font-mono:'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
```

### 3.1 Shkala
- **display**: 32/38, 700 (KPI katta raqami)
- **h1**: 22/28, 650 (sahifa sarlavhasi)
- **h2**: 17/24, 600 (bo'lim)
- **body**: 14/20, 400 (asosiy matn)
- **sm**: 13/18, 400 (jadval katagi)
- **xs**: 11/16, 500, +0.04em (ustun sarlavhasi, nishon)
14px dan kichik asosiy matn yo'q. Jadvalda 13px — eng past chegara.

### 3.2 ⭐ RAQAMLAR — eng muhim qoida
```css
.num {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1;
  text-align: right;
  letter-spacing: 0;
}
```
Pul yoki hajm ko'rsatuvchi HAR katak `.num` sinfiga ega bo'lishi shart.

### 3.3 Pul formatlash
Qoida:
- KPI karta, obyekt kartasi → qisqa format (`467.3 млрд`), ostida to'liq summa.
- Jadval, daraxt, hisobot → doim to'liq summa (bo'shliq bilan ajratilgan, masalan `467 348 726 061`).
- `0` → `0`. Lekin `null/undefined` → `—`.
- Foiz: `19%` (bir kasr faqat 10 dan kichikda: `8.4%`).

## 4. O'LCHAM VA ORALIQ
**4px setka**: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`
- Ikonka ↔ matn: 8
- Karta ichi: 20
- Kartalar orasi: 16
- Jadval katagi: 12 / 16
- Daraxt qator balandligi: 32 (zich)

**Radius:**
```css
--r-sm: 6px;    /* nishon, kichik tugma */
--r-md: 10px;   /* tugma, input, karta */
--r-lg: 14px;   /* modal, katta panel */
--r-full: 999px;
```

**Soya:** faqat suzuvchi elementlarda.
`--shadow-float: 0 8px 24px rgba(0,0,0,.4), 0 2px 6px rgba(0,0,0,.3);`

## 5. HARAKAT (ANIMATSIYA)
```css
--t-fast:  120ms;  /* hover, fokus */
--t-base:  200ms;  /* ochilish, yopilish */
--t-slow:  320ms;  /* sahifa almashishi */
--ease:    cubic-bezier(.16, 1, .3, 1);
```
⛔ Sakraydigan animatsiyalar, uzoq (400ms+) animatsiyalar TAQIQLANADI.

## 6. HOLATLAR
- **Yuklanmoqda:** SKELETON (haqiqiy tarkib shaklida, aylanuvchi spinner emas).
- **Uzoq kutish (3s+):** Jonli matn sekundomer bilan ("Смета дарахти ўқилмоқда… 14 сония").
- **Bo'sh:** 48px yumshoq ikonka, matn, harakat tugmasi.
- **Xato:** Karta ko'rinishida sarlavha, xato matni, qayta urinish tugmasi.
- **Muvaffaqiyat:** O'ng pastda toast xabar (3 soniya). Modalda "Saqlandi" deyilmaydi.

## 7. KOMPONENTLAR
- **Tugma:** 36px (odatiy). Bosilganda `scale(.98)`. Yuklanishda kengligi saqlanadi.
- **Jadval:** Sarlavha `sticky`. Raqamlar o'ngga. Zebra yo'q (hover yetarli). Gorizontal chiziqlar faqat (vertikal yo'q). O'z konteynerida skroll qiladi.
- **Daraxt qatori:** `padding-left: 8 + daraja * 20 px`. `border-left` chiziq. Yopiq tugunda JAMI ko'rinsin.
- **Modal:** `rgba(0,0,0,.6)` fon, blur.
- **Input/Select:** 36px, `border-radius: var(--r-md)`. Focus holati --accent rang bilan.

## 8. GRAFIKLAR
- Bitta son -> KPI karta.
- Obyektlar taqqoslash -> Gorizontal ustun.
- Vaqt -> Chiziq.
- Taqsimot -> Stacked bar.
⛔ Pirog diagramma, ikki o'qli grafik (dual-axis) qat'iyan man etiladi.
- KPI kartada haqiqiy oylar bo'lmasa, soxta sparkline yasalmasin.

## 11. ANTI-PATTERNLAR (Bular qilinsa kod qaytariladi)
❌ Raqamlarda `tabular-nums` yo'q
❌ Aylanuvchi spinner
❌ Setkadan tashqari oraliq (masalan, 13px, 7px)
❌ Pirog diagramma
❌ Sahifa gorizontal skroll
❌ Jadvalda vertikal chiziqlar
❌ Modal "Saqlandi" uchun
