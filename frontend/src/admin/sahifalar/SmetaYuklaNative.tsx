import { useEffect, useRef, useState } from 'react';
import { sbT2ObyektlarOlKomp, yangiOperationId, type T2Obyekt } from '../../api/supabase';
import { useKompaniya } from '../../umumiy/kontekst/KompaniyaKontekst';
import { readXlsx, f2FaylOqiCore, f2UstunAniqla, type XlsxWorkbook, type F2ColumnConfig, type SheetGrid } from '../../lib/f2-import-parse';
import type { AktNode } from '../../lib/f2-match-engine';

/**
 * T2-FINAL-CLEAN-CUTOVER P0.2: native Smeta XLSX -> canonical Supabase, off
 * Google Drive/Sheets/GAS entirely (see `functions/api/smeta-yukla.ts` and
 * `supabase/migrations/20261010120000_t2_smeta_import_bulk_v1.sql`).
 *
 * Deliberately a ONE-SHOT first-import path, not the F2 flow's resumable-job
 * model: the target RPC refuses outright (SMETA_ALREADY_EXISTS) the instant
 * the object has any existing t2_qator row, so there is no "in-progress,
 * partially-written smeta" state to resume — either it's empty and this
 * writes it once, or it already has a smeta and this is refused untouched.
 */
const MAX_FILE_BYTES = 50 * 1024 * 1024;

/**
 * T2-PTO-OWNER-CRITICAL-CLOSURE: a real Smeta is normally TWO documents --
 * LRV (lokal resurs vedomosti / lokal smeta: ish/hajm ierarxiyasi, ko'pincha
 * narxsiz) and RES (resursniy vedomost: kod/nom/birlik bo'yicha resurs narx
 * indeksi). Bitta faylda hajm VA narx bo'lmasa, LRV o'zi narxsiz import
 * qilinadi -- bu quyidagi yordamchilar RES faylini o'qib, uning narxlarini
 * kod (birinchi ustuvor) yoki nom+birlik bo'yicha LRV daraxtining rs/mat/ob
 * bargiga ulaydi. LRV faylida allaqachon narx bo'lgan qatorlar ustidan
 * YOZILMAYDI -- RES faqat YETISHMAGAN narxni to'ldiradi.
 */
export type ResNarxYozuv = { kod?: string; nom?: string; birlik?: string; narx: number };
export type ResNarxIndeks = { byKod: Map<string, number>; byNomBir: Map<string, number> };

