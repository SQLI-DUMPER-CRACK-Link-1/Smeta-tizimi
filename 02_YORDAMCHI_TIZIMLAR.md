# 🛠️ YORDAMCHI TIZIMLAR VA INTEGRATSIYALAR

Smeta yadrosiga ulanib ishlaydigan barcha yordamchi modullar, generatorlar va tashqi ma'lumotlar bazasi (Supabase) integratsiyalari shu hujjatda bayon qilingan.

## 1. Akt Generator (F2 va Boshqalar)
**Maqsad:** Oylik va yakuniy bajarilgan ishlar aktlarini (Forma-2) avtomatik tarzda shakllantirish.
- **Mexanizm:** Tizim `Smeta tizimi` da tasdiqlangan va kiritilgan oylik fakt hajmlarni o'qiydi.
- **Eksport:** Excel yoki PDF formatida tasdiqlash uchun rasmiy ko'rinishda (Gost yoki korxona standartida) eksport qiladi.
- **Arxivlash:** Yaratilgan hujjatlar avtomatik tarzda `03_ARXIV_F2` papkasiga saqlab boriladi.

## 2. Prixod (Kirim) Tizimi
**Maqsad:** Obyektga kirib kelayotgan (prixod) haqiqiy materiallar miqdorini va hisob-fakturalarini nazorat qilish.
- **Taqqoslash:** Smetada (M) ko'rsatilgan materiallar miqdori bilan omborga kelib tushgan haqiqiy materiallar solishtiriladi.
- **Limit:** Pudratchi yoki taminotchi smetadan ortiqcha material olib kelishini yoki ortiqcha mablag' yozilishini nazorat qilish (Qoldiq - Prixod = Ishlatish mumkin bo'lgan qoldiq).

## 3. Viborka (Tanlanma)
**Maqsad:** Muayyan bir obyekt yoki ish turi bo'yicha jami kerak bo'ladigan Ishchi (CHEL), Mashina (MASH), va Material (MAT) larni svodka qilish.
- **Qo'llanilishi:** Snabjenetslar (ta'minotchilar) uchun materiallar ro'yxatini chiqarib berish. 
- **Filtrlash:** Faqat ishlari boshlanmagan yoki ma'lum bir Razdelga tegishli bo'lgan materiallarni guruhlab (Viborka qilib) berish.

## 4. Supabase (PostgreSQL) Sinxronizatsiyasi
**Maqsad:** Google Sheets'ning nisbatan sekin ishlashini chetlab o'tib, Next.js orqali qurilgan Frontend saytga yashin tezligida API taqdim etish.
- **Arxitektura:** `70_Supabase.js` va `71_SupabaseYozish.js` fayllari yordamida har safar smetada yoki Faktda o'zgarish bo'lganda, ma'lumotlar fondagi navbat (Queue) orqali Supabase'ga yoziladi.
- **Xavfsizlik:** Webhooks va maxsus JWT/Service Role kalitlar orqali ma'lumotlar xavfsiz uzatiladi.
- **Rollback (Reverse Sync):** Kiritilgan faktlarni faqatgina o'qish (Read) emas, balki Next.js dan turib yangi Fakt yozilganda, uni orqaga (Google Sheetsga) qaytarish (`77_ReverseSync.js`) amaliyoti ham mavjud. Tizim avval Sheets'ni, keyin Supabase'ni yangilaydi (Master - Slave arxitektura).
