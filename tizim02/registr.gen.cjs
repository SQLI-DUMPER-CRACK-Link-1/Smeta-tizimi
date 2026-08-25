#!/usr/bin/env node
/* TIZIM_01 → TIZIM_02 KO'CHIRISH REESTRI — GENERATOR
 * ═══════════════════════════════════════════════════════════════════
 *
 * Nima uchun generator, qo'lda yozilgan hujjat emas:
 * qo'lda yozilgan xarita BIRINCHI kunidayoq eskiradi. Kimdir Tizim_01 ga
 * yangi `api*` qo'shadi va xaritada u yo'q — natijada «hammasi
 * ko'chirildi» degan soxta tasavvur paydo bo'ladi.
 *
 * Bu yerda XARITA KODDAN o'qiladi:
 *   koddagi api* funksiyalar  +  tasnif.json (qo'lda)  →  REGISTR.json
 *                                                       →  KEYINGI.md
 *
 * `t2_registr.test.cjs` REGISTR.json ni qayta yasab solishtiradi.
 * Eskirgan bo'lsa yoki tasnifsiz funksiya bo'lsa — test YIQILADI.
 *
 * Ishlatish:  node tizim02/registr.gen.cjs           (yozadi)
 *             node tizim02/registr.gen.cjs --tekshir (faqat solishtiradi)
 */
const fs = require('fs');
const path = require('path');

const ILDIZ = path.join(__dirname, '..');
const GAS = path.join(ILDIZ, 'Smeta tizimi');

/* ── 1. Koddan api* funksiyalarni topamiz ───────────────────────────── */
function koddanOqi() {
  const chiqish = [];
  for (const fayl of fs.readdirSync(GAS).filter((f) => f.endsWith('.js')).sort()) {
    const matn = fs.readFileSync(path.join(GAS, fayl), 'utf8');
    const qatorlar = matn.split('\n');
    for (let i = 0; i < qatorlar.length; i++) {
      const m = /^function (api[A-Za-z0-9_]*)\s*\(([^)]*)\)/.exec(qatorlar[i]);
      if (!m) continue;
      chiqish.push({
        nom: m[1],
        fayl,
        qator: i + 1,
        argSoni: m[2].trim() ? m[2].split(',').length : 0,
        /* Tizim_02 ning o'z funksiyalari — ular MANBA emas, NATIJA */
        t2: fayl.startsWith('T2_'),
      });
    }
  }
  return chiqish;
}

/* ── 2. Domen va qatlamni aniqlaymiz ────────────────────────────────── */
function tasnifla(fn, T) {
  let domen = T.faylDomen[fn.fayl] || 'nomalum';

  /* 30_Panel.js bitta domen emas — nom bo'yicha ajratamiz */
  if (domen === 'panel') {
    for (const [naqsh, d] of T.nomQoida) {
      if (new RegExp(naqsh).test(fn.nom)) { domen = d; break; }
    }
  } else if (/^apiF2/.test(fn.nom) && domen !== 'f2' && T.domenQatlam[domen] !== 'GAS') {
    /* Boshqa fayldagi F2 nomli funksiya ham F2 domeniga tegishli */
    domen = 'f2';
  }

  const h = T.holat[fn.nom];
  const qatlam = (h && h.qatlam) || T.domenQatlam[domen] || 'NOMALUM';

  let holat;
  /* ⚠️ GAS qatlami «bajarilmagan» EMAS — u ATAYLAB o'z joyida qoladi
     (Drive/Sheets/Excel/AI kalitlari). Uni foizga qo'shish soxta qarz
     yasardi: xarita «0%» deb ko'rsatib, aslida qilinadigan ish yo'q. */
  if (qatlam === 'GAS') holat = 'joyida';
  else if (qatlam === 'YOQ') holat = 'kerakmas';
  else if (!h) holat = 'kutilmoqda';
  else if (h.toliq) holat = 'tayyor';
  else holat = 'qisman';

  return {
    domen, qatlam, holat,
    qopladi: (h && h.qopladi) || null,
    izoh: (h && h.izoh) || null,
  };
}

