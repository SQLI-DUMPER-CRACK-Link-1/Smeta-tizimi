# T2-COMPANY-CONTEXT-UX-AUDIT-001

## 1. EXECUTIVE SUMMARY

**Natija: FAIL.** `NEXT-MAIN-RELEASE-V1` texnik jihatdan deploy qilingan bo‘lsa ham, actor → company context modeli product qobig‘ida bir xil qo‘llanmagan. Eng katta aniqlangan sabab: production `/admin/*` sahifalari `useKompaniya()` ishlatadi, ammo `KompaniyaProvider` va ko‘rinadigan `KompaniyaTanlagich` faqat `/admin/test/*` ichidagi `TestShell`da mavjud. Natijada canonical sahifalar default context (`joriy: null`) bilan ishlaydi va Product Owner ko‘rgan “Avval yuqoridan kompaniya tanlang” holatini beradi — lekin yuqorida selector yo‘q.

Ikkinchi P0 muammo: frontend selector `t2_kompaniya`dan barcha faol kompaniyalarni o‘qiydi, core DB guard esa `t2_actor_kompaniya_azo_tekshir` orqali faol `t2_azolik`ni talab qiladi. `superadmin` platforma roli deb tasvirlangan, lekin superadmin uchun company membershipdan mustaqil, explicit server-side privileged access mavjud emas. Bu product modeli va tenant authorization o‘rtasidagi qarama-qarshilikdir.

Bu hujjat Claude fixini tekshirish uchun acceptance oracle hisoblanadi. U implementation emas; productionga, `main`ga, Cloudflare/GAS/Supabasega hech narsa yozilmadi.

## 2. AUDIT BASELINE

| Maydon | Dalil |
|---|---|
| Repository | `SQLI-DUMPER-CRACK-Link-1/Smeta-tizimi` |
| Audit checkout | `b54f68636a5ae38f6f73435a6f06df48c241e2f5` — `docs(release): NEXT-MAIN-RELEASE-V1 shipped — governance to RELEASED state` |
| Governance ichidagi release merge | `9462a361fb249da36aab8141428cc95c17e8a0d6` (`docs/governance/CURRENT_STATE.md`) |
| Integration SHA | Audit checkoutda integration branchning immutable SHA’i qayd etilmagan; current governance release uchun `9462a36`ni ko‘rsatadi. Bu audit uchun faqat `b54f686` live source tekshirildi. |
| Production | User-reported `smeta-tizimi.pages.dev`; browser authenticated test bu auditda bajarilmadi. |
| Evidence rule | Live code + current governance; `tizim02/MULOQOT.md` ishlatilmadi. |
| Inspected paths | `frontend/src/App.tsx`, `frontend/src/admin/AdminShell.tsx`, `frontend/src/test02/KompaniyaTanlov.tsx`, `frontend/src/test02/TestShell.tsx`, `frontend/src/admin/pages/{KompaniyaPage,SystemControlPage,DocumentsPage,ParticipantsPage,HujjatNazoratPage}.tsx`, `frontend/functions/{_shared/auth.ts,api/{kirish,sessiya,company,sb,sb-yoz}.ts}`, `frontend/src/api/{supabase,t2-men,t2-boss,t2-control}.ts`, onboarding/storage/control migrations, `frontend/tsconfig*.json`. |

## 3. CURRENT ROUTE MAP

