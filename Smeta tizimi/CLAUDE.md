# SMETA GAS — Loyiha Holati va Asosiy Qoidalar (AI Uchun Xotira)

> **Oxirgi yangilanish:** 2026-yil 10-iyul (Antigravity tomonidan)
> **AI (Claude) uchun qat'iy ko'rsatma:** Har qanday o'zgarish qilishdan oldin, ushbu hujjatni to'liq o'qib chiqing. Bu tizimning xotirasi hisoblanadi va oldingi muvaffaqiyatli yechimlarni buzib qo'ymaslik uchun juda muhim!

---

## 1. Loyiha Qisqacha Tavsifi

Bu tizim **Google Apps Script (GAS)** orqali ishlaydigan **Qurilish Smeta Avtomatlashtirish Tizimi**. Tizim quyidagi qismlardan iborat:
1. **Google Drive & Sheets:** Har bir obyekt uchun lokal smeta + svodka saqlanadi. Dvigatel uni o'qib `LRV_PLUS` ishchi faylini yaratadi.
2. **Narxlar Markazi:** Barcha obyektlardagi resurs narxlari bitta markazlashgan fayldan (`_SERVER_DASHBOARD/NARXLAR`) boshqariladi.
3. **Web UI (Admin Panel & Boss Dashboard):** GAS WebApp (`Panel.html`, `Boss.html`) orqali brauzerda boshqariladi.
4. **Supabase & Next.js (Yangi arxitektura):** Hozirda tizimning o'qish tezligini oshirish maqsadida `70_Supabase.js` orqali ma'lumotlar Supabase (Postgres) ga sinxronizatsiya qilinmoqda, kelajakda Next.js asosidagi ochiq tizimga o'tiladi.

---

## 2. ⚠️ ENG MUHIM QOIDALAR (Faqat Buzuqlik Qilmaslik Uchun)

Foydalanuvchi tomonidan oldingi AI (Claude) bilan ishlash jarayonida ba'zi jiddiy muammolar (regressiyalar) kuzatilgan. Bularni takrorlamaslik shart:

1. **"Faqat buzasanda" tamoyili:** Tizim juda yirik va biror joyni "optimallashtirish" uchun qilingan qaltis o'zgarish butun tizim mantiqini (ayniqsa, ierarxiya va narxlash) buzib yuborishi mumkin. O'zgartirishdan oldin `30_Panel.js` yoki `10_Engine.js` ni yaxshilab tahlil qiling.
2. **Sinxronizatsiya anomaliyasi (IDE Cache muammosi):** Ba'zida `clasp push` muvaffaqiyatli deb topsa ham, Google Apps Script serverida eski fayl holati qolib ketgan (ayniqsa `30_Panel.js` va `Panel.html` bilan bo'ldi). Shuning uchun, juda muhim o'zgarish qilsangiz, haqiqiy o'zgarishlar qabul qilinganini diqqat bilan tekshiring. Ba'zida IDE / muhit o'zgarishlarni bekor qilib yuboradi.
3. **Deployment Limiti:** Apps Script'da maksimum **20 ta** aktiv deployment bo'lishi mumkin. Agar `clasp deploy` da limit xatosi chiqsa, eng eskilarini `clasp undeploy <id>` orqali tozalang.
4. **IDEAL F2 (F2 Tayyorlash & Import):** Hech qachon F2 va Fakt tizimi mantiqini (Ayniqsa, qoldiqlar va Ierarxiya) qo'lda o'zboshimchalik bilan o'zgartirmang. F2 mexanizmi hozirda juda nozik sozlangan.

---

## 3. ARXITEKTURA VA ENG YANGI YECHIMLAR (2026-Iyul Holatiga)

Ushbu funksiyalar uzoq mehnat evaziga to'g'irlangan va ularni mutlaqo saqlab qolish kerak:

### 3.1. Ko'p Smetali Obyektlar Ierarxiyasi (`_subObyektlar` mantiqi)
Bitta obyekt papkasida (masalan, "YEVROPA OSXONASI") bir nechta smeta fayllari bo'lishi mumkin. Eski tizim faqat 1 ta faylni o'qirdi va xato qilardi.
**To'g'rilangan Yechim:** `30_Panel.js` dagi barcha funksiyalar (ayniqsa Daraxt quradigan `apiRazdelShYasat` va darajalarni bazaga yozadigan `apiDarajalarLrvGaYoz`) endilikda **`_subObyektlar(obyekt)`** yordamida obyekt ostidagi **hamma** fayllarni aylanib chiqadi. Shu orqali barcha fayllardagi Razdellar (`rz`), Bloklar (`bl`), Resurslar (`rs`), va Materiallar (`mat`) YAGONA KATTA DARAXT ko'rinishida yig'iladi va UI'ga (Daraxtga) qaytariladi.
**Qoida:** `30_Panel.js` dagi obyekt fayllarini skanerlash tsikllarini hech qachon faqat 1 ta fayl uchun qilib o'zgartirmang!

