# T2-COMPANY-CONTROL-UX-AUDIT-001
**Role:** INDEPENDENT PRODUCT / UX / QA AUDITOR
**Date:** 2026-09-03
**Target:** Frontend T2 Company Control Foundation & UX

Ushbu hujjat Antigravity tomonidan T2 Company Control UX komponentlarini audit qilish natijasida tuzildi. Hujjat backend va frontend o'rtasidagi contract uzilishlarini (gaps) va UX/Security kamchiliklarini qamrab oladi.

---

## PASS_CASES
1. **NORMAL USER (1 COMPANY):** Dropdown muvaffaqiyatli yashirilgan, o'rniga "Kontekst: Asosiy kompaniya" statik yorlig'i (badge) chiqib turibdi. UI qat'iy va ortiqcha chalg'itishlarsiz.
2. **SUPERADMIN GLOBAL MODE:** `isGlobal` tekshiruvi muvaffaqiyatli ishlamoqda. "🌐 Global" holati va qolgan kompaniyalar orasida silliq o'tish (context switch) mavjud. Global rejimda `/admin/kompaniya` sozlamalari bloklanadi ("Kompaniya tanlanmagan" empty state).
3. **NO MEMBERSHIP:** Kompaniyasi yo'q foydalanuvchilar (yoki hali a'zolikni tasdiqlamaganlar) uchun "Kompaniya oching yoki taklifni qabul qiling" maxsus Onboarding CTA tugmasi chiqadi.
4. **STATE RECOVERY (Refresh/New Tab):** `localStorage` dagi `t2_kompaniya_id` orqali refresh va yangi tablarda foydalanuvchi qaysi kompaniyadagi ishini tashlab ketgan bo'lsa, o'shani tiklash qismi to'g'ri yozilgan (Revoked access bo'lsa `k[0]` fallback ishlaydi).
5. **RESPONSIVE (Desktop / 1366x768):** Sidebar `w-64 xl:w-72` qilib ishlangan va kichik noutbuk ekranlarida custom-scrollbar orqali muammosiz scroll qilinadi.
6. **LAYOUT INTEGRATION:** `KompaniyaProvider` endi butun `AdminShell`ni o'rab turibdi, natijada barcha sahifalar global *view-model* context'iga ulandi.

---

## FAIL_CASES
1. **MULTI-COMPANY STALE DATA (API Caching):** Kompaniya almashtirilganda (switch) UI yangilanadi, lekin TanStack React Query cache (yoki boshqa API hook'lar) eski kompaniya ma'lumotlarini tozalab tashlamasligi mumkin, chunki sahifa hard-refresh bo'lmaydi va boshqa modullar `joriy.id` o'zgarganini trigger sifatida to'liq catch qilmasligi ehtimoli bor. (Stale data xavfi).
2. **ROLE SWITCHING ARXITEKTURASI (A -> B):** Hozirgi `useSessiya()` hook faqat 1 ta global rolni (masalan "pto") qaytaradi. Lekin Multi-Company tizimida foydalanuvchi "A" kompaniyasida Boss, "B" kompaniyasida PTO bo'lishi mumkin. Hozir kompaniya almashtirilganda rol va menyular avtomat o'zgarmaydi.
3. **SECURITY UX (Direct URL Bypassing):** `AdminShell.tsx` menyuda tugmalarni yashiradi, lekin React Router dagi `<Outlet />` (ichki marshrutlar) URL manzilini to'g'ridan-to'g'ri kiritgan (masalan `/admin/test/moliya`) foydalanuvchini bloklamayapti. Ochiq qolib ketgan.
4. **FAKE BUTTONS (Hub):** `/admin/kompaniya` dagi "Saqlash" tugmasi hozircha simulyatsiya (setTimeout) qilinmoqda, haqiqiy `sbKompaniyaYangila` backendga ulanmagan. "Yangi taklif" tugmasi umuman harakatsiz.
5. **LOGOUT STATE LEAK:** `Tizimdan chiqish` bosilganda `localStorage` dan `t2_kompaniya_id` o'chirilmayapti. Boshqa odam kiritilsa, eski ID ni izlaydi.

---

## P0 (CRITICAL BLOCKERS)
- **PER-WORKSPACE ROLES (Claude):** `useSessiya()` ni global bitta roldan voz kechib, har bir kompaniya uchun biriktirilgan rollar (Entity Participants) ro'yxatini qaytaradigan qilish kerak. Aks holda Multi-Company modelida ruxsatlarni ajratib bo'lmaydi.
- **ROUTE GUARDS (Security):** `App.tsx` yoki `AdminShell.tsx` da faqat menyuni yashirish emas, balki to'g'ridan-to'g'ri URL kirilganda 403 Permission Denied (Professional ekran, raw SQL emas) beruvchi Guard komponent yaratilishi shart.
- **DATA ISOLATION (React Query):** Barcha ma'lumot chaqiruvchi hook'lar (masalan `useQuery(['fakturalar', kompaniya_id])`) qat'iy ravishda `kompaniya_id` ga bog'lanishi kerak. Kompaniya almashtirilganda parallel fetching xatoliklarga olib kelmasligini Codex test orqali tasdiqlashi shart.

## P1 (HIGH PRIORITY)
- **LOGOUT CLEANUP:** AuthContext yoki logout funksiyasi `localStorage.removeItem('t2_kompaniya_id')` ni albatta chaqirishi kerak.
- **API MOCKLARNI OLIB TASHLASH:** `/admin/kompaniya` markazidagi barcha tablardagi "UX mock" yozuvlarini va ishlamaydigan tugmalarni haqiqiy API mutation'larga almashtirish (Backend endpointlar tayyor bo'lishi bilan).

---

## CLAUDE_MUST_FIX (Backend & Contract)
1. **Sessiya va Rollar Kontrakti:** `GET /api/sessiya` endpoint endi foydalanuvchining barcha `(kompaniya_id, rol)` juftliklarini qaytarishi kerak.
2. **Kompaniyalar ro'yxati (RLS):** `sbT2KompaniyalarOl()` barcha kompaniyalarni emas, balki faqat joriy foydalanuvchi a'zo bo'lgan kompaniyalarnigina (Superadmin bundan mustasno) qaytaradigan maxsus bazaviy view yoki endpoint (masalan `my_companies`) taqdim etishi kerak.
3. **Audit Log:** T2 Audit uchun `t2_audit_log` arxitekturasi yozilishi kerak.

---

## CODEX_CORE_GAPS (Auditor e'tiboriga)
1. **Test Coverage Yo'qligi:** Frontend komponentlari (Context Switcher va Hub) ustida hech qanday unit test (Jest/React Testing Library) yoki E2E test (Playwright/Cypress) yo'q. Ehtiyotkorlik bilan Refactor qilinganda Regression xatolar chiqish ehtimoli 100%.
2. **Stale Data Testing:** Bitta foydalanuvchi ikkita kompaniyaga a'zo bo'lib, ular orasida switch qilganda state mutlaqo tozalanib yangi API call ketishini majburiy smoke test qatoriga qo'shing.

---

## READY_FOR_OWNER_SMOKE: **NO**
*(Hozirgi holatda vizual UX talab darajasida ishlangan bo'lsa-da, backend arxitekturasi va marshrut xavfsizligi (route guarding) to'liq emas. Claude API contractlarni yetkazib bergach va Security bo'shliqlari yopilgach, tizim Smoke Test ga tayyor bo'ladi.)*

---

## OWNER_SMOKE_CHECKLIST
- [ ] Tizimga "Prorab" (kompaniya A) va "Bugalter" (kompaniya B) a'zoligi bor foydalanuvchi bilan kirib, kompaniya almashtirilganda Nav menyu to'g'ri o'zgarishi tekshirilsin.
- [ ] Bitta kompaniyasi bor oddiy foydalanuvchi kirganda Headerda faqat "Asosiy kompaniya" yozuvi ko'rinishi va boshqa kompaniyalarga ura olmasligi tasdiqlansin.
- [ ] Manzil qatoriga ruxsat yo'q page (masalan `/admin/kompaniya/audit`) kiritilganda chiroyli "Ruxsat yo'q" (Permission Denied) ekrani chiqsin, app qotib qolmasin yoki oq ekran bermasin.
- [ ] Tizimdan chiqib, boshqa odam orqali kirilganda eski odamning kompaniyasi tanlanib qolmasligi tekshirilsin.
- [ ] Har bir "Saqlash" tugmasi haqiqiy Supabase API ga ob'ektlarni yuborishi va optimistik UI qulf (kutilganVersiya) xatosiz ishlashi tekshirilsin.
