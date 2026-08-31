# TIZIM_02 — Agentlararo aloqa tizimi (Agent Communication Protocol v1)

Status: ACCEPTED (v1) · Owner: Claude (Chief Architect) · Last checked: 2026-08-31

Bu hujjat **agentlar bir-biri bilan qanday gaplashishini** belgilaydi: Claude
(arxitektor/orkestrator), Codex (backend/DB/release), Antigravity/Gemini
(frontend/mexanik ish). U governance boot zanjirining bir qismi va
`AGENTS.md` → `CONSTITUTION.md` → `CURRENT_STATE.md` → `ops/ACTIVE_TASKS.json`
qatoriga bo‘ysunadi. Konflikt bo‘lsa Constitution ustun turadi.

---

## 1. Asosiy qonunlar

1. **Yagona haqiqat manbai — repozitoriy.** Agentlararo hamma rasmiy aloqa
   git ичида fayl sifatida yashaydi. Chat/terminaldagi gap — kontekst, dalil
   emas.
2. **Har bir xabar bitta ref ustida ko‘rinadi.** "Qayta ishga tush, o‘zi
   topib oladi" — taqiqlangan. Ishchi faqat o‘zi checkout qilgan ref’dagi
   faylni ko‘radi. Handoff har doim `repo + base_sha + branch + fayl yo‘li`ni
   ko‘rsatadi.
3. **`tizim02/MULOQOT.md` — TARIX.** U append-only jurnal. Aktiv vazifa
   navbati emas, joriy holat emas.
4. **Mashina o‘qiydigan holat — `ops/ACTIVE_TASKS.json`.** Odam o‘qiydigan
   handoff — `ops/handoff/<TASK-ID>.md`. Javob/hodisa — `ops/mailbox/`.
5. **Bir vaqtda bitta aktiv P0.** Parallel ish faqat `owns` yo‘llari
   kesishmasa ruxsat etiladi.

---

## 2. Kataloglar tuzilishi

```text
ops/
  ACTIVE_TASKS.json          # yagona task-lock reestri (governance-v2 sxema)
  governance-check.cjs       # handoffdan oldin majburiy tekshiruv
  handoff/
    <TASK-ID>.md             # Claude -> ishchi: to‘liq ish paketi (pastdagi shablon)
  mailbox/
    <TASK-ID>/
      01-claude.md           # Claude yozadi (topshiriq, savolga javob, review)
      02-codex.md            # Codex yozadi (progress, blocker, PASS/FAIL, savol)
      03-claude.md           # ...raqamlangan, append-only, hech qachon o‘chirilmaydi
    INBOX.md                 # ochilmagan e'tibor talab qiladigan bandlar ro‘yxati
  releases/
    <MILESTONE>.md           # release paketi: migr/rollback/acceptance/smoke/risk
```

Faqat `ops/ACTIVE_TASKS.json` va `ops/mailbox/INBOX.md` — "jonli indeks".
Qolgani append-only.

---

## 3. Rollar va yo‘nalishlar

| Kim | Rol | Kimga yozadi | Nimani hal qiladi |
|---|---|---|---|
| Odam | Product Owner + domen eksperti | Claude | biznes yo‘nalish, ustuvorlik, prod/destructive approval |
| Claude | Chief Architect / orkestrator | handoff/, mailbox/, ACTIVE_TASKS.json | arxitektura, kontrakt, ketma-ketlik, review, integratsiya |
| Codex | Senior backend/DB/release | mailbox/<TASK>/NN-codex.md | o‘z `owns` yo‘llari ичидаги implementatsiya |
| Antigravity | Frontend/mexanik CRUD | mailbox/<TASK>/NN-antigravity.md | berilgan kontrakt bo‘yicha UI |

**Ishchi arxitekturani belgilamaydi.** Yangi jadval/RPC/kontrakt kerak bo‘lsa —
mailboxda savol yozadi, Claude javob beradi yoki ADR chiqaradi.

Odam agent dispecheri emas. Claude ishchiga bitta to‘liq paket beradi,
15 ta mayda prompt emas.

---

## 4. Xabar hayotiy sikli

```text
Claude:  ops/handoff/<TASK-ID>.md yozadi
      -> ops/ACTIVE_TASKS.json ga task qo‘shadi (status: assigned)
      -> ops/mailbox/<TASK-ID>/01-claude.md: "boshla" + kontekst
Odam:    Codexga bitta copy-paste handoff beradi (repo/branch/task/objective)
Codex:   branch checkout, must_read o‘qiydi
      -> 02-codex.md: "ACK, boshladim" (ixtiyoriy progress yozuvlari)
      -> blocker bo‘lsa: 02-codex.md da BLOCKER: <sabab> + kutilayotgan qaror
Claude:  03-claude.md: javob / kontrakt aniqlashtirish
Codex:   ish tugadi -> NN-codex.md: "DONE" + diff summary + test natijalari
      -> ACTIVE_TASKS.json status: review
Claude:  diff review -> NN-claude.md: PASS yoki CHANGES-REQUESTED: <ro‘yxat>
Codex:   tuzatadi -> qayta DONE
Claude:  integratsiya -> ACTIVE_TASKS.json status: integrated
      -> release kerak bo‘lsa ops/releases/<MILESTONE>.md tayyorlaydi
      -> odamdan BITTA marta: "PROD READY — APPROVE?"
```

