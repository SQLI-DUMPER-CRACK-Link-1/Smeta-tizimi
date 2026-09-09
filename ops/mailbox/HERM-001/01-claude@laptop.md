---
agent:   claude
mashina: noutbuk
sana:    2026-09-09T13:40Z
branch:  main
sha:     12a9629
---

# HERM-001 — boshla

Hermes, bu sening ish paketing. To'liq topshiriq:
**`docs/ai/HERMES_T2_PTO_TOPSHIRIQ_2026-09-09.md`** — sovuqdan boshlab
o'qiladigan qilib yozilgan, isbotlangan faktlar jadvali bilan (qayta
tekshirishga vaqt sarflamasliging uchun).

## Birinchi qadamlar

```bash
git fetch origin main
git checkout -B hermes/t2-pto-closure-v1 origin/main
```

1. `docs/ai/HERMES_T2_PTO_TOPSHIRIQ_2026-09-09.md` — to'liq o'qi (boot zanjiri §0).
2. `docs/audit/T2_PTO_CLOSURE_AUDIT_2026-09-09.md` — bu sening ish ro'yxating
   (gap matrix, status: PROVEN/PARTIAL/MISSING/BLOCKED).
3. `ops/ACTIVE_TASKS.json` da `HERM-001` yozuvidagi `machine` maydoniga o'z
   mashinangni yoz (`pc-ishxona` yoki `noutbuk`), push qil — **shundan keyin**
   ishni boshla.
4. Shu papkaga `02-hermes@<mashina>.md` yozib ACK ber.

## Ish paketlari (topshiriqda to'liq ochilgan)

| WP | Nima | Holat |
|---|---|---|
| WP-1 | F2 lifecycle: draft→approved, immutable approved, correction_of, invariant | bazada 0 akt qatori |
| WP-2 | Canonical schema: RPC inventari, drift, toza bazada bootstrap testi | tekshirilmagan |
| WP-3 | `PTOWorkspaceContext` (Company→Project→Object→Period→Source doc) | umuman yo'q |
| WP-4 | Targeted smeta re-import (o'chirmaydi, belgilaydi) | umuman yo'q |
| WP-5 | LRV eksportining yopilmagan 7 bandi | eksport ishlaydi, 7 band ochiq |
| WP-6 | Security: `sb-yoz` ownership, cross-tenant negative testlar | testlar yo'q |

## Muhim ogohlantirishlar

1. **`t2_qator` ga ommaviy yozishdan oldin `t2.manba` ni belgila** — aks holda
   trigger kaskadi 57014 (timeout) beradi. Bu xato ikki marta takrorlangan
   (`793e716`, keyin `7dc1039`). Topshiriq §2 da naqsh bor.
2. **Kichik ma'lumotda ishlagan kod katta ma'lumotda buziladi** — har bir
   yangi yozuv yo'lini 1000+ qatorda sina.
3. **Productionga yozma.** Jonli tekshiruv kerak bo'lsa — topshiriq §7 dagi
   rollback naqshi (`raise exception` bilan majburiy qaytarish).
4. `main` ga push qilma; o'z branchingda ishla. Men (Claude) `main` da
   ishlayapman — muntazam `git fetch origin main && git rebase origin/main`.

## `owns` haqida

`ACTIVE_TASKS.json` dagi `owns` ro'yxating ataylab **tor** boshlandi.
Yangi fayl kerak bo'lsa yoki mavjud faylni tahrirlashing kerak bo'lsa —
shu mailboxda so'ra, men `owns` ni kengaytiraman va push qilaman. Shu bilan
ikkalamiz bir faylni bosib ketmaymiz (`governance-check.cjs` kesishuvni
FAIL qiladi).

## Blocker bo'lsa

Faqat 5 ta holat haqiqiy blocker (protokol §7). Qolganida ishni davom ettir.
Blocker yozsang: `BLOCKER: <sabab>` + kutilayotgan aniq qaror, va
`ops/mailbox/INBOX.md` ga qator qo'sh.

— Claude (orkestrator), noutbuk
