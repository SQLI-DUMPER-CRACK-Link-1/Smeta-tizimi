# T2 PTO RES narxlash — Codex handoff

## Branch va commit

- **Branch:** `codex/t2-res-pricing-v1`
- **HEAD:** `0b5b584fec8fa18da78e2a2ac8ba87269ad5d087`
- **Base:** `origin/integration/next-main-release-v1` @ `50e1fb72a81e187ba495865ce8515b13603dd9be`
- **Main/production:** tegilmagan.

## PTO foydalanuvchi yo‘li

`/admin/smeta-narxlash` sahifasi obyektning faqat narxi `NULL` yoki `0`
bo‘lgan `rs`/`mat`/`ob` resurs qatorlarini RES faylidan narxlaydi.

1. PTO kanonik obyektni tanlaydi.
2. RES XLSX/XLS faylini yuklaydi; bir nechta RES varaqlarini tanlashi mumkin.
3. Tizim yozishdan **oldin** exact preview ko‘rsatadi.
4. Faqat aniqligi isbotlangan qatorlar yoziladi.
5. Nom/birlik/kod mos bo‘lmasa, bir RES kalitida turli narx bo‘lsa yoki
   identifikatsiya yetarli bo‘lmasa, qator narxsiz qoladi va sababi ko‘rinadi.

Preview RS/MAT/OB bo‘yicha `mos / narxsiz` hisobini hamda ko‘pi bilan 100 ta
moslashmagan qatorni ko‘rsatadi. Bu foydalanuvchiga RESni tuzatish uchun
aniq ro‘yxat beradi; hech qachon pozitsiya, qator raqami yoki “birinchi topilgan”
narxdan foydalanmaydi.

## V2: haqiqiy RES farqlari uchun qo‘lda, isbotli bog‘lash

2026-09-08 dagi read-only production inventory shuni ko‘rsatdi:
`t2_smeta_narxla_res_v1(bigint,bigint,bigint,uuid,jsonb)` jonli bazada
allaqachon bor. Shuning uchun V1 imzosi o‘zgartirilmadi va overload ham
yaratilmadi. PostgREST uchun xavfsiz yo‘l — yangi V2 nomli funksiya:

`supabase/migrations/20261011140000_t2_smeta_narxla_res_v2.sql`

- avtomatik yo‘l o‘sha qat’iy `kod + nom + birlik` qoidasini saqlaydi;
- mos kelmagan satr uchun PTO aynan yuklangan RES satrini qo‘lda tanlaydi;
- browser narxni erkin kiritmaydi: faqat `source_ref` yuboradi;
- server `source_ref` aynan import ichida borligini, satr obyekt/tenantniki,
  `rs/mat/ob`, narxi `NULL/0` ekanini qayta tekshiradi;
- qo‘lda bog‘lash avtomatik aniq moslikni bosib o‘ta olmaydi;
- bir target yoki source ref takrorlansa rad etiladi;
- audit, idempotent `operation_id`, F2 va nom daxlsizligi saqlanadi.

V2 uchun `.acceptance.sql` va post-use holatda rad etuvchi
`.rollback.sql` ham bor. Bu branch productionga hech narsa qo‘llamadi.

## Server contract

Manba migratsiya:

`supabase/migrations/20261011130000_t2_smeta_narxla_res_v1.sql`

RPC: `t2_smeta_narxla_res_v1`.

- actor Cloudflare sessiyasidan olinadi; client actor yubora olmaydi;
- obyekt kompaniyasi va DB a’zoligi tekshiriladi;
- ruxsatli rollar: `admin`, `superadmin`, `boss`, `director`, `pto`;
- `operation_id` idempotent receipt bilan himoyalangan;
- mavjud narx, F2/certified tarix va qator nomi o‘zgarmaydi;
- `summa` faqat mavjud `hajm × aniq RES narxi` bilan yangilanadi;
- 5000+ qatorli obyekt signal-refresh timeoutiga kirmaydi;
- rollback faqat yangi functionni olib tashlaydi; mavjud biznes qatorlarini
  qaytarmaydi yoki o‘chirmaydi.

Productionga apply qilinmagan. Applydan oldin migrationning acceptance fayli
xavfsiz muhitda yoki release qoidalariga muvofiq tekshirilishi kerak.

## Validatsiya

- `res-narxlash.test.ts`: **6/6 PASS**.
- `t2_res_narxlash_v2.test.cjs`: **9/9 PASS**.
- Cloudflare Functions TypeScript gate: **PASS**.
- `npm run tekshir`: **PASS**.
- lint: **0 error**, avvaldan mavjud warninglar saqlangan.
- `git diff --check`: **PASS**.

Bu Windows sessiyasida keng `tsc -b` va `npm run build` bosqichi ikki marta
V8 `out of memory: Zone` bilan to‘xtadi. Fokuslangan Vitest va functions
type gate o‘tdi; bu manba xatosi sifatida tasdiqlanmagan. Integrator yetarli
xotirali toza worktreeda to‘liq buildni qayta yuritishi shart.

## Integratsiya ogohlantirishi

`claude/t2-final-clean-cutover` @ `c530650` bazasiga trial cherry-pick
qilindi, lekin unda RESga aloqasiz `t2_security_p0` regressiyasi hamda
eskirgan route/RPC ro‘yxati aniqlandi. Shu sabab o‘sha trial branch
**push qilinmadi** va uning diffi integratsiya uchun manba emas.

Avval `origin/integration/next-main-release-v1`ning hozirgi headini yangilang,
so‘ng ushbu branchni qayta ko‘rib chiqing. F2/LRV mavjud native yo‘llarini
almashtirib yubormang; faqat RES sahifasi, route, menu, allowlist va named
write gatewayni semantic ravishda birlashtiring.
