# O'ZBEKISTON MILLIY QURILISH PLATFORMASI (NATIONAL CONSTRUCTION OS)

Ushbu hujjat Respublika miqyosidagi ko'p kompaniyali Qurilish Boshqaruv Tizimi, B2B Hamkorlik Tarmog'i va Bozor Kliringi Standarti arxitekturasini belgilab beradi. Shuningdek, u barcha AI agentlar (Claude, Antigravity, Gemini va kelajakdagi dasturchilar) uchun tizimni rivojlantirish va saqlash bo'yicha yagona qonuniy va texnik yo'riqnomadir.

## 1. STRATEGIK VIZYON VA MILLIY MIQYOS
**Loyihaning maqsadi:** Navoiy shahridagi «Yangi O'zbekiston bog'i» (32 ga) qurilishini raqamlashtirishdan boshlab, ko'p kompaniyali Construction AI OS darajasiga (Procore / Autodesk analogi) ko'tarilish.
O'zbekiston Milliy Qurilish Platformasining asosiy maqsadi — mamlakatning butun qurilish sanoatini yagona raqamli ekotizimga birlashtirishdir. Bu tizim Toshkent shahridan boshlab Qoraqalpog'iston Respublikasigacha, Navoiyning sanoat hududlaridan Farg'ona vodiysining aholi punktlarigacha bo'lgan barcha loyihalarni qamrab oladi.

**Bozor Ishtirokchilari:**
* Yirik Developerlar: Murad Buildings, Discover Invest, Golden House va boshqalar.
* Davlat Buyurtmachilari: Yangi Toshkent, Yangi Navoiy loyihalari ma'muriyatlari hamda sohaviy vazirliklar.
* Pudratchilar: 1000 dan ortiq Bosh pudratchi tashkilotlar va 10 000 dan ziyod ixtisoslashgan Subpudratchilar.
* Ishlab chiqaruvchilar: Bekobod metallurgiya kombinati, sement va kabel zavodlari.
* Xizmat ko'rsatuvchilar: Maxsus texnika parklari va loyiha institutlari (masalan, O'zshaharsozlikLITI).
* Nazorat Organlari: GASN va "Shaffof Qurilish" tizimi.

**Yagona Haqiqat Manbai:**
* **Baza (Haqiqat Manbai):** Supabase PostgreSQL 17. Barcha moliya-xo'jalik hisob-kitoblari, smeta daraxtlari va tranzaksiyalar faqat shu yerda saqlanadi.
* **Sheets Ko'zgusi:** Google Sheets ma'lumotlar bazasi emas. U faqat foydalanuvchilar uchun qulay interfeys hamda «ИШЧИ СМЕТА» ma'lumotlarini import/export qilish uchun «oyna» vazifasini bajaradi.
* **Frontend:** Next.js frameworki asosida, Cloudflare Pages yoki Vercel platformalarida joylashtiriladi, UI komponentlar uchun shadcn/ui kutubxonasidan foydalaniladi.

## 2. B2B NETWORK VA KO'P KOMPANIYALI MULTI-TENANT MODELI
Platforma yuqori darajadagi izolyatsiya va xavfsizlikni ta'minlovchi arxitekturaga asoslangan.
* **Multi-Tenant Izolyatsiya:** Har bir kompaniya tizim ichida o'zining virtual makoniga ega. Ma'lumotlar xavfsizligi company_id identifikatori va PostgreSQL Row Level Security (RLS) mexanizmi orqali ta'minlanadi, bu esa kompaniyalar o'rtasida ma'lumotlar sizib chiqishini oldini oladi.
* **Kompaniyalararo Hamkorlik (B2B Project Federation):** Loyiha boshqaruvi zanjiri raqamli ko'rinishda amalga oshiriladi:
  1. Buyurtmachi platformada loyiha kartochkasini yaratadi.
  2. Bosh pudratchi tizim orqali taklif qilinadi va barcha huquqlarni oladi.
  3. Bosh pudratchi o'z navbatida ixtisoslashgan Subpudratchilarni ulaydi.
