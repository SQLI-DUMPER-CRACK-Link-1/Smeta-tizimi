import { useEffect, useRef, useState } from 'react';
import { sbT2ObyektlarOlKomp, yangiOperationId, type T2Obyekt } from '../../api/supabase';
import { useKompaniya } from '../../umumiy/kontekst/KompaniyaKontekst';
import { readXlsx, f2FaylOqiCore, type XlsxWorkbook, type F2ColumnConfig } from '../../lib/f2-import-parse';

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
  const rawFile = useRef<File | null>(null);
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
    rawFile.current = file;
    const token = generation.current;
    try {
      if (file.size > MAX_FILE_BYTES) throw new Error(`Fayl ${MAX_FILE_BYTES / 1024 / 1024} MB dan katta.`);
      const workbook = await readXlsx(await file.arrayBuffer());
      if (generation.current !== token) return;
      setBook(workbook); chooseSheet(workbook, workbook.sheets[0]?.name || ''); setPhase('Varaq va ustunlarni tekshiring');
    } catch { if (generation.current === token) setError('Fayl o‘qilmadi. XLSX faylni tekshiring.'); }
    finally { setBusy(false); }
  }

  async function sourceniR2gaYukla(file: File, objId: number): Promise<number | undefined> {
    try {
      const buf = await file.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', buf);
      const sha256 = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
      const loyihaId = objects.find(o => o.id === objId)?.loyiha_id ?? null;
      const fd = new FormData();
      fd.append('fayl', file); fd.append('kompaniya_id', String(companyId));
      if (loyihaId != null) fd.append('loyiha_id', String(loyihaId));
      fd.append('obyekt_id', String(objId)); fd.append('turi', 'smeta');
      fd.append('operation_id', yangiOperationId()); fd.append('sha256', sha256); fd.append('size', String(file.size));
      const r = await fetch('/api/hujjat-yukla', { method: 'POST', body: fd });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j: any = await r.json().catch(() => null);
      return j && j.ok ? Number(j.document_id) : undefined;
    } catch { return undefined; }
  }

  async function importQil() {
    if (!book || !cols || !objectId) return;
    setError(''); setResult(null); const token = generation.current; setBusy(true); setPhase('Import qilinmoqda');
    try {
      const sheet = book.sheet(sheetName)!;
      const built = f2FaylOqiCore(sheet.rows, cols);
      if (!('tree' in built) || !built.tree.length) throw new Error('Ustunlarni tekshiring — daraxt bo‘sh chiqdi.');

      const sourceDocumentId = rawFile.current ? await sourceniR2gaYukla(rawFile.current, Number(objectId)) : undefined;
      if (generation.current !== token) return;

      const r = await fetch('/api/smeta-yukla', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amal: 'import', kompaniyaId: companyId, obyektId: Number(objectId),
          operationId: yangiOperationId(), sourceDocumentId, tree: built.tree,
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
          value={objectId} onChange={e => { setObjectId(e.target.value); reset(); }}>
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
