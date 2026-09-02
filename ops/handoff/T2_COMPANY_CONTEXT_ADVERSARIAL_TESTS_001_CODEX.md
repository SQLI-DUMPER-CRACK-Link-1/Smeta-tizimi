# T2-COMPANY-CONTEXT-ADVERSARIAL-TESTS-001

## 1. TEST BASELINE

| Maydon | Qiymat |
|---|---|
| Source baseline | `b54f68636a5ae38f6f73435a6f06df48c241e2f5` |
| Audit branch | `codex/t2-company-context-adversarial-tests` (local-only; push qilinmagan) |
| Product ownership | Claude `T2-COMPANY-CONTEXT-P0-FIX-001`; Codex faqat oracle/harness yaratdi |
| Production/main | Tegilmadi |
| Hozirgi expected result | Adversarial static oracle **14 FAIL / 6 PASS**; Functions gate **2 FAIL / 1 baseline PASS**. Bu expected — current buglar aniqlanmoqda. |

## 2. EXISTING TEST STACK

- **Vitest 4 + jsdom:** `frontend/vitest.config.ts`; frontend source unit/component testlari mavjud.
- **React Testing Library:** `@testing-library/react` va `@testing-library/dom` installed.
- **Static Node release gates:** `frontend/testlar/*.test.cjs`, runner `frontend/testlar/hammasi.cjs`.
- **Existing company/tenant tests:** `t2_company_onboarding.test.cjs`, `t2_tenant_izolyatsiya.test.cjs`, `t2_kompaniya.test.cjs`.
- **Cloudflare Functions test framework:** isolated runtime/miniflare/Playwright/Cypress topilmadi. Functionlar `frontend/functions/**`da, ammo browser `tsc -b` graphida yo‘q.
- **E2E:** Playwright/Cypress config yoki dependency topilmadi. Authenticated real-browser tests manual/QA harness sifatida qoladi until a runner is introduced.

Yangi framework qo‘shilmadi. Oracle mavjud Node test usuliga mos yozildi va `hammasi.cjs`ga **ataylab qo‘shilmadi**: Claude fix qilmaguncha standard current-main gate qizil bo‘lib qolmasligi kerak.

## 3. COVERAGE GAPS

1. Production AdminShell provider/selector ownershipini tekshiruvchi regression test yo‘q edi.
2. Normal user selectorining server-authorized company listga bog‘liqligi test qilinmagan.
3. A→B async race, cache cancellation va stale UI leakage component/E2E testlari yo‘q.
4. Explicit privileged superadmin path uchun backend contract test yo‘q.
5. Deep-link context resolver va logout cleanup testlari yo‘q.
6. `frontend/functions/**` TypeScript tekshiruvi yo‘q.

## 4. STRUCTURAL TESTS

Executable file: `frontend/testlar/t2_company_context_adversarial.test.cjs`.

U quyidagilarni qat’iy tekshiradi:

- production `App.tsx` yoki `AdminShell.tsx` canonical `KompaniyaProvider`ni import qiladi;
- production shell `KompaniyaTanlagich`ni render qiladi;
- `BossDashboard`, `DocumentsPage`, `ParticipantsPage`, `HujjatNazoratPage` context consumer bo‘lsa, provider production tree’da bo‘ladi;
- `TestShell` parallel mustaqil providerga aylanmaydi;
- selector `sbT2KompaniyalarOl()` orqali barcha faol tenantlarni o‘qimaydi;
- selector actor/session-namespaced persistence ishlatadi;
- stale ID topilmasa birinchi faol company silent default qilinmaydi.

Current baseline bu qatlamda intentional FAIL qiladi.

## 5. SUPERADMIN TESTS

Machine-readable cases manifestdagi quyidagi scenario’lar Claude fixidan keyin API/E2E evidence bilan bajariladi:

- `SUPERADMIN_NO_COMPANY_GLOBAL`
- `SUPERADMIN_NO_COMPANY_SCOPED`
- `SUPERADMIN_SELECT_COMPANY_A`
- `SUPERADMIN_SWITCH_A_TO_B`
- `SUPERADMIN_WITHOUT_MEMBERSHIP`

