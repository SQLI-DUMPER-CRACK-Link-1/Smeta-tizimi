# Hermes checkpoint — 2026-09-11 tushlik tanaffusi

## Holat

- Ish branchi: `task/20260911-claude-handoff`
- Baseline: `origin/main` @ `6ebae58`
- Repo: `C:\Users\PC\Documents\GAS_task_20260911`
- Asosiy worktree `C:\Users\PC\Documents\GAS` dirty holatda; unga tegilmagan.
- `frontend/npm ci` bajarildi: dependency’lar o‘rnatildi.
- Production Supabase migration/deploy/destructive write bajarilmadi.

## Egasining tasdiqlagan БЕЗ СКЛАД qoidasi

- Kategoriya RES faylidan emas, resurs nomining o‘zidan aniqlanadi.
- Tasdiqlangan misollar: suv (`ВОДА`/`SUV`), beton (`БЕТОН`/`BETON`), rastvor (`РАСТВОР`/`RASTVOR`).
- Qum (`ПЕСОК`/`QUM`), sheben (`ЩЕБЕНЬ`/`SHEBEN`), kvars (`КВАРЦ`/`KVARS`) saqlanadigan materiallar — `БЕЗ СКЛАД` emas.
- Qoidani kengaytirib taxminiy/fuzzy material klassifikatsiyasi qo‘shilmasin.

## Agentlar

8 ta lane parallel yuborildi:

1. frontend pure classifier + test
2. Supabase additive migration + SQL contract test
3. LRV_PLUS export: 7 category columns + tests
4. mavjud smetani xavfsiz tozalab qayta import qilish UX + tests
5. shared category type/allowlist/UI integration
6. PTO scope/deletion read-only audit
7. import path read-only audit
8. LRV export read-only acceptance audit

Status tanaffus vaqtida:

- 5 agent `running` ro‘yxatidan chiqdi; ularning natijalari va diff’i hali parent tomonidan mustaqil tekshirilmagan.
- 3 agentga xavfsiz interrupt yuborildi: `sa-6-00ec80a4`, `sa-2-f02ef90f`, `sa-7-cd86c27b`.
- Interrupt in-flight tool call tugagach qo‘llanadi; qaytgan partial summary/diff’ni ishonchli fakt deb qabul qilmasdan tekshirish kerak.

## Current verified state after async completion

- `delegate_task(action='list')`: **0 live subagents**; no process needs stopping.
- Branch remains `task/20260911-claude-handoff`, HEAD `6ebae58914fce627539aa4fcecc2461ec188c5a3`.
- Worktree has only task-scope implementation/test files plus this checkpoint; no commit was created.
- Completed lanes: pure classifier, Supabase migration/SQL contract, existing-object re-import UX, shared category type/UI/API.
- LRV export lane was interrupted after leaving source/test changes; it must receive a parent review before acceptance.
- Read-only audit lanes 6/7/8 did not leave their requested reports; do not assume those audits are complete.
- Parent manually added `БЕЗСКЛАД` to `resurs-vedomost` ordering with a RED→GREEN focused test.
- Parent added `TEMIR BETON` SQL acceptance coverage and classifier exclusion with a RED→GREEN static contract check.

## Verification already run

- Focused Vitest for classifier, LRV export, and import UX: exit 0.
- Full frontend Vitest (`npm test -- --run`): exit 0.
- Frontend app TypeScript (`npm exec tsc -- -p tsconfig.app.json --noEmit`): exit 0.
- Functions TypeScript (`npm run typecheck:functions -- --pretty false`): exit 0.
- `npm run tekshir`: exit 0.
- `node ops/governance-check.cjs`: exit 0.
- `git diff --check`: exit 0.
- A root-level `npx tsc -b --pretty false` invocation exited 1; rerun from the documented `frontend` directory after resuming and inspect exact output.
- SQL runtime acceptance was not executed: no local Postgres/psql/Supabase CLI/Docker parser was available.

## Resume gates

1. Preserve all current uncommitted changes; do not reset/clean or touch `C:\Users\PC\Documents\GAS`.
2. Re-read all changed files and review the interrupted LRV diff against T1: `J:P = ЧЕЛ, МАШ, МАТ, ОБ, БЕЗ СКЛАД, М/К, ПРОВОД`; decide whether canonical `КАБ` is only normalized to the display label `ПРОВОД`.
3. Verify whether LRV requires duplicated display in `МАТ` for `М/К`, `КАБ`, and `БЕЗ СКЛАД`; do not alter totals/nakrutka semantics without a test.
4. Validate the new SQL migration against actual function signatures/constraints; keep it source-only and document unavailable DB runtime.
5. Re-run documented checks from `frontend`: `npx tsc -b`, `npm test -- --run`, `npm run tekshir`; then lint and governance.
6. Produce or explicitly mark missing scope/import/LRV audit reports; freeze panes remain `UNPROVEN` unless XML post-processing is implemented and tested.
7. Only commit or hand off after a complete diff review; never deploy without the owner’s explicit approval.
