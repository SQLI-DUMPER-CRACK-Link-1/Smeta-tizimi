# TIZIM_02 — Agentlararo aloqa tizimi (Agent Communication Protocol v2)

Status: ACCEPTED (v2) · Last checked: 2026-09-09

Bu hujjat **agentlar bir-biri bilan qanday gaplashishini** belgilaydi va
governance boot zanjirining bir qismi: `AGENTS.md` → `CONSTITUTION.md` →
`CURRENT_STATE.md` → `ops/ACTIVE_TASKS.json`. Konflikt bo'lsa Constitution
ustun turadi.

**v2 da nima o'zgardi:** (1) Hermes rol sifatida qo'shildi; (2) §11 —
bir nechta MASHINA (noutbuk + ishxona PC) bitta liniyada ishlashi qoidasi;
(3) hujjat `main` ga chiqarildi — ilgari u faqat `codex/agent-comms-
protocol-v1` branchida turardi va hech kim ko'rmasdi.

---

## 1. Asosiy qonunlar

1. **Yagona haqiqat manbai — repozitoriy.** Agentlararo hamma rasmiy aloqa
   git ichida fayl sifatida yashaydi. Chat/terminaldagi gap — kontekst,
   dalil emas. **Push qilinmagan narsa — aytilmagan narsa.**
2. **Har bir xabar bitta ref ustida ko'rinadi.** «Qayta ishga tush, o'zi
   topib oladi» — taqiqlangan. Handoff har doim `repo + base_sha + branch +
   fayl yo'li`ni ko'rsatadi.
3. **`tizim02/MULOQOT.md` — TARIX.** Append-only jurnal; aktiv navbat emas,
   joriy holat emas.
4. **Mashina o'qiydigan holat — `ops/ACTIVE_TASKS.json`.** Odam o'qiydigan
   handoff — `ops/handoff/<TASK-ID>.md`. Javob/hodisa — `ops/mailbox/`.
5. **Bir vaqtda bitta aktiv P0.** Parallel ish faqat `owns` yo'llari
   kesishmasa ruxsat etiladi (`governance-check.cjs` buni majburlaydi).

---

## 2. Kataloglar tuzilishi

```text
ops/
  ACTIVE_TASKS.json          # yagona task-lock reestri (governance-v2 sxema)
  governance-check.cjs       # handoffdan oldin majburiy tekshiruv
  handoff/
    <TASK-ID>.md             # orkestrator -> ishchi: to'liq ish paketi
  mailbox/
    INBOX.md                 # JONLI indeks — ochiq, e'tibor kutayotgan bandlar
    <TASK-ID>/
      01-claude@laptop.md    # raqamlangan, append-only, hech qachon o'chirilmaydi
      02-hermes@pc.md
      03-claude@laptop.md
  releases/
    <MILESTONE>.md           # migr/rollback/acceptance/smoke/risk
```

Faqat `ops/ACTIVE_TASKS.json` va `ops/mailbox/INBOX.md` — «jonli indeks».
Qolgani append-only.

---

## 3. Rollar

| Kim | Rol | Qayerga yozadi | Nimani hal qiladi |
|---|---|---|---|
| **Odam** | Product Owner + domen eksperti | orkestratorga | biznes yo'nalish, ustuvorlik, prod/destructive approval |
| **Claude** | Chief Architect / orkestrator | handoff/, mailbox/, ACTIVE_TASKS.json | arxitektura, kontrakt, ketma-ketlik, review, integratsiya |
| **Hermes** | Senior implementer (PTO liniyasi) | mailbox/`<TASK>`/NN-hermes@`<mashina>`.md | o'z `owns` yo'llari ichidagi implementatsiya, audit, katta refaktor |
| **Codex** | Senior backend/DB/release | mailbox/`<TASK>`/NN-codex@`<mashina>`.md | o'z `owns` yo'llari ichidagi implementatsiya |
| **Antigravity** | Frontend/mexanik CRUD | mailbox/`<TASK>`/NN-antigravity@`<mashina>`.md | berilgan kontrakt bo'yicha UI |

**Ishchi arxitekturani belgilamaydi.** Yangi jadval/RPC/kontrakt kerak
bo'lsa — mailboxda savol yozadi, orkestrator javob beradi yoki ADR chiqaradi.

Odam agent dispecheri emas: ishchiga bitta to'liq paket beriladi, 15 ta
mayda prompt emas.

---

## 4. Xabar hayotiy sikli

