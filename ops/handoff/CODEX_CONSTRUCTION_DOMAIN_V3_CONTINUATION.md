# Construction hard-domain V3 continuation

Branch: `codex/construction-os-expansion-v3`.

Implemented source:

- Commercial V2 extends `t2_shartnoma`, adds change orders, version checks and idempotent decision ledger.
- Procurement V2 uses `material_need_id → PR (t2_erp_taminot) → RFQ → bid → award/PO → receipt → warehouse movement` by IDs only.
- Schedule V2 extends `t2_grafik_qator` with project/WBS/baseline, dependency cycle rejection, progress history, variance/late and procurement-risk read model.
- Cloudflare `/api/domain-v3`, typed client and reusable V3 panels are additive; no `App.tsx`, `AdminShell`, Boss, FILE-TRUTH or Claude-owned files changed.

Verification completed locally: TypeScript build, Vite build, Vitest (19 files/50 tests), `npm run tekshir`, V3 guard (16 checks), lint warnings only, `git diff --check`.

Still required before any release: run the migration and acceptance in a disposable Supabase database, then semantic DB tests for cross-tenant rejection, duplicate operation IDs, partial/over receipt and schedule cycle. Production remains untouched.
