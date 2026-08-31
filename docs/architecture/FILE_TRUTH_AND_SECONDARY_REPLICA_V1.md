# File Truth & Secondary Replica v1 (FILE-TRUTH-001)

Status: DRAFT — SOURCE READY, NOT APPLIED. Owner: Claude (Lead Engineer/Architect).
Base: `origin/main @ 2361d10`. Production writes forbidden for this task.

---

## 0. Canonical law

| Layer | Role |
|---|---|
| **Supabase / Postgres** | **BUSINESS + METADATA TRUTH** — document identity, ownership, lineage, revision history, sync state, audit. |
| **Cloudflare R2** | **FILE / BINARY TRUTH** — every canonical document byte. Content-addressed keys. |
| **Google Drive** | **SECONDARY SYNCHRONIZED REPLICA** — a mirror of canonical documents into the company's Drive workspace (STOR-001 folders). Two-way for a small set of supported edits. |
| **Google Sheets** | **SECONDARY SYNCHRONIZED REPLICA** — structured-entity mirror (contract v1 only tonight). |
| **GAS** | **EXTERNAL BRIDGE ONLY** — the transport that reaches Drive/Sheets. Never on a core read/write path. |

**No core interactive TIZIM_02 path may depend on Drive, Sheets, or GAS.**
A user upload succeeds when R2 + Supabase succeed. A user download reads R2.
Drive/Sheets being down = *replica degraded*, canonical system stays UP.

---

## 1. Existing R2 stack (reused — do not reinvent)

- Binding: **`R2_ARCHIVE`** (Cloudflare Pages project binding; not in `wrangler.toml`).
- Public read domain: `https://r2.qurilish-os.uz/<key>` (bucket custom domain).
- Current `functions/api/upload.ts`: `R2_ARCHIVE.put(key, file.stream(), {httpMetadata})`.
  Key scheme today: `kompaniya_id/obyekt_id/{hujjat|loyiha}/<safe_name>` — **name-based, unauthenticated**. Both are fixed here.
- No download function today (reads hit the public domain directly, no authz).
- Old model `t2_obyekt_hujjat` (0 rows) is superseded by `t2_document_registry`.

## 2. Canonical R2 key scheme (ID + content addressed)

```
docs/<kompaniya_id>/<loyiha_id>/<obyekt_id|_>/<document_id>/r<revision_seq>/<sha256_12>__<safe_original_name>
```

- Never derived from a display name alone. `safe_original_name` is a label only.
- A new content revision writes a **new key** (immutable objects). Old keys retained.
- `_` for `obyekt_id` when the document is project-level.

## 3. `t2_document_registry` — canonical vs replica split (additive migration)

**Canonical identity (R2 truth):**
`id` (=document_id), `kompaniya_id`, `loyiha_id`, `obyekt_id?`, `document_type`,
`revision` (business label), `revision_seq` (int, monotonic), `original_filename`,
`mime_type`, `size_bytes`, `sha256`, `r2_bucket` (default `archive`), `r2_key`,
`canonical_storage_status` (`pending|stored|failed`), `status`
(`active|superseded|replica_missing|deleted`), `versiya` (optimistic lock),
`created_by`, `actor_id`, `created_at`, `updated_at`, `operation_id`.

**Drive replica info (separate, nullable):**
`drive_file_id`, `drive_parent_id`, `drive_revision`,
`drive_sync_status` (`not_configured|pending|syncing|synced|failed|conflict`),
`drive_last_sync_at`, `drive_last_error`.

**Sheets replica info (V1 reserved):** `sheets_entity_id`, `sheets_sync_status`,
`sheets_last_sync_at`.

`provider` / `external_file_id` / `external_parent_id` become **nullable** and
carry the legacy Drive value during migration; new writes leave them null and
use `drive_*`. `external_file_id` is NEVER the canonical document identity.

## 4. Canonical upload path

