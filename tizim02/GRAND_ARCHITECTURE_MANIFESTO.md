# KATTA ARXITEKTURA MANIFESTI (TIZIM_02 YAKUNIY TALABLARI)

Ushbu hujjat Tizim_02 ning yakuniy va o'zgarmas arxitektura qonuniyatlarini belgilaydi. Claude, ushbu qoidalarni to'liq o'qib, ma'lumotlar bazasi va kodni shunga moslashtirishing shart. Kichik UI o'zgarishlarini to'xtat va darhol shu arxitekturani qurishga o't.

## 1. DYNAMIC ROLES & KONTRAGENT HIERARCHY
Eng katta xato: Kompaniyalarga bitta qat'iy rol berish. Tizimda bitta kompaniya (Kontragent) bitta obyektda **Buyurtmachi**, boshqa obyektda **Bosh Pudratchi**, uchinchi obyektda **Sub-Pudratchi** yoki **Loyihachi** bo'lishi mumkin. 

### Ma'lumotlar Bazasi Talabi:
- **	2_kontragent (Yangi jadval):** Tizimdagi barcha yuridik shaxslar (o'zimizning kompaniya ham, chetdagi ta'minotchilar ham) shu yerda saqlanadi. 
- **Qatorlar:** id, inn (Yagona identifikator), 
omi, direktor, ekvizitlar, holat.
- **	2_obyekt_qatnashchilar (Many-to-Many):** Obyekt va Kontragentni bog'laydi.
  - obyekt_id
  - kontragent_id
  - ol (Enum: 'Buyurtmachi', 'Bosh Pudratchi', 'Sub Pudratchi', 'Loyihachi', 'Yetkazib beruvchi', 'Texnadzor')
  - shartnoma_id (Ushbu rolga asos bo'lgan shartnoma)

## 2. INN INTEGRATSIYASI VA AVTOMATIZATSIYA
Foydalanuvchi kompaniya yoki pudratchi qo'shayotganda hamma ma'lumotni qo'lda kiritmasligi kerak.
- **Talab:** INN kiritilganda (masalan, 9 raqamli STIR), davlat ochiq ma'lumotlar bazasidan (yoki mock qilingan tashqi API-dan, agar haqiqiy API bo'lmasa, arxitektura API qo'ng'iroqqa tayyor bo'lishi kerak) kompaniya nomi, yuridik manzili, MFO va bank hisob raqamlarini tortib olib formani to'ldirishi shart.

## 3. ZANJIRLI IERARXIYA (Zero-loading tree)
Tizim doim quyidagi zanjirda ishlaydi:
Kompaniya (Akkount) -> Kontragent (O'zimiz) -> Shartnoma -> Obyekt -> Blok -> Qavat -> Xona -> Ish Turi (Smeta) -> Resurs (Material/Ishchi)
- **Talab:** Ushbu daraxtni Frontendda har safar alohida API chaqirib qiynamaslik uchun, PostgreSQL ichida yagona **RPC funksiya** yoziladi. U jsonb_agg yordamida butun ierarxiyani bitta JSON obyekt qilib qaytaradi.

## 4. "BILIM BAZASI" VA SUN'IY INTELLEKT (Tavsiyalar Tizimi)
Tizim "kar" va "ko'r" bo'lmasligi kerak. O'tgan obyektlarda olingan xulosalar keyingi loyihalarda yordam berishi shart.
- **Takliflar va Birja (RFQ):** Tizim qaysi Sub-pudratchi yoki Yetkazib beruvchi o'z vaqtida material olib kelgani, qanday narx bergani haqida tarixni saqlashi kerak (	2_kontragent_tarix).
- **Talab:** Yangi obyekt uchun tender yoki xarid e'lon qilinganda (Birja moduli), tizim avtomatik ravishda: *"Oldingi obyektda ushbu sementni X kompaniyasi arzonroq va sifatliroq bergan, shularni tanlashni tavsiya qilamiz"* kabi mos variantlarni (AI-based matching yoki oddiy SQL reyting orqali) taklif qilib chiqarib berishi shart.

## 5. UMUMIY MARKAZLASHTIRISH (Shared Resources)
- Sklad, Kadr, Texnika bitta obyektga emas, markaziy bazaga (Bosh Kompaniyaga) tegishli bo'ladi va **TestXarita.tsx** da ko'rsatilganidek Obyektlarga faqatgina "Bog'lanadi" (M:N).

CLAUDE, SENING HOZIRGI ENG ASOSIY VAZIFANG: Ushbu manifestni o'qib chiqib, Supabase dagi 	2_kompaniya arxitekturasini 	2_kontragent va 	2_obyekt_qatnashchilar ko'rinishida qayta qurish va INN yordamida ma'lumotlarni tortish logikasini yaratish!
