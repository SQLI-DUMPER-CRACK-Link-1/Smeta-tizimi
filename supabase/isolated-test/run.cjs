#!/usr/bin/env node
/**
 * run.cjs — T2-LRV-CLOSURE-006 Section 2: repeatable isolated acceptance
 * workflow (reset -> apply migrations -> seed -> LRV acceptance -> teardown).
 * ═══════════════════════════════════════════════════════════════════
 *
 * HOLAT: preflight qatlamlari (guard + baseline tekshiruvi + migration
 * ro'yxati) HAQIQIY va ISHLAYDIGAN. Seed/acceptance/teardown qatlamlari
 * ATAYLAB "NOT_IMPLEMENTED" bilan to'xtaydi — soxta PASS ko'rsatishdan
 * ko'ra, aniq ISHLAMAYDI deb aytish afzal (vazifa qoidasi: "do not fake
 * DB PASS"). Bu skript hech qachon productionga ulanmaydi (1-qatlam —
 * `env-guard.cjs` — buni fail-closed kafolatlaydi).
 *
 * ANIQLANGAN QO'SHIMCHA TO'SIQ (bu faylni yozishda topildi, Docker/Pro
 * plan yo'qligidan MUSTAQIL): `supabase/migrations/` o'zi YOLG'IZ bo'sh
 * Postgresni ishga tushira olmaydi — asos jadvallar (t2_kompaniya,
 * t2_obyekt, t2_qator, t2_foydalanuvchi, t2_azolik va h.k.) uchun BIRON
 * CREATE TABLE shu papkada yo'q (tekshirildi: grep -i "create table.*
 * t2_(kompaniya|qator)" supabase/migrations/*.sql -- 0 natija). Sabab
 * `supabase/baseline/README.md`da yozilgan: bu loyiha o'z kanonik
 * migration daraxtidan OLDIN mavjud bo'lgan, va "reviewed `supabase db
 * pull`" bazasi hali OLINMAGAN/TASDIQLANMAGAN. Shuning uchun bu skript
 * ishlashi uchun: (a) shunday tasdiqlangan baseline dump kerak (env
 * ISOLATED_BASELINE_SQL orqali ko'rsatiladi), YOKI (b) migration
 * ro'yxati boshida asos jadvallar DDL'i qo'shilishi kerak — ikkalasi
 * ham egasining arxitektura qarori, bu yerda o'zboshimchalik bilan hal
 * qilinmaydi.
 *
 * ISHLATISH (isolated DB va baseline mavjud bo'lganda):
 *   ISOLATED_TEST_DATABASE_URL=postgres://...localhost:54322/postgres \
 *   ISOLATED_BASELINE_SQL=/path/to/production_schema_baseline.sql \
 *   node run.cjs
 *
 * `ISOLATED_BASELINE_SQL` fayli bilan bir qatorda
 * `supabase/baseline/production_schema_baseline.manifest.json` (2026-09-04,
 * shu round yozildi) ham o'qiladi -- uning `pending_migrations_not_yet_applied_to_production`
 * ro'yxati production'ning HAQIQIY applied-migration tarixi bilan solishtirib
 * chiqarilgan (o'zboshimchalik EMAS, `inventory/repo_migration_reconciliation.json`ga
 * qara). Baseline tiklangach FAQAT o'sha ro'yxatdagi fayllar qo'llanadi --
 * `included_migrations`dagilar QAYTA QO'LLANMAYDI (baseline'da allaqachon bor).
 */

const fs = require('fs');
const path = require('path');
const { productionEmasliginiTekshir } = require('./env-guard.cjs');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const MANIFEST_PATH = path.join(__dirname, '..', 'baseline', 'production_schema_baseline.manifest.json');

function log(qadam, xabar) {
  console.log(`[${qadam}] ${xabar}`);
}

function forwardMigrationlarniRoyxatQil() {
  // Faqat forward migration -- .rollback.sql / .acceptance.sql o'tkazib
  // yuboriladi (ular alohida, qo'lda/keyingi bosqichda ishlatiladi).
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && !f.endsWith('.rollback.sql') && !f.endsWith('.acceptance.sql'))
    .sort(); // fayl nomlari timestamp bilan boshlanadi -- leksik tartib = xronologik tartib
}

