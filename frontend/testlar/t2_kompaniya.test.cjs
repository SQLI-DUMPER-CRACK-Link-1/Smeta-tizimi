/* TIZIM_02 — KOMPANIYA VA VERSIYA QATLAMI (manba tekshiruvi)
 *
 * Bu test bazaga ULANMAYDI (u CI da ham ishlashi kerak). U KOD ichida
 * qoidalar saqlanib qolganini tekshiradi — chunki bu qoidalar bir marta
 * buzilsa oqibati jim va qimmat bo'ladi:
 *
 *   • yozish eshigi kengaysa → tasodifan ixtiyoriy jadvalga yozib qo'yish
 *   • versiya majburiy bo'lmasa → «oxirgi yozgan yutadi», birovning ishi
 *     jim yo'qoladi
 *   • kompaniya filtri tushib qolsa → boshqa mijozning raqami ko'rinadi
 *
 * Bazadagi xulq-atvor ALOHIDA tekshirilgan (Supabase MCP orqali, jonli):
 *   ikkinchi kompaniyada bir xil nomli obyekt      → ruxsat berildi
 *   bola qator kompaniyani otadan avtomat oldi     → ha
 *   versiya update da +1 (aynan bitta)             → ha
 *   eski versiya bilan yozuv                       → RAD ETILDI
 *   yangilangan versiya bilan qayta urinish        → o'tdi
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

console.log('\n── 1. YOZISH ESHIGI TOR QOLGANMI ──');
{
  const s = oqi('functions/api/sb-yoz.ts');
  /* ⚠️ 2026-08-21: eshik ATAYLAB kengaytirildi — F2/Fakt hujjatlari
     uchun. Lekin u «tor» bo'lib qolishi SHART: RPC nomi foydalanuvchi
     kiritmasidan qurilmaydi, faqat qat'iy ro'yxatdan olinadi.
     Ya'ni yangi amal qo'shish = shu faylga ataylab kod yozish. */
  {
    const amallar = (s.match(/rpc:\s*'([a-z0-9_]+)'/g) || [])
      .map((x) => x.split("'")[1]).sort();
    /* ⚠️ 2026-08-24: `t2_qator_qosh` qo'shildi — Tizim_01 dagi
       apiRzQosh/apiBlQosh/apiRsQosh/apiSmetaQatorQosh o'rniga.
       Ro'yxat ATAYLAB qat'iy: yangi amal qo'shish uchun shu testni ham
       ochish kerak, ya'ni eshik JIMGINA kengayolmaydi. */
    /* ⚠️ 2026-08-25: narxlar markazi amallari qo‘shildi (Claude). */
    /* ⚠️ 2026-08-25: buxgalteriya (to'lov/xarajat) amallari qo‘shildi (Claude). */
    /* ⚠️ 2026-08-27: korzinka/obyekt_yangila amallari qo'shildi (Claude,
       Antigravity g'oyasi asosida — sklad/birja/faktura bilan birga
       to'liq qayta yozildi, sabab MULOQOT.md da). */
    const KUTILGAN = ['t2_akt_bekor', 't2_akt_tasdiqlash', 't2_akt_yarat',
                      't2_faktura_yoz', 't2_grafik_sozlama_saqla', 't2_grafik_yangilash', 't2_ish_turi_yoz', 't2_narx_belgila', 't2_narx_sana_qosh',
                      't2_qator_qosh', 't2_qator_tahrir', 't2_shaxsiy_smeta_yarat', 't2_skladga_yozish', 't2_erp_amal', 't2_boss_tahlil_boshla', 't2_sozlama_saqla', 't2_tizim_amal', 't2_xato_yoz', 't2_kirish_amal', 't2_taklif_yubor', 't2_taklif_qabul', 't2_birja_rfq_yarat', 't2_birja_taklif_ber', 't2_viborka_smetadan_toldir', 't2_viborka_qabul_yoz',
                      't2_shartnoma_saqla', 't2_shartnoma_ochir', 't2_shartnoma_bog_saqla', 't2_nakrutka_saqla',
                      't2_tolov_yoz', 't2_tolov_tahrir', 't2_tolov_ochir', 't2_xarajat_yoz', 't2_xarajat_tahrir', 't2_xarajat_ochir',
                      't2_korzinkaga_tashlash', 't2_korzinkadan_tiklash', 't2_butunlay_ochirish', 't2_obyekt_yangila',
                      't2_aosr_yoz', 't2_aosr_bekor', 't2_aosr_bog_saqla', 't2_aosr_bog_ochir', 't2_audit_yoz',
                      't2_obyekt_hujjat_yoz', 't2_obyekt_hujjat_ochir',
                      't2_sklad_yarat', 't2_kadr_yarat', 't2_texnika_yarat',
                      't2_resurs_yarat_v2', 't2_resurs_yangila_v2', 't2_resurs_bekor_v2',
                      't2_resurs_bog_saqla', 't2_resurs_bog_ochir',
                      't2_loyiha_yarat', 't2_loyiha_yangila', 't2_loyiha_ochir',
                      't2_obyekt_loyihaga_biriktir',
                      't2_loyiha_qatnashchi_biriktir', 't2_loyiha_qatnashchi_ochir',
                      't2_kontragent_saqla', 't2_kontragent_ochir',
                      't2_azolik_qosh', 't2_azolik_rol_ozgartir', 't2_azolik_ochir',
                      't2_fakt_yoz', 't2_fakt_belgila',
                      't2_kompaniya_yangila',
                      't2_material_alias_yoz', 't2_material_alias_ochir',
                      't2_mindmap_bog_v2', 't2_mindmap_bog_ochir_v2',
                      't2_mindmap_joylashuv_saqla_v2', 't2_mindmap_tugun_ochir_v2'].sort();
    T('RPC ro\'yxati AYNAN belgilangan ' + KUTILGAN.length + ' ta domen amali',
      JSON.stringify(amallar) === JSON.stringify(KUTILGAN),
      'topildi: ' + amallar.join(', '));
    /* RPC nomi FAQAT ro'yxatdan — so'rovdan emas */
    T('RPC nomi so\'rov tanasidan olinmaydi',
      /rpc\/' \+ AMALLAR\[amal\]\.rpc/.test(s) &&
      !/rpc\/' \+ so\./.test(s) && !/rpc\/\$\{so\./.test(s));
    /* Manbada apostrof qochirilgan (`Noma\'lum`) — shuni hisobga olamiz */
    T('noma\'lum amal RAD etiladi',
      /Noma\\?'lum amal/.test(s));
  }
  /* ⚠️ Qator qo'shishda ham idempotentlik MAJBURIY: tarmoq uzilib
     qayta yuborilsa smetaga ikkita bir xil qator tushardi. */
  T("qator qo'shishda operation_id majburiy",
    s.indexOf('ikkinchi qator yaratadi') > 0);
  /* ⚠️ MANFIY norma (ПЕРЕРАСЧЁТ) bloklanmasin — bu tizimda bir
     necha marta `> 0` sharti bilan yo'qotilgan. */
  T("norma tekshiruvi `> 0` EMAS (manfiy o'tadi)",
    /norma = Number\(so\.norma\)/.test(s) && !/norma\s*<=?\s*0/.test(s));
  T('ixtiyoriy jadvalga yozish yo\'q',
    s.indexOf('/rest/v1/' + '${') < 0 && !/rest\/v1\/'\s*\+\s*[a-z]/.test(s));
  T('versiya MAJBURIY (usiz rad etiladi)',
    s.indexOf('kutilgan_versiya majburiy') >= 0);
  T('rahbar roli yoza olmaydi',
    s.indexOf("sess.rol === 'boss'") >= 0 && s.indexOf('403') >= 0);
  T('maydon oq ro\'yxati bor',
    /RUXSAT\s*=\s*\['nom',\s*'hajm',\s*'narx',\s*'birlik',\s*'kat'\]/.test(s));
  T('manba doim `frontend` (klient o\'zi tanlay olmaydi)',
    s.indexOf("p_manba: 'frontend'") >= 0);
}

console.log('\n── 2. O\'QISH ESHIGI YOZMAYDI ──');
{
  const s = oqi('functions/api/sb.ts');
  T('faqat GET so\'rov (method yozilmagan → GET)',
    s.indexOf("method: 'POST'") < 0 && s.indexOf('method:"POST"') < 0);
  T('t2_ jadvallar oq ro\'yxatda', s.indexOf("'t2_daraxt'") >= 0);
  T('t2_kompaniya o\'qilishi mumkin', s.indexOf("'t2_kompaniya'") >= 0);
}

console.log('\n── 3. KOMPANIYA FILTRI TUSHIB QOLMAGANMI ──');
{
  const s = oqi('src/api/supabase.ts');
  T('obyektlar kompaniya bo\'yicha filtrlanadi',
    s.indexOf("'kompaniya_id=eq.'") >= 0);
  T('kompaniyalar ro\'yxati faqat FAOL larni oladi',
    s.indexOf('faol=is.true') >= 0);
  T('tahrir funksiyasi versiyani talab qiladi',
    /kutilganVersiya:\s*number/.test(s));

  const o = oqi('src/test02/TestObyektlar.tsx');
  T('ro\'yxat sahifasi kompaniya hook\'ini ishlatadi',
    o.indexOf('useKompaniya') >= 0 && o.indexOf('sbT2ObyektlarOlKomp') >= 0);
  T('kompaniya almashsa qayta o\'qiydi',
    o.indexOf('[joriy?.id') >= 0);
}

console.log('\n── 4. TIZIM_01 GA TEGILMAGANMI ──');
{
  const o = oqi('src/test02/TestObyektlar.tsx');
  const d = oqi('src/test02/TestDaraxt.tsx');
  T('Tizim_02 eski `holat` jadvalini o\'qimaydi',
    o.indexOf("'holat'") < 0 && d.indexOf("jadval: 'holat'") < 0);
  T('Tizim_02 eski `obyektlar` jadvalini o\'qimaydi',
    o.indexOf("sbObyektlarOl(") < 0);
}

console.log('\n── 5. HALOLLIK QOIDALARI ──');
{
  const o = oqi('src/test02/TestObyektlar.tsx');
  T('narxlanmagan qatorlar OCHIQ ko\'rsatiladi',
    o.indexOf('NARXLANMAGAN') >= 0 || o.indexOf('narxsiz') >= 0);
  const t = oqi('src/test02/QatorTahrir.tsx');
  T('ziddiyat «xato» emas, tushuntirish sifatida ko\'rsatiladi',
    t.indexOf('boshqa foydalanuvchi o‘zgartirdi') >= 0);
  T('bo\'sh qiymat 0 emas, «yo\'q» ekani aytiladi',
    t.indexOf('0 emas') >= 0);
}

console.log(`\n═══ ${ok} o'tdi, ${xato} yiqildi ═══`);
process.exit(xato ? 1 : 0);

