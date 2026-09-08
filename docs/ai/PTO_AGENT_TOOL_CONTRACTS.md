# PTO agent tool contracts

## Contract envelope

Every call must contain:

```json
{
  "api_version": "v1",
  "request_id": "uuid",
  "operation_id": "uuid-or-null",
  "role": "pto_copilot",
  "tenant_id": "numeric-company-id",
  "object_id": "numeric-or-null",
  "conversation_id": "validated-id",
  "tool": "named-tool",
  "args": {},
  "expected_version": "numeric-or-null"
}
```

The server derives actor/session/company membership. Client-supplied tenant or
object values are claims to validate, never authorization evidence.

## Named read tools

The current connector exposes a fixed read-oriented catalog. Each tool must
specify its source RPC/read model, required IDs, role allowlist, scope (`tenant`
or `object`), schema, timeout, and evidence fields. No generic table name,
RPC name, SQL text or arbitrary provider call is accepted from the agent.

Recommended contracts:

| Tool | Scope | Result must include |
|---|---|---|
| `pto_object_overview` | object | object ID/company, completeness, signals, source revision |
| `smeta_tree_search` | object | canonical row ID, source row, hierarchy, unit, amount state |
| `resource_price_explain` | object/resource | code/name/unit, price, basis, source, confidence |
| `fakt_f2_reconciliation` | object/period | Fakt, previous approved F2, current draft, remainder, unknowns |
| `document_evidence` | object | file ID/hash, role, sheet, revision, sync/readability |
| `procurement_requirement` | object/resource | requirement draft, source row, remaining value, reason |
| `quality_evidence_status` | object | AOSR/coverage rows, missing evidence, source documents |

The exact names must match the deployed catalog; this table is the target
contract, not permission to invent RPCs.

## Write contracts

Writes are separate from reads and require:

- authenticated actor and active company membership;
- role and named-command allowlist;
- object/company consistency check;
- expected version for optimistic concurrency;
- UUID `operation_id` required for state-changing commands;
- explicit NULL/zero/negative semantics;
- source-document/provenance fields;
- idempotent replay behavior;
- append-only audit result.

Candidate commands: `fakt_draft`, `f2_import_draft`, `f2_submit`,
`f2_approve`, `zayavka_create`, `aosr_create`, `document_link`, and
`official_export_prepare`. `f2_approve` and official export remain blocked until
owner-approved state/formula rules exist.

## Validation matrix

| Attack | Required result |
|---|---|
| wrong company ID | reject before read/write |
| object from another company | reject; no existence leak |
| stale version | conflict with current version/evidence |
| duplicate operation ID | prior result, no second write |
| NULL amount | preserve unknown; never turn into 0 |
| source amount ≠ qty×price | show both; apply approved precedence only |
| wrong unit | block or approved conversion only |
| negative correction | preserve and require defined state/approval |
| unauthorized role | reject at gateway and DB/RPC |
| arbitrary SQL/RPC | schema validation rejects unknown tool |
| replay store unavailable | fail closed for write command |
| provider fallback | explicit recorded event or no fallback |

## AI event record

Minimum append-only event fields:

`request_id, operation_id, actor_id, tenant_id, object_id, conversation_id,
role, tool, args_hash, source_rpc, provider, model, prompt_version,
schema_version, output_hash, draft_or_commit, result_status, error_code,
created_at, completed_at`.

Do not store raw confidential document text unless the retention policy and
owner-approved provider boundary explicitly allow it.

## Current gaps

- deployed RPC/grant/RLS parity is unverified;
- durable AI/agent audit record is not proven;
- replay-store migration is a candidate, not a deployment proof;
- Jarvis bypasses the common named-tool path;
- invoice AI output lacks a durable draft before writes;
- rate/quota/file-signature/provider data handling are unverified.
