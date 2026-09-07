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
import { Skelet } from '../../umumiy/ui/Sahifa';
import { IkkiPanel } from '../../umumiy/ui/IkkiPanel';

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

/** `hajm/narx/summa` durable draftda o'zi saqlangani uchun qayta tiklashda
 *  original faylga qaytish shart emas. Dastlabki sessiyada esa fayl avval
 *  canonical R2 registry'ga yoziladi; resume mavjud jobning saqlangan
 *  source_document_id bog'lanishiga tayanadi. */
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
  const [matchingFilter, setMatchingFilter] = useState<'all' | 'suggested' | 'unmatched'>('all');
  const [sourceSearch, setSourceSearch] = useState('');
  const [targetSearch, setTargetSearch] = useState('');
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<number | null>(null);
  const [manualBindings, setManualBindings] = useState<Set<string>>(new Set());
  const targetRowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});
  const sourceRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
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
  const rawFile = useRef<File | null>(null);
  const sourceDocId = useRef<number | undefined>(undefined);
  const sourceOperationId = useRef('');
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
    setMatchingFilter('all'); setSourceSearch(''); setTargetSearch(''); setSelectedUid(null); setSelectedTargetId(null); setManualBindings(new Set());
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
    rawFile.current = file; sourceDocId.current = undefined; sourceOperationId.current = yangiOperationId();
    const token = generation.current;
    try {
      if (file.size > MAX_FILE_BYTES) throw new Error(`Fayl ${MAX_FILE_BYTES / 1024 / 1024} MB dan katta.`);
      const workbook = await readXlsx(await file.arrayBuffer());
      if (generation.current !== token) return;
      setBook(workbook); chooseSheet(workbook, workbook.sheets[0]?.name || ''); setPhase('Varaq va ustunlarni tekshiring');
    } catch { if (generation.current === token) setError(`Fayl o‘qilmadi yoki ${MAX_FILE_BYTES / 1024 / 1024} MB chegarasidan oshdi. XLSX faylni tekshiring.`); }
    finally { setBusy(false); }
  }
  /** T2-PTO-DAILY-FINAL-CUTOVER-008 P0.2: F2 manba fayli canonical R2'ga
   *  importdan OLDIN yoziladi. R2 qabul qilmasa, qoralama/kanonik akt
   *  yaratilmaydi — binary manba bilan biznes yozuvi ajralib ketmasin. Bir
   *  fayl sessiyasidagi qayta urinish aynan bitta operation_id bilan ketadi. */
  async function sourceniR2gaYukla(file: File, objId: number): Promise<number> {
    if (sourceDocId.current != null) return sourceDocId.current;
    try {
      const buf = await file.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', buf);
      const sha256 = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
      // `t2_f2_import_job_yarat_v1` hujjatning loyiha_id'ini obyektnikiga aynan
      // solishtiradi (SOURCE_DOCUMENT_SCOPE_MISMATCH) -- shuning uchun bu yerda
      // ham AYNAN o'sha loyiha_id yuboriladi, aks holda job hujjatni rad etadi.
      const loyihaId = objects.find(o => o.id === objId)?.loyiha_id ?? null;
      const fd = new FormData();
      fd.append('fayl', file); fd.append('kompaniya_id', String(companyId));
      if (loyihaId != null) fd.append('loyiha_id', String(loyihaId));
      fd.append('obyekt_id', String(objId)); fd.append('turi', 'f2_akt');
      fd.append('operation_id', sourceOperationId.current || (sourceOperationId.current = yangiOperationId()));
      fd.append('sha256', sha256); fd.append('size', String(file.size));
      const r = await fetch('/api/hujjat-yukla', { method: 'POST', body: fd });
      const j: any = await r.json().catch(() => null);
      const documentId = j && j.ok ? Number(j.document_id) : NaN;
      if (!r.ok || !Number.isSafeInteger(documentId) || documentId <= 0) {
        throw new Error('F2 manba fayli kanonik R2 saqlashga qabul qilinmadi.');
      }
      sourceDocId.current = documentId;
      return documentId;
    } catch (e) {
      if (e instanceof Error && e.message === 'F2 manba fayli kanonik R2 saqlashga qabul qilinmadi.') throw e;
      throw new Error('F2 manba fayli kanonik R2 ga yuklanmadi. Import to‘xtatildi.');
    }
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
      if (!rawFile.current) throw new Error('F2 manba fayli topilmadi. XLSX faylni qayta tanlang.');
      await sourceniR2gaYukla(rawFile.current, Number(objectId));
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
      setSource(leaves); setMapping(bindings); setManualBindings(new Set()); operation.current = yangiOperationId(); setPhase('Ko‘rib chiqish kerak');
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
      const job = await sbT2F2ImportJobYarat({ obyektId: Number(objectId), operationId: yangiOperationId(), totalRows: leaves.length, sourceDocumentId: sourceDocId.current });
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
  const importSummary = useMemo(() => {
    const unmatched = source.filter((row) => !mapping.has(row.uid)).length;
    const missingValues = source.filter((row) => row.narx == null || row.summa == null).length;
    const arithmeticMismatch = source.filter((row) => row.narx != null && row.summa != null && Math.abs(row.hajm * row.narx - row.summa) > 0.005).length;
    const reviewRequired = source.filter((row) => !mapping.has(row.uid) || row.narx == null || row.summa == null || (row.narx != null && row.summa != null && Math.abs(row.hajm * row.narx - row.summa) > 0.005)).length;
    return {
      exactMatched: source.length - reviewRequired,
      reviewRequired,
      unmatched,
      arithmeticMismatch,
      missingValues,
    };
  }, [mapping, source]);
  useEffect(() => {
    const target = selectedUid ? mapping.get(selectedUid) ?? null : null;
    setSelectedTargetId(target);
    const sourceRow = selectedUid ? sourceRowRefs.current[selectedUid] : null;
    const targetRow = target != null ? targetRowRefs.current[target] : null;
    if (sourceRow && typeof sourceRow.scrollIntoView === 'function') sourceRow.scrollIntoView({ block: 'nearest' });
    if (targetRow && typeof targetRow.scrollIntoView === 'function') targetRow.scrollIntoView({ block: 'nearest' });
  }, [mapping, selectedUid]);
  const visibleSource = useMemo(() => {
    const query = sourceSearch.trim().toLowerCase();
    return source.filter((row) => {
      const label = (labels.get(row.uid) || row.uid).toLowerCase();
      const mapped = mapping.has(row.uid);
      const stateMatches = matchingFilter === 'all' || (matchingFilter === 'suggested' && mapped && !manualBindings.has(row.uid)) || (matchingFilter === 'unmatched' && !mapped);
      return stateMatches && (!query || label.includes(query));
    });
  }, [labels, manualBindings, mapping, matchingFilter, source, sourceSearch]);
  useEffect(() => {
    if (!visibleSource.length) { setSelectedUid(null); return; }
    if (!selectedUid || !visibleSource.some((row) => row.uid === selectedUid)) setSelectedUid(visibleSource[0].uid);
  }, [selectedUid, visibleSource]);
  const visibleTargets = useMemo(() => {
    const query = targetSearch.trim().toLowerCase();
    return [...targets.entries()].filter(([, label]) => !query || label.toLowerCase().includes(query)).slice(0, 500);
  }, [targetSearch, targets]);
  const sourceByTarget = useMemo(() => {
    const index = new Map<number, F2ExactManbaTugun>();
    for (const row of source) {
      const targetId = mapping.get(row.uid);
      if (targetId != null && !index.has(targetId)) index.set(targetId, row);
    }
    return index;
  }, [mapping, source]);
  const manualRebind = (targetId: number) => {
    if (!selectedUid || done || busy) return;
    const next = new Map(mapping);
    next.set(selectedUid, targetId);
    setMapping(next);
    setManualBindings((old) => new Set(old).add(selectedUid));
    setSelectedTargetId(targetId);
  };
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
  return <section className="os-workbench space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">F2 · MANBA IMPORTI</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">F2 import</h1>
        <p className="mt-1 max-w-2xl text-sm text-text-dim">XLSX manbasini tekshiring, qatorlarni kanonik LRV bilan aniq bog‘lang va tasdiqlashdan oldin qoralama sifatida saqlang.</p>
      </div>
      <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs text-text-dim"><span className="h-1.5 w-1.5 rounded-full bg-accent" /> {phase}</span>
    </header>
    {resumable && !source.length && <p className="karta p-3">
      Tugallanmagan import bor ({resumable.matched}/{resumable.total ?? '?'} qator moslashtirilgan, {resumable.updatedAt ? new Date(resumable.updatedAt).toLocaleString() : ''}).{' '}
      <button onClick={() => void resume(resumable)} disabled={busy}>Davom ettirish</button>
    </p>}
    {draftXato && <p role="alert" className="text-warn">{draftXato}</p>}
    <fieldset disabled={busy || done} className="karta grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-xs text-text-dim">Obyekt<select aria-label="Obyekt" className="input mt-1 h-10" value={objectId} onChange={e => {
        reset(); setObjectId(e.target.value); rawFile.current = null;
        sourceDocId.current = undefined; sourceOperationId.current = '';
      }}><option value="">Tanlang</option>{objects.map(o => <option key={o.id} value={o.id}>{o.nom}</option>)}</select></label>
      <label className="text-xs text-text-dim">F2 davri<input className="input mt-1 h-10" type="month" value={month} onChange={e => setMonth(e.target.value)} disabled={source.length > 0} /></label>
      <label className="text-xs text-text-dim">XLSX fayl<input className="input mt-1 h-10 text-xs" type="file" accept=".xlsx,.xlsm" onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); }} /></label>
      {book && <label className="text-xs text-text-dim">Varaq<select className="input mt-1 h-10" value={sheetName} onChange={e => chooseSheet(book, e.target.value)}>{book.sheets.map(s => <option key={s.name}>{s.name}</option>)}</select></label>}
    </fieldset>
    {cols && <fieldset disabled={busy || done} className="karta flex flex-wrap items-end gap-3 p-4"><legend className="px-1 text-xs font-semibold text-text">Ustun raqamlari (1 dan boshlab)</legend>{(Object.keys(cols) as (keyof F2ColumnConfig)[]).map(k => <label key={k} className="text-xs text-text-dim">{k}<input className="input mt-1 h-9 w-20" type="number" min="1" value={cols[k] + 1} onChange={e => { reset(); setCols({ ...cols, [k]: Number(e.target.value) - 1 }); }} /></label>)}<button className="h-9 rounded-[10px] bg-accent px-4 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50" onClick={() => void match()} disabled={!objectId || !month}>Moslashtirish</button></fieldset>}
    {error && <p role="alert" className="text-danger">{error}</p>}
    {source.length > 0 && <>
      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5" aria-label="F2 import tekshiruv xulosasi">
        {[
          ['Aniq mos', importSummary.exactMatched, importSummary.exactMatched ? 'text-ok' : 'text-text'],
          ['Ko‘rib chiqish', importSummary.reviewRequired, importSummary.reviewRequired ? 'text-warn' : 'text-text'],
          ['Moslashmagan', importSummary.unmatched, importSummary.unmatched ? 'text-danger' : 'text-text'],
          ['Arifmetik farq', importSummary.arithmeticMismatch, importSummary.arithmeticMismatch ? 'text-warn' : 'text-text'],
          ['Qiymat yo‘q', importSummary.missingValues, importSummary.missingValues ? 'text-warn' : 'text-text'],
        ].map(([label, value, tone]) => <div key={String(label)} className="karta px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-mute">{label}</p><p className={`mt-1 text-lg font-semibold tabular-nums ${tone}`}>{value}</p></div>)}
      </section>
      <section className="karta flex flex-wrap items-center justify-between gap-3 p-3" aria-label="F2 matching filterlari">
        <div className="flex flex-wrap items-center gap-2 text-xs text-text-dim"><span>{source.length} manba qatoridan {source.filter((n) => mapping.has(n.uid)).length} tasi bog‘landi.</span><span>·</span><span>{targets.size} kanonik qator</span></div>
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Moslash holati">
          {([['all', 'Hammasi'], ['suggested', 'Avto moslangan'], ['unmatched', 'Moslashmagan']] as const).map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={matchingFilter === id} onClick={() => { setMatchingFilter(id); setPage(0); }} className={`rounded-full border px-2.5 py-1 text-[11px] ${matchingFilter === id ? 'border-accent bg-accent/15 text-text' : 'border-border text-text-dim hover:text-text'}`}>{label}</button>)}
        </div>
      </section>
      <IkkiPanel
        balandlik="min(640px, calc(100dvh - 390px))"
        chapSarlavha={<span>F2 manba <span className="text-text-mute">({visibleSource.length})</span></span>}
        ongSarlavha={<span>Kanonik smeta / LRV <span className="text-text-mute">({targets.size})</span></span>}
        chapOng={<input aria-label="F2 manbadan qidirish" value={sourceSearch} onChange={(event) => { setSourceSearch(event.target.value); setPage(0); }} placeholder="Manbadan qidirish…" className="input h-8 w-44 text-xs" />}
        chap={<div className="min-w-[560px]">
          <div className="sticky top-0 z-[1] border-b border-border bg-surface-2 px-3 py-2 text-[10px] uppercase tracking-[0.1em] text-text-dim">Qatorni tanlang — o‘ng panelda mos smeta qatori yoritiladi</div>
          <table className="w-full text-xs"><thead className="sticky top-[33px] z-[1] bg-surface-2 text-text-dim"><tr><th className="px-3 py-2 text-left">Ish / manba</th><th className="text-right">Hajm</th><th className="text-right">Narx</th><th className="text-right">Summa</th><th className="px-3">Holat</th></tr></thead><tbody>{visibleSource.slice(page * 80, page * 80 + 80).map((n) => { const mapped = mapping.get(n.uid); const selected = selectedUid === n.uid; const manual = manualBindings.has(n.uid); const mismatch = n.narx != null && n.summa != null && Math.abs(n.hajm * n.narx - n.summa) > 0.005; return <tr key={n.uid} ref={(el) => { sourceRowRefs.current[n.uid] = el; }} onClick={() => setSelectedUid(n.uid)} className={`cursor-pointer border-t border-border transition-colors ${selected ? 'bg-accent/15' : 'hover:bg-surface-2/60'}`}><td className="max-w-[270px] px-3 py-2"><div className="truncate font-medium text-text">{labels.get(n.uid) || 'Manba qatori'}</div><div className="text-[10px] text-text-mute">{manual ? 'Qo‘lda bog‘langan' : mapped != null ? 'Avto tavsiya' : 'Moslashmagan'}</div></td><td className="text-right tabular-nums">{n.hajm}</td><td className="text-right tabular-nums">{n.narx ?? '—'}</td><td className="text-right tabular-nums">{n.summa ?? '—'}{mismatch && <div className="text-[10px] text-warn">Q×narx farqi</div>}</td><td className="px-3 text-center">{mapped != null ? <span className={manual ? 'text-accent' : 'text-ok'}>{manual ? 'Qo‘lda' : 'Tavsiya'}</span> : <span className="text-danger">Kutilmoqda</span>}</td></tr>; })}</tbody></table>
          {visibleSource.length === 0 && <div className="p-8 text-center text-sm text-text-dim">Bu filtr bo‘yicha manba qatori topilmadi.</div>}
          {visibleSource.length > 80 && <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-text-dim"><button type="button" disabled={page === 0} onClick={() => setPage((value) => value - 1)} className="rounded border border-border px-2 py-1 disabled:opacity-40">Oldingi</button><span>{page * 80 + 1}–{Math.min((page + 1) * 80, visibleSource.length)} / {visibleSource.length}</span><button type="button" disabled={(page + 1) * 80 >= visibleSource.length} onClick={() => setPage((value) => value + 1)} className="rounded border border-border px-2 py-1 disabled:opacity-40">Keyingi</button></div>}
        </div>}
        ong={<div className="min-w-[520px]">
          <div className="sticky top-0 z-[1] flex items-center justify-between gap-2 border-b border-border bg-surface-2 px-3 py-2"><span className="text-[10px] uppercase tracking-[0.1em] text-text-dim">Tanlangan manba: {selectedUid ? (labels.get(selectedUid) || '—') : 'qator tanlang'}</span><input aria-label="Kanonik smetadan qidirish" value={targetSearch} onChange={(event) => setTargetSearch(event.target.value)} placeholder="Smetadan qidirish…" className="input h-8 w-48 text-xs" /></div>
          {selectedUid && <div className="border-b border-accent/20 bg-accent/5 px-3 py-2 text-xs text-text-dim">O‘ng tomondan qatorni tanlang, keyin <b className="text-text">Bog‘lash</b> ni bosing. Bu faqat matching bog‘lanishini o‘zgartiradi; F2 qiymatlari manba fayldan qoladi.</div>}
          <table className="w-full text-xs"><thead className="sticky top-[49px] z-[1] bg-surface-2 text-text-dim"><tr><th className="px-3 py-2 text-left">Kanonik ish / resurs</th><th className="text-right">Bog‘langan</th><th className="px-3 text-right">Amal</th></tr></thead><tbody>{visibleTargets.map(([id, label]) => { const mappedSource = sourceByTarget.get(id); const selected = selectedTargetId === id; return <tr key={id} ref={(el) => { targetRowRefs.current[id] = el; }} onClick={() => { setSelectedTargetId(id); if (mappedSource) setSelectedUid(mappedSource.uid); }} className={`border-t border-border transition-colors ${selected ? 'bg-accent/15' : 'hover:bg-surface-2/60'}`}><td className="max-w-[300px] px-3 py-2"><div className="truncate text-text">{label}</div>{mappedSource && <div className="text-[10px] text-ok">{labels.get(mappedSource.uid) || 'Manba qatori'}</div>}</td><td className="text-right text-text-dim">{mappedSource ? '1' : '—'}</td><td className="px-3 text-right"><button type="button" onClick={(event) => { event.stopPropagation(); manualRebind(id); }} disabled={!selectedUid || busy || done} className="rounded border border-accent/40 px-2 py-1 text-[11px] font-semibold text-text hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-40">{mapping.get(selectedUid || '') === id ? 'Bog‘langan' : 'Bog‘lash'}</button></td></tr>; })}</tbody></table>
          {visibleTargets.length === 0 && <div className="p-8 text-center text-sm text-text-dim">Smeta qatori topilmadi.</div>}
          {targets.size > visibleTargets.length && <p className="border-t border-border px-3 py-2 text-[11px] text-text-mute">{visibleTargets.length} ta qator ko‘rsatildi. Qidiruvni toraytiring.</p>}
        </div>}
      />
      <p className="text-xs text-text-mute">Matching workbench: avtomatik tavsiya → ko‘rib chiqish → zarur bo‘lsa qo‘lda qayta bog‘lash. Ichki row/UID identifikatorlari biznes nomi sifatida ishlatilmaydi.</p>
      <F2PreapprovalAudit aktBarglar={source} getSmetaId={uid => mapping.get(uid)} />
      {payload.error && <p role="alert">{payload.error}</p>}
      <label className="block"><input type="checkbox" checked={reviewed} disabled={busy || done} onChange={e => setReviewed(e.target.checked)} /> Varaq, davr va moslashtirish natijasini tekshirdim</label>
      <button className="h-10 rounded-[10px] bg-accent px-4 text-sm font-medium text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50" disabled={busy || done || !reviewed || !!payload.error} onClick={() => void save()}>F2 qoralamasini saqlash</button>
    </>}
  </section>;
}

export default function F2ImportNative() {
  const { joriy, yuklanmoqda } = useKompaniya();
  if (yuklanmoqda) return <div className="os-workbench"><Skelet qatorlar={5} /></div>;
  if (!joriy?.id) return <div className="os-workbench"><div className="karta p-6 text-sm text-text-dim">F2 importni boshlash uchun kompaniyani tanlang.</div></div>;
  return <NativeSession key={joriy.id} companyId={joriy.id} />;
}