```text
Orkestrator: ops/handoff/<TASK-ID>.md yozadi
          -> ACTIVE_TASKS.json ga task (status: active)
          -> ops/mailbox/<TASK-ID>/01-claude@<mashina>.md: "boshla" + kontekst
          -> INBOX.md ga qator qo'shadi
Ishchi:      branch checkout, must_read o'qiydi
          -> NN-<agent>@<mashina>.md: "ACK, boshladim" + mashina/sha
          -> blocker bo'lsa: BLOCKER: <sabab> + kutilayotgan qaror
Orkestrator: javob / kontrakt aniqlashtirish
Ishchi:      DONE + diff summary + test natijalari -> status: ready_for_review
Orkestrator: PASS yoki CHANGES-REQUESTED: <ro'yxat>
          -> integratsiya -> status: integrated -> INBOX.md dan qator o'chadi
          -> odamdan BITTA marta: "PROD READY — APPROVE?"
```

---

## 5. `ops/mailbox/INBOX.md` formati

Faqat ochiq bandlar. Hal bo'lgani **darhol** olib tashlanadi.

```markdown
| Sana (UTC) | TASK | Kim kutmoqda | Nima kerak | Fayl |
|---|---|---|---|---|
| 2026-09-09 | HERM-001 | Hermes <- Odam | Handoff berildi, ACK kutilmoqda | ops/mailbox/HERM-001/01-claude@laptop.md |
```

---

## 6. Handoff shabloni — `ops/handoff/<TASK-ID>.md`

Majburiy bo'limlar: TASK ID · OWNER · OBJECTIVE · REPO · BASE REF/SHA ·
WORK BRANCH · REQUIRED READING · OWNED PATHS · DO-NOT-TOUCH ·
ARCHITECTURAL INVARIANTS · IMPLEMENTATION BOUNDARY · TESTS · ACCEPTANCE ·
FORBIDDEN ACTIONS · EXPECTED FINAL OUTPUT.

Ishchi **DONE** yoki **haqiqiy BLOCKER**gacha davom etadi. «Yana ish qoldi»
bloker emas.

---

## 7. Haqiqiy blocker ta'rifi (faqat shular)

1. odamning biznes qarori kerak;
2. tashqi kredensial/ruxsat yo'q;
3. prod/destructive approval kerak;
4. davom etish ma'lumot yo'qotishi / xavfsizlik buzilishi bilan tahdid qiladi;
5. muqarrar uchinchi tomon bog'liqligi to'sib turibdi.

Boshqa hamma holatda — **ishni davom ettir**.

---

## 8. Status leksikasi (hech qachon aralashtirilmaydi)

`SOURCE READY` · `TESTED` · `BRANCH PUSHED` · `MERGED TO MAIN` ·
`DB MIGRATION APPLIED` · `GAS DEPLOYED` · `CLOUDFLARE DEPLOYED` ·
`LIVE SMOKE VERIFIED`.

Dalil tili: `VERIFIED LOCAL` / `VERIFIED REMOTE` / `VERIFIED PRODUCTION` /
`REPORTED BUT NOT YET VERIFIED` / `UNPROVEN` / `BLOCKED`.

---

## 9. governance-check majburiyati

Har handoff va har DONEdan oldin: `node ops/governance-check.cjs`.
`owns` ro'yxatidan tashqari fayl tegilgan bo'lsa — FAIL, handoff to'xtaydi.

---

## 10. Konflikt va lock qoidasi

- Git lock faylni «eskirgan» deb faraz qilma: egasi, yoshi va aktiv `git`
  jarayonini tekshir. Aktiv jarayon bo'lsa — kutasan, o'chirmaysan.
- Ikki ishchi bir yo'lni xohlasa — orkestrator `ACTIVE_TASKS.json` da
  ketma-ketlik belgilaydi; parallel emas.
- Dirty user fayllar (Excel, DOCX, PDF, wrangler, biznes fayllar) hech qachon
  `git reset --hard` / `git clean` / `stash` qilinmaydi. Toza muhit kerak
  bo'lsa — alohida worktree.

---

## 11. KO'P MASHINA — noutbuk va ishxona PC bitta liniyada  ⭐ v2

Agentlar ikki xil mashinada ishlaydi (noutbuk, ishxona PC) va bir xil agent
ikkala mashinada ochilishi mumkin. Liniya bitta bo'lib qolishi uchun:

### 11.1 Liniya — git remote, boshqa hech narsa emas

```text
github.com/SQLI-DUMPER-CRACK-Link-1/Smeta-tizimi
```

