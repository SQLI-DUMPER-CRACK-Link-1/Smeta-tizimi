# T2 main konsolidatsiya auditi — 2026-09-16

## Maqsad

`origin/main`dagi amaldagi TIZIM_02 kodini agent branchlari bilan solishtirish,
faqat hozirgi kanonik modelga mos, test bilan isbotlangan va xavfsiz foydali
ishlarni birlashtirish. Bu hujjat yangi feature sprint emas, release
konsolidatsiyasi dalilidir.

## Boshlang‘ich holat

- Boshlang‘ich main: `5e7a1af2cccfc35f8255c5620b2eaf86e2525f7b`.
- `origin/integration/next-main-release-v1` uchi main tarkibida allaqachon bor;
  integration alohida yangi kod sifatida main’dan oldinda emas.
- Ish toza alohida worktree’da bajarildi; foydalanuvchining asosiy dirty
  worktree’si o‘zgartirilmadi.

## Main’da allaqachon mavjud deb tasdiqlangan yo‘nalishlar

- Tree V2: edit, selection, expand/collapse va drag/drop mosligi saqlangan.
- F2 exact source: hujjatdagi summa qayta hisoblanmaydi; pre-approval faqat
  istisnolarni ko‘rsatadi.
- Nakopitelniy, Change Control, Workbench, Document Center va private R2
  konfiguratsiyasi kanonik yo‘lga ulangan.
- Company context, authorization guard va System Control bo‘yicha keyingi
  integratsiya main tarixida mavjud.
- Resurs kategoriyasi, LRV export, slichitelniy va PTO hujjat zanjirining
  asosiy source/test qismlari main’da mavjud.

## Shu konsolidatsiyada bajarilgan xavfsiz tuzatishlar

1. `f2ExactPayloadQur()` endi bir kanonik qatorga bir nechta turli
   sertifikatlangan narx tushsa, payload qaytarmaydi. Oldingi narxni jim tanlash
   mumkin emas; qatorlar ko‘rib chiqishga qaytariladi.
2. Eski va native F2 yozish chaqiruvchilari yangi konflikt natijasini alohida
   va foydalanuvchiga tushunarli ko‘rsatadi. Mavjud exact summa, narxsiz qator
   va qisman summa himoyalari saqlanadi.
3. RES oldindan ko‘rishida moslashmagan qatorlarning sababi, RS/MAT/OB kesimi
   va kodsiz RES manbasining nom+birlik bo‘yicha xavfsiz moslashuvi ko‘rsatiladi.
   Bu backend/RPC haqiqatini almashtirmaydi va narxni taxminan yozmaydi.

## Ataylab main’ga qo‘shilmagan branchlar

- Patch-ekvivalent ishlari allaqachon main’da bor bo‘lgan branchlar qayta
  cherry-pick qilinmadi.
- Eski Tree V1, Product Recovery V2, eski F2 approval va eski LRV price/core
  branchlari yangi main bilan regressiya yoki parallel truth xavfini beradi.
- RES manual-binding V2 va `БЕЗСКЛАД` branchlari yangi production migration,
  live acceptance va ayrim canonical writer dalillariga bog‘liq; ularni faqat
  source branch borligi uchun main’ga qo‘shish release xavfsizligi talabiga zid.
- Hermes/MCP konfiguratsiyasi va construction expansion branchlari product
  release kodidan alohida qoladi.

## Hali dalil talab qiladigan yo‘nalishlar

- Owner sessiyasi bilan Preview/Production authenticated vertical smoke.
- Google Drive/Sheets haqiqiy ikki tomonlama sinxron round-trip.
- GAS’dan to‘liq chiqish (`T2-GAS-EXIT-001`).
- `FORMA3_RULE_UNRESOLVED` uchun vakolatli huquqiy manba.
- `БЕЗСКЛАД` writer va RES manual binding uchun live migration/readback.

## Chegaralar

- Production biznes qatorlariga yozilmadi.
- Secretlar o‘qilmadi, chiqarilmadi yoki almashtirilmadi.
- Main’ga force push qilinmaydi.