/* ── 3. Reestrni yig'amiz ───────────────────────────────────────────── */
function yasa() {
  const T = JSON.parse(fs.readFileSync(path.join(__dirname, 'tasnif.json'), 'utf8'));
  const hammasi = koddanOqi();
  const manba = hammasi.filter((f) => !f.t2);
  const t2Lar = hammasi.filter((f) => f.t2).map((f) => f.nom).sort();

  const funksiyalar = {};
  const tasnifsiz = [];
  for (const fn of manba) {
    const t = tasnifla(fn, T);
    /* ⚠️ `panel` — ZAXIRA domen: 30_Panel.js dagi funksiya biror
       nom qoidasiga tushmasa shu yerda qoladi. U navbatda ko'rinmaydi,
       ya'ni JIMGINA yo'qoladi. Shuning uchun u ham TASNIFSIZ sanaladi —
       `tasnif.json` → `nomQoida` ga yangi qoida qo'shilishi kerak. */
    if (t.domen === 'nomalum' || t.domen === 'panel' || t.qatlam === 'NOMALUM') {
      tasnifsiz.push(fn.nom + ' (' + fn.fayl + ' — domen: ' + t.domen + ')');
    }
    funksiyalar[fn.nom] = {
      fayl: fn.fayl, qator: fn.qator, argSoni: fn.argSoni,
      domen: t.domen, qatlam: t.qatlam, holat: t.holat,
      qopladi: t.qopladi, izoh: t.izoh,
    };
  }

  /* Domen bo'yicha jamlanma */
  const domenlar = {};
  for (const [nom, f] of Object.entries(funksiyalar)) {
    const d = (domenlar[f.domen] = domenlar[f.domen] || {
      qatlam: f.qatlam, jami: 0,
      tayyor: 0, qisman: 0, kutilmoqda: 0, kerakmas: 0, joyida: 0,
      funksiyalar: [],
    });
    d.jami++; d[f.holat]++; d.funksiyalar.push(nom);
  }
  /* Hudud egasi — ikki agent bir domenni olib qolmasin.
     Manba: `tizim02/navbat.json` (qo'lda). Bu yerda faqat O'QILADI. */
  let hudud = {};
  try {
    hudud = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'navbat.json'), 'utf8')).hudud || {};
  } catch (e) { /* navbat.json hali yo'q — egasiz ishlayveramiz */ }
  for (const [nom, d] of Object.entries(domenlar)) {
    d.egasi = (hudud[nom] && hudud[nom].egasi) || null;
    d.ish_holati = (hudud[nom] && hudud[nom].holat) || null;
  }

  for (const d of Object.values(domenlar)) {
    const hisobga = d.jami - d.kerakmas - d.joyida;
    d.foiz = hisobga ? Math.round(((d.tayyor + d.qisman * 0.5) / hisobga) * 100) : null;
    d.kochiriladi = hisobga > 0;
    d.funksiyalar.sort();
  }

  const barcha = Object.values(funksiyalar);
  const kerakmas = barcha.filter((f) => f.holat === 'kerakmas').length;
  const joyida = barcha.filter((f) => f.holat === 'joyida').length;
  const hisobga = manba.length - kerakmas - joyida;
  const tayyor = barcha.filter((f) => f.holat === 'tayyor').length;
  const qisman = barcha.filter((f) => f.holat === 'qisman').length;

  return {
    versiya: 1,
    /* ⚠️ Sana ATAYLAB yo'q. Bo'lsa har generatsiyada o'zgarardi,
       drift testi doim yiqilardi va unga qarashni bas qilishardi. */
    manba: { jami: manba.length, hisobga, tayyor, qisman, joyida, kerakmas },
    foiz: hisobga ? Math.round(((tayyor + qisman * 0.5) / hisobga) * 100) : 0,
    tizim02Funksiyalari: t2Lar,
    tasnifsiz,
    navbat: T.keyingiNavbat.tartib,
    domenlar,
    funksiyalar,
  };
}

