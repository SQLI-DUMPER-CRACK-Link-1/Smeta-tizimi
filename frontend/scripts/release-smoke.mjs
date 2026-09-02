#!/usr/bin/env node
/* Non-destructive post-deploy release smoke. It never logs in or mutates data. */
const base = process.env.RELEASE_SMOKE_BASE_URL?.replace(/\/+$/, '');
const cookie = process.env.RELEASE_SMOKE_COOKIE;
const objectId = process.env.RELEASE_SMOKE_OBJECT_ID;
const companyId = process.env.RELEASE_SMOKE_COMPANY_ID;
if (!base) { console.error('RELEASE_SMOKE_FAIL missing RELEASE_SMOKE_BASE_URL'); process.exit(2); }
const headers = cookie ? { Cookie: cookie } : {};
let failed = 0; let skipped = 0;
const check = async (name, pathname, expected, json = false) => {
  try {
    const response = await fetch(base + pathname, { headers, redirect: 'manual' });
    const contentType = response.headers.get('content-type') || ''; const body = await response.text();
    const statusOk = expected.includes(response.status); const jsonOk = !json || contentType.includes('application/json');
    if (!statusOk || !jsonOk || /<html/i.test(body) && json) { failed++; console.error(`FAIL ${name} status=${response.status} content-type=${contentType}`); return; }
    console.log(`PASS ${name} status=${response.status}`);
  } catch (error) { failed++; console.error(`FAIL ${name} network=${String(error?.message || error)}`); }
};
await check('session', '/api/sessiya', [200, 401, 503], true);
await check('workbench-route', '/admin/hujjat-nazorat', [200], false);
if (cookie && objectId) {
  await check('workbench-read', `/api/hujjat-nazorat?amal=workbench&obyekt_id=${encodeURIComponent(objectId)}`, [200, 403, 501], true);
  await check('nakopitelniy-read', `/api/hujjat-nazorat?amal=nakopitelniy&obyekt_id=${encodeURIComponent(objectId)}`, [200, 403, 501], true);
  await check('change-list-read', `/api/hujjat-nazorat?amal=ozgarish-royxat&obyekt_id=${encodeURIComponent(objectId)}`, [200, 403, 501], true);
  await check('closeout-read', `/api/hujjat-nazorat?amal=closeout&obyekt_id=${encodeURIComponent(objectId)}`, [200, 403, 501], true);
} else { skipped += 4; console.log('SKIP authenticated Workbench reads: set RELEASE_SMOKE_COOKIE and RELEASE_SMOKE_OBJECT_ID'); }
if (cookie && companyId) await check('document-center-read', `/api/hujjat-royxat?kompaniya_id=${encodeURIComponent(companyId)}`, [200, 403, 501], true);
else { skipped++; console.log('SKIP authenticated Document Center read: set RELEASE_SMOKE_COOKIE and RELEASE_SMOKE_COMPANY_ID'); }
if (failed) { console.error(`RELEASE_SMOKE_FAIL failures=${failed} skipped=${skipped}`); process.exit(1); }
console.log(`RELEASE_SMOKE_PASS skipped=${skipped}`);
