# SMETA ANATOMIYA — ishning ikki qismi (2026-09-25)

Egasi: "ishlarni ideal davom ettirish… 2 qismga bo'l… ideal production darajasida".
Ikki agent parallel ishlaydi; **fayl egaligi kesishmaydi**. Yagona aloqa — git remote
(`AGENT_COMMS_PROTOCOL.md` §11). Push qilinmagan ish — aloqa emas.

| Qism | Kim | Qayerda | Vazifa ID | Branch |
|---|---|---|---|---|
| **A** | GitHub agenti | faqat repo (real fayllar, Excel, login YO'Q) | `SMETA-ANAT-002-A` | `claude/t2-oferta-v2` → PR lar |
| **B** | Claude (noutbuk) | real korpus, Excel, egasining brauzer sessiyasi | `SMETA-ANAT-001` | `claude/smeta-anatomiya-v1` |

## Hozirgi holat (main `4e6dcce` + ushbu commit)

- `frontend/src/lib/smeta-anatomiya/` — yagona o'qish moduli (kontrakt:
  `docs/architecture/SMETA_ANATOMIYA_V1.md`): varaq roli, ustun xaritasi, ichma-ich RZ yo'li
  (СМЕТА№ > РАЗДЕЛ > blok, raqam prefiksi, qayta raqamlash, guruh lookahead), titul, svod
  orqali obyekt (чел-ч isboti), erkin varaqlar (transport → svod formula havolasi).
- Smeta yuklash (`SmetaYuklaNative.tanlanganLrvVaraqlaridanDaraxtQur`) anatomiya daraxtini
  **tenglik qo'riqchisi** bilan ishlatadi: ish/resurs barglari eski `treeBuild` bilan aynan
  teng bo'lsagina ichma-ich RZ. Korpus: Navoiy 180/180, Faravon 18/18 LRV varaq teng.
- Eski `treeBuild` ABC4 "ВЕДОМОСТЬ РЕСУРСОВ" ni ish qilib qo'shardi (Navoiy STR 2 413 resurs
  ikki marta) — endi qo'shilmaydi.