| Route | Hozirgi surface | Scope klassi | Audit bahosi |
|---|---|---|---|
| `/` | `KirishSahifa` | USER_SCOPED | Login va registration request. |
| `/admin/dashboard` | `BossDashboard` | COMPANY_SCOPED | `useKompaniya()` talab qiladi; global dashboard emas. |
| `/admin/test/portfel` | `WrapperPortfel` | COMPANY_SCOPED | `TestShell` provider ichida. |
| `/admin/test/{moliya,logistika,smeta,zayavka,aosr,...}` | Legacy/T2 test surfaces | COMPANY_SCOPED / UNKNOWN | Provider bor, lekin production nav top-level unga bevosita olib boradi. |
| `/admin/documents` | `DocumentsPage` | COMPANY_SCOPED | Registry query `kompaniyaId` bilan. |
| `/admin/hujjat-nazorat` | `HujjatNazoratPage` | OBJECT_SCOPED | Company → project → object selector. |
| `/admin/participants` | `ParticipantsPage` | PROJECT_SCOPED | Company → project. |
| `/admin/storage` | `TestSaqlash` | OBJECT_SCOPED | Company → project → object storage. |
| `/admin/mindmap` | `TestXarita` | COMPANY_SCOPED | Provider tashqarisida ishlatilmoqda. |
| `/admin/kompaniya` | `KompaniyaPage` | USER_SCOPED + COMPANY_ADMIN | Current actor memberships, create company, director member management. |
| `/admin/system-control` | `SystemControlPage` | GLOBAL va COMPANY_SCOPED aralash | Kod company ID talab qiladi, mahsulot nomi esa global control. |
| `/admin/test/sozlama` | `TestSozlama` | COMPANY_SCOPED / UNKNOWN | Legacy test surface. |
| `/admin/sozlamalar` | `Sozlamalar` | UNKNOWN / LEGACY_GAS | Global root, Drive va old settings semantikasi. |
| `/admin/{obyektlar,f2,buxgalteriya,...}` | legacy pages | UNKNOWN / LEGACY_GAS | `ESKI_TIZIM_MENYU`; canonical IA bilan bir navda mavjud. |
| `/admin/_demo/*` | demo UI | DEMO_ONLY | Production default emas, ammo raw nav/data isolation tekshirilishi kerak. |
| `/boss/*` | legacy BossShell | USER_SCOPED / legacy | `/boss` index `/admin/dashboard`ga redirect qiladi; parallel qobiq qolgan. |

`frontend/src/App.tsx:90-222` route source. Ayniqsa `TestShell` faqat `path="test"` child route’iga qo‘yilgan (`App.tsx:148`), but canonical paths uning siblinglaridir.

## 4. CURRENT NAVIGATION MAP

`frontend/src/admin/AdminShell.tsx` uch guruh beradi:

1. **Platforma:** Rahbar paneli, Loyihalar va Obyektlar (`/admin/test/portfel`), Loyiha ishtirokchilari, Hujjatlar, Hujjat nazorati, Mindmap, CRM.
2. **Operatsion Boshqaruv:** Smeta/F2, Moliya/Shartnomalar, Ta’minot/Sklad, Zayavka, AOSR, ERP — asosan `/admin/test/*`.
3. **Tizim:** Kompaniya va a’zolik, Sozlamalar, Storage, Control Center, Xodimlar/Rollar, Korzinka.

Qo‘shimcha `ESKI_TIZIM_MENYU` 20 ga yaqin legacy route’ni yana ko‘rsatadi. Nav context scope’ini ko‘rsatmaydi: global Control Center bilan company Storage bir blokda, company-bound “Rahbar paneli” “Platforma”da, “Kompaniya va a’zolik” esa tizim sozlamasi kabi ko‘rsatiladi.

## 5. CURRENT COMPANY CONTEXT MODEL

### Amaldagi state

- `KompaniyaProvider` ichida `kompaniyalar`, `joriy`, `tanla`, loading/error (`frontend/src/test02/KompaniyaTanlov.tsx:43-94`).
- Persistensiya: browser `localStorage['t2_kompaniya_id']`.
- Reload: `sbT2KompaniyalarOl()` tugagach oldin saqlangan ID ro‘yxatda bo‘lsa tiklanadi, bo‘lmasa **birinchi faol kompaniya** avtomatik tanlanadi (`:66-78`).
- URL, cookie, server session yoki route paramsda active company saqlanmaydi.
- Direct URL uchun explicit context resolver yo‘q.

### P0 structural break

`KompaniyaProvider` faqat `TestShell`ga o‘ralgan (`frontend/src/test02/TestShell.tsx:7`). `AdminShell` provider ham selector ham render qilmaydi. Production pages (`BossDashboard`, `DocumentsPage`, `ParticipantsPage`, `HujjatNazoratPage`, `SystemControlPage`) shu provider tashqarisida `useKompaniya()` chaqiradi; Context defaulti `joriy:null` (`KompaniyaTanlov.tsx:51-55`).

Bu aniq owner symptomining root causeidir. “Yuqoridan” selector faqat test shell yuqorisida mavjud.

