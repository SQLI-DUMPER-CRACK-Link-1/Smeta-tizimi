# T2-LRV-CANONICAL-CORE-001 — Codex handoff

## Contract

T1 `12_LrvIO.js`dagi yagona o‘qish/yozish prinsipi va `15_IshTurlar.js`dagi
BL→RS kutubxonasi T2da immutable source snapshot, stable entity ID va canonical
catalogga ko‘chirildi. Sheet row number hech qachon identity emas.

## Core

- `document → document_revision → document_line` original smeta/F2 qatordan
  ajralmagan immutable source chain.
- work type, alias/observation, recipe version/resource va LRV entity tree.
- exact identity automatic; ambiguous candidate-only; norm/code/price invent qilinmaydi.
- approved F2 source amountni exact saqlaydi va frozen.
- additional/replacement/resource pure change engine operation/version/parent/order bilan.
- Sync envelope event/operation/entity/version/hash asosida echo, duplicate, stale,
  deleted/reordered row va frozen F2 konfliktlarini fail-closed qiladi.

## Migration

`20260918120000_t2_lrv_canonical_core_v1` source-only forward, acceptance va
pre-use rollback paketi. Supabase CLI Windows binari yo‘qligi sabab generator
ishlamadi; filename repo ketma-ketligidan keyingi unique stamp bilan tanlandi.
Productionga apply qilinmadi.

## Verification

- Pure engine Vitest: 7/7 PASS (`NODE_OPTIONS=--max-old-space-size=4096`).
- Forward migration + acceptance: `LRV_CANONICAL_ACCEPTANCE_PASS` bitta
  `BEGIN ... ROLLBACK` transaction ichida o‘tdi.
- Rollbackdan keyin live katalogda `t2_lrv_document`, `t2_lrv_approved_f2` va
  `t2_lrv_sync_event` yo‘qligi tasdiqlandi: productionga schema yoki data
  saqlanmadi.
- Fixture qamrovi: BASE, ADDITIONAL, REPLACEMENT, source amount ≠ qty×price,
  ambiguous identity, frozen F2, recipe preflight va stale/frozen sync.

## Performance

Pure matching indeksli exact identityga tayangan; API ichida positional scan
yo‘q. Batch ingestion/sync implementationi Claude server adapterida event
bo‘yicha chunklanadi; interactive pathda full Sheet scan ishlatilmaydi.

## Claude conflicts

Yo‘q. Claude-owned UI/API/context fayllari o‘zgartirilmagan. Change-command
DB RPC wiring Claude integratsiyasidan keyingi server lane bo‘lib qoladi.
