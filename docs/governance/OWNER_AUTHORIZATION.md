# TIZIM_02 — Owner standing authorization

Status: ACTIVE · 2026-09-20 · Product Owner tomonidan berilgan

## Oddiy ishlar uchun doimiy ruxsat

Product Owner development tezligini ustuvor deb belgiladi. Quyidagi ishlar
uchun agent qayta-qayta alohida ruxsat so‘ramaydi:

- branch, commit, fetch, push, merge, cherry-pick va rebase;
- integration va `main` yangilanishi;
- kod, test, refaktor, konfiguratsiya va governance hujjatlari;
- additive, forward-only, qaytarish yo‘li bor Supabase o‘zgarishlari;
- odatiy Cloudflare Pages/Workers, GAS va ilova deploylari;
- mavjud release doirasidagi diagnostika, bugfix va smoke tekshiruvlari.

Bu hujjat chatdagi vaqtinchalik gap emas: u repository ichidagi amaldagi
Owner qarori sifatida agentlar uchun yagona ruxsat manbai hisoblanadi.

## Ishlash qoidasi

Agent vazifani mustaqil yakunlaydi, testlarni ishga tushiradi, branchni push
qiladi va texnik jihatdan tayyor bo‘lsa integratsiyani bajaradi. “Push qilaymi?”,
“merge qilaymi?”, “davom etaymi?” kabi takroriy savollar berilmaydi.

Agent faqat quyidagi holatlarda to‘xtaydi:

- qaytarib bo‘lmaydigan DROP/TRUNCATE/reset yoki real biznes ma’lumotlarini
  ommaviy o‘chirish;
- maxfiy kalitni rotate/overwrite qilish va tirik integratsiyani buzish xavfi;
- ma’lumotni tiklash yo‘li bo‘lmagan destruktiv qayta yozish;
- yangi pullik xizmat yoki tashqi moliyaviy majburiyat;
- texnik jihatdan chetlab bo‘lmaydigan credential/access yetishmasligi;
- mahsulot bo‘yicha haqiqiy, yechimsiz noaniqlik.

## Muhim chegara

Agent ownership locklarini va tenant/security tekshiruvlarini o‘chirib
qo‘ymaydi. Ular ruxsat so‘rash mexanizmi emas, parallel agentlar bir faylni
bosib ketmasligi va serverda vakolatsiz yozuv bo‘lmasligi uchun himoyadir.

Production xavfsizligi, tenant isolation, audit, idempotency, optimistic
locking va “NULL — noma’lum” qoidalari o‘z kuchida qoladi.