```
Browser --(multipart, session cookie)--> Cloudflare Pages Function
  /api/hujjat-yukla
    1. tekshir(cookie) -> Sess (actor_id, company membership)
    2. validate company/project/object lineage belongs to the actor's companies
    3. stream file -> sha256 + size (Web Crypto, streaming)
    4. R2_ARCHIVE.put(canonical_key, bytes, {httpMetadata, customMetadata:{sha256, document_id?}})
    5. RPC t2_document_canonical_upsert_v1(actor, company, project, object,
         doc_type, filename, mime, size, sha256, r2_key, r2_bucket, operation_id, revision?)
       -> idempotent on (kompaniya_id, operation_id); returns {document_id, revision_seq, versiya}
       -> enqueues one t2_replica_sync_job(target='drive', operation='mirror', holat='pending')
    6. return {ok, document_id, r2_key, sha256}  (Drive NOT awaited)
```

**Idempotency:** same `operation_id` → same `document_id`, no second R2 object
(the upsert returns the existing row; the function may still PUT the identical
key — R2 PUT is idempotent for the same key/content, and the key is
content-addressed so a retry writes the same bytes to the same key).

## 5. Canonical read / download

```
UI --> /api/hujjat-ol?id=<document_id>   (session cookie)
  1. tekshir(cookie)
  2. RPC t2_document_canonical_get_v1(actor, document_id)
     -> row only if actor is an active member of row.kompaniya_id; else 403
  3. R2_ARCHIVE.get(row.r2_key) -> stream back with Content-Type row.mime_type,
     Content-Disposition attachment; filename* = row.original_filename
  4. If R2 object missing but row.status='active' -> 502 CANONICAL_BINARY_MISSING
     (never fall back to Drive silently)
```

Drive file absent → download still works (reads R2).

## 6. Drive = secondary synchronized replica

STOR-001 company/project/object folders are retained; their role is now
**replica destination**. After a canonical upload, a `t2_replica_sync_job`
(`target='drive'`, `operation='mirror'`) is processed by the sync worker (GAS
side) which:
- resolves the object's canonical Drive folder (`t2_object_storage_binding.folder_id`)
- creates/updates the Drive file from R2 bytes
- calls `t2_replica_job_synced_v1(job_id, drive_file_id, drive_revision)`
  → sets `drive_sync_status='synced'`, `drive_file_id`, `drive_last_sync_at`.

A Drive error sets `drive_sync_status='failed'` + `drive_last_error`; it **never**
rolls back the canonical upload.

## 7. Drive write-back (V1 supported edits)

Detected by a GAS poller (Drive changes feed / per-folder scan on the *replica*
folders only — never a global Drive scan) which maps `drive_file_id → document_id`
via `t2_document_registry` and calls one command per change:

| Change | Command | Behavior |
|---|---|---|
| **RENAME** | `t2_document_replica_rename_v1(actor, document_id, drive_file_id, new_name, drive_revision)` | validate binding; update `original_filename`; audit. Metadata only. |
| **MOVE** (between managed replica folders) | `t2_document_replica_move_v1(actor, document_id, drive_file_id, new_parent_id, drive_revision)` | resolve `new_parent_id` to a known object/project binding; if it maps → update `obyekt_id`/`loyiha_id` lineage + audit; if not → `drive_sync_status='conflict'`, no lineage change. |
| **CONTENT CHANGE** | `t2_document_replica_content_v1(actor, document_id, new_r2_key, new_sha256, new_size, drive_revision, base_version)` | if `base_version <> versiya` → `REPLICA_CONFLICT` (no write). Else: mark current row `status='superseded'`, insert a NEW registry row `revision_seq+1`, `r2_key=new_r2_key`, `sha256=new_sha256`, `versiya=1`; audit. The GAS worker uploads the changed Drive binary to a fresh canonical R2 key *before* calling this. |
| **DELETE** | `t2_document_replica_deleted_v1(actor, document_id, drive_file_id)` | `drive_sync_status='failed'`(missing) + `status` unchanged; enqueue a `review` job. **R2 is never hard-deleted.** A real delete is a separate authorized `t2_document_delete_v1` + retention policy (out of V1). |