/** Client-side tolerant numeric parse (comma-decimal, thousands spaces) -- server-side t2_son mirrors this. */
function son(v: unknown): number | undefined {
  if (v == null) return undefined;
  const raw = String(v).replace(/[\s ]/g, '').replace(',', '.');
  if (raw === '') return undefined;
  const m = /[+-]?[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?/.exec(raw);
  if (!m) return undefined;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : undefined;
}

/** RES varag'ini {kod,nom,birlik,narx} tekis ro'yxatiga o'giradi -- ierarxiya yo'q, RES odatda tekis narx katalogi. */
export function resSatrlariniOl(rows: SheetGrid, cols: F2ColumnConfig): ResNarxYozuv[] {
  const out: ResNarxYozuv[] = [];
  for (const row of rows) {
    const kod = cols.kod >= 0 ? String(row[cols.kod] ?? '').trim() : '';
    const nom = cols.nom >= 0 ? String(row[cols.nom] ?? '').trim() : '';
    const bir = cols.bir >= 0 ? String(row[cols.bir] ?? '').trim() : '';
    const narx = cols.narx >= 0 ? son(row[cols.narx]) : undefined;
    if (!nom && !kod) continue;
    if (/^\d+$/.test(nom) && /^\d+$/.test(bir)) continue; // ustun-raqamlash qatori
    if (narx == null || narx <= 0) continue;
    out.push({ kod: kod || undefined, nom: nom || undefined, birlik: bir || undefined, narx });
  }
  return out;
}

export function resNarxIndeksiQur(rows: ResNarxYozuv[]): ResNarxIndeks {
  const byKod = new Map<string, number>();
  const byNomBir = new Map<string, number>();
  for (const r of rows) {
    if (r.kod) { const k = r.kod.toUpperCase(); if (!byKod.has(k)) byKod.set(k, r.narx); }
    if (r.nom) { const k = (r.nom + '|' + (r.birlik || '')).toUpperCase(); if (!byNomBir.has(k)) byNomBir.set(k, r.narx); }
  }
  return { byKod, byNomBir };
}

/** LRV daraxtiga RES narxlarini qo'llaydi. Faqat narx YO'Q rs/mat/ob barglariga tegadi -- LRV o'z narxini yozgan bo'lsa ustidan yozilmaydi. */
export function narxlarniDaraxtgaQoll(tree: AktNode[], idx: ResNarxIndeks): { tree: AktNode[]; mosSoni: number; mosEmasSoni: number } {
  let mosSoni = 0, mosEmasSoni = 0;
  function walk(n: AktNode): AktNode {
    if (n.children && n.children.length) return { ...n, children: n.children.map(walk) };
    if (n.type !== 'rs' && n.type !== 'mat' && n.type !== 'ob') return n;
    if (n.narx != null) return n;
    let narx: number | undefined;
    if (n.kod) narx = idx.byKod.get(n.kod.toUpperCase());
    if (narx == null && n.nom) narx = idx.byNomBir.get((n.nom + '|' + (n.bir || '')).toUpperCase());
    if (narx == null) { mosEmasSoni++; return n; }
    mosSoni++;
    const summa = n.hajm != null ? Math.round(n.hajm * narx * 100) / 100 : undefined;
    return { ...n, narx, summa };
  }
  return { tree: tree.map(walk), mosSoni, mosEmasSoni };
}

function Sessiya({ companyId, fixedObjectId }: { companyId: number; fixedObjectId?: number }) {
  const [objects, setObjects] = useState<T2Obyekt[]>([]);
  const [objectId, setObjectId] = useState(fixedObjectId ? String(fixedObjectId) : '');
  const [book, setBook] = useState<XlsxWorkbook | null>(null);
  const [sheetName, setSheetName] = useState('');
  const [cols, setCols] = useState<F2ColumnConfig | null>(null);
  const [preview, setPreview] = useState<Array<{ r: number; cells: string[] }>>([]);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ qator_soni: number } | null>(null);
  const [resBook, setResBook] = useState<XlsxWorkbook | null>(null);
  const [resSheetName, setResSheetName] = useState('');
  const [resCols, setResCols] = useState<F2ColumnConfig | null>(null);
  const [resBusy, setResBusy] = useState(false);
  const [resError, setResError] = useState('');
  const [resIndex, setResIndex] = useState<ResNarxIndeks | null>(null);
  const [resIndexSize, setResIndexSize] = useState(0);
  const rawFile = useRef<File | null>(null);
  const sourceDocumentId = useRef<number | undefined>(undefined);
  const sourceOperationId = useRef('');
  const importOperationId = useRef('');
  const generation = useRef(0);

  useEffect(() => {
    let active = true;
    void sbT2ObyektlarOlKomp(companyId).then(r => {
      if (!active) return;
      setObjects(r.ok ? (r.qatorlar || []) as T2Obyekt[] : []);
    });
    return () => { active = false; };
  }, [companyId]);

  useEffect(() => {
    if (fixedObjectId) setObjectId(String(fixedObjectId));
  }, [fixedObjectId]);

  function reset() {
    generation.current++; setError(''); setResult(null); setCols(null); setPreview([]);
    setResBook(null); setResCols(null); setResIndex(null); setResIndexSize(0); setResError('');
  }

  function chooseSheet(workbook: XlsxWorkbook, name: string) {
    setSheetName(name);
    const sheet = workbook.sheet(name);
    if (!sheet) { setCols(null); setPreview([]); return; }
    const detected = f2FaylOqiCore(sheet.rows);
    if ('cols' in detected) { setCols(detected.cols); setPreview(detected.preview); }
    else { setCols(null); setPreview([]); }
  }

  async function upload(file: File) {
    reset(); setBook(null); setBusy(true); setPhase('Fayl o‘qilmoqda');
    rawFile.current = file; sourceDocumentId.current = undefined;
    sourceOperationId.current = yangiOperationId(); importOperationId.current = yangiOperationId();
    const token = generation.current;
    try {
      if (file.size > MAX_FILE_BYTES) throw new Error(`Fayl ${MAX_FILE_BYTES / 1024 / 1024} MB dan katta.`);
      const workbook = await readXlsx(await file.arrayBuffer());
      if (generation.current !== token) return;
      setBook(workbook); chooseSheet(workbook, workbook.sheets[0]?.name || ''); setPhase('Varaq va ustunlarni tekshiring');
    } catch { if (generation.current === token) setError('Fayl o‘qilmadi. XLSX faylni tekshiring.'); }
    finally { setBusy(false); }
  }

  async function sourceniR2gaYukla(file: File, objId: number): Promise<number> {
    if (sourceDocumentId.current != null) return sourceDocumentId.current;
    try {
      const buf = await file.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', buf);
      const sha256 = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
      const loyihaId = objects.find(o => o.id === objId)?.loyiha_id ?? null;
      const fd = new FormData();
      fd.append('fayl', file); fd.append('kompaniya_id', String(companyId));
      if (loyihaId != null) fd.append('loyiha_id', String(loyihaId));
      fd.append('obyekt_id', String(objId)); fd.append('turi', 'smeta');
      fd.append('operation_id', sourceOperationId.current || (sourceOperationId.current = yangiOperationId()));
      fd.append('sha256', sha256); fd.append('size', String(file.size));
      const r = await fetch('/api/hujjat-yukla', { method: 'POST', body: fd });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j: any = await r.json().catch(() => null);
      const documentId = j && j.ok ? Number(j.document_id) : NaN;
      if (!r.ok || !Number.isSafeInteger(documentId) || documentId <= 0) {
        throw new Error('Manba fayli kanonik R2 saqlashga qabul qilinmadi.');
      }
      sourceDocumentId.current = documentId;
      return documentId;
    } catch (e) {
      if (e instanceof Error && e.message === 'Manba fayli kanonik R2 saqlashga qabul qilinmadi.') throw e;
      throw new Error('Manba fayli kanonik R2 ga yuklanmadi. Import to‘xtatildi.');
    }
  }

  /** RES (resursniy vedomost) faylini o'qib, kod/nom/birlik/narx ustunlarini
   *  taxminan aniqlaydi -- LRV o'zi uchun ishlatilgan aynan shu detektor
   *  (f2UstunAniqla), lekin RES odatda tekis narx katalogi -- foydalanuvchi
   *  ustunlarni tasdiqlashi/tuzatishi kerak (LRV'dagi bilan bir xil naqsh). */
  async function uploadRes(file: File) {
    setResError(''); setResIndex(null); setResIndexSize(0); setResBusy(true);
    try {
      const workbook = await readXlsx(await file.arrayBuffer());
      setResBook(workbook);
      const name = workbook.sheets[0]?.name || '';
      setResSheetName(name);
      const sheet = workbook.sheet(name);
      setResCols(sheet ? f2UstunAniqla(sheet.rows) : null);
    } catch { setResError('RES fayli o‘qilmadi. XLSX faylni tekshiring.'); }
    finally { setResBusy(false); }
  }
  function chooseResSheet(workbook: XlsxWorkbook, name: string) {
    setResSheetName(name); setResIndex(null); setResIndexSize(0);
    const sheet = workbook.sheet(name);
    setResCols(sheet ? f2UstunAniqla(sheet.rows) : null);
  }
  function resNarxlarniUlash() {
    if (!resBook || !resCols) return;
    const sheet = resBook.sheet(resSheetName);
    if (!sheet) return;
    const satrlar = resSatrlariniOl(sheet.rows, resCols);
    setResIndex(resNarxIndeksiQur(satrlar));
    setResIndexSize(satrlar.length);
  }

  async function importQil() {
    if (!book || !cols || !objectId) return;
    setError(''); setResult(null); const token = generation.current; setBusy(true); setPhase('Import qilinmoqda');
    try {
      const sheet = book.sheet(sheetName)!;
      const built = f2FaylOqiCore(sheet.rows, cols);
      if (!('tree' in built) || !built.tree.length) throw new Error('Ustunlarni tekshiring — daraxt bo‘sh chiqdi.');
      // RES fayli ulangan bo'lsa: narxi YO'Q rs/mat/ob barglariga kod/nom+birlik
      // bo'yicha narx qo'llanadi. LRV faylida allaqachon narx bo'lgan qatorlar
      // ustidan YOZILMAYDI (narxlarniDaraxtgaQoll'ning o'zi shuni ta'minlaydi).
      const importTree = resIndex ? narxlarniDaraxtgaQoll(built.tree, resIndex).tree : built.tree;

      if (!rawFile.current) throw new Error('Smeta manba fayli topilmadi. XLSX faylni qayta tanlang.');
      const sourceDocumentId = await sourceniR2gaYukla(rawFile.current, Number(objectId));
      if (generation.current !== token) return;

      const r = await fetch('/api/smeta-yukla', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amal: 'import', kompaniyaId: companyId, obyektId: Number(objectId),
          operationId: importOperationId.current || (importOperationId.current = yangiOperationId()), sourceDocumentId, tree: importTree,
        }),
      });
      const j = await r.json() as { ok: boolean; code?: string; qator_soni?: number };
      if (generation.current !== token) return;
      if (!j.ok) {
        if (j.code === 'SMETA_ALREADY_EXISTS') throw new Error('Bu obyektda smeta allaqachon mavjud — ustidan yozilmaydi (xavfsizlik uchun).');
        throw new Error('Import bajarilmadi (' + (j.code || 'xato') + ').');
      }
      setResult({ qator_soni: j.qator_soni || 0 }); setPhase('Tayyor');
      setObjects(prev => prev.map(o => o.id === Number(objectId) ? { ...o, qator_soni: j.qator_soni ?? o.qator_soni } : o));
    } catch (e) { if (generation.current === token) setError(e instanceof Error ? e.message : 'Import bajarilmadi.'); }
    finally { setBusy(false); }
  }

  const selectedObject = objects.find(o => o.id === Number(objectId));
  const alreadyHasSmeta = !!selectedObject?.qator_soni;

  return (
    <div className="space-y-3 p-1">
      {!fixedObjectId && <label className="block text-sm">Obyekt
        <select aria-label="Obyekt" className="ml-2 border rounded px-2 py-1"
          value={objectId} onChange={e => {
            setObjectId(e.target.value); reset(); rawFile.current = null;
            sourceDocumentId.current = undefined; sourceOperationId.current = ''; importOperationId.current = '';
          }}>
          <option value="">Tanlang</option>
          {objects.map(o => <option key={o.id} value={o.id}>{o.nom}{o.qator_soni ? ` (${o.qator_soni} qator bor)` : ' (bo‘sh)'}</option>)}
        </select>
      </label>}
      {objectId && alreadyHasSmeta && (
        <p role="alert" className="text-danger text-sm">Bu obyektda allaqachon {selectedObject?.qator_soni} qatorlik smeta bor — bu ekran faqat BO‘SH obyektga birinchi import uchun.</p>
      )}
      {objectId && !alreadyHasSmeta && (
        <label className="block text-sm">Smeta fayli (XLSX)
          <input aria-label="Smeta fayli" type="file" accept=".xlsx,.xlsm" className="ml-2"
          onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
        </label>
      )}
      {busy && <p role="status">{phase}…</p>}
      {error && <p role="alert" className="text-danger">{error}</p>}
      {book && cols && !result && (
        <>
          {book.sheets.length > 1 && (
            <label className="block text-sm">Varaq
              <select aria-label="Varaq" className="ml-2 border rounded px-2 py-1"
                value={sheetName} onChange={e => chooseSheet(book, e.target.value)}>
                {book.sheets.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
            </label>
          )}
          <div className="karta p-3 text-[12px] overflow-auto max-h-64">
            <table className="w-full">
              <tbody>
                {preview.slice(0, 12).map(row => (
                  <tr key={row.r} className="border-t border-border/60">
                    <td className="text-text-mute pr-2">{row.r}</td>
                    {row.cells.map((c, ci) => <td key={ci} className="px-1">{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="karta p-3 space-y-2">
            <p className="text-[12px] font-semibold text-text">
              Resurs vedomosti (RES) — narxlarni ulash (ixtiyoriy)
            </p>
            <p className="text-[11px] text-text-mute">
              Real smeta odatda 2 hujjat: LRV (ish/hajm — yuqorida) va RES (kod/nom/birlik bo‘yicha resurs narxlari).
              LRV faylida narx bo‘lmasa, RES faylini shu yerga yuklang — narxlar kod (ustuvor), topilmasa nom+birlik bo‘yicha ulanadi.
              LRV faylida allaqachon narxi bor qatorlar ustidan yozilmaydi.
            </p>
            <label className="block text-sm">RES fayli (XLSX)
              <input aria-label="RES fayli" type="file" accept=".xlsx,.xlsm" className="ml-2"
                onChange={e => { const f = e.target.files?.[0]; if (f) void uploadRes(f); }} />
            </label>
            {resBusy && <p role="status" className="text-[12px]">RES fayli o‘qilmoqda…</p>}
            {resError && <p role="alert" className="text-danger text-[12px]">{resError}</p>}
            {resBook && resCols && (
              <>
                {resBook.sheets.length > 1 && (
                  <label className="block text-sm">RES varag‘i
                    <select aria-label="RES varag‘i" className="ml-2 border rounded px-2 py-1"
                      value={resSheetName} onChange={e => chooseResSheet(resBook, e.target.value)}>
                      {resBook.sheets.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </select>
                  </label>
                )}
                <fieldset className="flex flex-wrap gap-3 items-end">
                  <legend className="text-[11px] text-text-mute">RES ustunlari (1 dan boshlab)</legend>
                  {(['kod', 'nom', 'bir', 'narx'] as const).map(k => (
                    <label key={k} className="text-[12px]">{k}
                      <input className="w-16 border rounded px-1 ml-1" type="number" min="1"
                        value={resCols[k] + 1}
                        onChange={e => { setResIndex(null); setResIndexSize(0); setResCols({ ...resCols, [k]: Number(e.target.value) - 1 }); }} />
                    </label>
                  ))}
                  <button type="button" className="tugma" onClick={resNarxlarniUlash}>Narxlarni ulash</button>
                </fieldset>
                {resIndex && (
                  <p className="text-[12px] text-success">
                    {resIndexSize} ta resurs narxi o‘qildi ({resIndex.byKod.size} ta kod bo‘yicha, {resIndex.byNomBir.size} ta nom+birlik bo‘yicha).
                    Import bosilganda mos keluvchi narxsiz qatorlarga qo‘llanadi.
                  </p>
                )}
              </>
            )}
          </div>
          <button type="button" className="tugma tugma-asosiy" disabled={busy} onClick={() => void importQil()}>
            Ushbu ustunlar bilan import qilish
          </button>
        </>
      )}
      {result && (
        <p role="status" className="text-success">Tayyor: {result.qator_soni} qator canonical Supabase’ga yozildi.</p>
      )}
    </div>
  );
}

export default function SmetaYuklaNative({ obyektId }: { obyektId?: number } = {}) {
  const { joriy, yuklanmoqda } = useKompaniya();
  if (yuklanmoqda) return <p>Kompaniya yuklanmoqda…</p>;
  if (!joriy?.id) return <p>Kompaniyani tanlang.</p>;
  return <Sessiya key={`${joriy.id}:${obyektId ?? 'all'}`} companyId={joriy.id} fixedObjectId={obyektId} />;
}
