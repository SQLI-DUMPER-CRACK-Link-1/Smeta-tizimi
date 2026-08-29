# Mindmap command RPC v2 contract

This is the deployment contract for the forward migration 20260829051320_t2_mindmap_command_contract_hardening.sql. The current UI uses the typed V2 adapter.

The Cloudflare mutation gateway, not browser UI, must inject actorId and actorLabel from the verified session. It must reject a legacy session that lacks foydalanuvchi_id. The browser must supply kompaniyaId, natural relation IDs, expectedVersion, and a caller-generated UUID operationId.

## Shared types

\`\`\`ts
type MindmapRelation =
  | 'obyekt_loyiha'
  | 'shartnoma_loyiha'
  | 'shartnoma_obyekt'
  | 'sklad_obyekt'
  | 'texnika_obyekt'
  | 'kadr_obyekt'
  | 'qatnashchi';

type ParticipantRole =
  | 'zakazchik'
  | 'bosh_pudratchi'
  | 'subpudratchi'
  | 'loyihachi'
  | 'taminotchi';

type CommandResult = {
  ok: true;
  idempotent?: boolean;
  natija?: CommandResult;
  tur?: MindmapRelation;
  manba_id?: number;
  maqsad_id?: number;
  saqlandi?: number;
  soft?: true;
};
\`\`\`

## Relation link

\`\`\`ts
type MindmapLinkCommand = {
  kompaniyaId: number;
  actorId: number;        // gateway-injected only
  tur: MindmapRelation;
  manbaId: number;
  maqsadId: number;
  rol: ParticipantRole | null;
  expectedVersion: number;
  operationId: string;    // UUID generated once by caller and reused on retry
  actorLabel?: string;    // gateway-injected only
};
\`\`\`

RPC mapping:

\`\`\`text
t2_mindmap_bog_v2(
  p_kompaniya_id, p_actor_id, p_tur, p_manba_id, p_maqsad_id, p_rol,
  p_kutilgan_versiya, p_operation_id, p_actor_label
)
\`\`\`

Ownership/version target:

| Relation | Source ownership | Target ownership and expectedVersion |
|---|---|---|
| loyiha to obyekt | loyiha.kompaniya_id | obyekt.versiya |
| shartnoma to loyiha | loyiha.kompaniya_id | shartnoma.versiya |
| shartnoma to obyekt | shartnoma.kompaniya_id | obyekt.versiya |
| sklad to obyekt | sklad.kompaniya_id | obyekt.versiya |
| texnika to obyekt | texnika.kompaniya_id | obyekt.versiya |
| kadr to obyekt | kadr.kompaniya_id | obyekt.versiya |
| kontragent to loyiha | kontragent.kompaniya_id | loyiha.versiya |

All entities must belong to kompaniyaId. The database rejects another tenant's ID even if the gateway is bypassed.

## Soft unlink

\`\`\`ts
type MindmapUnlinkCommand = MindmapLinkCommand;
\`\`\`

RPC mapping:

\`\`\`text
t2_mindmap_bog_ochir_v2(
  p_kompaniya_id, p_actor_id, p_tur, p_manba_id, p_maqsad_id, p_rol,
  p_kutilgan_versiya, p_operation_id, p_actor_label
)
\`\`\`

Unlink never deletes a domain entity. FK relations are set to null only when they match the requested natural relation. Mapping relations change holat from faol to bekor. A non-matching or already-unlinked relation is an explicit error, not a silent success.

## Layout save

\`\`\`ts
type MindmapLayoutCommand = {
  kompaniyaId: number;
  actorId: number;       // gateway-injected only
  operationId: string;
  actorLabel?: string;   // gateway-injected only
  joylar: Array<{ tugun_id: string; x: number; y: number }>;
};
\`\`\`

RPC mapping:

\`\`\`text
t2_mindmap_joylashuv_saqla_v2(
  p_kompaniya_id, p_actor_id, p_joylar, p_operation_id, p_actor_label
)
\`\`\`

Each node ID is checked against the company graph. The layout is not a relation and does not create a second domain graph.

## Entity soft-delete

\`\`\`ts
type MindmapSoftDeleteCommand = {
  kompaniyaId: number;
  actorId: number;       // gateway-injected only
  tur: 'loyiha' | 'shartnoma' | 'sklad' | 'texnika' | 'kadr' | 'kontragent';
  id: number;
  expectedVersion: number;
  operationId: string;
  actorLabel?: string;   // gateway-injected only
};
\`\`\`

RPC mapping:

\`\`\`text
t2_mindmap_tugun_ochir_v2(
  p_kompaniya_id, p_actor_id, p_tur, p_id,
  p_kutilgan_versiya, p_operation_id, p_actor_label
)
\`\`\`

It changes holat to bekor and increments versiya. Obyekt is intentionally excluded.

## Gateway requirements

1. Require sess.foydalanuvchi_id and active company membership; do not use the legacy-session bypass for these v2 commands.
2. Verify that the session company role is not boss or rahbar.
3. Inject actorId and actorLabel server-side. Never accept either from browser input.
4. Require UUID operationId and positive expectedVersion before calling an RPC.
5. Route only these named v2 RPCs through the existing allowlist. No generic SQL or arbitrary RPC name.
6. Keep v1 functions reachable only until this gateway adapter is deployed atomically; then revoke their direct execution and remove the v1 named mutations in a separate reviewed migration.

## Audit/event result

Each successful mutation writes a t2_audit_log event through t2_audit_yoz with actor ID, effective membership role, command type, and natural IDs. Command receipts are in t2_mindmap_command_reestr solely for retry idempotency; they are not a relation or business source of truth.
