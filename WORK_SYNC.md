# Multi-Agent Sinxronizatsiya Protokoli (WORK_SYNC)

Ushbu fayl **Claude Code**, **Antigravity (UI/UX)**, va **Codex (Arxitektor/QA)** o'rtasida ma'lumot almashish, fayl-lock va handoff (ishni topshirish) uchun ishlatiladi.

---

## 📌 Hozirgi Status
**Sana/Vaqt:** 2026-08-28
**Tizim holati:** Tizim_02 Frontend modullari yig'ildi. Hozirda Zayavka (Talabnoma) moduliga o'tish kutilmoqda.

---

## 🔒 Hozirgi Fayl-Lock (Kim nima qilyapti?)
- **CLAUDE:** [Kutmoqda]
- **ANTIGRAVITY:** [Kutmoqda]
- **CODEX:** [Kutmoqda]

---

## ✅ Tayyor bo'lgan qism (So'nggi commitlar)
- **Antigravity:** 
  - `KirishSahifa.tsx` to'liq premium UI/UX va Ro'yxatdan o'tish qismi bilan yangilandi.
  - `AdminShell.tsx` va barcha menyular (Portfel, Moliya, Logistika, CRM/EDO) wrapper'lar orqali tartiblandi va guruhlandi.
  - `TestKorrespondensiya.tsx` (EDO) va `TestSotuvCrm.tsx` yasaldi.

---

## 🚀 Keyingi qadam (Navbatdagi "Vertical Slice")
Codex'ning ruxsati kutilmoqda. 

1. **Claude:** Backend API / RPC yozishi kerak (Kontrakt beradi).
2. **Codex:** API'ni tekshiradi.
3. **Antigravity:** API'ga moslab React UI qismini ulaydi.

---

## ⚠️ Xavf va Ochiq masalalar
- RPC kontraktlar (Typescript interfeyslari) har doim aniq berilishi shart.
- "Mock data" faqat dizayn uchun ishlatiladi va keyin olib tashlanishi kerak.