## 6. CURRENT SUPERADMIN MODEL

### Frontend/session

- `Rol` unionda `superadmin` bor (`frontend/functions/_shared/auth.ts:1`).
- `AdminShell` navni hardcoded global session role (`sess.data?.rol`) bilan filterlaydi; `superadmin` “hammasiga ruxsat” (`AdminShell.tsx:160-180`).
- `/api/sessiya` sessiyadan global `rol`, `foydalanuvchi_id`, optional `kompaniyalar` qaytaradi (`frontend/functions/api/sessiya.ts`).
- `/api/kirish` rolnı GAS `apiKirishTekshir`dan oladi; browser `isSuperadmin` bilan rol berolmaydi (`frontend/functions/api/kirish.ts:14-40`). Bu yaxshi.

### DB/RPC

- `t2_men_v1` actor uchun `t2_azolik`lardan membership read model qaytaradi. `is_director` `a.rol in ('boss','superadmin')` deb hisoblaydi (`20260905120000...sql:115-139`).
- `t2_actor_kompaniya_azo_tekshir` **faol `t2_azolik` bo‘lmasa** `42501` beradi; superadmin special bypass yo‘q (`20260830052000...sql:102-113`).
- Boss dashboard (`t2_boss_dashboard_v1`), file truth va system control company read pathlari shu membership guard’ni chaqiradi.
- Control migration global capability actionlarida ham `t2_azolik` ichida `rol in ('boss','superadmin')` qidiradi (`20260904120000...sql:242-264, 329-414`).

### Finding

**P0: platform superadmin modeli implementatsiyada global emas.** Hozir `superadmin` nomenklaturada platform role, lekin ko‘p privileged server pathlarda u biror companyga faol a’zo bo‘lishi shart. Bu Owner talabiga — “companyga sun’iy membership qo‘shish talab qilinmasligi kerak” — mos emas.

## 7. CURRENT MEMBERSHIP MODEL

- Canonical onboarding migration `t2_kirish_royxatga_ol` yangi userni barcha kompaniyalarga auto-join qilishni to‘xtatgan; zero membership valid onboarding state (`20260905120000...sql:27-68`). Bu tenant xavfsizligi uchun to‘g‘ri.
- Company yaratgan actor `boss` membership oladi (`:73-113`).
- `t2_men_v1` actor memberships va `onboarding_kerak` qaytaradi.
- `KompaniyaPage` self-service company create va director-only member add UI beradi (`frontend/src/admin/pages/KompaniyaPage.tsx`).
- Member commandlar `t2_azo_actor_director_tekshir` orqali membershipga bog‘langan; superadminni bu path bilan berish bloklangan (`ROLE_INVALID`).

**Normal user:** membership canonical va kerakli. **Multi-company user:** membership list bor. **Director:** membership role `boss`; current UI add only. **Superadmin:** platform identity va tenant impersonation/access pathway alohida modeled emas.

## 8. COMPANY / MEMBERSHIP / SETTINGS DUPLICATION

| Surface | Haqiqiy semantika / backend | Qaror |
|---|---|---|
| `/admin/kompaniya` | `t2_men_v1`, `t2_kompaniya_yarat_v1`, `t2_azolik_*_v1`; actor memberships + company create + director member add | **KEEP**, nomi “Kompaniya” bo‘lsin; ichida tabs: Profil, A’zolar, Rollar, Takliflar. |
| `/admin/test/xodimlar` | `t2_azolik_royxat` / older `sb-yoz` member CRUD | **MERGE/REDIRECT**. Bu company membershipning parallel CRUD surface’i. |
| `/admin/test/sozlama` | test/legacy settings | **MOVE**: company scoped preference bo‘lsa Company ichiga; boshqa bo‘lsa settingsga. |
| `/admin/sozlamalar` | GAS hooks; ROOT folder, server, global coefficients, wage/category rules (`Sozlamalar.tsx`) | **REMOVE FROM PRODUCT NAV / ARCHIVE** until scope and authority defined. Company profile emas. |
| `/admin/system-control` | canonical Control Center, lekin company ID talab qiladi | **SPLIT**: Global System Control vs selected-company operational capability view. |

