/* SMETA / F2 / NAKOPITELNIY / CHANGE CONTROL — generic (project-agnostic) canonical model.
   "PARK" is only the reference scenario; NO t2_park_* / park_* canonical entity.
   Additive on the existing t2_qator -> t2_akt -> t2_akt_qator -> t2_qator_holat model. */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');
const has = (p) => fs.existsSync(path.join(__dirname, '..', '..', ...p.split('/')));
let ok = 0;
const must = (l, c) => { assert(c, l); console.log('  ✅ ' + l); ok++; };
const N = (s) => s.replace(/\s+/g, ' ');

const m1 = R('supabase', 'migrations', '20260910120000_t2_f2_baseline_price_v1.sql');       const m1n = N(m1);
const m1r = R('supabase', 'migrations', '20260910120000_t2_f2_baseline_price_v1.rollback.sql');
const m1a = R('supabase', 'migrations', '20260910120000_t2_f2_baseline_price_v1.acceptance.sql');
const m2 = R('supabase', 'migrations', '20260911120000_t2_smeta_change_control_v1.sql');    const m2n = N(m2);
const m2r = R('supabase', 'migrations', '20260911120000_t2_smeta_change_control_v1.rollback.sql');
const m2a = R('supabase', 'migrations', '20260911120000_t2_smeta_change_control_v1.acceptance.sql');
const doc = R('docs', 'architecture', 'SMETA_F2_NAKOPITELNIY_CHANGE_CONTROL_V1.md');

console.log('\n── Naming: PARK is not a canonical boundary ──');
for (const [n, s] of [['migration 1', m1], ['migration 2', m2], ['rollback 1', m1r], ['rollback 2', m2r]]) {
  must(n + ': no t2_park_* / park_* canonical entity', !/\bt2_park_|\bpark_project_id\b|create (table|function)[^;]*\bpark\b/i.test(s));
}
must('generic entity names (t2_smeta_revision / t2_smeta_ozgarish / t2_nakopitelniy_v1)',
  /t2_smeta_revision/.test(m1) && /t2_smeta_ozgarish/.test(m2) && /t2_nakopitelniy_v1/.test(m1));
must('binds through canonical ids (obyekt_id / kompaniya_id / qator_id / revision_id / operation_id)',
  /obyekt_id/.test(m1) && /revision_id/.test(m1) && /operation_id/.test(m2));

console.log('\n── Price facts kept strictly separate ──');
must('t2_akt_qator: baseline_narx (A) + narx (B) + actual_narx (C) are distinct columns',
  /add column if not exists baseline_narx/.test(m1) && /add column if not exists actual_narx/.test(m1));
must('narx_manba enum separates smeta / f2_sertifikat / taminot / shartnoma / qol_nomalum',
  /narx_manba in \('smeta','f2_sertifikat','taminot','shartnoma','qol_nomalum'\)/.test(m1));
must('actual_narx is NULL when unknown — never silently the estimate', /actual_narx.*NULL = unknown|NULL when unknown/i.test(m1));
must('acceptance proves actual stays NULL + manba qol_nomalum when no source',
  /actual_narx must stay NULL when no source|q2 narx_manba must be qol_nomalum/i.test(m1a));
must('variance is a stored generated column (certified value vs frozen baseline)',
  /variance_summa numeric\s+generated always as/.test(m1));

console.log('\n── Baseline never drifts / revision lineage ──');
must('t2_smeta_revision ledger: seq 0 = asl (original), seq N = ozgarish', /seq 0 = original baseline|seq 0 = 'asl'/i.test(m1) && /tur in \('asl','ozgarish'\)/.test(m1n));
must('t2_akt / t2_akt_qator stamp the effective revision_id', /add column if not exists revision_id/.test(m1) && /revision_id\)\s*(--|$)/m.test(m1) || /,revision_id\)/.test(m1n));
must('acceptance: a later BOQ re-price does NOT rewrite the historical F2 baseline',
  /BOQ re-price silently rewrote the historical F2 baseline|reprice rewrote baseline/i.test(m1a));
must('acceptance: F2 certified ABOVE baseline AND BELOW baseline both covered',
  /variance should be positive/i.test(m1a) && /variance should be negative/i.test(m1a));
must('acceptance: historical period unchanged after later revision',
  /historical period baseline value changed after later revision|historical period certified price changed/i.test(m1a));

console.log('\n── Nakopitelniy: approved-only cumulative, bounded, stable ──');
must('t2_nakopitelniy_v1 is STABLE + has NO temp table (correctness of volatility/DDL)', (() => {
  const body = (m1.match(/create or replace function public\.t2_nakopitelniy_v1[\s\S]*?\$\$;/) || [''])[0];
  return /language plpgsql stable/i.test(body) && !/create temp table/i.test(body);
})());
must('cumulative uses APPROVED F2 only (a.holat=tasdiqlangan)', /a\.holat='tasdiqlangan' and a\.oy/.test(m1n));
must('draft F2 kept separate (joriy_qoralama_summa)', /joriy_qoralama_summa/.test(m1));
must('previous / current / cumulative / remaining all present',
  /'oldingi_summa'/.test(m1) && /'joriy_tasdiqlangan_summa'/.test(m1) && /'jami_tasdiqlangan_summa'/.test(m1) && /'qoldiq_summa'/.test(m1));
must('acceptance: previous + current-approved = cumulative; remaining = smeta - cumulative',
  /cumulative reconciliation \(prev \+ current-approved\)|jami_tasdiqlangan_summa.*oldingi_summa/i.test(m1a) && /remaining value != smeta - cumulative/i.test(m1a));