Pass faqat frontend selector ko‘ringani bilan berilmaydi. `SUPERADMIN_WITHOUT_MEMBERSHIP` uchun server-side explicit privileged authorization va actor + target company audit dalili majburiy. Synthetic `t2_azolik` yaratish PASS emas.

## 6. NORMAL USER TESTS

- `NORMAL_ONE_MEMBERSHIP`: selector/API faqat A ni qaytaradi.
- `NORMAL_MULTI_MEMBERSHIP`: faqat A/B, safe switching.
- `NORMAL_NO_MEMBERSHIP`: onboarding/join/create, tenant data yo‘q.
- `FORGED_COMPANY_ID`: member-A B ni query/body bilan so‘rasa server block qiladi.
- `SELECTOR_SERVER_FILTER`: frontend filter emas, server actor authorized list qaytaradi.

## 7. CONTEXT PERSISTENCE TESTS

- `PERSIST_COMPANY_REFRESH`: select A → navigate → refresh; actor still authorized bo‘lsa A tiklanadi.
- `PERSIST_PROJECT_OBJECT_REFRESH`: A → project → object → F2/workbench → refresh; child lineage safe tiklanadi yoki safe reselect state.
- `LOGOUT_CONTEXT_CLEANUP`: A user logoutidan keyin B user A context/cacheini meros qilmaydi.

## 8. DIRECT URL TESTS

No-context holatda alohida component/E2E test:

- `/admin/dashboard`
- `/admin/documents`
- `/admin/participants`
- `/admin/mindmap`
- `/admin/hujjat-nazorat`

Oracle: crash yo‘q; raw error yo‘q; unauthorized request yo‘q; professional company-selection state bor.

## 9. TENANT LEAKAGE TESTS

`FORGED_COMPANY_ID`, `ACCESS_REVOKED`, `SELECTOR_SERVER_FILTER` API qatlamida, `STALE_A_RESPONSE_AFTER_B` component qatlamida bajariladi.

Har request uchun target `company_id` serverda verified actor bilan qayta tekshiriladi. Company selector security boundary emas. `service_role` gateway buni bypass qilmasligi shart.

## 10. CACHE/RACE TESTS

Required deterministic component test:

1. API mock A projects `[A1]`ni deferred promise qiladi.
2. User A contextda so‘rovni boshlaydi.
3. User B ga switch qiladi va B `[B1]` return qiladi.
4. A deferred responseini resolve qiladi.
5. Assert: B UI’da A1 hech qachon authoritative entity/card/selection sifatida qolmaydi; B key/query/request ishlatiladi.

Claude QueryClient invalidation/cancellation va child state resetini shu test bilan isbotlashi kerak.

## 11. AUTHORIZATION TESTS

Current structural oracle two positive existing invariantsni saqlaydi:

- `/api/company` actorni verified cookie sessiondan oladi, request bodydan emas.
- Boss/Control gateway target company va actor paramlarini RPCga uzatadi.

Lekin current baseline quyidagilarda intentional failure beradi:

- `/api/sb` filter shakliga bog‘langan partial tenant authorization;
- old session membership yo‘q bo‘lsa canonical tenant checks skip qilinishi.

Claude fixidan keyin real disposable DB/API testlari normal actor, outsider, platform superadmin, revoked membership bilan qo‘shilishi kerak.

## 12. RAW ERROR UX TESTS

Manifest: `RAW_404`, `RAW_RPC_FAILURE`, `EXPIRED_SESSION`.

Component mocks returned bodyda `PGRST125`, raw JSON, SQL/internal path beradi. User UI assert faqat safe message/diagnostic IDga qaraydi; `PGRST`, `Supabase`, `{"`, stack, provider URL chiqmasligi kerak. Real detail server log/telemetryga ketadi.

## 13. IA DUPLICATION GUARDS

`COMPANY_MEMBERSHIP_SETTINGS_IA` scenario required. Static guard only navigation string bilan semantic ownershipni isbotlay olmaydi; shuning uchun component/E2E assertion:

- Company profile/member CRUD owner bitta route/surface;
- `Xodimlar va Rollar` parallel member command surface bo‘lsa redirect/archived;
- settings company profile write bermaydi;
- `Kompaniya` tablarida Profile/A’zolar/Rollar/Invites canonical read/commands ishlaydi.