Hozir “A’zolik” standalone nav label sifatida `Kompaniya va a’zolik`da birlashgan, lekin `Xodimlar va Rollar` ham parallel membership CRUD bo‘lib turibdi. User ko‘rgan duplication real.

## 9. COMPANY CONTEXT PROPAGATION

| Domain/API | Frontend context | API/RPC contract | Server guard holati |
|---|---|---|---|
| Boss dashboard | `joriy.id` → `useBossDashboard` | `/api/boss-dashboard?kompaniya_id`; `t2_boss_dashboard_v1(p_kompaniya_id,p_actor_id)` | Membership DB guard bor; superadmin bypass yo‘q. |
| Control Center | `joriy.id` → `useSystemControl` | `/api/system-control?kompaniya_id`; `t2_system_control_v1` | Membership / role check; global semantics mixed. |
| Documents | `joriy.id` query key/body | `/api/hujjat-royxat`; registry read | Canonical DB contract; selector provider bug. |
| Hujjat nazorati/F2 | company → project → object UI | `/api/hujjat-nazorat` object read model | Object lineage backend; local context selection volatile. |
| Participants | company → project | `sbT2LoyihalarOl`, `sbLoyihaQatnashchilarOl` through `/api/sb` | Frontend company filter; server coverage needs regression. |
| Storage | company → project → object | `/api/gas` storage commands | Canonical RPC checks company/lineage; GAS transport remains. |
| Mindmap / test ERP | `useKompaniya` | `/api/sb` / `/api/sb-yoz` | `sb.ts` only recognizes explicit `kompaniya_id=eq.N` filters; see P0 security finding. |
| Company onboarding | actor only | `/api/company` → `t2_men_v1` / commands | actor ID injected from verified session. |

Actor must be taken from verified session; `company_id` is a requested tenant target and must be re-authorized server-side. Active company is UX context, never security boundary.

## 10. GLOBAL VS COMPANY-SCOPED CAPABILITY MAP

**Global:** login/logout; current identity; company directory/onboarding; global superadmin management; deployment/system health; capability defaults; global users/roles.

**Company scoped:** dashboard; projects/objects; F2, Fakt, AOSR; documents; participant graph; storage workspace; mindmap; procurement/warehouse; company membership management; company capability overrides.

**Project scoped:** participants, contracts, work packages, F2 period selection.

**Object scoped:** document-control workbench, storage binding, F2/Nakopitelniy, AOSR/Fakt.

**Current mismatch:** `/admin/system-control` is named global but coded as company scoped. `/admin/dashboard` is a company dashboard but nav/context does not make that prerequisite visible. `/admin/kompaniya` correctly starts user-scoped, yet its company management is not separated from platform management.

## 11. ROOT CAUSES

1. **Provider placement error (P0):** selected company context lives only under legacy/test shell, while released canonical pages consume it outside that tree.
2. **Selector authority error (P0):** selector reads all active companies from `t2_kompaniya`, not actor-authorized memberships/read model.
3. **Superadmin semantic conflict (P0):** platform role language exists, but DB membership guards do not express privileged cross-company access.
4. **Mixed generation IA (P1):** canonical, test and legacy routes coexist as top-level navigation without scope metadata.
5. **No explicit state machine (P1):** global/company/project/object modes are inferred ad hoc from nullable local state.
6. **Old session compatibility waiver (P1 security):** comments in auth/sb state that missing `foydalanuvchi_id`/`kompaniyalar` can skip membership checks for old 12-hour sessions.

## 12. TENANT SECURITY FINDINGS

### P0 — all-company selector

`sbT2KompaniyalarOl()` reads `t2_kompaniya` with only `faol=is.true` (`frontend/src/api/supabase.ts:440-444`). It is not based on `/api/company?me=1`. A normal user can be offered a company it has no membership in, then receive a later failure. That is both misleading UX and unnecessary tenant enumeration surface.

### P0 — superadmin has no explicit privileged path

The generic guard requires `t2_azolik`; adding hidden memberships solely to make global operators work would corrupt business membership semantics and audit attribution. Fix must introduce a reviewed platform-privilege resolver, not weaken company membership checks.

### P1 — `/api/sb` partial tenant enforcement