- `sbT2TreeQur`: ota RZ smetasi = o'z ishlari + bola RZ lar. `t2_rollup` va obyekt jamilari
  (`t2_obyekt_jami`, `t2_ai_umumiy`, `t2_ai_kontekst`, `t2_mindmap_grafi` — BARCHA RZ ni
  qo'shadi) O'ZGARMAYDI: rollup rekursiv qilinsa ular IKKI MARTA sanaydi. Tegmang.
- LRV/Fakt: `useT2Daraxt` — fakt saqlanganda faqat taalluqli qatorlar holati o'qiladi,
  daraxt ekranda qoladi. LRV_PLUS eksportida `$` yo'q, bl qatorida G = birlik narxi.
- `lib/res-kategoriya.ts` main ga olindi (Oferta V2 dan), `SmetaYuklaNative` undan re-export.

---

## A QISMI — GitHub agenti

**Egalik (`owns`)** — faqat shular:
`frontend/src/lib/tender-oferta*.ts`, `frontend/src/lib/nakrutka-kaskad*.ts`,
`frontend/src/lib/res-kategoriya*.ts`, `frontend/src/admin/sahifalar/OfertaNative*.tsx`,
`frontend/src/lib/ostatka-export*.ts`, `frontend/src/api/supabase.ts`,
`frontend/src/api/supabase*.test.ts`, `frontend/src/umumiy/daraxt/useT2Daraxt*.ts`,
`frontend/src/admin/sahifalar/HolatNative.tsx`, `frontend/src/admin/sahifalar/FaktNative.tsx`,
`frontend/.oxlintrc.json` (A4 uchun), `docs/governance/CURRENT_STATE.md`.

**TEGMANG:** `frontend/src/lib/smeta-anatomiya/**`, `SmetaYuklaNative*`,
`smeta-source-analysis*`, `smeta-lrv-boundary*`, `f2-import-parse/**`, `smeta-package-import*`
(B qismi). Anatomiya modulidan faqat `index.ts` eksportlari orqali FOYDALANING; unga o'zgarish
kerak bo'lsa — `ops/mailbox/SMETA-ANAT/` ga so'rov yozing.

### A1. Oferta V2 ni tugatish (eng muhim)
Branch `claude/t2-oferta-v2` (`023e7db`, eski asos `6813e57`). Qadamlar:
1. `origin/main` ga rebase. `SmetaYuklaNative.tsx`/`.test.ts`/`res-kategoriya.ts` bo'yicha
   konfliktda **main versiyasini oling** (ko'chirish allaqachon main da).
2. `tender-oferta-parser.ts` o'z sarlavha/ustun/rol aniqlashini tashlab, `smeta-anatomiya`
   dan foydalansin: `kitobAnatomiyasi()` → varaq roli (`res`/`lrv`/`transport`/`erkin`/`svod`),
   `ustunlar`, `vedomost`, `jamilar`, `erkin[]` (transport yakuniysi + svod qatori).
   Oferta faqat Oferta ga xos narsani qiladi: kategoriya, taklif narxi, kaskad.
   Yiqilgan test ("RESURS_VEDOMOST: nom ustuni…") sababi: `columnHeader` ma'lumot qatorini
   (kod ustunida `ЦЕНА`) sarlavhaga qo'shib yuborardi — anatomiyaning `sarlavhaBlokiniTop`
   bu xatodan xoli (tartib-raqam qatori chegarasi, ≥2 sonli qator sarlavha emas).
3. `OfertaNative.tsx` ni yangi API ga qayta yozish (hozir tsc xato beradi): kategoriya foizlari;
   qatorda kategoriya tanlash + БЕЗСКЛАД taklifini bir tugmada qabul; taklif hajmi inputi;
   "faqat muammolar" filtri; SOURCE TOTAL / DIRECT / kategoriyalar / kaskad / QQS / FINAL paneli;
   nakrutka koeffitsientlari (`t2NakrutkaKoefOl` kompaniya bo'yicha, bo'lmasa standart,
   tahrirlanadi); transport siyosati (kaskad|varaq); eksport natijasi `saqlanish` ko'rsatiladi.
4. Eksport (`tender-oferta-export.ts`) testlari:
   - o'zgarmagan ZIP qismlari bayt-bayt identik; o'zgargan varaqda barcha asl `<c>` identik;
   - `.xlsm` — `xl/vbaProject.bin` identik saqlanadi;
   - P0 regressiya: manba hajm bo'sh + override 10 × narx 800 000 → Excel formula TAKLIF
     HAJMI ustuniga qaraydi (sayt = Excel);
   - formulalarda `$` YO'Q (test: yozilgan varaqda `$` li formula soni = 0);
   - ish qatorida summa ustunidan oldingi bo'sh katakda `=IF(N(hajm)=0,"",summa/hajm)`;
   - yangi ustunlar uslubi qo'shni asl ustundan klonlanadi, yangi rang o'ylab topilmaydi.
5. Excel COM (CalculateFull) va real fayllar bilan tekshiruv A da MUMKIN EMAS —
   `REAL_BINARY_UNKNOWN` deb qoldiring, soxta PASS yozmang. B qismi tekshiradi.

### A2. Katta obyektning birinchi ochilishi (~12 s → maqsad < 4 s)
O'lchov (Suniy Ko'l, 27 309 qator): `/api/sb` t2_daraxt server 7.0 s / brauzer 11.8 s,
t2_qator_holat 9.0 / 12.7 s, `soro=3` (Supabase max-rows 10 000), `toliq:true`.
- `sbT2DaraxtOl` va `sbT2QatorHolatOl` ga faqat kerakli ustunlar (`ustunlar`), barcha
  iste'molchilarni (`sbT2TreeQur`, `lrvPlusFaylBaytlari`, FaktNative markerlari, eksport
  kontekstlari) grep bilan tekshirib — ishlatilmaydigan maydonni olib tashlash.
- Payload o'lchami va vaqtini testda/logda isbotlang (oldin/keyin). Gateway `MAX_SORO`,
  sahifa hajmi mantig'iga tegmang (u to'g'ri).

