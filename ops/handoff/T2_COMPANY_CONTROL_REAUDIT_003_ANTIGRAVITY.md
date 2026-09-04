# T2-COMPANY-CONTROL-REAUDIT-003

**Role:** INDEPENDENT AUDITOR
**Date:** 2026-09-03
**Target:** `c52ba4f632b30fbac9de3ce0437c10963719e132` (Company Control Phase A Closeout)

## XULOSA: COMPANY_CONTROL PASS

Kechagi P0 xatolar to'liq bartaraf etildi. Quyida re-audit natijalari:

- **A boss → B pto menu role switch:** **PASS**. `AdminShell.tsx` endi global `sess.data?.rol` o'rniga, har bir kompaniya uchun qayta o'qiladigan `effektivRol` ni ishlatmoqda. Menyu shu asosda to'g'ri o'zgaradi.
- **Direct URL guard & Permission screen:** **PASS**. `RuxsatGuard` yozilib, `<Outlet />` ni o'rab oldi. Endi ruxsatsiz yopiq manzilga kirilganda API xatosidan ham oldin `useAuthorize` orqali UI qatlamida to'siladi va professional qizil Permission Screen chiqadi.
- **7 company tabs:** **PASS**. `KompaniyaPage.tsx` faylida Profil, A'zolar, Rollar, Modullar, Loyiha/Obyekt ruxsatlari, Integratsiyalar, Audit tablari qo'shilgan.
- **Profile optimistic lock:** **PASS**. Profil ma'lumotlarini saqlashda `expected_version: q.data!.versiya` ishlatilgan.
- **System Control global/company split:** **PASS**. `useGlobalSystemControl` va `useSystemControl` orqali superadmin bo'lsa `globalRejim` da aniq ajratilgan.
- **Cache clear:** **PASS**. Kompaniya almashganda React Query keshi `qc.clear()` orqali tozalanadi (Stale data xavfi yo'q).

**READY_FOR_REAL_PARK_VERTICAL_SLICE: YES** (Company Control qismi uchun).
