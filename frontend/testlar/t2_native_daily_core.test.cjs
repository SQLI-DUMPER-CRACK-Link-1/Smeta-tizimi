/* T2-OVERNIGHT-NATIVE-CORE-CUTOVER — executable source gate.
 * Bu test T2 kundalik canonical route'larining eski T1 GASga qaytib ketmasligini,
 * hamda alohida T2 Bridge'ning ID/version/whitelist qonunlarini tekshiradi.
 * Legacy komponentlar va T1 source ataylab bu testga kiritilmagan. */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execFileSync } = require('child_process');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');
const noComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|\s)\/\/.*$/gm, '$1');
let ok = 0;
const must = (label, condition) => { assert(condition, label); console.log('  ✅ ' + label); ok++; };

const app = R('frontend', 'src', 'App.tsx');
const holat = R('frontend', 'src', 'admin', 'sahifalar', 'HolatNative.tsx');
const fakt = R('frontend', 'src', 'admin', 'sahifalar', 'FaktNative.tsx');
const f2 = R('frontend', 'src', 'admin', 'sahifalar', 'F2TayyorlashNative.tsx');
const f2Import = R('frontend', 'src', 'admin', 'sahifalar', 'F2ImportNative.tsx');
const bridge = R('frontend', 'functions', 'api', 't2-bridge.ts');
const gasBridge = R('tizim02', 'gas', 'T2Bridge.gs');
const nativeFiles = [holat, fakt, f2, f2Import].map(noComments);

console.log('\n── Native T2 daily routes ──');
must('LRV/Holat route uses HolatNative', /<Route path="holat" element={<HolatNative \/>} \/>/.test(app));
must('Fakt route uses FaktNative', /<Route path="fakt" element={<FaktNative \/>} \/>/.test(app));
must('F2 preparation route uses F2TayyorlashNative', /<Route path="f2-tayyorlash" element={<F2TayyorlashNative \/>} \/>/.test(app));
must('F2 import route uses F2ImportNative', /<Route path="f2" element={<F2ImportNative \/>} \/>/.test(app));
must('native daily components contain no old GAS request', nativeFiles.every((source) => !/fetch\(['"]\/api\/gas|\bapiHolatOl\b|\bapiHolatSaqla\b/.test(source)));
must('LRV reads canonical Supabase model', /sbT2DaraxtOl\(obyektId\)[\s\S]*sbT2QatorHolatOl\(obyektId\)/.test(noComments(holat)));
must('Fakt writes through versioned native commands', /sbFaktYoz/.test(fakt) && /sbFaktBelgilaV2/.test(fakt) && /operationId/.test(fakt));
must('F2 preparation writes through native v2 command', /sbT2AktYaratV2/.test(f2) && /f2Mumkin/.test(f2));
must('F2 import canonical route has no old GAS import', !/from ['"].*F2Import['"]/.test(noComments(app)));
must('daily UI does not print qator technical ids to users', !/#[{]row\.qator_id[}]|kanonik qator/.test(noComments(f2)) && !/raqamli `t2_obyekt\.id`/.test(noComments(holat)));

console.log('\n── T2 Bridge security and retry contract ──');
must('bridge requires a dedicated shared secret and configured actor', /T2_BRIDGE_SHARED_SECRET/.test(bridge) && /T2_BRIDGE_ACTOR_ID/.test(bridge));
must('projection pull verifies object company membership before read', /verifyObjectAccess/.test(bridge) && /t2_actor_kompaniya_azo_tekshir/.test(bridge));
must('projection versions come from t2_qator.versiya, not Fakt quantity', /t2_qator\?obyekt_id=eq\.[^`]+select=id,versiya/.test(bridge) && /t2_entity_version: versionsById/.test(bridge));
must('bridge write requires UUID operation id', /requireUuid/.test(bridge) && /OPERATION_ID_REQUIRED/.test(bridge));
must('bridge write is canonical qator_id based and server actor based', /p_qator_id: qatorId/.test(bridge) && /p_actor_id: actorId/.test(bridge));
must('bridge exposes rename/move/content/delete and Sheets whitelist actions', ['replica.rename','replica.move','replica.content','replica.deleted','sheets.writeback'].every((action) => bridge.includes(action)));
must('Sheets writeback rejects numeric row identity and derived fields', /!\[.*original_filename.*document_type.*\]/.test(bridge) && /\^\\d\+\$/.test(bridge) && /SHEETS_WRITEBACK_NOT_ALLOWED/.test(bridge));
must('Bridge GAS has stable hidden id/version/hash/operation metadata', /t2_entity_id.*t2_entity_version.*t2_projection_hash.*t2_last_operation_id/.test(gasBridge));
must('Bridge GAS writes only explicit Fakt field', /fc=headers\.indexOf\('fakt_hajm'\)/.test(gasBridge) && /T2B_DERIVED/.test(gasBridge));
must('same Sheet edit keeps operation id on retry', /state\.operationId/.test(gasBridge) && /cell\.setNote\(JSON\.stringify/.test(gasBridge));
must('conflict is blocked without a hot retry loop', /state\.blocked/.test(gasBridge) && /BRIDGE_TICK_ALREADY_RUNNING/.test(gasBridge));
must('all control tabs are bootstrapped and trigger is installed', /T2B_TABS/.test(gasBridge) && /t2BridgeInstallTrigger_/.test(gasBridge) && /everyMinutes\(5\)/.test(gasBridge));
try { execFileSync(process.execPath, ['--check'], { input: gasBridge, stdio: ['pipe', 'pipe', 'pipe'] }); }
catch (error) { assert.fail(String(error.stderr || error.stdout || error)); }
must('Bridge source parses as JavaScript', true);

console.log('\n' + ok + ' checks passed');
