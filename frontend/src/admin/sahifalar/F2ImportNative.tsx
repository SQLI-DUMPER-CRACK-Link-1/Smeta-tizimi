import { useEffect, useMemo, useRef, useState } from 'react';
import {
  sbT2AktYaratV2, sbT2DaraxtOl, sbT2F2ImportDraftRoyxat, sbT2F2ImportDraftSaqla,
  sbT2F2ImportJobHolat, sbT2F2ImportJobIlgarilash, sbT2F2ImportJobYarat,
  sbT2ObyektlarOlKomp, yangiOperationId, type T2Obyekt, type T2Qator,
} from '../../api/supabase';
import { useKompaniya } from '../../umumiy/kontekst/KompaniyaKontekst';
import { readXlsx, f2FaylOqiCore, type XlsxWorkbook, type F2ColumnConfig, type SheetGrid } from '../../lib/f2-import-parse';
import { type AktNode, type LrvNode, type F2MatchResult } from '../../lib/f2-match-engine';
import { f2AggregatsiyaQator, f2ExactPayloadQur, type F2ExactManbaTugun } from '../../test02/f2-exact-payload';
import { F2PreapprovalAudit } from '../../test02/F2PreapprovalAudit';

/* T2-GAS-EXIT-001 SS5/SS6 + T2-PTO-CLOSURE-007-CODEX-F2-RESUMABLE-IMPORT:
 * eski qattiq devor (15MB / 20000 qator) endi durable job/draft modeli bilan
 * almashtirildi -- migratsiya (`t2_f2_import_job_v1`) cheklovi 100000 qatorgacha
 * ruxsat beradi, lekin bu yerda ancha kichikroq, HAQIQATAN sinovdan o'tgan
 * chegara tanlandi: f2-match-engine.perf.test.ts ~52 800 qatorni ~2s da
 * moslashtiradi (real production 6-daqiqalik GAS limitidan ~180x tezroq);
 * Codex'ning "tugadi" mezoni aynan ~30000 qatorlik sintetik faylni talab
 * qiladi. 60000/50MB -- shu ikkalasidan sezilarli yuqori, lekin brauzer
 * xotirasi cheksiz emasligini application MUHOKAMASIZ tan oladi. */
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_ROWS = 60000;
/** `t2_f2_import_draft_saqla_v1` o'zi bitta chaqiruvda 5000 tadan ko'pini rad etadi. */
const DRAFT_CHUNK = 5000;

function jobKey(objectId: string) { return 't2-f2-import-job:' + objectId; }

type Resumable = { jobId: number; matched: number; total: number | null; updatedAt: string };

/** `hajm/narx/summa` durable draftda o'zi saqlangani uchun (T2-PTO-CLOSURE-007
 *  REPORT) qayta tiklashda original faylga qaytish shart emas -- faqat R2 fayl
 *  saqlash (ataylab bu safar qamrovdan chiqarilgan) yo'qligi sabab, "kod"dan
 *  boshqa (nom/bir) ko'rgazma matni tiklanmaydi. Bu funksionallikka ta'sir
 *  qilmaydi -- `exactWrite` faqat hajm/narx/summaga tayanadi. */
function draftdanTiklash(qatorlar: { uid: string; hajm: number | null; narx: number | null; summa: number | null; lrv_row: number | null; kod: string | null }[]) {
  const source: F2ExactManbaTugun[] = [];
  const mapping = new Map<string, number>();
  const labels = new Map<string, string>();
  for (const q of qatorlar) {
    if (q.hajm == null) continue; // hal_qilinmagan/otkazib_yuborildi -- moslashmagan, exactWrite baribir rad etadi
    source.push({ uid: q.uid, hajm: q.hajm, narx: q.narx, summa: q.summa });
    if (q.lrv_row != null) mapping.set(q.uid, q.lrv_row);
    labels.set(q.uid, (q.kod || q.uid) + ' (davom ettirilgan sessiya)');
  }
  return { source, mapping, labels };
}

// Bu adapter asl katakni tekshiradi. Matcher qaytargan narx/summa manba emas.
function son(value: unknown): number | undefined {
  if (value == null || String(value).trim() === '') return undefined;
  const text = String(value).replace(/\s/g, '').replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
}

