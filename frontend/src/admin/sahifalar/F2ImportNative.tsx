import { useEffect, useMemo, useRef, useState } from 'react';
import { sbT2AktYaratV2, sbT2DaraxtOl, sbT2ObyektlarOlKomp, yangiOperationId, type T2Obyekt, type T2Qator } from '../../api/supabase';
import { useKompaniya } from '../../umumiy/kontekst/KompaniyaKontekst';
import { readXlsx, f2FaylOqiCore, type XlsxWorkbook, type F2ColumnConfig, type SheetGrid } from '../../lib/f2-import-parse';
import { type AktNode, type LrvNode, type F2MatchResult } from '../../lib/f2-match-engine';
import { f2AggregatsiyaQator, f2ExactPayloadQur, type F2ExactManbaTugun } from '../../test02/f2-exact-payload';
import { F2PreapprovalAudit } from '../../test02/F2PreapprovalAudit';

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
  const result = f2ExactPayloadQur(rows);
  if (!result.ok) {
    throw new Error(result.sabab === 'CONFLICTING_PRICES'
      ? 'Bir smeta qatoriga turli narxlar tushdi. Birinchi narx tanlanmaydi; bog‘lanishni tekshiring.'
      : 'Hujjat summasi noaniq. Yozish to‘xtatildi.');
  }
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
  const operation = useRef('');
  const generation = useRef(0);
  const writing = useRef(false);
  useEffect(() => {
    let active = true;
    void sbT2ObyektlarOlKomp(companyId).then(r => {
      if (!active) return;
      if (!r.ok) { setError('Obyektlar o‘qilmadi.'); return; }
      setObjects((r.qatorlar || []) as T2Obyekt[]);
    }).catch(() => { if (active) setError('Obyektlar o‘qilmadi.'); });
    return () => { active = false; generation.current++; };
  }, [companyId]);
  function reset() {
    generation.current++;
    setSource([]); setMapping(new Map()); setReviewed(false); setDone(false); setError(''); setPage(0); operation.current = '';
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
      if (file.size > 15 * 1024 * 1024) throw new Error('Fayl 15 MB dan katta. Katta fayl oqimi keyingi bosqichda.');
      const workbook = await readXlsx(await file.arrayBuffer());
      if (generation.current !== token) return;
      setBook(workbook); chooseSheet(workbook, workbook.sheets[0]?.name || ''); setPhase('Varaq va ustunlarni tekshiring');
    } catch { if (generation.current === token) setError('Fayl o‘qilmadi yoki 15 MB chegarasidan oshdi. XLSX faylni tekshiring.'); }
    finally { setBusy(false); }
  }
  async function match() {
    if (!book || !cols || !objectId) return;
    reset(); const token = generation.current; setBusy(true); setPhase('Moslashtirilmoqda');
    try {
      const sheet = book.sheet(sheetName)!;
      if (sheet.rows.length > 20000) throw new Error('Varaq 20 000 qatordan katta.');
      const built = f2FaylOqiCore(sheet.rows, cols);
      if (!('tree' in built)) throw new Error('Ustunlarni tekshiring.');
      const leaves = sourceLeaves(built.tree, sheet.rows, cols);
      const r = await sbT2DaraxtOl(Number(objectId));
      if (!r.ok) throw new Error('Smeta o‘qilmadi.');
      const rows = (r.qatorlar || []) as T2Qator[];
      if (rows.length > 20000) throw new Error('Smeta 20 000 qatordan katta.');
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
    } catch (e) { if (generation.current === token) setError(e instanceof Error ? e.message : 'O‘qish bajarilmadi.'); }
    finally { setBusy(false); }
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
    } catch { setError('Yozish javobi olinmadi. Qayta urinish ayni operatsiyani tekshiradi.'); }
    finally { writing.current = false; setBusy(false); }
  }
  return <section className="p-4 space-y-4 max-w-5xl">
    <h1 className="text-xl font-semibold">F2 import — yangi rejim</h1>
    <p role="status">{phase}</p>
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