* **Qog'ozsiz Hujjat Aylanishi:** Subpudratchi tomonidan tizimga kiritilgan bajarilgan ishlar faktlari avtomatik ravishda Bosh pudratchiga tekshirish uchun yuboriladi. Bosh pudratchi tasdiqlaganidan so'ng, ma'lumotlar Buyurtmachiga o'tadi. Barcha jarayonlar yagona raqamli zanjirda muhrlanadi.

## 3. MILLIY ME'YORIY BAZA VA HUDUDIY NARXLAR KLIRINGI
Tizim milliy qurilish qonunchiligi va iqtisodiy ko'rsatkichlari bilan uzviy bog'langan.
* **Me'yoriy Qatlam:** Platformaga Shaharsozlik normalari va qoidalari (SHNQ), KMQ hamda Yagona milliy klassifikator integratsiya qilingan. Bu loyihalarni smeta bosqichidanoq standartlashtirish imkonini beradi.
* **Hududiy Narxlar Kliringi (14 ta hudud):** Tizim 14 ta ma'muriy hudud bo'yicha real vaqt rejimidagi narxlar indeksini yuritadi: Asosiy materiallar, Energiya resurslari, Ishchi kuchi xarajatlari va hududiy koeffitsientlar.
* **Avtomatik Ekspertiza:** Smeta ma'lumotlari sun'iy intellekt yordamida tahlil qilinadi va narx anomaliyalari (o'rtacha bozor narxidan asossiz chetlashishlar) haqida ogohlantirish beradi.

## 4. DAVLAT TIZIMLARI VA YURIDIK INTEGRATSIYALAR
Platforma barcha jarayonlarni yuridik jihatdan legallashtirish uchun davlat xizmatlari bilan bog'langan:
* **E-IMZO (ERI):** Forma-2, Forma-3, AOSR aktlari va shartnomalarni 100% yuridik kuch bilan imzolash.
* **Didox.uz / Soliq.uz:** Elektron hisob-fakturalarni (EHF) ombor kirimiga avtomatik bog'lash.
* **Shaffof Qurilish:** Pudratchilar reytingi va litsenziyalarini tekshirish, davlat hisobotlarini shakllantirish.
* **Open Banking:** To'g'ridan-to'g'ri to'lov topshirnomalari, maqsadli hisobraqamlar va akkreditiv nazorati.
* **1C:Korxona:** 1C:Podryadchik va 1C:Buxgalteriya bilan API orqali ikki tomonlama ma'lumot almashinuvi.

## 5. B2B MATERIALLAR VA MAXSUS TEXNIKALAR MILLIY BIRJASI
* **Materiallar Xaridi (Marketplace):** Loyiha smetasi asosida tizim avtomatik ravishda "viborka" (materiallar tanlanmasi) shakllantiradi. Foydalanuvchi bitta tugma orqali eng yaqin joylashgan 10 ta zavodga RFQ (tender so'rovi) yuborishi va eng maqbul narxni tanlab, shartnoma tuzishi mumkin.
* **Maxsus Texnikalar Milliy Parki:** Ekskavatorlar, avtokranlar va betonnasoslar kabi texnikalarning geolokatsiyasi real vaqtda kuzatiladi. Bu qurilish kompaniyalariga bo'sh turgan texnikalarni tezkor ijara birjasi orqali topish imkonini beradi.

## 6. YUQORI YUKLAMALI ENTERPRISE ARXITEKTURA
Platforma millionlab tranzaksiyalarni qayta ishlashga mo'ljallangan zamonaviy texnologik stekka ega:
* **Database:** Multi-region PostgreSQL (Supabase / AWS Aurora) + Tenant Partitioning + Read Replicas.
* **Storage:** Cloudflare R2 bazasida cheksiz chizmalar, AOSR fotosuratlari va PDF hujjatlar arxivi ( egress narxi bilan).
* **Event Driven Engine:** Apache Kafka yoki RabbitMQ tranzaksiyalar navbati va Redis kesh tizimi.
* **Frontend & Mobile:** Next.js (Web) va React Native / PWA texnologiyasi. Qurilish maydonida oflayn ishlash imkoniyati.
* **AI Agentlar Klasteri:** Smeta Agent (hisob-kitoblarni tekshirish), F2/PTO Agent (hujjatlarni tayyorlash), Material/Xarid Agent (bozor tahlili), SHNQ RAG Agent (normativ hujjatlar maslahatchisi).

## 7. BIZNES MODEL VA MONETIZATSIYA
* **Tiered SaaS Obunasi:** Kichik subpudratchilar uchun minimal to'lovlardan tortib, ulkan qurilish holdinglari uchun kengaytirilgan tariflargacha.
* **B2B Marketplace Komissiyasi:** Materiallar va texnika ijarasi bo'yicha bitimlardan olinadigan tranzaksion foizlar.
* **Enterprise Private Cloud:** Yirik developerlar va davlat tashkilotlari uchun tizimni o'z serverlarida (on-premise) o'rnatish va maxsus litsenziyalash.

## 8. BUZILMAS QONUNLAR (HARD RULES & CONSTITUTION)
Ushbu qoidalar tizimning barqarorligi va ma'lumotlar yaxlitligini ta'minlaydi:
* **Q1. SOXTA MA'LUMOT QAT'IYAN TAQIQLANADI:** Tizimda Math.random(), uydirma raqamlar yoki qattiq kodlangan (hardcoded) mock ma'lumotlardan foydalanish taqiqlanadi. Agar ma'lum bir narx topilmasa, u NULL qiymatida qolishi kerak (0 qiymati tizim uchun 'bepul' degan ma'noni anglatadi).
* **Q2. O'LIK TUGMA QO'YILMASIN:** Interfeysdagi har bir UI elementi haqiqiy backend RPC (Remote Procedure Call) funksiyasiga ulangan bo'lishi shart. Tugma bosilganda hech qanday amal bajarmaydigan interfeys qismlarini yaratish taqiqlanadi.
* **Q3. INVARIANTLAR KAFOLATI:** Mantiqiy zanjir buzilmasligi shart: F2 <= Fakt <= Smeta. Har doim Qoldiq = Smeta - F2 >= 0 mantiqiy sharti tekshirilishi kerak.
* **Q4. MANFIY HAJMLAR BLOKLANMAYDI:** Tizimda qayta hisob-kitob (Перерасчёт) jarayonlari manfiy hajmlar orqali amalga oshirilishi mumkin. Shuning uchun x > 0 qat'iy cheklovi emas, balki umumiy yig'indi chegarasi (total limit) tekshiriladi.
* **Q5. NORMA != HAJM:** Ma'lumotlar strukturasida 5-ustun har doim sarf normasini, 6-ustun esa jismoniy hajmni bildiradi. Resursning umumiy hajmi = ota blok hajmi * norma formulasi bo'yicha hisoblanadi.
* **Q6. KATEGORIYA STANDARTI:** Buxgalteriya va sklad hisobi uchun kategoriyalar qat'iy belgilangan:
  * ЧЕЛ: faqat 'чел-час' (ishchi kuchi) uchun.
  * МАШ: faqat 'маш-час' (mexanizmlar) uchun.
  * ОБ: Svodka sarlavhalari (ob'ekt/blok) uchun.
  * МАТ: Qolgan barcha turdagi materiallar uchun.
* **Q7. OPTIMISTIK QULF VA IDEMPOTENTLIK:** Har bir tranzaksiya chaqirilayotganda unga takrorlanmas operation_id (UUID) beriladi. Ma'lumotlarni tahrirlashda ma'lumotlar bazasidagi version ustuni tekshirilishi shart.

## 9. DEPLOY VA OPERATSION XAVFSIZLIK QOIDALARI
* **Jonli manba (Source of Truth):** Har doim clasp remote dagi kod hisoblanadi (Git HEAD emas).
* **Ishni boshlash:** Har bir sessiya boshida majburiy ravishda clasp pull komandasi bajarilishi shart.
* **Taqiqlar:** Hech qachon git checkout <fayl>, git reset --hard yoki pop qilinmagan git stash komandalarini ishlatmang.
* **Testlash:** Har bir push operatsiyasidan oldin selftestFunksiyalar() ishga tushirilishi va testlar soni avvalgisidan kamaymasligi kerak.
* **Versiyalash:** Har bir yangi versiya chiqarilgandan so'ng 79_WebAPI.js faylidagi KOD_VERSIYA o'zgaruvchisi yangilanishi va clasp deploy qilinishi shart.

## 10. TIZIM_02 ARXITEKTURASI VA KO'CHIRISH REJASI
Tizim 4 qatlamli model asosida ishlaydi: Oyna (React) -> Darvoza (Cloudflare Functions) -> Haqiqat (Postgres RPC) -> Ko'prik (GAS T2_*.js).

**Funksiyalarni ko'chirish (Migration) quyidagi ustuvorlik tartibida amalga oshiriladi:**
1. Smeta (39% -> 100%)
2. F2 / Bajarilgan ishlar (4% -> 100%)
3. Hujjatlar aylanishi (11% -> 100%)
4. Shartnomalar (0% -> 100%)
5. Buxgalteriya (0% -> 100%)
6. Sklad / Ombor (0% -> 100%)
7. Faktura (0% -> 100%)
8. Spravochnik (8% -> 100%)
9. ERP (0% -> 100%)
10. Grafiklar (0% -> 100%)

## 11. DESIGN SYSTEM: DARK LUXURY & HIGH-DENSITY UX
Interfeys professional, qimmatbaho va ma'lumotlarga boy ko'rinishga ega bo'lishi kerak.
* **Texnik Stack:** Next.js, Tailwind CSS, shadcn/ui, Radix UI, TanStack Table & Virtual, Framer Motion.
* **Tipografiya:** Matnlar uchun Geist Sans yoki Inter, raqamlar, summalar va shifrlar uchun JetBrains Mono.
* **Ranglar palitrasi:** Chuqur qora (#09090b), kartalar fon rangi #18181b, chegaralar 1px border-white/10. Aksent ranglar sifatida Sky Blue (#38bdf8) va Emerald (#10b981) ishlatiladi.
* **Dashboard (Bento Grid):** Bog'ning umumiy moliyaviy holati, ob'ektlar kartalari, kichik grafiklar (sparklines) va xavf-xatarlar (anomaliyalar) radari.
* **Performance:** 10 000+ qatorli smetalar Virtual Scrolling texnologiyasi yordamida 60 fps tezlikda kechikishlarsiz ishlashi shart.
* **Tezkorlik:** Cmd+K yoki Ctrl+K kombinatsiyasi orqali ochiladigan Command Palette yordamida barcha funksiyalarni qidirish va boshqarish.

## 12. SAQLANISHI SHART BO'LGAN YADRO MEXANIZMLAR
Ushbu funksionalliklar tizimning asosi bo'lib, ularni o'zgartirishda ehtiyotkorlik talab etiladi:
* **36_XlsxQiymat.js:** ZIP XML formatidan faqat keshdagi <v> qiymatlarni o'qiydi. Bu Exceldagi #REF! xatolaridan himoyalanish uchun muhim.
* **35_F2Moslash.js:** F2 hujjatlarini iyerarxik tarzda smetaga moslashtirish va bog'lash mexanizmi.
* **00_AI_Gateway.js:** AI agentlari uchun kvota boshqaruvi va ulanish uzilganda avtomatik ravishda Gemini tizimidan Groq LPU tizimiga o'tish (fallback) mexanizmi.

Tasdiqlovchi shaxs: Person
Sana: 2026-08-25
