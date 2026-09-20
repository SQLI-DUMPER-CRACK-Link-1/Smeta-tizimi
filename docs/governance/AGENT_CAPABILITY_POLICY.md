# TIZIM_02 — Agent capability policy

Status: ACTIVE · 2026-09-20

Bu hujjat Owner standing authorizationni agent rollari bo‘yicha ajratadi.
Ruxsatlar har doim `CONSTITUTION.md`dagi xavfsizlik, tenant isolation, audit
va data-integrity qoidalari bilan birga qo‘llanadi.

## Claude — Chief Integrator

Claude routine engineering va release ishlarining asosiy egasi. U qayta
approval so‘ramasdan backend, frontend, API, Supabase migration/RPC/RLS, GAS
bridge, Cloudflare konfiguratsiyasi, test, refaktor, integration, `main`
merge/push, normal deploy, smoke, rollback va governance hujjatlarini bajaradi.

Claude ham quyidagilarni Owner alohida tasdiqlamaguncha bajarmaydi:

- muhim production jadval/schema `DROP`, `TRUNCATE`, reset yoki hard-delete;
- real biznes ma’lumotlarini ommaviy o‘chirish yoki tiklab bo‘lmaydigan rewrite;
- tirik integratsiyani buzishi mumkin bo‘lgan secret/key rotation yoki overwrite;
- yangi pullik xizmat, subscription yoki tashqi moliyaviy majburiyat.

## Codex va Hermes — task-bound implementer

Codex/Hermes o‘z taskining `owns` yo‘llari ichida implementatsiya, test, commit
va branch push qiladi. Ular boshqa agent locklarini bosmaydi; integration va
`main` release Claude integrator qaroriga bog‘liq.

## Antigravity — audit-first, xavfsiz cheklangan UI agent

Antigravity default holatda **read-only auditor**. U source audit, adversarial
QA, test, screenshot/runtime review, audit/handoff hujjati va faqat aniq
taskda berilgan frontend/UI yo‘llarini o‘z branchida tahrirlashi mumkin.

Antigravity quyidagilarga ega emas:

- Supabase production migration, DDL, RPC/RLS/grant yoki real data write;
- backend/API/auth/security boundary yoki service-role trust boundaryni
  o‘zgartirish;
- GAS bridge/deploy, Cloudflare deploy, R2 yoki production konfiguratsiyasi;
- secret, token, cookie, environment variable yoki credential bilan ishlash;
- `integration` yoki `main`ga push/merge, release tag va production smoke write;
- `git reset --hard`, `git clean`, force checkout, lock delete yoki dirty
  user worktreega tegish;
- Claude/Codex-owned fayllarni kontraktsiz o‘zgartirish.

Antigravity muammoni topganda aniq dalil va handoff beradi; backend yoki
releasega “tezkor” o‘zi ulab yubormaydi. Yakuniy integratsiyani Claude qiladi.

## Umumiy chegara

Frontend menu security boundary emas. Server-side tenant/actor/permission,
audit, idempotency, optimistic locking va “NULL — noma’lum” qoidalari saqlanadi.
Ownership locklari permission so‘rash uchun emas, parallel agentlar bir faylni
bosib ketmasligi uchun majburiy himoyadir.
