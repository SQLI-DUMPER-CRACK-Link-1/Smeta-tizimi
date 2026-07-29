# 🤖 AI VA SUN'IY INTELLEKT INTEGRATSIYASI

Loyiha ichiga o'rnatilgan sun'iy intellekt (Gemini API) agentlarining ishlash mexanizmlari, cheklovlar (Rate limits) va xavfsizlik arxitekturasi.

## 1. AI_Gateway (Markazlashtirilgan Orkesrator)
**Fayl:** `00_AI_Gateway.js`
Tizimdagi barcha sun'iy intellekt so'rovlari aynan bitta ko'prikdan (Gateway) o'tadi. Bunga sabab — Google API limitlarini (429 Too Many Requests) yondirib yubormaslik.
- **LockService:** Bir vaqtning o'zida ikkita har xil skript (masalan, Telegram bot va Smetachi) AI ga murojaat qilsa, Gateway birini 45 soniyagacha navbatda kutib turishini ta'minlaydi.
- **Xotira (History):** Gateway endilikda kontekst va muloqotlar tarixini (chat history) eslab qolish va uni bitta oqimda Gemini API ga yuborish imkoniyatiga ega.

## 2. Titan AI (Smeta Tahlilchisi)
**Fayl:** `65_TitanAI.js`
- **Vazifasi:** Smetani to'liq tahlil qilish, narxlardagi mantiqsizlikni topish (masalan, armaturaning bozor narxi va smeta narxidagi tafovutlar), qoldiqni hisoblash.
- **Akt Yaratish:** `apiTitanAktYarat` funksiyasi orqali AI tizimi odam tilida yozilgan ("Falon obyektda kecha 15 m3 beton quydik") matnni tushunib, uni to'g'ridan-to'g'ri JSON formatidagi aniq Fakt hujjatiga (Aktga) aylantirib beradi.
- **Qat'iy Format (Structured Output):** AI har doim kod javob berganda JSON qaytarishi qat'iy nazorat qilinadi.

## 3. Telegram va Vision AI
**Fayllar:** `72_AI_Telegram.js`, `73_AI_Vision.js`
- **Telegram Bot:** Qurilish maydonidagi prorab yoki boshqaruvchilar to'g'ridan-to'g'ri Telegram orqali smetadagi o'zgarishlarni so'rashi yoki fakt (bajarilgan ishlar) kiritishi mumkin. AI bot xabarni tushunadi va tizimga yozadi.
- **Vision AI:** Qog'ozdagi chizmalar, aktlar yoki rasmlarni o'qib, uni elektron bazadagi hajmlar bilan solishtirish.

## 4. Antigravity API Ko'prigi
**Fayl:** `78_AntigravityAPI.js`
- Antigravity (yoki IDE'dagi boshqa AI yordamchi) ga to'g'ridan-to'g'ri jonli (live) ma'lumotlarni uzatish kanali.
- `apiHolatOl()` orqali Smetaning butun shajarasini (razdel, blok, material) to'liq JSON formatida jo'natadi, bu orqali AI bevosita tizim ma'lumotlarini analiz qila oladi. Qulflash va deploylarsiz ishlaydigan Universal API hisoblanadi.
