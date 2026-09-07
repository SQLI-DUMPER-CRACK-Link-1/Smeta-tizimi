/* Overnight ishini integration bazasiga ko‘r-ko‘rona ko‘chirmaslik uchun
 * source-level regression oracle. Bu test biznes qiymat hisoblamaydi; u
 * mavjud T2 bridge xavfsizlik va ma’lumotni saqlash qonunlarini qo‘riqlaydi. */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const must = (label, condition) => {
  assert(condition, label);
  console.log('  ✅ ' + label);
};

const app = read('frontend', 'src', 'App.tsx');
const holat = read('frontend', 'src', 'admin', 'sahifalar', 'HolatNative.tsx');
const fakt = read('frontend', 'src', 'admin', 'sahifalar', 'FaktNative.tsx');
const f2 = read('frontend', 'src', 'admin', 'sahifalar', 'F2TayyorlashNative.tsx');
const bridge = read('frontend', 'functions', 'api', 't2-bridge.ts');
const gasBridge = read('tizim02', 'gas', 'T2Bridge.gs');
const registry = read('frontend', 'testlar', 'hammasi.cjs');
const native = [holat, fakt, f2].join('\n');

console.log('\n── Integration native daily yo‘li ──');
must('Holat, Fakt va F2 tayyorlash native komponentlarda qolgan',
  /HolatNative|FaktNative|F2TayyorlashNative/.test(app));
must('native kundalik komponentlar eski GAS requestiga qaytmagan',
  !/fetch\(['"]\/api\/gas|\bapiHolatOl\b|\bapiHolatSaqla\b/.test(native));
must('Fakt yozuvi kanonik qator ID, actor va operation_id bilan yuradi',
  /sbFaktYoz/.test(fakt) && /operationId/.test(fakt));
must('F2 tayyorlash exact native commanddan foydalanadi',
  /sbT2AktYaratV2/.test(f2));

console.log('\n── Integration Cloudflare bridge qonunlari ──');
must('proyeksiya xeshi qator tartibiga emas, saralangan canonical IDga bog‘langan',
  /normalizeProjectionRows[\s\S]*\.sort\(\(a, b\) => Number\(a\.qator_id\) - Number\(b\.qator_id\)/.test(bridge));
must('Fakt qatori aynan obyekt ichidan o‘qilib tekshiriladi',
  bridge.includes('id=eq.${qatorId}&obyekt_id=eq.${objectId}'));
must('Fakt payload base qiymat va entity versiyasini talab qiladi',
  /base_fakt_hajm/.test(bridge) && /base_entity_version/.test(bridge) && /ENTITY_VERSION_REQUIRED/.test(bridge));
must('bridge ichki xatoni xavfsiz kodga aylantiradi',
  bridge.includes('BRIDGE_INTERNAL_ERROR'));
must('shared secret taqqoslashida uzunlik va belgilar tekshiriladi',
  /function equal\(a: string, b: string\)/.test(bridge));

console.log('\n── Sheet bridge regressiya himoyasi ──');
must('Sheet proyeksiyasi ID bo‘yicha yangilanadi',
  /rowById/.test(gasBridge) && /DUPLICATE_CANONICAL_ID/.test(gasBridge));
must('proyeksiya kelganda Sheet butunlay tozalanmaydi',
  !/clearContent\(\)/.test(gasBridge));
must('canonical ID/version/hash/state yashirin metadata sifatida saqlanadi',
  /t2_entity_id.*t2_entity_version.*t2_projection_hash.*t2_projection_state/s.test(gasBridge));
must('bo‘sh yoki noto‘g‘ri Fakt qiymati 0ga aylantirilmaydi',
  /FAKT_VALUE_INVALID/.test(gasBridge) && /t2BridgeNumber_/.test(gasBridge));
must('triggerlar ustma-ust ishlashidan LockService himoya qiladi',
  /LockService\.getScriptLock\(\)/.test(gasBridge) && /BRIDGE_TICK_ALREADY_RUNNING/.test(gasBridge));

console.log('\n── Regression suite ro‘yxati ──');
for (const file of [
  't2_safe_error_boundary.test.cjs',
  't2_workbench_null_semantics.test.cjs',
  't2_pto_visible_surface.test.cjs',
]) must(file + ' release suite’da saqlangan', registry.includes(file));

console.log('\n15 ta reconciliation tekshiruvi o‘tdi');