`frontend/functions/api/sb.ts` checks membership only if the incoming free-form filter contains exact `kompaniya_id=eq.N`; comments acknowledge other table/entity shapes may pass. `MAJBURIY_KOMPANIYA_FILTRI` contains only `t2_obyekt_jami`. Every company-scoped table/read RPC needs explicit server-side tenant lineage enforcement, not frontend filtering convention.

### P1 — old sessions

`/api/kirish` still permits login when the Supabase identity enrichment fails (best effort), and `sb.ts` comments say undefined memberships skip enforcement. Post-fix policy must be fail closed for canonical T2 tenant read/write paths after a defined migration/session invalidation window.

## 13. CONTEXT PERSISTENCE FINDINGS

- `localStorage` persistence survives refresh in the one subtree where provider exists.
- No URL context means links/bookmarks cannot state intended tenant; any local previous choice wins.
- Defaulting to `k[0]` when stored ID is missing silently changes tenant context. This violates the “visible intentional tenant” principle; safer result is explicit context selection.
- The selected ID is not namespaced by authenticated actor. A shared browser may retain a prior user’s company ID; list validation prevents use only if source list itself is correct.
- React Query keys in newer pages include company ID (`['bossDashboard', kompaniyaId]`, `['systemControl', kompaniyaId]`, `['hujjatRoyxat', kompaniyaId]`), which reduces cache key collision. But active list/project/object local state is not reset uniformly on A→B switching and must be e2e tested.

## 14. DIRECT URL FINDINGS

Direct `/admin/dashboard`, `/admin/documents`, `/admin/participants`, `/admin/hujjat-nazorat`, `/admin/system-control` currently load under `AdminShell`, not `TestShell`. Therefore no provider exists and all dependent pages see null context. This is reproducible from source without login.

Target deep-link policy:

- global route: opens global mode without company.
- company route with `?company=<id>` or canonical context URL: resolver validates server-side authorization, then loads.
- company route with no context: show an in-page contextual selector/onboarding panel, not a dead text sentence; do not choose an arbitrary tenant.
- unauthorized/stale tenant: clear only requested context, retain actor session, show `COMPANY_ACCESS_REVOKED` safe state.

## 15. STALE CACHE / SWITCHING RISKS

1. A→B switch must cancel/invalidate in-flight A requests; otherwise late A response can paint B screen.
2. Pages with `useEffect` only on `joriy?.id` must reset project/object selections and error/empty data before B fetch starts.
3. TanStack keys are good where used, but legacy state/hooks need a complete inventory.
4. Back button must restore a server-authorized context, never merely a historical `localStorage` ID.

Required test technique: delayed A API response, switch to B before resolution, assert no A company/project/object name, ID, record or error is shown under B.

## 16. RAW ERROR UX FINDINGS

| Evidence | Classification | Required correction |
|---|---|---|
| `frontend/src/main.tsx:30` global ErrorBoundary renders `error.message` in `<pre>` | RAW_TECHNICAL_ERROR / SECURITY_DISCLOSURE_RISK | User-safe incident page; diagnostic ID only; console/server telemetry gets stack/detail. |
| `frontend/src/admin/sahifalar/Holat.tsx:454` prints `error.message` | RAW_TECHNICAL_ERROR | Map to domain error code. |
| `HujjatNazoratPage.tsx` includes error code/message fallback | RAW_TECHNICAL_ERROR | Safe translation table. |
| `/api/company`, `/api/system-control`, `/api/hujjat-*`, `/api/boss-dashboard` return `text.slice(...)` from Supabase on failures | SECURITY_DISCLOSURE_RISK | Log raw response server-side; return stable public code and safe message. |
| `/api/gas.ts` returns upstream HTML/text snippets | SECURITY_DISCLOSURE_RISK | Never send provider response body to browser. |
| Login, session-expired AdminShell states | SAFE_USER_MESSAGE | Preserve, but avoid rendering backend diagnostics. |

## 17. TARGET PRODUCT MODEL

Use two independent facts:

```
Actor = authenticated human/service identity
Context = selected authorized operating tenant
```

State machine:

