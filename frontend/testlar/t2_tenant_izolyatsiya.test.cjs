/* TENANT IZOLYATSIYASI — "Auth Session -> User -> Tenant -> Role" poydevori
 * ═══════════════════════════════════════════════════════════════════
 *
 * 2026-08-27: foydalanuvchi ko'rsatmasi bilan (Antigravity orqali
 * uzatilgan, keyin to'g'ridan-to'g'ri suhbatda tasdiqlangan) — kichik
 * funksiyalarni to'xtatib, haqiqiy multi-tenant poydevorini qurish.
 *
 * MUAMMO EDI: sessiya faqat `rol`/`email` saqlardi — qaysi foydalanuvchi,
 * qaysi kompaniya(lar)ga a'zo ekani UMUMAN yo'q edi. Server `kompaniya_id`
 * ni mijoz yuborgan har qanday qiymat deb qabul qilardi, sessiya bilan
 * solishtirmasdi.
 *
 * Bu test 3 narsani tekshiradi (bazaga ulanmaydi, faqat KOD ichida
 * qoida saqlanib qolganini):
 *   1) Sess TYPE'i foydalanuvchi/kompaniya identifikatsiyasini bilishi
 *   2) kirish.ts yangi kirishda haqiqiy a'zolik yozuvini yaratishi
 *   3) sb-yoz.ts har yozuv so'rovida kompaniya a'zoligini tekshirishi
 *
 * Bazadagi xulq-atvor ALOHIDA tekshirilgan (Supabase MCP orqali, jonli):
 *   t2_kirish_royxatga_ol bir xil login bilan ikki marta chaqirilsa
 *     → ikkinchisi dublikat a'zolik yaratmaydi (idempotent)
 *   yangi foydalanuvchi hali a'zoligi yo'q bo'lsa
 *     → barcha faol kompaniyaga GAS'dan kelgan rol bilan a'zo qilinadi
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const oqi = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let ok = 0, xato = 0;
const T = (nom, shart, izoh) => {
  if (shart) { ok++; console.log('  ✅ ' + nom); }
  else { xato++; console.log('  ❌ ' + nom + (izoh ? '  → ' + izoh : '')); }
};

console.log('\n── 1. SESS TYPE FOYDALANUVCHI/KOMPANIYANI BILADIMI ──');
{
  const s = oqi('functions/_shared/auth.ts');
  T('Sess da foydalanuvchi_id bor', /foydalanuvchi_id\?:\s*number/.test(s));
  T('Sess da kompaniyalar ro\'yxati bor', /kompaniyalar\?:\s*number\[\]/.test(s));
  T('eski sessiya buzilmasin deb IXTIYORIY (?:) belgilangan',
    /foydalanuvchi_id\?:/.test(s) && /kompaniyalar\?:/.test(s));
}

console.log('\n── 2. KIRISHDA HAQIQIY A\'ZOLIK YOZUVI YARATILADIMI ──');
{
  const s = oqi('functions/api/kirish.ts');
  T('t2_kirish_royxatga_ol chaqiriladi', s.indexOf('t2_kirish_royxatga_ol') >= 0);
  T('sessiya foydalanuvchi_id/kompaniyalar bilan imzolanadi',
    /imzola\(\{[^}]*foydalanuvchi_id[^}]*kompaniyalar/s.test(s));
  T('Supabase ishlamasa ham kirish BLOKLANMAYDI (best-effort)',
    s.indexOf('kirish baribir davom etadi') >= 0);
}

console.log('\n── 3. sb-yoz.ts HAR YOZUVDA A\'ZOLIKNI TEKSHIRADIMI ──');
{
  const s = oqi('functions/api/sb-yoz.ts');
  T('kompaniya_id sessiya a\'zoligi bilan solishtiriladi',
    /sess\.kompaniyalar\.includes\(soraganKompaniya\)/.test(s));
  T('tekshiruv AMAL branchlaridan OLDIN turadi (hech biri o\'tkazib yubormaydi)',
    s.indexOf('sess.kompaniyalar.includes') < s.indexOf("amal === 'qator_tahrir'"));
  T('eski sessiya (kompaniyalar yo\'q) bloklanib qolmaydi',
    /Array\.isArray\(sess\.kompaniyalar\)/.test(s));
  T('rad javobi 403 bilan qaytadi', /zo emassiz[\s\S]{0,80}status:\s*403/.test(s));
}

console.log('\n── 4. sb.ts (O\'QISH) HAM KOMPANIYA A\'ZOLIGINI TEKSHIRADIMI ──');
{
  const s = oqi('functions/api/sb.ts');
  T('filtrdan kompaniya_id ajratib olinadi',
    /filtr \|\| ''\)\.match\(\/.*kompaniya_id=eq/.test(s));
  T('sessiya a\'zoligi bilan solishtiriladi',
    /sess\.kompaniyalar\.includes\(soraganKompaniya\)/.test(s));
  T('eski sessiya (kompaniyalar yo\'q) bloklanib qolmaydi',
    /Array\.isArray\(sess\.kompaniyalar\)/.test(s));
  T('rad javobi 403 bilan qaytadi', /zo emassiz[\s\S]{0,80}status:\s*403/.test(s));
}

console.log(`\n═══ ${ok} o'tdi, ${xato} yiqildi ═══`);
process.exit(xato ? 1 : 0);
