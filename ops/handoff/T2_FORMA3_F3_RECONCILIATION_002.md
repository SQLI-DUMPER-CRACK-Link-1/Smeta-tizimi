# T2-FORMA3-F3-RECONCILIATION-002

## TASK ID

`T2-FORMA3-F3-RECONCILIATION-002`

## OWNER / MACHINE

- owner: `codex`
- machine: `noutbuk`
- branch: `codex/f3-closeout-v1`
- production_write_allowed: `false`

## MAQSAD

`C1 — F3` bandining haqiqiy holatini qayta qurish. F3 implementatsiyasi
`T2_FORMA3_F3_001` handoffiga ko‘ra allaqachon bajarilgan va `origin/main`
ichida bor. Ushbu task F3 kodini qayta yozmaydi; main/production/source
holatini alohida dalil bilan tasdiqlaydi, qolgan UNKNOWN bandlarni ajratadi va
governance truthni yangilaydi.

## BASE / EVIDENCE BOUNDARY

- `origin/main` tekshirildi: `81641ded6a3920f308a8de6b11eade057772ad15`
- F3 source commit main tarixida: `992384dd2e836cbe600da8a6b647e84e1d3160e0`
- F3 source branch: `claude/forma3-f3-v1` → `992384dd2e836cbe600da8a6b647e84e1d3160e0`
- primary F3 handoff: `ops/handoff/T2_FORMA3_F3_001.md`
- production migration evidence: `20261102090000_t2_forma3_rule_mapped_v1`

## OWNED PATHS

- `ops/ACTIVE_TASKS.json`
- `docs/governance/CURRENT_STATE.md`
- `ops/handoff/T2_FORMA3_F3_RECONCILIATION_002.md`
- `ops/mailbox/T2-FORMA3-F3-RECONCILIATION-002/**`

## DO-NOT-TOUCH

- `frontend/src/lib/forma3-export.ts`
- `frontend/src/lib/forma3-export.hujjat.test.ts`
- `frontend/src/admin/sahifalar/NakopitelniyVedomost.tsx`
- `supabase/migrations/20261102090000_t2_forma3_rule_mapped_v1.sql*`
- boshqa agentlarning `owns` yo‘llari
- production business data va production migration

## VERIFIED WORK

- F3 export modeli, UI tugmasi/ko‘rish oqimi va `FORMA3_RULE_MAPPED` migration
  source tree’da mavjudligi tekshiriladi.
- `NULL != 0`, approved F2-only period semantics, live `$`siz formulalar,
  nakrutka podvali va `ВСЕГО К ОПЛАТЕ` invariantlari regression testlar bilan
  qayta yuritiladi.
- Production faqat read-only catalog/RPC tekshiruvlari bilan ko‘riladi.

## OPEN / UNKNOWN

- Kompaniya 17 da tasdiqlangan F2 bo‘lmagani uchun real F3 period jami ↔ F2
  `к оплате` tiyingacha tenglik — `UNKNOWN`.
- Egasi bilan authenticated browser smoke va Excel/LibreOffice print fidelity
  — `UNKNOWN`; parol/cookie so‘ralmaydi.
- F3 source’da yangi biznes feature yoki schema truth yaratilmaydi.

## ACCEPTANCE

1. F3 source va testlar `origin/main`da mavjud.
2. Focused F3 testlar PASS.
3. Full release gates branchda PASS yoki aniq pre-existing failure bilan
   ajratilgan.
4. `CURRENT_STATE.md` va `ACTIVE_TASKS.json` statuslari source/production
   faktiga mos.
5. Production write/deploy faqat gate’lar yashil bo‘lsa; migration qayta
   qo‘llanmaydi.