```
GLOBAL
  SELECT_COMPANY(authorised id) -> COMPANY_SELECTED
COMPANY_SELECTED
  SELECT_PROJECT(authorised child) -> PROJECT_SELECTED
  CLEAR_COMPANY -> GLOBAL
PROJECT_SELECTED
  SELECT_OBJECT(authorised child) -> OBJECT_SELECTED
  SWITCH_COMPANY -> COMPANY_SELECTED (reset project/object/query state)
ANY -> LOGOUT -> UNAUTHENTICATED
```

Platform superadmin must have an explicit platform capability, auditable target company selection, and a separate “acting in company context” audit field. It must not be encoded as fake company membership. Normal tenant access remains `actor + active membership + role/capability`.

## 18. TARGET INFORMATION ARCHITECTURE

### Global mode

- Boshqaruv overview (global, no tenant KPI fabrication)
- Kompaniyalar
- Foydalanuvchilar / platform roles
- Tizim boshqaruv markazi
- Health / integrations / deployment state

### Company mode — header must show `Faol kompaniya: <nom>` and clear/change action

- Dashboard
- Loyihalar va obyektlar
- Smeta / F2 / Fakt
- Hujjatlar / Hujjat nazorati
- AOSR / sifat
- Ta’minot / sklad
- Mindmap
- Kompaniya: Profile, A’zolar, Rollar, Takliflar

Project/object entry happens inside company mode. Do not show duplicated platform control next to tenant business operations without context badge.

## 19. SUPERADMIN UX

1. Login → global mode, no forced tenant.
2. Global nav works with no company selected.
3. Company-scoped link presents one deliberate `Kompaniyani tanlash` surface (searchable authorized/all-company privileged directory) and records target context.
4. After choose A, persistent context badge, URL/context resolver, and audit show actor + company A.
5. Switch to B clears tenant-dependent cache, project and object state before B data renders.
6. A superadmin may inspect B under explicit privileged authorization; normal members remain membership-bound.

## 20. NORMAL USER UX

- **One membership:** after verified `/api/company?me=1`, auto-select is acceptable only if UI visibly says which company and direct URL remains authorized. Prefer URL/context persistence.
- **Multiple memberships:** choose last authorized company stored per actor, otherwise display company picker; never global all-company list.
- **No membership:** onboarding state: create company, request join, or waiting approval. No business nav dead ends.
- **Access revoked:** context resets safely and user sees “Bu kompaniyaga ruxsatingiz o‘zgardi” with company picker, not raw 403.

## 21. EMPTY STATES

Replace “Avval yuqoridan kompaniya tanlang” with a standard `CompanyContextRequired` surface:

- title: “Ishlash uchun kompaniya konteksti kerak”;
- why the page needs it;
- embedded selector/search (if actor has choices);
- `Kompaniya yaratish` / `Qo‘shilish so‘rovi` only where authorized;
- deep-link target retained after selection;
- no fake data, no auto-first active tenant.

Global pages never render this guard.

## 22. ACCEPTANCE TEST ORACLE

The following are release blockers until proven against authenticated build:

| # | Scenario | Oracle |
|---|---|---|
| 1-4 | Superadmin login, global mode, no company, global route | Works without company context or membership injection. |
| 5 | Superadmin opens company route | Professional chooser, not dead text. |
| 6-10 | Select A → projects/objects → refresh → direct URL | A remains only if still authorized; data A only. |
| 11-13 | A→B, back button, logout/login | No A residue under B; context/authorization revalidated. |
| 14 | Normal user with one membership | Visible automatic context, no selector confusion. |
| 15 | Multi-company normal user | Only memberships offered; switch isolation passes. |
| 16 | User without membership | Onboarding/join/waiting state, no tenant data. |
| 17 | Unauthorized company ID | 403/domain safe state; no data leak. |
| 18-20 | Manually change company ID / stale context / A data in B | Server denies target; UI clears stale cache. |
| 21-23 | Company profile, membership, settings | One canonical ownership path; no parallel conflicting CRUD. |
| 24 | Backend 404 | User message + diagnostic ID; no PostgREST/raw JSON. |
| 25 | RPC failure | Safe error code mapping. |
| 26 | Expired session | Redirect/login state; no stale tenant display. |
| 27 | Membership revoked mid-session | Next request rejects and UI resets context safely. |

## 23. AUTOMATED TEST PLAN

