# T2-AUTH-PASSWORD-MIGRATION-001 — Supabase-native bcrypt password (Claude)

Closes incident item 2.1 from `T2_POST_DEPLOY_INCIDENT_ROUND_20260905.md`:
"A'zo qo'shish" wrote a new `t2_foydalanuvchi`/`t2_azolik` row but never
touched a password anywhere — the new member could not log in (their login
did not exist in GAS's plaintext `_XODIMLAR` sheet either).

Owner decision (2026-09-05, via `AskUserQuestion`): migrate to Supabase,
**hashed (bcrypt)**, never plaintext; GAS stays parallel for existing logins.

## 1. Migration — reviewed, applied, acceptance-verified

`supabase/migrations/20261005120000_t2_parol_hash_v1.sql` (+ `.rollback.sql`
+ `.acceptance.sql`), applied to the real production project
(`tuoyrzadkgoltpqkdiyx`) this session, additive only:

- `t2_foydalanuvchi` gains two nullable columns: `parol_hash` (bcrypt, via
  the already-enabled `pgcrypto`/`extensions.crypt`/`extensions.gen_salt`)
  and `parol_yangilandi`. **NULL for every existing row** — this alone
  changes no current user's ability to log in.
- `t2_parol_tekshir_v1(p_login, p_parol)` — `stable`, login-time check.
  Case-insensitive login match (mirrors GAS's own
  `String(login).toLowerCase()` exactly). Returns `NO_PASSWORD_SET` when
  the login has no hash yet — this is the signal the caller (`kirish.ts`)
  uses to fall back to GAS.
- `t2_parol_belgila_v1(p_actor_id, p_kompaniya_id, p_foydalanuvchi_id,
  p_yangi_parol, p_operation_id)` — director-only (reuses
  `t2_azo_actor_director_tekshir`, the exact law `t2_azolik_qosh_v1`
  already uses), idempotent via `operation_id`
  (`t2_onboarding_command_log` reuse), rejects a password under 8 chars
  before ever hashing, verifies the target is actually a member of the
  actor's company. Deliberately **not self-service** — this closes exactly
  the reported gap (a new member has no way in at all); a user changing
  their own already-working password is a smaller, separate follow-up
  (see §5).
- Both RPCs revoked from `public`/`anon`/`authenticated`, granted only to
  `service_role` — same law as every other RPC in this codebase.

**Ran the migration's own acceptance logic against real production data**
(`kompaniya_id=1`, a real active `boss`), self-rolled-back, zero residue
confirmed (`select count(*) from t2_foydalanuvchi where login like
'sinov_%'` → 0, `where parol_hash is not null` → 0 afterward). Proved:
idempotent job... (n/a here) — proved: no-hash → `NO_PASSWORD_SET`; a
password under 8 chars is rejected before hashing; a non-director member of
the *same* company cannot set anyone's password (`42501`); a director can;
the stored value is bcrypt (`^\$2[aby]\$`), never the plaintext input;
the correct password authenticates, a wrong one gets `PAROL_NOTOGRI` (not
`NO_PASSWORD_SET` — this distinction is what stops the caller from ever
falling through to GAS once a hash exists); `t2_parol_belgila_v1` is
retry-safe (same `operation_id` → same result, not a second re-hash).

## 2. `kirish.ts` — dual-check, fail-closed, zero regression by construction

Before calling GAS at all, `kirish.ts` now calls `t2_parol_tekshir_v1`:

- **`NO_PASSWORD_SET`** (or a Supabase transport error) → falls through to
  the *exact* pre-existing GAS call, unchanged. This is every current user,
  today — their login flow is byte-for-byte what it was before this task.
- **Hash exists and matches** → session is minted from the Supabase result.
  GAS is **never called** for this login.
- **Hash exists and does NOT match** → hard `401` immediately. GAS is
  **never consulted** — a wrong Supabase password can never be rescued by a
  coincidentally-matching (or different) GAS password. Once a login has a
  Supabase hash, Supabase is its sole source of truth.

Proved with 3 new tests (`kirish.test.ts`, mocking `fetch` to distinguish
the Supabase RPC URL from the GAS URL and asserting which one was or was
not called in each branch) — this is the actual safety property, not just
"the right JSON came back."

## 3. `company.ts` / `t2-men.ts` — admin sets a member's password

- `company.ts` gains a `member_password_set` action → `t2_parol_belgila_v1`,
  `p_actor_id` always from the verified session (never the request body —
  proved directly: a test request that also sends a spoofed
  `p_actor_id: 999` in the body is ignored, the real session actor `3` is
  what reaches the RPC). Error codes mapped: `PAROL_QISQA`→400,
  `AZOLIK_TOPILMADI`→404, `42501`→403 (existing generic regex already
  covers this, confirmed by test).
- `t2-men.ts` gains `azoParolBelgila` (→ `member_password_set`), exposed via
  `useOnboardingCommands()`.
- `KompaniyaPage.tsx` (`AzolarBoshqaruv`, the "A'zolar" tab): each member row
  gets a director-only "🔑 parol" button. Clicking it (after a confirm
  dialog) generates a 12-character random temp password client-side
  (excludes visually-confusing `0/O/1/l/I`), calls
  `azoParolBelgila.mutate(...)`, and on success shows it **once**, inline,
  in a dismissible banner ("yetkazing — bu yerda qayta ko'rsatilmaydi").
  The temp password lives only in that component's local React state — it
  is never sent anywhere except the one RPC call that hashes it; nothing
  else on the client or server ever holds or logs the plaintext.

## 4. Gates (this session, real runs)

- `npx tsc -b`: exit 0
- `npm run typecheck:functions`: exit 0
- `npx oxlint` (whole repo): 0 new warnings in any touched file (one
  pre-existing `kirish.ts` warning, confirmed via `git diff` to be outside
  this task's edited lines)
- `npx vitest run` (whole frontend suite): **249/249 pass** (was 242/242
  before this task; +7: 3 `kirish.test.ts` dual-check proofs, 4
  `company.test.ts` `member_password_set` proofs)
- `npm run build`: succeeds
- `node ops/governance-check.cjs`: PASS

## 5. What is still NOT done (explicitly, do not understate)

- **No self-service "change my own password."** A user who receives a temp
  password from a director cannot yet change it themselves after first
  login — they must ask a director to issue a new one via the same "parol"
  button. This is a real, known gap, scoped out deliberately to keep this
  round closeable; it is the natural next increment.
- **No forced-reset-on-first-login UX.** A newly issued temp password does
  not expire or force a change; it simply works until a director resets it
  again. Combined with the item above, a more complete flow would be:
  self-service change (with current-password verification) +
  optionally a `parol_muddat_tugadi` flag forcing a change after first use.
- **Existing GAS-only users are not migrated.** `apiKirishTekshir` /
  `_XODIMLAR` continues to run in parallel, unchanged, for every login that
  has never had a Supabase password set (i.e. everyone except future new
  members who go through the "parol" button). Migrating existing users off
  GAS entirely (and what to do about `_XODIMLAR`'s hardcoded default
  `admin/570632` superadmin credential still sitting in the GAS source) is
  a separate, larger decision the owner has not yet been asked to make.
- **No rate-limiting specific to `t2_parol_tekshir_v1`** beyond the
  pre-existing generic 800ms failure-delay in `kirish.ts` (unchanged,
  applies identically to both the GAS and Supabase failure paths).
