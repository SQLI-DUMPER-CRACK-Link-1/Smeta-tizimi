# T2-PTO-WORKFLOW-HARDENING-002 — yakuniy topshiruv

## Holat

- **Asosiy branch:** `codex/pto-workflow-hardening-v3`
- **Boshlang‘ich nuqta:** `881e3bcffe21e0949deaa0c48ee472205af8a2c6`
- **Vazifa:** PTO operatori uchun takroriy Smeta/Fakt kirishlarini bitta ishchi yo‘lga jamlash.
- **Ishlab chiqarish bazasi:** o‘zgartirilmagan.
- **Supabase migratsiyasi:** qo‘llanmagan.
- **GAS va Cloudflare maxfiy sozlamalari:** o‘zgartirilmagan.

## Shu branchda bajarilgan ish

`AdminShell` ichidagi alohida `/admin/fakt` menyu bandi olib tashlandi. Fakt kiritish va Smeta daraxti bitta `/admin/holat` ishchi yo‘lida qoladi; eski `/admin/fakt` marshruti chuqur havolalar uchun saqlangan. `/admin/holat` nomi foydalanuvchiga `Smeta va Fakt / LRV` deb ko‘rsatiladi.

Shu qarorni tekshiradigan release oracle yangilandi: alohida Fakt dublikati bo‘lmasligi va yagona ishchi menyu bo‘lishi tasdiqlanadi.

## Tekshiruv dalillari

- `npm run tekshir` — PASS.
- `npx tsc -b --force` — PASS.
- `npm run typecheck:functions` — PASS.
- `npx vitest run --maxWorkers=1 --no-file-parallelism` — **72 fayl, 499 test PASS**.
- `npm run lint` — PASS, faqat oldindan mavjud ogohlantirishlar.
- `npm run build` — PASS.
- `git diff --check` — PASS.
- `node ops/governance-check.cjs` — PASS, faqat `CURRENT_STATE.md`dagi eski main SHA haqida ogohlantirish bor.

## Chegaralar

Bu checkpoint autentifikatsiyalangan brauzer smoke’ini isbotlamaydi. Kompyuterdagi brauzer avtomatizatsiyasi joriy sessiyada URLni siyosat bo‘yicha aniqlay olmagani sabab to‘xtadi. Shu bois login → kompaniya → Smeta/Fakt → Fakt saqlash → F2 import → Nakopitelniy ketma-ketligi jonli foydalanuvchi sessiyasida bu branchdan mustaqil tasdiqlanmagan.

`CURRENT_STATE.md`ning main SHA qaydi ham alohida governance qarzi sifatida qolmoqda; uni shu kichik UI o‘zgarishi bilan yashirmasdan, integratsiyadan keyingi state update’da yangilash kerak.

## Integratsiya qarori

Kod va barcha mahalliy release gate’lari yashil. Branchni integration’ga qo‘shish mumkin. Productionga chiqarishdan oldin autentifikatsiyalangan PTO smoke majburiy: Smeta/Fakt yagona menyudan ochilishi, daraxtda smeta hajmi ko‘rinishi, Fakt yozuvi serverda kanonik qator ID + `operation_id` bilan saqlanishi, F2 ikki oynali moslashtirish va Nakopitelniy eksportlari tekshiriladi.