export function sourceLeaves(tree: AktNode[], grid: SheetGrid, cols: F2ColumnConfig): F2ExactManbaTugun[] {
  const out: F2ExactManbaTugun[] = [];
  const stack = [...tree];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.children?.length) { stack.push(...n.children); continue; }
    if (n.type === 'rz') continue;
    // UID faqat shu immutable fayl ichidagi manba manzili; canonical ID emas.
    const match = /^f2_(\d+)$/.exec(n.uid);
    if (!match) throw new Error('Manba qator manzili aniqlanmadi.');
    const raw = grid[Number(match[1])];
    if (!raw) throw new Error('Manba qator topilmadi.');
    const qty = son(raw[cols.obyom] == null || String(raw[cols.obyom]).trim() === '' ? raw[cols.norma] : raw[cols.obyom]);
    if (qty === undefined) throw new Error('Hujjat hajmi noaniq. Ustunlarni tekshiring.');
    out.push({ uid: n.uid, hajm: qty, narx: son(raw[cols.narx]), summa: son(raw[cols.sum]) });
  }
  return out;
}

export function exactWrite(nodes: F2ExactManbaTugun[], mapping: Map<string, number>) {
  if (!nodes.length || nodes.some(n => !mapping.has(n.uid))) throw new Error('Barcha manba qatorlari moslashtirilishi kerak.');
  // Shared helper nol summani yo'q deb hisoblaydi; shu holatni jim o'tkazmaymiz.
  if (nodes.some(n => n.narx == null || n.narx <= 0 || n.summa == null || n.summa === 0)) {
    throw new Error('Narx yoki summa yo‘q/nol. Bu holat uchun manba kontrakti aniqlashtirilmaguncha yozish yopiq.');
  }
  const rows = f2AggregatsiyaQator(nodes, uid => mapping.get(uid));
  if (rows.some(r => r.barchaNarxlar.length > 1)) throw new Error('Bir smeta qatoriga turli narxlar tushdi. Bog‘lanishni tekshiring.');
  const result = f2ExactPayloadQur(rows);
  if (!result.ok) throw new Error('Hujjat summasi noaniq. Yozish to‘xtatildi.');
  return result.qatorlar;
}

