# Codex parallel domain gaps

Evidence base: `frontend/src/api/t2-shartnoma.ts`, `t2-buxgalteriya.ts`, `t2-birja.ts`, `supabase.ts` and `t2-sklad-konsolidatsiya.ts`.

| Domain | Existing canonical surface | Missing backend read/command model | UI status |
|---|---|---|---|
| Company | `t2-invite.ts` invite adapter | company create/join/current-company membership read model and role command | UI_READY_BACKEND_MISSING |
| Subscription | none found | plan, entitlement, usage and billing-provider-abstract read model | CONTRACT_ONLY |
| Commercial | `t2-shartnoma`, `t2-buxgalteriya` | normalized party/scope/change-order/invoice-payment lineage read model | UI_READY_BACKEND_MISSING |
| Procurement | `t2-birja`, warehouse APIs | material master and full PR→RFQ→award→PO→GRN chain | UI_READY_BACKEND_MISSING |
| Planning/design/quality/HR/AI | no audited canonical read models | bounded read models plus reviewed commands/RPCs | CONTRACT_ONLY |