### 3.2. F2 Tayyorlash (Teskari F2 Import) — "Ideal F2"
Avval faqat "F2 Import" bor edi (tashqi Excel'dan F2 ma'lumotni tiqish). Endi Panel ichida **"🧾 Ф2 Тайёрлаш"** tugmasi bor.
- **Qanday ishlaydi?** Chap ekranda obyektning `F2_MUMKIN` (qoldiq= Fakt - Oldin Olingan F2) ni ko'rsatadi. O'ng ekranda esa tanlangan resurslardan mutlaqo yangi va toza **F2 Hujjatini (Google Sheet da KS-2 ko'rinishida)** avtomat generatsiya qiladi. 
- **Buzmaslik kerak:** `f2TayOch()`, `_f2TayFlatten()`, `f2TayChapChiz`, va eng asosiysi `apiF2TayyorHujjatYarat` funksiyalari o'ta muhim. `Panel.html` da `<div id="f2TayModal">` maxsus UI blokida yashaydi.

### 3.3. Shartnoma va Buxgalteriya (`vsego` / Nakrutka mantiqi)
Asl smeta summasi (Fakt va F2) bu "toza narx" (nakrutkasiz). Lekin Buxgalteriyaga/Shartnomalarga o'tganda NAKRUTKA qo'shilgan narx kerak.
- Yechim: `80_Shartnoma.js` (va `85_Buxgalteriya.js`) smetaning F2/Fakt summasini hisoblayotganda `(vsego / obJamiSmeta)` koeffitsientiga ko'paytirib, Buxgalteriya uchun **Nakrutka bilan** summaga aylantiradi.
- `КАБ` (Kabel) va `БЕЗ СКЛАД` tushunchalari server va dashboardda saqlanib qolgan va alohida hisob-kitobga ega. `Boss.html` va `20_Server.js` dagi drill-down (batafsil ko'rish) aynan shu ustunlarni taniydi.

### 3.4. Ostatka (Qoldiq) Muammosi (Hal qilingan)
KPI va Nakrutka bo'limida "Smeta = faqat ASL smeta summasi" hisoblanadi. (Zamena va Qo'shimcha ishlar maxsus kategoriya ostiga ajratilgan, ular asl smetaga qoshilib ketmaydi). Natijada Qoldiq summasi (Asl - Fakt) adekvat va to'g'ri (manfiy bo'lmagan nol) chiqadi.

---

## 4. ASOSIY FAYLLAR FUNKSIYASI

- `00_Config.js` - Global sozlamalar, ustun indekslari, Svodka qoidalari.
- `10_Engine.js` - **Dvigatel.** Barcha fayllarni bog'laydi, narxlaydi (`_findPrice`), oraliqlarni ajratadi, `LRV_PLUS` ishchi varag'ini yasaydi.
- `20_Server.js` - Barcha obyektlarning natijalarini `_SERVER_DASHBOARD` ga jamlash. 
- `30_Panel.js` - Web UI uchun barcha asosiy API endpointlar (`apiRazdelShYasat`, `apiF2TayyorHujjatYarat`, `apiBossData` va h.k.).
- `70_Supabase.js` - Ma'lumotlarni to'g'ridan-to'g'ri (REST orqali) Supabase'ga yozish/sinxronizatsiya.
- `80_Shartnoma.js` - Podryadchilar va yetkazib beruvchilar hisob-kitobi.
- `Panel.html` - Admin ishchi maydoni. UI struktura, modallar (`f2TayModal`, `f2ImpModal`). 
- `Boss.html` - Rahbariyat uchun read-only interaktiv hisobot.

---

## 5. KELAJAKDAGI MAQSADLAR

Agar foydalanuvchi "keyingi qadamga o'tamiz" desa, ushbu ro'yxatga e'tibor qiling:
1. **Tezlik / Kesh Tizimi**: Yirik ob'ektlarda Panel yuklanishi (Ayniqsa Daraxtni qurish) vaqt oladi. Keyingi optimallashtirish shunga qaratiladi.
2. **Next.js Vercel Deploy**: `LOYIHA_HOLATI.md` dagi ma'lumotga asosan, tizim qachondir Next.js'dagi yangi frontend'ga ko'chirilishi kerak (Supabase integratsiyasi tayyorlangan).
3. **M-29 / Hujjat Yaratish Tizimini kengaytirish**: F2 tayyorlash mexanizmi ishga tushdi, xuddi shu muvaffaqiyat bilan Materiallar uchun ham M-29 avtomat hujjat tayyorlash takomillashtirilishi mumkin.

---
Endi jigar (Claude), agar sizga keyingi vazifa berilsa, ushbu xotira hujjatiga tayanib, tizimni hech qanday regressiyalarsiz, faqat olg'a siljiting! Omad!
