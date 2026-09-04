# T2-COMPANY-CONTROL-FINAL-AUDIT-002

**Role:** INDEPENDENT PRODUCT / UX / SECURITY AUDITOR
**Date:** 2026-09-03
**Target:** Final Integrated Product (`GAS__nrel2` / `audit/final-002` brenchi)
**Target SHA:** 9d9ba3d (merge: integrate codex/t2-company-control-auth-core-v1)

Ushbu audit xulosasi Claude va Codex tomonidan qilingan integratsiya natijalarini to'g'ridan-to'g'ri sinab ko'rish orqali tayyorlandi.

---

## 1. CLASSIFICATION OF PREVIOUS FINDINGS

- **MULTI-COMPANY STALE DATA (API Caching):** `FIXED`. `KompaniyaKontekst.tsx` faylida kompaniya almashganda `qc.clear()` chaqirilib, eski kesh tozalanmoqda.
- **ROLE SWITCHING ARXITEKTURASI (A -> B):** `REGRESSION/CONFIRMED`. Codex `effectiveAuth.ts` yozgan bo'lishiga qaramay, Claude uni `AdminShell.tsx` ichida integratsiya qilmagan. Hali ham eski `useSessiya().data?.rol` ishlatilmoqda.
- **SECURITY UX (Direct URL Bypassing):** `CONFIRMED`. `App.tsx` yoki `AdminShell.tsx` da `<RouteGuard>` yo'q. Faqat `kompaniyaKerakmi` orqali UI State yashiriladi, ammo API xato bermagunicha UI chizilaveradi.
- **Company Control Gaps (Tabs/Buttons):** `CONFIRMED/REGRESSION`. `KompaniyaPage.tsx` faylida Profilni tahrirlash, Rollar, Modullar, Integratsiyalar, Audit kabi 7 ta tab umuman yo'q. Hali ham eski "A'zolar" ro'yxati turibdi.

---

## 2. SEKSIYALAR BO'YICHA XULOSALAR

### SECURITY: **FAIL**
- **Direct URL Bypassing:** Yopiq sahifa URL manzilini to'g'ridan-to'g'ri brauzerga kiritganda 403 o'rniga komponent chizilib ketadi. API orqali rad etilsa-da, bu "Professional 403/Permission UX" talabiga javob bermaydi.
- **Role & Route Integration:** Codex yozgan `effectiveAuth.ts` backend/core shartlarini zo'r tekshiradi, ammo frontend buni ishlatmayapti.

### ROLE_SWITCH: **FAIL**
- A kompaniyada boss, B kompaniyada pto bo'lgan foydalanuvchi kompaniya almashtirganda `AdminShell` menyulari moslashmaydi. Sababi: `AdminShell.tsx` hamon global `sess.data?.rol` o'qimoqda.
- Foydalanuvchi A dan B ga o'tganda faqat ID o'zgaradi, lekin effective role UI uchun yangilanmaydi.

### DIRECT_URL: **FAIL**
- Tizim faqat API 403 xatosiga tayanadi. Frontend Guard mavjud emas.

### COMPANY_CONTROL: **FAIL**
- Talab qilingan 7 ta tab (Profil, A'zolar, Rollar, Modullar, Obyekt ruxsatlari, Integratsiyalar, Audit) mavjud emas. `KompaniyaPage.tsx` ichida fake tugmalar yo'q, lekin funksionallikning o'zi ham yo'q.
- Optimistic conflict (Profile Concurrency) testini o'tkazish imkonsiz, chunki Profil tahrirlash UI umuman yo'q.

### STALE_DATA: **PASS**
- `qc.clear()` yordamida ma'lumotlar tozalanishi muvaffaqiyatli ulangan. Boshqa kompaniyaga o'tganda eski ma'lumot qolmaydi.

### RESPONSIVE: **PASS**
- UI kichik noutbuk ekranlarida (`w-64 xl:w-72`) moslashuvchan. Overlap yo'q.

---

## 3. ASOSIY P0 VA P1 KAMCHILIKLAR

### P0 (BLOCKERS FOR MAIN)
1. **AdminShell Role Integration:** `AdminShell.tsx` zudlik bilan Codex'ning `effectiveAuth.ts` natijasidan keladigan rolga (active membership role) ulanishi shart.
2. **Frontend Route Guards:** Barcha protected URL'lar oldidan (React Router darajasida) Auth va Permission Guard o'rnatilishi shart.
3. **Company Control UI Gaps:** T2-COMPANY-CONTROL-FOUNDATION-001 shartnomasida belgilanganidek, Antigravity (men) yasagan Hub UX (`TestKompaniyaHub.tsx`) yoki to'liq 7 ta tabga ega bo'lgan `KompaniyaPage.tsx` integratsiya qilinishi kerak edi. Hozirgi `KompaniyaPage.tsx` eski holatda.

### P1 (HIGH PRIORITY)
1. **Superadmin Mixing:** `KompaniyaKontekst.tsx` ichida `superadmin` ruxsatini a'zolik rollari qatoridan (`a.rol === 'superadmin'`) izlash mantig'i saqlanib qolgan. Buni PlatformRole va MembershipRole aralashmasligini hisobga olib Codex'ning contractiga to'g'rilash kerak.

---

## 4. XULOSA

**OWNER_SMOKE_CHECKLIST:**
- [ ] A -> B kompaniya o'tganda menyu va ruxsatlar tegishli rolga (boss -> pto) moslashishi (HOZIR ISHLAMAYDI).
- [ ] /admin/kompaniya sahifasida barcha 7 tab haqiqiy holatni ko'rsatishi (HOZIR MAVJUD EMAS).
- [ ] Direct URL URL kiritilganda 403 Guard ishlashi (HOZIR ISHLAMAYDI).

**READY_FOR_OWNER_SMOKE:** NO
**READY_FOR_MAIN:** NO

Integratsiya qilingan kod bazasi Codexning backend ruxsatnomalarini o'z ichiga olgan bo'lsa-da, UI qatlamida (Claude integration) eski kodlar (global rol, guard yo'qligi) saqlanib qolgan va Company Control Center qismi to'liq emas. 
Ruxsat (Security/Roles) va UI o'rtasidagi uzilishlarni to'g'irlash uchun Claude ga qaytarildi.