function NativeSession({ companyId }: { companyId: number }) {
  const [objects, setObjects] = useState<T2Obyekt[]>([]);
  const [objectId, setObjectId] = useState('');
  const [book, setBook] = useState<XlsxWorkbook | null>(null);
  const [sheetName, setSheetName] = useState('');
  const [cols, setCols] = useState<F2ColumnConfig | null>(null);
  const [source, setSource] = useState<F2ExactManbaTugun[]>([]);
  const [mapping, setMapping] = useState(new Map<string, number>());
  const [labels, setLabels] = useState(new Map<string, string>());
  const [targets, setTargets] = useState(new Map<number, string>());
  const [page, setPage] = useState(0);
  const [phase, setPhase] = useState('Faylni tanlang');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [month, setMonth] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [done, setDone] = useState(false);
  const [resumable, setResumable] = useState<Resumable | null>(null);
  const [draftXato, setDraftXato] = useState('');
  const operation = useRef('');
  const generation = useRef(0);
  const writing = useRef(false);
  const jobId = useRef<number | null>(null);
  const jobVersiya = useRef(1);
  useEffect(() => {
    let active = true;
    void sbT2ObyektlarOlKomp(companyId).then(r => {
      if (!active) return;
      if (!r.ok) { setError('Obyektlar o‘qilmadi.'); return; }
      setObjects((r.qatorlar || []) as T2Obyekt[]);
    }).catch(() => { if (active) setError('Obyektlar o‘qilmadi.'); });
    return () => { active = false; generation.current++; };
  }, [companyId]);
  /* Obyekt tanlanganda — o'sha obyekt uchun tugallanmagan job bormi tekshiramiz
   * (localStorage FAQAT job_id'ni eslab qoladi — haqiqat manbai Supabase'da). */
  useEffect(() => {
    setResumable(null);
    if (!objectId) return;
    let active = true;
    const raw = (() => { try { return localStorage.getItem(jobKey(objectId)); } catch { return null; } })();
    const id = raw ? Number(raw) : NaN;
    if (!Number.isFinite(id) || id <= 0) return;
    void sbT2F2ImportJobHolat(id).then(r => {
      if (!active) return;
      if (!r.ok || !r.status || r.status === 'completed' || r.status === 'failed' || r.status === 'cancelled') {
        try { localStorage.removeItem(jobKey(objectId)); } catch { /* Faqat kesh. */ }
        return;
      }
      setResumable({ jobId: id, matched: r.matched_rows ?? 0, total: r.total_rows ?? null, updatedAt: r.updated_at || '' });
    }).catch(() => { /* Tarmoq xatosi -- keyingi safar qayta urinamiz, hozircha yangi importga to'sqinlik qilmaymiz. */ });
    return () => { active = false; };
  }, [objectId]);
  function reset() {
    generation.current++;
    setSource([]); setMapping(new Map()); setReviewed(false); setDone(false); setError(''); setDraftXato(''); setPage(0);
    operation.current = ''; jobId.current = null; jobVersiya.current = 1;
  }
  async function resume(r: Resumable) {
    reset(); setBusy(true); setPhase('Oldingi sessiya tiklanmoqda');
    try {
      const [job, draft, smeta] = await Promise.all([
        sbT2F2ImportJobHolat(r.jobId), sbT2F2ImportDraftRoyxat(r.jobId), sbT2DaraxtOl(Number(objectId)),
      ]);
      if (!job.ok || !draft.ok || !smeta.ok) throw new Error();
      const cursor = (job.cursor || {}) as { writeOperationId?: string; month?: string };
      const { source: tiklanganSource, mapping: tiklanganMapping, labels: tiklanganLabels } = draftdanTiklash(draft.qatorlar);
      const rows = (smeta.qatorlar || []) as T2Qator[];
      setTargets(new Map(rows.map(q => [q.id, `${q.kod || ''} ${q.nom || ''} (${q.birlik || '—'})`])));
      setLabels(tiklanganLabels); setSource(tiklanganSource); setMapping(tiklanganMapping);
      operation.current = cursor.writeOperationId || yangiOperationId();
      setMonth(cursor.month || ''); jobId.current = r.jobId; jobVersiya.current = job.versiya || 1;
      setResumable(null); setPhase('Ko‘rib chiqish kerak (tiklangan)');
    } catch { setError('Oldingi sessiya tiklanmadi. Faylni qayta yuklashingiz mumkin.'); }
    finally { setBusy(false); }
  }
  function chooseSheet(workbook: XlsxWorkbook, name: string) {
    reset(); setSheetName(name);
    const sheet = workbook.sheet(name);
    const preview = sheet && f2FaylOqiCore(sheet.rows);
    setCols(preview && 'cols' in preview ? preview.cols : null);
  }
  async function upload(file: File) {
    reset(); setBook(null); setCols(null); setBusy(true); setPhase('Fayl o‘qilmoqda');
    const token = generation.current;
    try {
      if (file.size > MAX_FILE_BYTES) throw new Error(`Fayl ${MAX_FILE_BYTES / 1024 / 1024} MB dan katta.`);
      const workbook = await readXlsx(await file.arrayBuffer());
      if (generation.current !== token) return;
      setBook(workbook); chooseSheet(workbook, workbook.sheets[0]?.name || ''); setPhase('Varaq va ustunlarni tekshiring');
    } catch { if (generation.current === token) setError(`Fayl o‘qilmadi yoki ${MAX_FILE_BYTES / 1024 / 1024} MB chegarasidan oshdi. XLSX faylni tekshiring.`); }
    finally { setBusy(false); }
  }
  async function match() {
    if (!book || !cols || !objectId) return;
    reset(); const token = generation.current; setBusy(true); setPhase('Moslashtirilmoqda');
    try {
      const sheet = book.sheet(sheetName)!;
      if (sheet.rows.length > MAX_ROWS) throw new Error(`Varaq ${MAX_ROWS} qatordan katta.`);
      const built = f2FaylOqiCore(sheet.rows, cols);
      if (!('tree' in built)) throw new Error('Ustunlarni tekshiring.');
      const leaves = sourceLeaves(built.tree, sheet.rows, cols);
      const r = await sbT2DaraxtOl(Number(objectId));
      if (!r.ok) throw new Error('Smeta o‘qilmadi.');
      const rows = (r.qatorlar || []) as T2Qator[];
      if (rows.length > MAX_ROWS) throw new Error(`Smeta ${MAX_ROWS} qatordan katta.`);
      const index = new Map<number, LrvNode>(rows.map(q => [q.id, { type: q.tur as LrvNode['type'], kod: q.kod || undefined, nom: q.nom || undefined, birlik: q.birlik || undefined, row: q.id, varaq: 'SB', children: [] }]));
      const roots: LrvNode[] = [];
      for (const q of rows) { const n = index.get(q.id)!; const parent = q.ota_id == null ? undefined : index.get(q.ota_id); if (parent) parent.children!.push(n); else roots.push(n); }
      const response = await fetch('/api/f2-moslash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amal: 'moslash', aktTree: built.tree, lrvTree: roots }) });
      if (!response.ok) throw new Error('Moslashtirish bajarilmadi.');
      const result = await response.json() as F2MatchResult & { ok: boolean };
      if (!result.ok) throw new Error('Moslashtirish bajarilmadi.');
      if (generation.current !== token) return;
      const bindings = new Map<string, number>();
      for (const m of result.mosliklar) {
        if (!index.has(m.row) || bindings.has(m.uid)) throw new Error('Moslashtirish javobida noaniq bog‘lanish bor.');
        bindings.set(m.uid, m.row);
      }
      const names = new Map<string, string>();
      const stack = [...built.tree];
      while (stack.length) { const n = stack.pop()!; names.set(n.uid, `${n.kod || ''} ${n.nom || ''} (${n.bir || '—'})`); stack.push(...(n.children || [])); }
      setLabels(names); setTargets(new Map(rows.map(q => [q.id, `${q.kod || ''} ${q.nom || ''} (${q.birlik || '—'})`])));
      setSource(leaves); setMapping(bindings); operation.current = yangiOperationId(); setPhase('Ko‘rib chiqish kerak');
      await qoralamaniSaqla(leaves, bindings, names);
    } catch (e) { if (generation.current === token) setError(e instanceof Error ? e.message : 'O‘qish bajarilmadi.'); }
    finally { setBusy(false); }
  }
  /**
   * T2-GAS-EXIT-001 SS5/SS6: moslashtirish natijasi DARHOL Supabase'ga
   * yoziladi -- refresh/PC o'chishi/tarmoq uzilishi natijani yo'qotmasin.
   * ATAYLAB best-effort: bu qatlam ishlamasa ham ko'rib chiqish/yozish
   * (exactWrite/save) davom etishi kerak -- resumability yordamchi, EXACT
   * SOURCE yozish yo'lining o'zi emas (Codex handoff SS4 qat'iy chegara). */
  async function qoralamaniSaqla(leaves: F2ExactManbaTugun[], bindings: Map<string, number>, names: Map<string, string>) {
    try {
      const job = await sbT2F2ImportJobYarat({ obyektId: Number(objectId), operationId: yangiOperationId(), totalRows: leaves.length });
      if (!job.ok || job.job_id == null) throw new Error(job.error || job.code || 'job yaratilmadi');
      jobId.current = job.job_id; jobVersiya.current = 1;
      try { localStorage.setItem(jobKey(objectId), String(job.job_id)); } catch { /* Faqat kesh -- ishlamasa ham davom etamiz. */ }

      /* Har bo'lakdan keyin darhol checkpoint -- shu tufayli o'rtada
         uzilish (refresh/tarmoq/PC) OXIRGI bo'lakdan qayta boshlamaydi,
         `processed_rows`/`cursor.chunk` orqali qayerda to'xtaganini biladi.
         Birinchi chunk 'queued'->'running' o'tkazadi (ruxsat etilgan yo'l),
         keyingilari 'running'->'running' (o'z-o'ziga, ham ruxsat etilgan). */
      for (let i = 0; i < leaves.length; i += DRAFT_CHUNK) {
        const bolak = leaves.slice(i, i + DRAFT_CHUNK);
        const d = await sbT2F2ImportDraftSaqla({
          jobId: job.job_id,
          qatorlar: bolak.map(n => ({
            uid: n.uid,
            holat: bindings.has(n.uid) ? 'avto_moslashti' : 'hal_qilinmagan',
            lrvRow: bindings.get(n.uid), kod: (names.get(n.uid) || '').split(' ')[0] || undefined,
            hajm: n.hajm, narx: n.narx ?? undefined, summa: n.summa ?? undefined,
          })),
        });
        if (!d.ok) throw new Error(d.error || d.code || 'qoralama saqlanmadi');
        const bolakMos = bolak.filter(n => bindings.has(n.uid)).length;
        const prog = await sbT2F2ImportJobIlgarilash({
          jobId: job.job_id, expectedVersiya: jobVersiya.current,
          processedDelta: bolak.length, matchedDelta: bolakMos, unmatchedDelta: bolak.length - bolakMos,
          cursor: { phase: 'review', chunk: i + bolak.length, writeOperationId: operation.current, month },
          status: 'running',
        });
        if (!prog.ok) throw new Error(prog.error || prog.code || 'checkpoint yozilmadi');
        jobVersiya.current = prog.versiya!;
      }
    } catch (e) {
      /* Foydalanuvchi hozir ko'rib chiqishda davom etadi -- faqat
         "refresh qilsangiz yo'qolishi mumkin" deb ogohlantiramiz. */
      setDraftXato('Qoralama saqlanmadi (' + (e instanceof Error ? e.message : 'noma\'lum xato') + ') — hozircha davom etishingiz mumkin, lekin sahifa yopilsa oxirgi holat tiklanmasligi mumkin.');
    }
  }
  const payload = useMemo(() => { try { return { rows: exactWrite(source, mapping), error: '' }; } catch (e) { return { rows: [], error: e instanceof Error ? e.message : 'Tekshiruv kerak.' }; } }, [source, mapping]);
  async function save() {
    if (writing.current || done || !reviewed || payload.error || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return;
    writing.current = true; setBusy(true); setPhase('Yozilmoqda'); setError('');
    try {
      const provenance = new Map<number, F2ExactManbaTugun[]>();
      for (const n of source) { const id = mapping.get(n.uid)!; const group = provenance.get(id) || []; group.push(n); provenance.set(id, group); }
      const r = await sbT2AktYaratV2({ obyektId: Number(objectId), oy: month + '-01', operationId: operation.current, qatorlar: payload.rows.map(q => ({ ...q, rawSnapshot: { sheetName, source: provenance.get(q.qatorId) } })) });
      if (!r.ok) { setError('Hujjat saqlanmadi. Tanlovni o‘zgartirmasdan qayta urinishingiz mumkin.'); return; }
      setDone(true); setPhase('Tayyor — F2 qoralamasi saqlandi');
      /* Job endi kerak emas -- best-effort yopamiz. EXACT SOURCE hujjat
         (`t2_akt`) allaqachon yozilgan, bu qadam faqat ledger tozaligi
         uchun; muvaffaqiyatsiz bo'lsa foydalanuvchiga ta'sir qilmaydi. */
      if (jobId.current != null) {
        try {
          await sbT2F2ImportJobIlgarilash({
            jobId: jobId.current, expectedVersiya: jobVersiya.current,
            processedDelta: 0, matchedDelta: 0, unmatchedDelta: 0, status: 'completed',
          });
        } catch { /* Ledger tozaligi -- yozuvning o'zi allaqachon muvaffaqiyatli. */ }
        try { localStorage.removeItem(jobKey(objectId)); } catch { /* Faqat kesh. */ }
      }
    } catch { setError('Yozish javobi olinmadi. Qayta urinish ayni operatsiyani tekshiradi.'); }
    finally { writing.current = false; setBusy(false); }
  }
  return <section className="p-4 space-y-4 max-w-5xl">
    <h1 className="text-xl font-semibold">F2 import — yangi rejim</h1>
    <p role="status">{phase}</p>
    {resumable && !source.length && <p className="karta p-3">
      Tugallanmagan import bor ({resumable.matched}/{resumable.total ?? '?'} qator moslashtirilgan, {resumable.updatedAt ? new Date(resumable.updatedAt).toLocaleString() : ''}).{' '}
      <button onClick={() => void resume(resumable)} disabled={busy}>Davom ettirish</button>
    </p>}
    {draftXato && <p role="alert" className="text-warn">{draftXato}</p>}
    <fieldset disabled={busy || done} className="flex flex-wrap gap-4">
      <label>Obyekt<select aria-label="Obyekt" value={objectId} onChange={e => { reset(); setObjectId(e.target.value); }}><option value="">Tanlang</option>{objects.map(o => <option key={o.id} value={o.id}>{o.nom}</option>)}</select></label>
      <label>F2 davri<input type="month" value={month} onChange={e => setMonth(e.target.value)} disabled={source.length > 0} /></label>
      <label>XLSX fayl<input type="file" accept=".xlsx,.xlsm" onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); }} /></label>
      {book && <label>Varaq<select value={sheetName} onChange={e => chooseSheet(book, e.target.value)}>{book.sheets.map(s => <option key={s.name}>{s.name}</option>)}</select></label>}
    </fieldset>
    {cols && <fieldset disabled={busy || done} className="karta p-3 flex flex-wrap gap-3"><legend>Ustun raqamlari (1 dan boshlab) — fayl bilan solishtiring</legend>{(Object.keys(cols) as (keyof F2ColumnConfig)[]).map(k => <label key={k}>{k}<input className="w-16 border" type="number" min="1" value={cols[k] + 1} onChange={e => { reset(); setCols({ ...cols, [k]: Number(e.target.value) - 1 }); }} /></label>)}<button onClick={() => void match()} disabled={!objectId || !month}>Moslashtirish</button></fieldset>}
    {error && <p role="alert" className="text-danger">{error}</p>}
    {source.length > 0 && <><p>{source.length} manba qatoridan {source.filter(n => mapping.has(n.uid)).length} tasi bog‘landi.</p>
      <details><summary>Bog‘lanishlarni ko‘rish</summary><div className="overflow-auto"><table className="w-full text-sm"><thead><tr><th>F2 manba</th><th>Smeta qatori</th><th>Hajm</th><th>Narx</th><th>Hujjat summasi</th></tr></thead><tbody>{source.slice(page * 50, page * 50 + 50).map(n => <tr key={n.uid}><td>{labels.get(n.uid)}</td><td>{targets.get(mapping.get(n.uid) || 0) || 'Moslashtirilmagan'}</td><td>{n.hajm}</td><td>{n.narx ?? '—'}</td><td>{n.summa ?? '—'}</td></tr>)}</tbody></table></div><button disabled={page === 0} onClick={() => setPage(p => p - 1)}>Oldingi</button><span> {page + 1} / {Math.ceil(source.length / 50)} </span><button disabled={(page + 1) * 50 >= source.length} onClick={() => setPage(p => p + 1)}>Keyingi</button></details>
      <F2PreapprovalAudit aktBarglar={source} getSmetaId={uid => mapping.get(uid)} />
      {payload.error && <p role="alert">{payload.error}</p>}
      <label className="block"><input type="checkbox" checked={reviewed} disabled={busy || done} onChange={e => setReviewed(e.target.checked)} /> Varaq, davr va moslashtirish natijasini tekshirdim</label>
      <button className="karta p-3" disabled={busy || done || !reviewed || !!payload.error} onClick={() => void save()}>F2 qoralamasini saqlash</button>
    </>}
  </section>;
}

export default function F2ImportNative() {
  const { joriy, yuklanmoqda } = useKompaniya();
  if (yuklanmoqda) return <p>Kompaniya yuklanmoqda…</p>;
  if (!joriy?.id) return <p>Kompaniyani tanlang.</p>;
  return <NativeSession key={joriy.id} companyId={joriy.id} />;
}