must('acceptance: draft F2 must NOT leak into certified current period',
  /draft F2 leaked into certified current period|draft F2 not surfaced separately/i.test(m1a));
must('detail bounded (limit clamp), totals over ALL rows',
  /least\(greatest\(coalesce\(p_limit,500\),1\),3000\)/.test(m1n) && /into v_jami from agg/.test(m1n));
must('pending change delta shown separately (not in certified totals)', /pending_ozgarish_delta/.test(m1));
must('membership-checked + service_role only', /t2_actor_kompaniya_azo_tekshir/.test(m1n) && /revoke all on function public\.t2_nakopitelniy_v1/.test(m1));

console.log('\n── Change control: governed layer, not a 2nd smeta ──');
must('reuses t2_qator_tahrir / t2_qator_qosh (no parallel line writer)',
  /public\.t2_qator_tahrir\(/.test(m2n) && /public\.t2_qator_qosh\(/.test(m2n));
must('carries reason / type / evidence / effective period / affected IDs / before-after',
  /sabab/.test(m2) && /evidence_hujjat_id/.test(m2) && /effective_oy/.test(m2) && /baseline_snapshot/.test(m2) && /eski_hajm.*yangi_hajm/.test(m2n));
must('all professional change kinds supported',
  ['almashtirish','qoshimcha_ish','olib_tashlash','hajm_ozgarish','yangi_bolim','yangi_ish','resurs_almashtirish','boshqa']
    .every((k) => m2.includes("'" + k + "'")));

console.log('\n── ATOMIC approval (correction #1) ──');
must('preflight validates EVERY line before any mutation', /PHASE 1 — PREFLIGHT: validate EVERY line, ZERO mutation/.test(m2));
must('preflight collects errors, returns CHANGE_PREFLIGHT_FAILED with zero mutation',
  /if jsonb_array_length\(v_xatolar\) > 0 then[\s\S]{0,120}CHANGE_PREFLIGHT_FAILED/.test(m2n));
must('preflight covers: existence, hierarchy, snapshot version, required values, new-line parent, kat',
  /QATOR_NOT_IN_OBJECT/.test(m2) && /NEW_LINE_PARENT/.test(m2) && /NEW_LINE_HIERARCHY/.test(m2) && /SCOPE_DRIFT/.test(m2) && /YANGI_HAJM_REQUIRED/.test(m2) && /NEW_LINE_KAT_INVALID/.test(m2));
must('affected rows locked FOR UPDATE across preflight+apply', /select qator_id from public\.t2_smeta_ozgarish_qator[\s\S]{0,80}for update/.test(m2n));
must('apply-phase race forces rollback (raise exception, never partial-commit)', /raise exception 'CHANGE_APPLY_RACE/.test(m2));
must('acceptance PROVES zero partial mutation (line 1 untouched when line 2 fails)',
  /FAIL ATOMICITY: line 1 was mutated despite line 2 preflight failure|line 1 mutated/i.test(m2a));

console.log('\n── Approved-change reversal (correction #2) ──');
must('reversal writes a COMPENSATING revision (forward event), not a deletion',
  /COMPENSATING revision|compensating revision|kompensatsiya_revision_id/.test(m2));
must('added qator is SOFT-removed on reversal (hajm=0), never hard-deleted',
  /soft-remove any qator this order added|soft-remove any line this order ADDED/i.test(m2) && !/delete from public\.t2_qator/i.test(m2n));
must('acceptance: added row still EXISTS after reversal (history preserved)',
  /added row hard-deleted \(history lost\)|added not soft-removed/i.test(m2a));
must('acceptance: original baseline + revision chain intact after reversal',
  /original baseline lost after reversal|compensating revision missing/i.test(m2a));

console.log('\n── Migration rollback correctness (correction #3) ──');
must('rollback 1 is PRE-USE ONLY and REFUSES when post-use data exists',
  /PRE-USE SCHEMA ROLLBACK/.test(m1r) && /POST-USE: t2_smeta_revision has|Pre-use rollback refused/.test(m1r));
must('rollback 2 refuses to delete change/revision lineage while mutations remain',
  /PRE-USE SCHEMA ROLLBACK/.test(m2r) && /Pre-use rollback refused/.test(m2r) && /forward repair/i.test(m2r));
must('rollback docs point to t2_smeta_ozgarish_qaytar_v1 / compensating migration for post-use',
  /t2_smeta_ozgarish_qaytar_v1|forward-repair|forward repair/i.test(m2r));

console.log('\n── Acceptance sentinels + AI safety ──');
must('m1 acceptance raises PARK_F2_BASELINE_ACCEPTANCE_PASS', /PARK_F2_BASELINE_ACCEPTANCE_PASS/.test(m1a));
must('m2 acceptance raises SMETA_CHANGE_CONTROL_ACCEPTANCE_PASS', /SMETA_CHANGE_CONTROL_ACCEPTANCE_PASS/.test(m2a));
must('no AI / Drive / Sheets / GAS anywhere in the valuation or change path',
  !/openai|gemini|groq|aiCall|DriveApp|SpreadsheetApp|\/api\/gas/i.test(m1 + m2));

console.log('\n── Architecture doc ──');
must('doc is evidence-grounded (real objects + existing RPCs named)',
  /Amfiteatr/.test(doc) && /t2_akt_yarat/.test(doc) && /t2_qator_holat/.test(doc));
must('doc follows REUSE / EXTEND / ADDITIVE decision order', /REUSE/.test(doc) && /EXTEND/.test(doc) && /ADDITIVE/.test(doc));
must('doc keeps PARK as reference scenario, not a canonical name', !/t2_park_|park_project_id/.test(doc));

console.log('\n' + ok + ' checks passed');