**Unit:** pure `CompanyContextStateMachine` transitions, context persistence codec namespaced by actor, URL parse/serialize, error-code translator.

**Component:** AdminShell renders selector/provider; global vs company route guards; empty state actions; A→B React Query cancellation/reset; raw error never rendered.

**API:** `/api/company`, `/api/boss-dashboard`, `/api/system-control`, `/api/hujjat-*`, `/api/sb` with actor/session A, B, global superadmin, unauthenticated and revoked membership.

**DB integration:** normal membership required; privileged superadmin path explicit and audited; target company/project/object lineage; no direct `company_id` trust; security-definer functions preserve their own checks.

**E2E authenticated:** run the 27-case oracle above with seeded A/B and four user types. This is mandatory product release gate.

## 24. AUTHENTICATED OWNER SMOKE RUNBOOK

1. Login as superadmin.
2. Confirm global header/mode and no active company.
3. Open global Companies and System Control.
4. Open Dashboard without company; see selection flow, not broken page.
5. Select Company A.
6. Verify header and URL/context identify A.
7. Open dashboard, projects, objects, documents, F2 workbench, participants.
8. Refresh each critical route.
9. Copy/paste direct company-scoped URL into new tab.
10. Switch to Company B while A dashboard response is artificially slow (QA environment).
11. Verify no A record/label/KPI appears on B.
12. Use browser back/forward.
13. Open Company profile and member management; verify one source of truth.
14. Verify settings does not expose parallel company CRUD.
15. Login normal one-company user.
16. Login normal multi-company user.
17. Login zero-membership user.
18. Revoke a membership and repeat a company request.
19. Induce 404/RPC failure; verify safe UX and diagnostic log.
20. Logout, login again, verify actor-specific context behavior.

## 25. FUNCTIONS TYPE-CHECK GAP

`frontend/tsconfig.app.json` only includes `["src"]`; `frontend/package.json` build is `tsc -b && vite build`. `frontend/functions/**` is excluded. No `tsconfig.functions.json` was found. Therefore Cloudflare Pages Functions type errors can ship despite green `tsc -b`; this matches the reported historical `ctx.env.env.*` class of defect.

Required next gate: add `tsconfig.functions.json` with `frontend/functions/**/*.ts`, correct Pages/Workers types, a separate `typecheck:functions` script, and CI execution. This is P1 release infrastructure, but must be completed before claiming context/API hardening fully verified.

## 26. P0 / P1 / P2 FINDINGS

### P0

1. Provider/selector not in released `AdminShell` tree; canonical pages consume null context.
2. Selector enumerates all active companies rather than actor-authorized companies.
3. Superadmin is not an explicit membership-independent platform access model.
4. `/api/sb` tenant enforcement is partial/filter-shape dependent.
5. Raw upstream errors can reach user UI/API response.

### P1

1. Context only localStorage; no URL/server context or actor namespace.
2. Auto-selecting first active company is unsafe/unclear.
3. Legacy/test/canonical routes mixed in top navigation.
4. Direct URL and A→B cache correctness lack tests.
5. Functions excluded from TypeScript graph.

### P2

1. Consolidate legacy `/boss` and archived `/admin/*` UX.
2. Normalize permission/capability vocabulary across global role and company role.
3. Define per-role navigation and onboarding copy after canonical context is fixed.

## 27. RISKS

1. Moving provider without server guard changes can hide, not solve, tenant leaks.
2. Granting superadmin synthetic memberships changes company audit semantics.
3. Using `localStorage` as authorization creates stale/deep-link ambiguity.
4. Auto-first-company can cause action in wrong tenant.
5. Mixed legacy routes can bypass new route guards.
6. `service_role` gateway calls require explicit actor/tenant checks on every RPC.
7. Old optional identity session behavior can temporarily weaken checks.
8. Context switch race can display cross-tenant stale data.
9. Raw PostgREST messages disclose schema/implementation detail.
10. Anonymous health smoke cannot replace authenticated owner vertical smoke.

## 28. CLAUDE FIX ACCEPTANCE CRITERIA

