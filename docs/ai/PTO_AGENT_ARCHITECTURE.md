# PTO product agent architecture

## Boundary

`USER → provider-neutral agent gateway → named tool contract → canonical read
model/command → deterministic domain engine → audit → result`

AI can interpret, search, classify, explain, map, and prepare drafts. AI cannot
invent price/norm/quantity, convert NULL to zero, submit arbitrary SQL, bypass
tenant/role checks, overwrite certified F2, or write production outside a
reviewed named command.

## Current source evidence

- Shared provider/request/response and retry/fallback policy:
  `frontend/functions/_shared/ai.ts:16-49,68-145,165-219,435-468`.
- Named read-tool connector with fixed RPC sources, scopes and required IDs:
  `frontend/functions/_shared/agent-connector.ts:22-56`.
- Envelope, role, tenant/object scope checks:
  `agent-connector.ts:213-279,316-357`.
- Signing and replay contract:
  `agent-connector.ts:385-447` and replay migration candidate
  `supabase/migrations/20260909000000_t2_agent_replay_guard.sql`.
- Role/memory namespace catalog:
  `frontend/functions/_shared/agent-catalog.ts:15-145`.
- Jarvis read route: `frontend/functions/api/ai-savol.ts:95-156`.
- Invoice parser: `frontend/functions/api/ai-parse.ts:21-104`.

This is a good source contract, not deployed/runtime proof. Jarvis has a
separate Workers AI path and invoice AI output can flow into stock writes from
`TestFaktura.tsx:49-81,92-175`.

## Product roles

1. PTO Copilot — object status, missing evidence, next safe action.
2. Smeta/RES Analyst — classify rows and propose mappings; never certify price.
3. F2 Auditor — explain source/tree mismatches and approval exceptions.
4. Document Controller — locate revisions, sheets, source hashes and sync state.
5. Resource/Procurement Agent — prepare Zayavka drafts from selected context.
6. Fakt/Site Assistant — prepare daily-entry drafts and explain corrections.

All roles share one gateway and one audit model. They are not six independent
financial backends.

## Provider policy

For structured operations, pin provider/model, prompt/schema version and
temperature. Fallback must be explicit and recorded. Persist server-generated
request ID, input hash, output hash, provider/model, tenant/object, tool/RPC,
actor, approval state and final outcome. Do not send private source documents to
an unapproved provider.

## Draft-to-write lifecycle

1. `retrieve` — read-only named tool.
2. `propose` — structured draft with evidence and uncertainties.
3. `review` — human or deterministic validator checks amounts, units, scope and
   duplicates.
4. `commit` — one idempotent named command with operation ID and version.
5. `audit` — append-only event and source/output hashes.
6. `replay` — same request ID returns the prior result or explicit conflict.

Invoice parsing must stop at `propose/review`; item writes and invoice status
must be one server-side transaction or an explicit resumable command.

## Deployment gates

Before production: verify deployed RPCs/grants/RLS, mandatory replay store,
key rotation, rate/quota limits, file signature/malware handling, provider data
policy, audit persistence, and cross-company/object negative tests. Source-level
contracts alone are insufficient.
