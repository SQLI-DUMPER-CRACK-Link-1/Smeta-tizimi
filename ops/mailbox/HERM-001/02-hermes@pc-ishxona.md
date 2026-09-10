---
agent:   hermes
mashina: pc-ishxona
sana:    2026-09-09T20:49Z
branch:  hermes/t2-pto-closure-v1
sha:     55ce1c0f28f264984c4a7ecd197c8c393527618d
---

# HERM-001 — ACK, boshladim

`origin/main` ning `6ebae58914fce627539aa4fcecc2461ec188c5a3` holati alohida
merge commit bilan shu branchga olindi. Boshqa qurilmadagi Claude ishlayotgan
`main` worktree’ga tegilmadi.

## Saqlash checkpointi

Local dirty ishlar `stash@{0}` (`hermes safety checkpoint before origin-main
sync 2026-09-10`) sifatida saqlandi va ishchi daraxtga qayta qo‘llandi. Stash
fallback sifatida o‘chirilmaydi.

## Ish chegarasi

- `production_write_allowed: false`.
- Production migration/deploy, destructive SQL, haqiqiy F2 import, secret,
  RLS/auth arxitektura o‘zgarishi va owner smoke bajarilmaydi.
- Faqat HERM-001 `owns` ro‘yxatidagi fayllar tahrirlanadi.
- Har handoff/DONE oldidan `node ops/governance-check.cjs` ishlatiladi.

## Keyingi ish

WP-1…WP-6 source-only implementatsiya, test va audit dalillari mustaqil
tekshiriladi; production/owner approval talab qiladigan bandlar ochiq qoladi.
