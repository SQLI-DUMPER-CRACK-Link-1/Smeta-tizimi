# 📦 SKLAD AI ARXITEKTURASI (OVOZLI KIRIM-CHIQIM TIZIMI)

> **Muallif:** Antigravity (Frontend va AI Integratsiya agenti)
> **Sana:** 2026-07-02
> **Maqsad:** Claude (va boshqa agentlar) ushbu hujjatni o'qib, Ombor (Sklad) uchun mo'ljallangan 2 bosqichli, Groq orqali ishlaydigan telegram ovozli bot arxitekturasini to'liq tushunib olishi va keyingi backend integratsiyalarida shu mantiqqa tayanishi uchun yozildi.

---

## 1. MUAMMONING MOHIYATI
Skladchi (PTO muhandisi) qurilish maydonida chang, loy sharoitida telefonda matn terib o'tirishga vaqti yo'q. U shunchaki Telegram botga **ovozli xabar** yuboradi (Masalan: *"Bugun 12 lik armaturadan 5 tonna keldi, Amir Greetdan"*).
**Xavf:** Agar AI bu matnni o'zboshimchalik bilan qandaydir nomga aylantirib (masalan: "Арматура 12мм" deb) Google Sheets'ga yozib yuborsa, qoldiq (ostatka) hisoblaydigan filtrlarda tartibsizlik kelib chiqadi (bazada "Арматура d-12мм" bo'lishi mumkin). Inson xatosi va AI gallyutsinatsiyasi natijasida yuzlab dublikat nomlar paydo bo'ladi.

## 2. YECHIM: "IKKI BOSQICHLI SARALASH" ARXITEKTURASI (State Machine)
Tizim to'g'ridan-to'g'ri bazaga hech narsa yozmaydi. U **Tasdiq (Inline Keyboard)** orqali ishlaydi.

### A Bosqich: Ovozni tahlil qilish (Groq / Gemini)
1. Telegram'dan ovozli xabar (.ogg) keladi.
2. Bot uni tezkor va aniq tahlil qilish uchun **Groq API** (masalan, LLaMA-3 yoki Mixtral) yoki Gemini API'ga yuboradi. Nega Groq? Chunki u **LPU** arxitekturasida ishlaydi va sekundiga minglab token qaytaradi, javob deyarli lahzada shakllanadi.
3. AI'ning vazifasi faqat **Kategoriyani (Tip)** va boshqa mayda detallarni (soni, yetkazib beruvchi) aniqlash. 
   - *Ovoz:* "Sheben 5 ga 20 dan 12 kub keldi"
   - *AI JSON:* `{"operatsiya": "kirim", "tip": "Шебень", "miqdor": 12, "birlik": "м3", "kontragent": ""}`

### B Bosqich: Lokal Filtr (Google Apps Script)
1. Kategoriya ("Шебень") olingach, GAS kodi Google Sheets'ning "Приход" yoki "Справочник" varog'iga ulanadi.
2. U yerdagi minglab qatorlarni o'qimaydi. U faqat **B-ustuni (Kategoriya)** "Шебень" bo'lgan 5-10 ta aniq variantni (D-ustundan) tortib oladi.

### C Bosqich: Tasdiqlash (Telegram Inline Keyboard)
1. Tortib olingan variantlar Telegram'da **Tugmalar** ko'rinishida foydalanuvchiga yuboriladi.
2. Eng oxirida har doim **"➕ Yangi qo'shish"** tugmasi turadi (agar kutilmagan material kelsa).
3. Vaqtinchalik ma'lumot (JSON) Google Apps Script'ning `CacheService` idorasida saqlanib turadi (masalan, 10 daqiqagacha).

### D Bosqich: Yozish (Execution)
1. Foydalanuvchi "📁 Щебень фракция 5х20" tugmasini bosadi (yoki Yangi qo'shishni).
2. Bot `CacheService` dan keshni oladi, ismni tugmadagi rasmiy nomga almashtiradi.
3. Ma'lumotlarni Google Sheets'ning tegishli (Приход yoki Расход) varog'iga yozadi va keshni tozalaydi.

---

## 3. QOIDALAR VA KELISHUVLAR (Claude uchun)

1. **Groq API integratsiyasi:** AI shlyuzlari (Gateway) uchun alohida e'tibor qilinadi. Telegram bot tezkor bo'lishi uchun webhook bloklanmaydi, barchasi fon (queue) yoki tezkor asinxron usulda ishlaydi (hozirgi `_tgAiNavbatga` mexanizmiga o'xshab).
2. **Spravochnik ustunlari:** Sklad ma'lumotlari aynan `Navoiy Park` faylidagi kabi standart qat'iy ustunlarga asoslanadi:
   - `B-ustun`: Kategoriya (Tip materiala)
   - `D-ustun`: Material rasmiy nomi (Наименование)
3. **Qoldiqlar (Ostatka) Filtrlari:** Barcha sumif/ostatka formulalari yulduzcha (`*`) - qisman qidiruv orqali ishlamasligi (chunki tugmali tizim yuz foiz qat'iy nom beradi), aksincha To'liq moslik (Exact Match) bo'yicha ishlashi ta'minlanadi.

> **Xulosa:** Antigravity (Frontend/Telegram bot) shu arxitekturani `86_Sklad.js` va `40_Telegram.js` ichida qurishni o'z zimmasiga oladi. Claude esa keyingi safar anomaliyalar, buxgalteriya va Supabase sinxronizatsiyalarini tekshirayotganda ushbu qat'iy "Ikki bosqichli saralash" mavjudligini inobatga oladi.
