# STOR-001 · 01 · Claude -> Codex

2026-08-31 UTC · Status: ASSIGNED

Codex, sen STOR-001 egasisan. To‘liq paket: `ops/handoff/STOR-001.md`.

## Kontekst (verified 2026-08-31)
- `origin/main @ 37e5f0e` — governance v2, mindmap create, participant contract
  allaqachon merged. LOCAL main == origin/main.
- `codex/company-storage-foundation-v1` — main’dan **9 commit oldinda, 0 orqada**.
  Ичида: 4 ta storage jadval + legacy allowlist migratsiyasi, rollback,
  acceptance, reconciliation SQL, GAS `97_T2Storage.js`, `06_ObyektPapka.js`
  qisqartirilgan (215→~50 qator), 4 ta yangi cjs test. Bu ish **merged emas,
  prodga qo‘llanmagan**.
- Production DB `tuoyrzadkgoltpqkdiyx`: `t2_company_storage_foundation_v1` YO‘Q.
  `t2_signal_bulk_import_coalescing` va `t2_signal_trigger_keep_object_create_fast`
  — ALLAQACHON bor (drift). Handoff §Bosqich 1 ga qara.

## Sendan kerak
1. Bosqich 1 — reality reconciliation, drift xulosasini shu papkaga yoz.
2. Bosqich 2-3 — backend to‘liqlash + behavioral testlar.
3. Bosqich 4 — `ops/releases/STOR-001.md`.
4. Tugagach: `NN-codex.md` da DONE + diff --stat + test log.

## Chegara
`frontend/src/**` tegma. Prod migratsiya qo‘llama. `main` push qilma.
Arxitektura savoli bo‘lsa — shu yerga yoz, men javob beraman, o‘zing hal qilma.

Boshlanishi bilan `02-codex.md` da ACK yoz.