## 14. FUNCTIONS TYPE-CHECK GATE

Executable: `frontend/testlar/t2_functions_typecheck_gate.test.cjs`.

Current baseline facts:

- `tsconfig.app.json` only `include: ["src"]` — correctly detects no functions coverage.
- `tsconfig.functions.json` absent.
- `package.json`da independent functions typecheck script absent.

Claude fix contract:

```powershell
cd frontend
npx tsc --noEmit -p tsconfig.functions.json
```

`tsconfig.functions.json` must include `functions/**/*.ts` and explicit Cloudflare Pages/Workers types (e.g. `@cloudflare/workers-types`, or a verified equivalent). CI/release script must invoke it. This does not require product runtime behavior change.

## 15. OWNER E2E SMOKE

Minimum authenticated owner flow:

1. Superadmin login → global mode.
2. Global pages work without company.
3. Company route no-context → selector/onboarding state.
4. Select A; dashboard/projects/objects/documents/workbench work.
5. Refresh/direct-link every critical page.
6. A→B switch under delayed A response.
7. Back/forward.
8. Normal user one membership.
9. Normal user multi membership.
10. No-membership onboarding.
11. Forged `company_id` denied.
12. Revoke membership while session active.
13. 404/RPC/expired-session safe error UX.
14. Logout/login as different user, no inherited A state.

## 16. EXECUTABLE TEST FILES

| Path | Maqsad | Baseline result |
|---|---|---|
| `frontend/testlar/t2_company_context_adversarial.test.cjs` | Structural/context/tenant/error oracle + manifest integrity | 6 PASS / 14 FAIL (expected) |
| `frontend/testlar/t2_functions_typecheck_gate.test.cjs` | Functions TS release gate | 1 PASS / 2 FAIL (expected) |
| `frontend/testlar/fixtures/company-context-adversarial-cases.json` | 26 machine-readable API/component/E2E scenario contract | Valid |

## 17. HOW TO RUN

Claude fix branch rootdan:

```powershell
node frontend/testlar/t2_company_context_adversarial.test.cjs
node frontend/testlar/t2_functions_typecheck_gate.test.cjs
cd frontend
npm test -- --runInBand
npm run build
npm run lint
npm run tekshir
```

`--runInBand` Vitest versionga mos bo‘lmasa `npm test` ishlatiladi. Functions gate config kelgach:

```powershell
npx tsc --noEmit -p tsconfig.functions.json
```

## 18. CLAUDE RE-AUDIT PROCEDURE

1. Claude branch headini fetch/qayd qiling; current `main` bilan semantic diff qiling.
2. Ikkala new Node oracle 0 exit bilan tugasin.
3. New provider exactly one canonical source ekanini review qiling.
4. `KompaniyaTanlagich` actor-authorized context portidan kompaniyalar olishini tekshiring.
5. DB/RPCda normal membership guard saqlanganini, superadmin privileged path explicitligini tekshiring.
6. API fixtures bilan forged A/B/revoked casesni run qiling.
7. Delayed race component test outputini ko‘ring.
8. Authenticated owner smoke 14 qadamini staging/production-approved environmentda bajaring.
9. Raw-error screen capture/DOM assertionda internal text yo‘qligini tekshiring.
10. Faqat shu evidence’dan keyin release readiness xulosasi bering.

---

## FINAL STATUS

**TEST_HARNESS_READY:** YES

**EXECUTABLE_TESTS:** 2 runnable oracle scripts + 26 machine-readable scenario

**MANUAL_ONLY_CHECKS:** Authenticated superadmin privileged path, real membership revocation, real browser back/refresh race, owner visual/IA judgement. E2E runner hozir repo’da yo‘q.

**CLAUDE_BRANCH_REAUDIT_COMMANDS:**

```powershell
node frontend/testlar/t2_company_context_adversarial.test.cjs
node frontend/testlar/t2_functions_typecheck_gate.test.cjs
cd frontend; npm test; npm run build; npm run lint; npm run tekshir
```

**P0_NOT_AUTOMATABLE:** authenticated actor/session, DB RLS/SECURITY DEFINER behavior and real browser tenant isolation require disposable/staging environment with seeded A/B users; static success is not sufficient.

**READY_FOR_CLAUDE_REAUDIT:** YES
