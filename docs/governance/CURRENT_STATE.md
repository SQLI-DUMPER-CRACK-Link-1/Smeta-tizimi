# TIZIM_02 current state

Replaceable measured state, not a journal. Last checked: 2026-09-02.

| Field | Current value |
|---|---|
| `main_sha` | `b6db686329a4f3c7e5f49aca24d2872695e81402` (verified remote, unchanged) |
| `release_candidate` | `integration/next-main-release-v1 @ 640b6c3` — NEXT-MAIN-RELEASE-V1 + SMETA/F2/NAKOPITELNIY + Codex integration, RELEASE_BLOCKED_WITH_EXACT_CONTINUATION (26 ahead / 0 behind main, pushed) |
| `production_write_allowed` | **false** (owner-authorized for THIS release only, gated on the blockers below) |
| `smeta_f2_nakopitelniy` | **SOURCE_READY + ACCEPTANCE-VERIFIED** — `20260910120000` (F2 price-fact split A/B/C/D + `t2_smeta_revision` original-baseline ledger + `t2_nakopitelniy_v1` bounded STABLE period-aware cumulative), `20260911120000` (governed `t2_smeta_ozgarish` change control: atomic preflight-then-apply, zero partial mutation, compensating-revision reversal, optimistic lock, pre-use-only rollback), `20260912120000` (`t2_forma3` UNRESOLVED boundary — no legal/tax/payment total or column; `t2_yakunlash_talab` data-driven closeout pack; `t2_obyekt_yakunlash_v1`; `t2_workbench_v1` → `ConstructionDocumentControlReadModel`). All three acceptances raised their PASS sentinel on prod inside `BEGIN…ROLLBACK`, no state left. Guard: `t2_smeta_f2_nakopitelniy.test.cjs` (66 checks). Regression oracle `generateParkLegacyCompatibilityReport()` = MATCH:1 / INTENTIONAL_CHANGE:2 / UNRESOLVED:1 / **BUG_FOUND:0**. NOT applied to prod. |
| `codex_integration` | Codex hit usage limit; Claude took over. Merged: `codex/park-regression-lab-v1` (`f6d04c3`, pure PARK engine + legacy oracle), `codex/park-closeout-lab-v1` (`769c06b`), `codex/construction-document-control-workbench-v1` (`5586eb5`, generic engine + 4 ports + validators + UI). Codex uncommitted worktree work checkpointed as `87b2b31` and pushed to its branch before integration. Unrelated Commercial/Procurement/Schedule V3 branches NOT merged. Engine O(n²) rescan fixed (`640b6c3`): 10k-row valuation 3.35s→~35ms. `park-document-control` kept as reference/fixture namespace; canonical schema is already generic (`t2_smeta_*` / `t2_nakopitelniy_*` / `t2_workbench_*`). |
| `storage_STOR_001` | **LIVE** — DB migrations applied, GAS deployed (v378), frontend on main (`/admin/storage`). |
| `file_truth_FILE_TRUTH_001` | **SOURCE_READY** — private `R2_CANONICAL`, two-phase reserve/finalize/reconcile, `98_T2ReplicaSync.js` + Drive **managed-move** write-back (`20260907120000`), **Document Center registry read model** (`20260906120000`), **Sheets write-back reference** (`20260908120000` + `99_T2SheetsReplica.js`). NOT applied. |
| `boss_panel` | **SOURCE_READY** on release candidate (was P0 FAIL: GAS/Sheets `apiBossData`). Canonical `t2_boss_dashboard_v1` + `/admin/dashboard`. Verified read-only vs prod data. |
| `ctrl_001` | **SOURCE_READY** (was DEFERRED-P1) — real capability registry `20260904120000` (`t2_capability` / `_override` / `t2_job` / `t2_integration_health` / `t2_deploy_state`), precedence resolver `t2_capability_effective_v1` (project>company>global>default + kill-switch), audited commands, `t2_system_control_v1` aggregate. `/api/system-control` + `/admin/system-control` wired to real data. |
| `company_auth_director` | **SOURCE_READY** — `20260905120000`: **P0 fix** — `t2_kirish_royxatga_ol` no longer auto-joins a new user to every company; `t2_kompaniya_yarat_v1` (creator=director), `t2_men_v1` (identity+memberships), director-guarded `t2_azolik_*_v1`, `t2_royxat_sorov_qabul_v2`. `/api/company` + `/admin/kompaniya`. No subscription/payment. |
| `document_center` | **SOURCE_READY** — `/api/hujjat-royxat` → `t2_document_registry_v1`; `/admin/documents` renders the real Codex `DocumentCenter`; download → private R2 `/api/hujjat-ol`. A failed Drive replica is never a canonical failure. |
| `codex_ui` | document-center + participants + system-control + app-identity integrated; participants read real `t2_loyiha_qatnashchilar_royxat`; system-control + documents wired to real backends (this task). |
| `security_p0` | Hardcoded auth-secret fallback (`ZAXIRA`) **removed** — `_shared/auth.ts` fails closed; login returns 503 CONFIG with no cookie when `SESSIYA_KALIT` unset. `t2_security_p0.test.cjs` (41 checks). |
| `production_frontend` | Cloudflare Pages `smeta-tizimi.pages.dev`, auto-build from `main`. |
| `production_db` | Supabase `tuoyrzadkgoltpqkdiyx`. Applied: storage foundation, participant contract, signal migrations. **NOT applied** (dependency order): `20260902120000` file-truth, `20260903120000` boss-dashboard, `20260904120000` capability-registry, `20260905120000` company-onboarding, `20260906120000` document-registry-read, `20260907120000` replica-move, `20260908120000` sheets-writeback, `20260910120000` f2-baseline-price, `20260911120000` smeta-change-control, `20260912120000` forma3-closeout. Repo-vs-prod drift on `t2_resource_command_v2` / `t2_mindmap_request_identity_v2` tracked. |
| `release_blockers` | (1) **SESSIYA_KALIT** must be confirmed present in Cloudflare **Production AND Preview** before the fail-closed auth ships — Claude has no dashboard access; `_shared/auth.ts` history shows it was previously unreliable (caused the 2026-08-20 `ZAXIRA` fallback). (2) Cloudflare Pages deploy — owner-only. (3) Authenticated post-deploy smoke tests — owner-only. (4) Real Drive Forma-2 / Smeta template study for the Sheets projection + F2 document-fidelity acceptance (A–L) — Claude has no Drive access; the document-projection contract is designed (marker + canonical relation + hidden system columns, never banner rows / NAIMENOVANIE edits) but not verified against real templates. |
| `agent_control_plane` | `docs/governance/AGENT_COMMS_PROTOCOL.md` on `codex/agent-comms-protocol-v1` (not merged). Task truth: `ops/ACTIVE_TASKS.json`. `tizim02/MULOQOT.md` = append-only history. |
| `branches` | `ops/handoff/BRANCH_RECONCILIATION_NEXT_RELEASE.md`. Nothing deleted. Backlog kept: `universal-estimate-engine-v1`, `design-system-v1`, `storage-quota-ui-v1`, `agent-comms-protocol-v1`. |
| `roadmap` | `docs/architecture/CONSTRUCTION_OS_MASTER_ROADMAP.md` |
| `release_runbook` | `ops/releases/NEXT_MAIN_RELEASE_V1.md` |
| `continuation` | `ops/handoff/NEXT_MAIN_RELEASE_CONTINUATION.md` |
| `repo_health` | Two loose objects flagged bad by `git gc` (`f94fa32…`, `fb937515…`, both `(1)` partials) — not referenced by any branch; all release-candidate commits intact and pushed. Pre-existing detritus. |
| `broken` | No disposable Supabase branch (only `main`); all 7 migrations' acceptance run directly on prod inside rolled-back transactions (each raised its PASS sentinel). |
| `next_approval` | ONE consolidated — see the runbook §"Consolidated production approval request". |

## Evidence boundary

SHAs measured from repo/remote 2026-09-01. Production DB state measured from the
live Supabase catalog. NEXT-MAIN-RELEASE-V1 performed **no** production write, **no**
`main` push, **no** GAS/Cloudflare mutation. Every migration was verified only inside
a `BEGIN … ROLLBACK` transaction. `tizim02/MULOQOT.md` is an append-only historical
journal, not current state — this file is the only current-state authority.