Mashinalar bir-birini ko'rmaydi, umumiy disk yo'q, chat umumiy emas. Ular
faqat shu remote orqali gaplashadi. **Lokal, push qilinmagan holat — aloqa
emas.** Ish tugadi deyishdan oldin `git push` shart.

### 11.2 Mashina identifikatori majburiy

Har bir mailbox fayli nomida va sarlavhasida mashina ko'rsatiladi:

```text
ops/mailbox/HERM-001/02-hermes@pc.md
```

```markdown
---
agent:   hermes
mashina: pc-ishxona          # yoki: noutbuk
sana:    2026-09-09T14:20Z
branch:  hermes/t2-pto-closure-v1
sha:     12a9629
---
```

Sababi: bitta agent ikkala mashinada ochilsa, kim nima qilganini ajratib
bo'lmay qoladi va ikkalasi bir faylni yozib, bir-birini bosib ketadi.

### 11.3 Bitta task — bitta mashina

`ACTIVE_TASKS.json` dagi har bir aktiv task ixtiyoriy `machine` maydonini
oladi. Taskni olayotgan mashina uni **o'ziga yozadi va push qiladi** —
shundan keyingina ishni boshlaydi:

```json
{ "id": "HERM-001", "owner": "hermes", "machine": "pc-ishxona", "status": "active" }
```

Agar `machine` band bo'lsa, ikkinchi mashina o'sha taskni **olmaydi**.
Band bo'lgan mashinada ish tashlab ketilgan bo'lsa — mailboxda so'raydi,
o'zi bosib olmaydi.

### 11.4 Har sessiya boshida (qaysi mashina bo'lishidan qat'i nazar)

```bash
git fetch origin main
git log --oneline -5 origin/main          # boshqa mashina nima qildi?
cat ops/mailbox/INBOX.md                  # menga nima kutmoqda?
node -e "require('./ops/ACTIVE_TASKS.json').tasks.filter(t=>['active','in_progress','ready_for_review'].includes(t.status)).forEach(t=>console.log(t.id,t.owner,t.machine||'-',t.status))"
```

Ish oxirida:

```bash
node ops/governance-check.cjs
git push -u origin <branch>
# mailboxga DONE/BLOCKER yozib, uni ham push qil
```

### 11.5 Mashinalar orasida ishni topshirish

Noutbukda boshlangan ish PCda davom etsa:

1. Noutbuk: ishni commit + push qiladi (yarim bo'lsa ham — `WIP:` prefiksi bilan).
2. Noutbuk: `NN-<agent>@noutbuk.md` ga yozadi — `STATUS: HANDOFF`, branch,
   sha, nima qilingan, nima qolgan, keyingi aniq qadam.
3. Noutbuk: `ACTIVE_TASKS.json` da `machine` ni bo'shatadi, push qiladi.
4. PC: `git fetch` → o'sha faylni o'qiydi → `machine: pc-ishxona` yozib
   push qiladi → davom etadi.

**Hech qachon:** «PCda qoldirgandim, o'zi topadi» deb ishni yozmasdan
tashlab ketish. Yozilmagan ish — yo'q ish.

### 11.6 Ikkala mashina baravar ishlaganda

Ruxsat, lekin faqat `owns` yo'llari kesishmasa. `governance-check.cjs`
kesishuvni FAIL qiladi — uni chetlab o'tma. Rebase qoidasi:

```bash
git fetch origin main && git rebase origin/main    # merge emas, rebase
```

Konflikt bo'lsa — hal qil, `--force` bilan boshqaning ishini bosma.

---

## 12. Agentga birinchi xabar (copy-paste shablon)

Odam ixtiyoriy agentga (Hermes/Codex/Claude/Antigravity) shuni beradi:

```text
Repo:    github.com/SQLI-DUMPER-CRACK-Link-1/Smeta-tizimi
Mashina: <noutbuk | pc-ishxona>
Task:    <TASK-ID>
Branch:  <agent>/<qisqa-nom>

Avval shularni o'qi: AGENTS.md → docs/governance/CONSTITUTION.md →
docs/governance/CURRENT_STATE.md → docs/governance/AGENT_COMMS_PROTOCOL.md →
ops/ACTIVE_TASKS.json → ops/handoff/<TASK-ID>.md

Keyin ops/mailbox/<TASK-ID>/ ga ACK yoz (fayl nomi: NN-<agent>@<mashina>.md),
ACTIVE_TASKS.json da machine maydoniga o'z mashinangni yoz va push qil.
Shundan keyin ishni boshla. Production migration/deploy/destructive amalni
o'zing bajarma.
```