---

## 5. `ops/mailbox/INBOX.md` formati

E'tibor talab qiladigan ochiq bandlar. Hal bo‘lgani darhol olib tashlanadi.

```markdown
# INBOX — ochiq bandlar

| Sana (UTC) | TASK | Kim kutmoqda | Nima kerak | Fayl |
|---|---|---|---|---|
| 2026-08-31 | STOR-001 | Claude <- Codex | RLS policy nomlanishi tasdiqlansin | ops/mailbox/STOR-001/04-codex.md |
```

---

## 6. Handoff shabloni — `ops/handoff/<TASK-ID>.md`

Har bir ishchi vazifasi shu 13 bo‘limga ega bo‘lishi shart:

```markdown
# <TASK-ID> — <sarlavha>

- TASK ID:              <STOR-001>
- OWNER:                <codex | antigravity>
- OBJECTIVE:            <bir jumla: nima ishlaydigan bo‘lishi kerak>
- REPO:                 github.com/SQLI-DUMPER-CRACK-Link-1/Smeta-tizimi
- BASE REF / SHA:       <origin/main @ 37e5f0e...>
- WORK BRANCH:          <codex/...>
- REQUIRED READING:     AGENTS.md, CONSTITUTION.md, CURRENT_STATE.md,
                        ACTIVE_TASKS.json, <tegishli ADR>
- OWNED PATHS:          <faqat shu yo‘llarni tahrirlash mumkin>
- DO-NOT-TOUCH:         <boshqa ishchilarning yo‘llari, dirty user fayllar>
- ARCHITECTURAL INVARIANTS:
    - <masalan: yangi T2 kompaniya hech qachon global ROOT_FOLDER_ID meros olmaydi>
    - <name != identity; faqat stored external ID bo‘yicha qidiruv>
    - <interaktiv yo‘lda yangi sinxron O(n) skan yo‘q>
- IMPLEMENTATION BOUNDARY:  <qayerda to‘xtash; nimani qilmaslik>
- TESTS:               <qaysi testlar yashil bo‘lishi; qanday yangi test>
- ACCEPTANCE:          <ob'ektiv o‘lchov: masalan "global Drive fallback = 0
                        legacy-only koddan tashqari">
- FORBIDDEN ACTIONS:   prod migratsiya qo‘llash, main push, lock o‘chirish,
                        git reset --hard, boshqa worktree fayllarini tozalash
- EXPECTED FINAL OUTPUT: <branch push + mailbox DONE + diff summary + test log>
```

Ishchi **DONE** yoki **haqiqiy BLOCKER**gача davom etadi. "Yana ish qoldi"
bloker emas.

---

## 7. Haqiqiy blocker ta'rifi (faqat shular)

1. odamning biznes qarori kerak
2. tashqi kredensial/ruxsat yo‘q
3. prod/destructive approval kerak
4. davom etish ma'lumot yo‘qotishi / xavfsizlik buzilishi bilan tahdid qiladi
5. muqarrar uchinchi tomon bog‘liqligi to‘sib turibdi

Boshqa hamma holatda — **ishni davom ettir**.

---

## 8. Status leksikasi (hech qachon aralashtirilmaydi)

`SOURCE READY` · `TESTED` · `BRANCH PUSHED` · `MERGED TO MAIN` ·
`DB MIGRATION APPLIED` · `GAS DEPLOYED` · `CLOUDFLARE DEPLOYED` ·
`LIVE SMOKE VERIFIED`.

Dalil tili: `VERIFIED LOCAL` / `VERIFIED REMOTE` / `VERIFIED PRODUCTION` /
`REPORTED BUT NOT YET VERIFIED`.

---

## 9. governance-check majburiyati

Har handoff va har DONEdan oldin ishchi `node ops/governance-check.cjs`
ishga tushiradi. `owns` ro‘yxatidan tashqari fayl tegilgan bo‘lsa — FAIL,
handoff to‘xtaydi.

---

## 10. Konflikt va lock qoidasi

- Git lock faylni hech qachon "eskirgan" deb faraz qilma. Egasi, yoshi va
  aktiv `git` jarayonini tekshir. Aktiv jarayon bo‘lsa — kutasan, o‘chirmaysan.
- Ikki ishchi bir yo‘lni xohласа — Claude `ACTIVE_TASKS.json`da ketma-ketlik
  belgilaydi; parallel emas.
- Dirty user fayllar (Excel, DOCX, PDF, wrangler, biznes fayllar) hech qachon
  `git reset --hard` / `git clean` / `stash` qilinmaydi. Toza muhit kerak
  bo‘lsa — alohida worktree.