## 8. Sheets = secondary synchronized replica (contract only, V1)

- Row number is NEVER identity. Each replicated entity carries a hidden stable
  `sheets_entity_id` and `base_version` in a side column / developer metadata.
- Sheets edit → GAS diff → `t2_<entity>_command_v1(actor, id, base_version, fields, operation_id)`
  → permission + validation + optimistic version → Supabase update → audit →
  replica refresh back to Sheets.
- Financial / contract / estimate fields: **fail closed on conflict** (no
  deterministic auto-merge). Safe metadata fields may declare an explicit policy.
- Tonight: only the reusable sync-contract types + backend boundary + tests.
  No Sheets module rebuild.

## 9. Conflict engine (shared)

Every replica write-back carries: `entity/document id`, `base_version`,
`source_revision_or_sha`, `operation_id`. If the canonical row changed since
`base_version` → **CONFLICT** (`REPLICA_CONFLICT` / `drive_sync_status='conflict'`
/ `sheets_sync_status='conflict'`). No blind last-write-wins on important fields.

## 10. Sync execution (job abstraction)

`t2_replica_sync_job`: `id, kompaniya_id, target('drive'|'sheets'), entity_type,
entity_id, operation('mirror'|'rename'|'move'|'content'|'delete'|'review'),
holat('pending'|'running'|'synced'|'failed'|'conflict'), attempts, last_error,
base_version, source_hash, operation_id, created_at, updated_at`.

- Core requests only INSERT a job row (fast). They never wait for Drive/Sheets.
- Worker = GAS (already the bridge). It claims jobs
  (`t2_replica_job_claim_v1(target, limit)` → `for update skip locked`),
  processes, reports back. No new paid infrastructure. Deployment requirement:
  a GAS time-driven trigger (every 1–5 min) calling `apiT2ReplicaSyncTick`.
- `attempts` + exponential backoff (`next_attempt_at`), cap at 8, then `failed`
  (surfaced in the Control Center `replica.conflicts` view).

## 11. Existing Drive-only documents — backfill

No deletion. `ops/backfill/FILE-TRUTH-001-backfill.md` describes:
1. For each `t2_document_registry` row with `external_file_id` and no `r2_key`:
   GAS fetches the Drive binary by its **stored** `external_file_id` (no name
   guessing), computes sha256, PUTs a canonical R2 key, calls
   `t2_document_canonical_backfill_v1(document_id, r2_key, sha256, size, mime, drive_revision)`.
2. Row becomes canonical (R2) with Drive as `drive_sync_status='synced'`.
3. AMBIGUOUS / MISSING Drive files → `review` job, never auto-bound.

## 12. Control Center capabilities (register)

`canonical.database` (Supabase), `canonical.file_storage_r2` (R2),
`document.registry`, `drive.replica_sync`, `sheets.replica_sync`,
`replica.conflicts`.

Health rollup:
- `R2 DOWN` → **canonical file system DEGRADED**.
- `Supabase DOWN` → **canonical system DEGRADED**.
- `Drive DOWN` → canonical UP; `drive.replica_sync` = DEGRADED.
- `Sheets DOWN` → canonical UP; `sheets.replica_sync` = DEGRADED.

## 13. Performance law

Core interactive paths: **zero** Drive scan, Sheets scan, global folder scan,
GAS round-trip dependency, O(n) project scan. Canonical reads = Supabase/R2 only.
Static guard: `frontend/testlar/t2_file_truth.test.cjs`.

## 14. Governance

This file is a new accepted contract under `docs/architecture/`. The Constitution
already states Supabase-first; §0 here sharpens "R2 = file truth, Drive/Sheets =
replica, GAS = bridge". Constitution patch proposed in
`ops/handoff/FILE-TRUTH-001-constitution-patch.md` (not applied — governance
branch owns `docs/governance/`).

## 15. Codex lane boundary

Do NOT touch `frontend/src/components/document-center/**` or
`frontend/src/admin/document-center/**` — Codex owns that UI lane. This task
delivers the backend/contract/functions/migrations/tests it will consume.