async function main() {
  // ── QATLAM 1: production guard (fail-closed, HECH QACHON o'tkazib yuborilmaydi) ──
  const manzil = process.env.ISOLATED_TEST_DATABASE_URL || '';
  const guardNatija = productionEmasliginiTekshir(manzil);
  if (!guardNatija.ok) {
    log('GUARD', '❌ ' + guardNatija.xabar);
    process.exit(1);
  }
  log('GUARD', '✅ Manzil production emas.');

  // ── QATLAM 2: baseline preflight (haqiqiy tekshiruv, soxta emas) ──
  const baselineSql = process.env.ISOLATED_BASELINE_SQL || '';
  if (!baselineSql) {
    log(
      'BASELINE',
      '⚠️  ISOLATED_BASELINE_SQL berilmagan. supabase/migrations/ o\'zi YOLG\'IZ ' +
      'asos jadvallarni (t2_kompaniya, t2_obyekt, t2_qator, ...) yaratmaydi -- ' +
      'sabab supabase/baseline/README.md da: loyiha o\'z migration daraxtidan ' +
      'OLDIN mavjud, "reviewed supabase db pull" bazasi hali yo\'q. Bu -- ' +
      'egasining arxitektura qarori (Section 1-dagi Docker/Pro-plan tanlovidan ' +
      'MUSTAQIL, alohida). Davom etib bo\'lmaydi.',
    );
    log('RESULT', 'BASELINE_REQUIRED -- aniq blocker, DB ulanmadi, hech narsa yozilmadi.');
    process.exit(1);
  }
  if (!fs.existsSync(baselineSql)) {
    log('BASELINE', `❌ ISOLATED_BASELINE_SQL ko'rsatilgan, lekin fayl topilmadi: ${baselineSql}`);
    process.exit(1);
  }
  log('BASELINE', `✅ Baseline topildi: ${baselineSql} (mazmuni bu skriptda TEKSHIRILMAYDI -- egasi tomonidan reviewed deb belgilangan bo'lishi kerak).`);

  // ── QATLAM 3: manifest orqali FAQAT pending migratsiyalarni aniqlash ──
  // Manifest yo'q bo'lsa -- eski, kamroq aniq xatti-harakatga qaytamiz (BARCHA
  // forward migratsiya, ogohlantirish bilan): bu holatda baseline'ning o'zi
  // qaysi migratsiyalarni allaqachon o'z ichiga olganini bilmaymiz.
  const barchaMigratsiyalar = forwardMigrationlarniRoyxatQil();
  let qollanadiganMigratsiyalar = barchaMigratsiyalar;
  if (fs.existsSync(MANIFEST_PATH)) {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    const pending = new Set(manifest.pending_migrations_not_yet_applied_to_production || []);
    qollanadiganMigratsiyalar = barchaMigratsiyalar.filter((f) => pending.has(f));
    log(
      'MANIFEST',
      `✅ ${MANIFEST_PATH} topildi -- baseline_sql_status=${manifest.baseline_sql_status}. ` +
      `${barchaMigratsiyalar.length} ta forward migratsiyadan ${qollanadiganMigratsiyalar.length} ` +
      `tasi baseline'da YO'Q (pending) -- faqat shular qo'llanadi, qolganlari baseline'da allaqachon bor.`,
    );
  } else {
    log(
      'MANIFEST',
      `⚠️  ${MANIFEST_PATH} topilmadi -- barcha ${barchaMigratsiyalar.length} forward migratsiya ` +
      `qo'llanadi deb hisoblanadi (baseline qaysi migratsiyalarni allaqachon o'z ichiga olishi noma'lum). ` +
      `Bu XATOLI natija berishi mumkin agar baseline aslida keyingi migratsiyalarning ba'zilarini ham qamrab olgan bo'lsa.`,
    );
  }
  log(
    'MIGRATIONS',
    qollanadiganMigratsiyalar.length
      ? `${qollanadiganMigratsiyalar.length} ta qo'llanadigan migratsiya: ${qollanadiganMigratsiyalar[0]} .. ${qollanadiganMigratsiyalar[qollanadiganMigratsiyalar.length - 1]}.`
      : '0 ta qo\'llanadigan migratsiya qoldi -- baseline hammasini allaqachon qamrab olgan.',
  );

  // ── QATLAM 4+: DB ulanish, migratsiya qo'llash, seed, acceptance, teardown ──
  // Bu yerdan pastda HAQIQIY Postgres ulanish (node-postgres) kerak bo'ladi.
  // Bu bosqichda (isolated DB hali mavjud emas, T2-LRV-CLOSURE-006 Section 1)
  // ATAYLAB amalga oshirilmagan -- soxta "PASS" chiqarish o'rniga aniq
  // NOT_IMPLEMENTED bilan to'xtatiladi. `pg` paketi package.json'da tayyor
  // turibdi -- isolated DB kelganda shu joydan davom ettiriladi:
  //   1. `pg.Client` bilan ulanish (manzil -- guard'dan allaqachon tekshirilgan)
  //   2. Har migratsiyani BEGIN..COMMIT bilan tartibda qo'llash (xato bo'lsa to'xtash)
  //   3. Sintetik company/project/object/user fixture seed qilish
  //   4. `.acceptance.sql` fayllaridagi tekshiruvlarni sintetik ID'lar bilan qayta ishga tushirish
  //      (hozirgi .acceptance.sql fayllar production fixture ID'lariga qattiq bog'langan --
  //      obyekt 5 / actor 3,4 / qator 332297-332301,333310-333311 -- bularni
  //      seed bosqichida yaratilgan ID'larga parametrlashtirish kerak bo'ladi)
  //   5. Natijani chop etish, so'ng DB'ni reset/destroy qilish
  log('DB', 'NOT_IMPLEMENTED -- isolated Postgres ulanish/migratsiya/seed/acceptance/teardown hali yozilmagan.');
  log('RESULT', 'ISOLATED_DB_REQUIRED -- Section 1 (Docker/Pro-plan) hal bo\'lgandan keyin shu joydan davom.');
  process.exit(1);
}

main().catch((e) => {
  console.error('❌ Kutilmagan xato:', e);
  process.exit(1);
});