1. One production-wide `CompanyContextProvider` is mounted inside authenticated admin shell, and its selector is visible where company context matters.
2. Selector’s list derives from a server-authorized actor read model; normal users cannot enumerate arbitrary active companies.
3. Global and company routes have explicit classifications and guards.
4. Superadmin global capability and company-target authorization are explicit server contracts and audit actor/context separately; no synthetic membership requirement.
5. Normal membership checks remain strict on company/project/object RPC paths.
6. A context transition atomically resets child context and cancels/invalidates tenant-bound queries.
7. Context persistence is actor-namespaced and direct URLs are deterministic/authorized.
8. Company/membership/settings IA follows the KEEP/MERGE/MOVE decision above.
9. All public API/UI errors are stable user-safe messages; diagnostics are not exposed.
10. Functions typecheck is wired into the release gate.
11. All acceptance oracle cases pass under authenticated E2E evidence.

---

## FINAL SUMMARY

### CURRENT PRODUCT STATE:

**FAIL** — current deployed code has a reproducible company-context provider placement error and unresolved superadmin/membership semantics.

### P0 FINDINGS:

1. `/admin/*` canonical pages cannot receive selected company context because provider/selector are only under `/admin/test/*`.
2. `sbT2KompaniyalarOl()` exposes all active companies to selector instead of actor-authorized memberships.
3. Superadmin platform model is contradicted by membership-only DB guards.
4. Company-scoped read enforcement in `/api/sb` is incomplete.
5. Raw backend/provider errors can be exposed.

### P1 FINDINGS:

1. localStorage-only context and implicit first-company default.
2. Direct URL/back/cache switch tests missing.
3. Parallel Company/Membership/Settings/legacy navigation overlaps.
4. Cloudflare Functions absent from `tsc -b` graph.

### COMPANY / MEMBERSHIP / SETTINGS DECISION:

**KEEP** `/admin/kompaniya` as canonical company hub. **MERGE/REDIRECT** `Xodimlar va Rollar` membership CRUD into it. **MOVE** company-specific preferences into company hub. **REMOVE FROM product nav / ARCHIVE** legacy global GAS settings until scope/authority is established. **SPLIT** System Control into global and selected-company views.

### SUPERADMIN TARGET MODEL:

Global actor with explicit privileged platform capability; selects a target company deliberately; audit records both actor and company context; no invented company membership.

### NORMAL USER TARGET MODEL:

Membership-derived company list; one company may auto-select visibly; many companies require a chooser; zero membership gets onboarding; every server request re-authorizes target tenant.

### ROUTES TO KEEP:

`/admin/dashboard`, `/admin/documents`, `/admin/hujjat-nazorat`, `/admin/participants`, `/admin/storage`, `/admin/kompaniya`, `/admin/system-control` — after scope/guard corrections.

### ROUTES TO MERGE:

`/admin/test/xodimlar` → `/admin/kompaniya` membership tab; scattered project/object/F2 legacy navigation into canonical company mode.

### ROUTES TO REMOVE/REDIRECT:

Top-level legacy `/admin/sozlamalar`, duplicate test settings and `/boss` shell should be archived/redirected only after canonical replacements pass authenticated smoke.

### SECURITY BLOCKERS:

All-company selector enumeration; membership-only superadmin contradiction; partial `/api/sb` tenant enforcement; raw provider error exposure; old session enforcement waiver.

### CLAUDE MUST FIX BEFORE NEXT MAIN:

1. Provider/selector placement and authorized context resolver.
2. Explicit global-superadmin versus company-context server model.
3. Company/membership/settings IA consolidation.
4. Tenant guard coverage and raw error sanitization.
5. Authenticated owner vertical E2E gate plus functions typecheck.

### CODEX RE-AUDIT CHECKLIST:

1. Diff review for no synthetic superadmin membership and no weakened normal membership guard.
2. Run 27-case acceptance oracle authenticated with A/B tenants.
3. Inspect API/RPC audit fields for actor and target context.
4. Verify A→B query cancellation and direct URL behavior.
5. Confirm `/api/sb` and direct RPC paths deny altered company IDs.
6. Confirm function typecheck runs in CI/release command.

### READY_FOR_IMPLEMENTATION:

**YES** — implementation scope is unambiguous, but requires a controlled product/security change.

### READY_FOR_MAIN:

**NO** — this is an audit only; Claude fix and authenticated acceptance are not yet verified.