/* ── 4. Odam o'qiydigan navbat ──────────────────────────────────────── */
function keyingiMd(R, T) {
  const s = [];
  s.push('# TIZIM_02 — KEYINGI ISHLAR NAVBATI');
  s.push('');
  s.push('> ⚠️ **BU FAYL AVTOMAT YASALADI.** Qo\'lda tahrirlamang —');
  s.push('> `node tizim02/registr.gen.cjs` uni qayta yozadi.');
  s.push('> Tasnifni o\'zgartirish uchun `tizim02/tasnif.json` ni tahrirlang.');
  s.push('');
  s.push('Umumiy holat: **' + R.foiz + '%** — ' + R.manba.tayyor + ' tayyor · ' +
         R.manba.qisman + ' qisman · ' +
         (R.manba.hisobga - R.manba.tayyor - R.manba.qisman) + ' boshlanmagan ' +
         '(ko\'chiriladigan ' + R.manba.hisobga + ' tadan). ' +
         R.manba.joyida + ' ta GASda qoladi, ' + R.manba.kerakmas +
         ' ta umuman kerakmas — ular foizga KIRMAYDI.');
  s.push('');
  s.push('## Domenlar — qiymat tartibida');
  s.push('');
  s.push('| # | Domen | Egasi | Qatlam | Holat | Tayyor | Qisman | Qoldi |');
  s.push('|---|---|---|---|---|---|---|---|');
  let n = 0;
  /* ⚠️ Faqat KO'CHIRILADIGAN domenlar. GASda qoladiganlarni shu
     jadvalga qo'shish «0%» deb ko'rsatib, aslida yo'q qarz yasardi. */
  const koch = R.navbat.filter((d) => R.domenlar[d] && R.domenlar[d].kochiriladi)
    .concat(Object.keys(R.domenlar)
      .filter((k) => !R.navbat.includes(k) && R.domenlar[k].kochiriladi).sort());
  for (const d of koch) {
    const x = R.domenlar[d];
    n++;
    const belgi = { claude: '🔵', antigravity: '🟢' }[x.egasi] || '⚪';
    s.push('| ' + n + ' | **' + d + '** | ' + belgi + ' ' + (x.egasi || 'kelishilsin') +
           (x.ish_holati === 'ishlanmoqda' ? ' ⏳' : '') + ' | ' +
           x.qatlam + ' | ' + x.foiz + '% | ' +
           x.tayyor + ' | ' + x.qisman + ' | ' + x.kutilmoqda + ' |');
  }
  s.push('');

  /* ⚠️ Har AGENT uchun ALOHIDA keyingi ish. Ikkovi bir vaqtda ishlaydi,
     shuning uchun bitta umumiy «keyingi» yetarli emas — ikkinchi agent
     o'ziniki qaysiligini bilmay, birinchisining domenini ochib
     yuborishi mumkin. */
  for (const agent of ['claude', 'antigravity']) {
    const keyingi = R.navbat.find((d) => R.domenlar[d] && R.domenlar[d].kochiriladi &&
                                         R.domenlar[d].egasi === agent &&
                                         R.domenlar[d].foiz < 100);
    if (!keyingi) continue;
    const x = R.domenlar[keyingi];
    const belgi = agent === 'claude' ? '🔵' : '🟢';
    s.push('## ' + belgi + ' ' + agent + ' — keyingi ish: `' + keyingi +
           '` (' + x.qatlam + ', ' + x.foiz + '%)');
    s.push('');
    for (const nom of x.funksiyalar) {
      const f = R.funksiyalar[nom];
      if (f.holat !== 'kutilmoqda' && f.holat !== 'qisman') continue;
      s.push('- `' + nom + '` — `' + f.fayl + ':' + f.qator + '`' +
             (f.holat === 'qisman' ? ' *(qisman: ' + f.qopladi + ')*' : ''));
    }
    s.push('');
  }

  s.push('## Ko\'chirilmaydiganlar');
  s.push('');
  s.push('| Domen | Nechta | Qatlam | Nega |');
  s.push('|---|---|---|---|');
  for (const [d, x] of Object.entries(R.domenlar)) {
    if (!x.kochiriladi) {
      s.push('| `' + d + '` | ' + x.jami + ' | ' + x.qatlam + ' | ' +
             T.qatlamlar[x.qatlam] + ' |');
    }
  }
  s.push('');
  return s.join('\n');
}

/* ── 5. Ishga tushirish ─────────────────────────────────────────────── */
const T = JSON.parse(fs.readFileSync(path.join(__dirname, 'tasnif.json'), 'utf8'));
const R = yasa();
const jsonYol = path.join(__dirname, 'REGISTR.json');
const mdYol = path.join(__dirname, 'KEYINGI.md');
const jsonMatn = JSON.stringify(R, null, 2) + '\n';
const mdMatn = keyingiMd(R, T) + '\n';

if (process.argv.includes('--tekshir')) {
  const bor = fs.existsSync(jsonYol) ? fs.readFileSync(jsonYol, 'utf8') : '';
  if (bor.replace(/\r\n/g, '\n') !== jsonMatn) {
    console.error('REESTR ESKIRGAN — `node tizim02/registr.gen.cjs` ni ishga tushiring');
    process.exit(1);
  }
  if (R.tasnifsiz.length) {
    console.error('TASNIFSIZ: ' + R.tasnifsiz.join(', '));
    process.exit(1);
  }
  console.log('reestr yangi (' + R.manba.jami + ' funksiya, ' + R.foiz + '%)');
} else {
  fs.writeFileSync(jsonYol, jsonMatn);
  fs.writeFileSync(mdYol, mdMatn);
  console.log('REGISTR.json + KEYINGI.md yozildi — ' +
              R.manba.jami + ' funksiya, ' + R.foiz + '%');
  if (R.tasnifsiz.length) console.log('⚠️ tasnifsiz: ' + R.tasnifsiz.join(', '));
}
