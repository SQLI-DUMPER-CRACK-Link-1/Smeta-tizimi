# 🏗️ TIZIM ARXITEKTURASI (YADRO)

Bu hujjat butun Qurilish Smetasi va Boshqaruv Tizimining asosiy qoidalari va ishlash mexanizmlarini saqlaydi. 

## 1. Asosiy Konsepsiya
Tizim "Oyna" (Mirror) arxitekturasida ishlaydi:
- **Dvigatel (Backend):** Google Sheets va Google Apps Script (GAS) da ishlaydi. Ma'lumotlarni hisoblash, F2 ni yopish va Qoldiqni nazorat qilish aynan shu yerda bo'ladi.
- **Tezkor Xotira (Kesh):** Supabase (PostgreSQL) orqali boshqariladi. Smetalar va jadvallar faqat o'qish/ko'rsatish uchun yashin tezligida u yerga sinxronlanadi.
- **Frontend (UI):** Next.js asosidagi Web ilova. Ma'lumotlarni to'g'ridan-to'g'ri Supabase dan o'qiydi.

## 2. 10_Engine.js Mexanikasi
Smetalarni o'qish va tahlil qilishdagi "Aqlli yondashuv" (Smart Heuristics):
- **Tayyor narxlar ustuvorligi:** Agar lokalka (smetaning AVS yoki boshqa formati) faylida G ustunida to'g'ridan-to'g'ri narx ko'rsatilgan bo'lsa, tizim Svodkaga qarab o'tirmaydi va o'sha narxni 100% qabul qiladi.
- **Inflyatsiya / Dublikatsiya ximoyasi:** Hajm ustunidagi "Jami", "Norma" kabi so'zlarni yoki "Itogo" hajmlarni noto'g'ri ko'paytirib yuborish (masalan 40 mlrd dan 60 mlrd ga oshib ketishi) qat'iy tekshiruvlar orqali to'xtatilgan.
- **Manfiy hajmlar:** Isklyucheniyalar (masalan, -10 m3) avtomat nolga tushib ketmaydi, ular to'g'ri ayirib tashlanadi.

## 3. Smeta -> FAKT -> F2 -> Qoldiq Munosabatlari
Loyihaning yuragi bu **Moliyaviy Nazorat**.
- **Qoldiq (Ostatka):** Qoldiq doim [Smeta - F2] formulasi asosida hisoblanadi. FAKT hajmlar F2 ga aylanmaguncha qoldiqdan chegirilmaydi (yoki obyektning yondashuviga qarab FAKT bo'yicha ham ko'rish mumkin).
- **Qattiq qoidalar yo'q:** Pudratchi o'zgarishi yoki do'p ishlari (Доп. работы) ko'p bo'lishi sababli F2 hech qachon smetaga qattiq "qulflanmaydi". Faqat ortib ketgan taqdirda Qoldiq (Ostatka) qizil rangda minus ko'rsatadi.
- **Xavfsiz Yangilash (_faktSaqla / _faktQayta):** Smeta hujjatiga o'zgartirish kiritilib "Ishla" tugmasi bosilsa, tizim avval barcha yozilgan FAKT, oylik F2 va "Do'p. ishlarni" xotiraga olib qoladi (va _BAK_LRV zaxira yaratadi). Smeta tozalangach, hamma faktlarni o'z joyiga 100% nuqta-verguligacha qaytarib qo'yadi. Foydalanuvchi mehnati hech qachon o'chib ketmaydi.

## 4. Boshqaruv Paneli (30_Panel.js)
Tizim foydalanuvchilar va ma'muriyat uchun HTML Panel yordamida boshqariladi:
- **apiHolatOl(obyekt):** Hujjatni rz (Razdel), bl (Blok), rs (Resurs) shajarasida (tree) qaytaradi. Barcha narx, qoldiq, fakt va oylar bo'yicha summa shu yerda shakllanadi.
- **doGet API Ko'prigi:** `?action=api_boss` so'rovi orqali Antigravity yoki tashqi tizimlarga JSON formatida `apiHolatOl` va Dashboard ma'lumotlarini to'g'ridan-to'g'ri uzatadi.

## 5. Kataloglar va Papkalar Qoidasi
Barcha ishlar G: diskdagi "01_Tizim" (Google Drive) ichida bajariladi:
- `00_BOSH`: Tizim yadrosi va asosiy Dashboard.
- `01_LOYIHALAR`: Obyektlar papkasi (lokalkalar, _LRV_PLUS, _NAT_ shu yerda saqlanadi).
- `03_ARXIV_F2`: Har oylik aktlarning yopilgan nusxalari.
