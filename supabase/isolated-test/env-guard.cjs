/**
 * env-guard.cjs — T2-LRV-CLOSURE-006 Section 1/2.
 * ═══════════════════════════════════════════════════════════════════
 *
 * BITTA vazifasi bor: berilgan Postgres ulanish manzili PRODUCTION
 * bo'lsa, ANIQ va DARHOL rad etish. Bu fayl boshqa hech narsa
 * QILMAYDI — shu bilan uni ko'zdan kechirish (audit) OSON, va
 * "guard qochib ketdi" xavfi kam.
 *
 * Nega qattiq ro'yxat, "ehtimol"/heuristika emas: bitta noto'g'ri
 * salbiy (production'ni "xavfsiz" deb o'tkazib yuborish) TUZATIB
 * BO'LMAS oqibatga olib kelishi mumkin — shuning uchun bu yerda
 * FAIL-CLOSED: manzil qanday ko'rinishda kelishidan qat'i nazar
 * (host, connection string, Supabase project ref) MA'LUM production
 * identifikatorlaridan BIRI bilan mos kelsa — RAD ETILADI.
 *
 * Bu ro'yxat CLAUDE.md/MEMORY.md dagi loyiha ma'lumotidan olingan:
 * yagona Supabase project — `tuoyrzadkgoltpqkdiyx` ("Smet-01").
 */

const BILINGAN_PRODUCTION_REF = 'tuoyrzadkgoltpqkdiyx';
const BILINGAN_PRODUCTION_HOST_QISMLARI = [
  'tuoyrzadkgoltpqkdiyx.supabase.co',
  'db.tuoyrzadkgoltpqkdiyx.supabase.co',
];

/**
 * @param {string} connectionStringOrHost - DATABASE_URL yoki host nomi.
 * @returns {{ ok: true } | { ok: false, xabar: string }}
 */
function productionEmasliginiTekshir(connectionStringOrHost) {
  if (!connectionStringOrHost || typeof connectionStringOrHost !== 'string' || !connectionStringOrHost.trim()) {
    return { ok: false, xabar: 'DB manzili bo\'sh -- ISOLATED_TEST_DATABASE_URL o\'rnatilmagan. Xavfsizlik uchun BO\'SH manzil ham RAD ETILADI (fail-closed) -- "manzil yo\'q, demak biror default ishlatilsin" degan yashirin fallback YO\'Q.' };
  }
  const past = connectionStringOrHost.toLowerCase();

  if (past.includes(BILINGAN_PRODUCTION_REF.toLowerCase())) {
    return { ok: false, xabar: `RAD ETILDI: manzilda production project ref ("${BILINGAN_PRODUCTION_REF}") topildi. Bu skript FAQAT isolated/local test DB uchun -- productionga ULANISH TAQIQLANADI.` };
  }
  for (const host of BILINGAN_PRODUCTION_HOST_QISMLARI) {
    if (past.includes(host.toLowerCase())) {
      return { ok: false, xabar: `RAD ETILDI: manzilda production host ("${host}") topildi. Bu skript FAQAT isolated/local test DB uchun.` };
    }
  }
  // Umumiy ".supabase.co" (hosted, ref noma'lum bo'lsa ham) -- FAIL-CLOSED:
  // faqat ANIQ localhost/127.0.0.1/local Supabase CLI portlari (54322 --
  // `supabase start`ning standart local DB porti) yoki ochiq belgilangan
  // "isolated"/"local"/"shadow"/"staging" so'zi manzilda ANIQ ko'rinsa o'tkaziladi.
  const xavfsizBelgilar = ['localhost', '127.0.0.1', '::1', 'isolated', 'shadow-test', 'local-test'];
  const xavfsizmi = xavfsizBelgilar.some((b) => past.includes(b));
  if (past.includes('supabase.co') && !xavfsizmi) {
    return { ok: false, xabar: 'RAD ETILDI: manzil hosted Supabase (*.supabase.co) ko\'rinadi, lekin aniq xavfsizlik belgisi (localhost/isolated/shadow-test) topilmadi -- fail-closed, ehtiyot chorasi sifatida rad etiladi. Agar bu haqiqatan izolyatsiya qilingan hosted branch bo\'lsa, manzilga aniq "isolated" so\'zini qo\'shing yoki shu faylga uning project ref\'ini ANIQ ochiq ro\'yxatga kiriting (ko\'r-ko\'rona qabul qilinmaydi).' };
  }

  return { ok: true };
}

module.exports = { productionEmasliginiTekshir, BILINGAN_PRODUCTION_REF, BILINGAN_PRODUCTION_HOST_QISMLARI };

if (require.main === module) {
  const manzil = process.env.ISOLATED_TEST_DATABASE_URL || process.argv[2] || '';
  const natija = productionEmasliginiTekshir(manzil);
  if (!natija.ok) {
    console.error('❌ ' + natija.xabar);
    process.exit(1);
  }
  console.log('✅ Manzil production emas -- davom etish mumkin (bu tekshiruv YAGONA kafolat emas, faqat birinchi qatlam).');
}
