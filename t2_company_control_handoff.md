# TIZIM_02 COMPANY CONTROL FOUNDATION - HANDOFF REPORT

## 1. Bajarilgan ishlar
**Header Context UX (T2-COMPANY-CONTROL-FOUNDATION-001)**
- `KompaniyaTanlov.tsx` to'liq noldan yozildi va qat'iy qoidalarga moslandi.
- **SUPERADMIN (Platforma administratori):** `🌐 Global` formati qo'shildi. Dropdown orqali barcha kompaniyalar (yoki global holat) tanlanadi.
- **NORMAL USER (1 kompaniya):** Dropdown butkul yashirildi. O'rniga `Kontekst: Asosiy kompaniya` statik matni qo'shildi va foydalanuvchining roli UI da qat'iy ko'rsatiladi.
- **NORMAL USER (Ko'p kompaniyalar):** Qat'iy dropdown.
- **NO MEMBERSHIP:** Kompaniya bo'lmasa "Kompaniya oching yoki taklifni qabul qiling" CTA (Call-to-Action) yaratildi.
- "Stale data" ko'rinishining oldi olinib, professional `Yuklanmoqda...` statelari qo'shildi.

**Company Control Center (Hub)**
- `/admin/kompaniya` sahifasi noldan yaratildi (`TestKompaniyaHub.tsx`).
- Barcha so'ralgan tablar qo'shildi: UMUMIY, A'ZOLAR, ROLLAR VA RUXSATLAR, MODULLAR, LOYIHA/OBYEKT ACCESS, INTEGRATSIYALAR, AUDIT.
- Fake subscription yoki noo'rin to'lov formati qo'shilmadi.
- Texnik xatoliklar (JSON/SQL/ID) UI dan butunlay izolyatsiya qilindi, foydalanuvchi do'stona bo'sh holatlar (empty states) qo'shildi.

**Arxitektura va Routing**
- `AdminShell.tsx` ga `KompaniyaProvider` global ulandi. Bu orqali butun tizim (Tizim_01 va Tizim_02) endi **"effective active context view-model"** ostida ishlay oladi.
- Context Switcher (`KompaniyaTanlagich`) `AdminShell` ning yuqori qismiga (Top Bar) joylashtirildi, eski `TestShell` dagi takroriy bar o'chirildi.
- Barcha o'zgarishlar maxsus izolyatsiya qilingan `ag/t2-company-control-foundation` branchiga commit qilindi.

## 2. Ochiq Savollar (Claude uchun API Contract kutilmalari)
1. **Rollar va Ruxsatlar:** "A'zolar" tabidagi matritsa hozirda dizayn maketi (mockup). Claude qanday API kontrakt tuzishidan kelib chiqib, shular bog'lanadi. (masalan, `sbT2RuxsatlarOl()`).
2. **Global rejim:** Hozir `isGlobal` tanlansa `joriy` null bo'ladi. Bu holatda `/admin/test/smeta` kabi sahifalar `kompaniya_id` so'raganda xato berishini Claude hal qilishi (ya'ni global rejimda id=null orqali barchasini berishi yoki bloklashi) kerak bo'ladi.
3. **Audit Log:** Hozirgi Audit sahifasi uchun Supabase da maxsus `t2_audit_log` yoki shunga o'xshash table kutamiz.

## 3. Screenshots & Visuals
*(Note: Agent screenshot ololmagani uchun, o'zgarishlarni frontend/src orqali `npm run dev` qilib ko'rishingiz mumkin.)*
- Tepa barda barcha role'larga qarab ko'rinadigan Header UX mavjud.
- Sidebar menyusida "Operatsion Boshqaruv" guruhida "Kompaniyalar" tugmasi paydo bo'ldi.