### A3. Ostatka — smeta shaklida hujjat
`lib/ostatka-export.ts`: kanonik daraxt (ichma-ich RZ bilan) → smeta shaklidagi xlsx: har barg
`smeta − fakt`, RZ yo'li saqlanadi, formulalar nisbiy (`$` yo'q), ish qatorida birlik narxi.
`HolatNative` ga "Ostatka Excel" tugmasi (mavjud eksport gate'i bilan).

### A4. Lint qoidasi
`smeta-anatomiya/` va mavjud o'quvchilar (`f2-import-parse/xlsxReader.ts`) dan tashqarida
`xlsx`/`sheet_to_json` ni yangi joyda import qilishni taqiqlovchi qoida (mavjud joylar
ro'yxati bilan — keyin B ko'chiradi).

### A5. `CURRENT_STATE.md`
Governance ogohlantirishi: `main_sha` eskirgan. Yangi addendum (eski yozuvlar o'zgarmaydi):
yuqoridagi "Hozirgi holat" + o'lchangan raqamlar.

---

## B QISMI — Claude (noutbuk)

`SMETA-ANAT-001` owns: `smeta-anatomiya/`, `SmetaYuklaNative*`, `smeta-source-analysis*`,
`smeta-lrv-boundary*`, `f2-import-parse/**`, `smeta-package-import*`, `vitest.config.ts`.

- **B1.** "Suniy Ko'l 2" (obyekt 91) ga STR importi — egasining sessiyasi bilan jonli smoke:
  ierarxiya hisoboti, 24 324 barg, vedomost 2 413 chiqarildi, vaqt/qotish o'lchovi.
- **B2.** Yagona yuklash liniyasi: bitta fayl / ko'p fayl / papka → `Fayl[]` → anatomiya →
  bitta tekshiruv ekrani → bitta server buyrug'i. O'qish Web Worker da.
- **B3.** RES ni checkbox bilan BIR NECHTA LRV ga bog'lash (faqat operator tick qilganda;
  "RES hech qachon boshqa LRV ga avtomatik tarqatilmaydi" qoidasi saqlanadi).
- **B4.** Korpus manifesti (sha256 + kutilgan natijalar, real fayllar repoda EMAS), profillar.
- **B5.** A1 eksportini Excel COM (CalculateFull) + real fayllar (office PC
  `C:\Temp\oferta-real\`) bilan tekshirish → OFERTA_JAMI yakuniy == sayt, farq 0.
- **B6.** F2 import, RES narxlash, Nakopitelniy ni anatomiyaga ko'chirish (A4 ro'yxati bo'yicha).

## Ikkala qism uchun qonunlar

- `AGENTS.md` boot protokoli; `node ops/governance-check.cjs` PASS.
- NULL ≠ 0; manba qiymati o'zgarmaydi; noma'lum pul → REVIEW; UI == Excel; matn o'zgarmaydi.
- Gate'lar (hammasi yashil bo'lmasa main ga YO'Q): `npx tsc -b`,
  `npx tsc -p tsconfig.functions.json --noEmit`, `npx oxlint` (0 error), `npm run tekshir`,
  `npm run build`, `npx vitest run` (to'liq), `git diff --check`.
- Egasi main push + Cloudflare deploy ga umumiy ruxsat bergan (gate'lar yashil bo'lsa).
  Deploy dan keyin: Cloudflare check `success`, `/api/soglik` ok, prod va preview build xeshi bir xil.
- **Production migratsiya, destruktiv DDL, real biznes ma'lumotiga yozish — alohida egasining
  ruxsati bilan.** `t2_rollup` va obyekt jami view/funksiyalariga tegmang (yuqoriga qarang).
- Parol/cookie so'ralmaydi va kiritilmaydi. Real smeta fayllari repoga qo'yilmaydi (repo public).
- Hisobot o'zbek tilida: BASE/FINAL/DEPLOYED SHA, har band PASS/FAIL/UNKNOWN, dalil bilan.
