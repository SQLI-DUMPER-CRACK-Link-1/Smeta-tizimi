import { useEffect, useRef, useState } from 'react';
import { readXlsx, type XlsxWorkbook } from '../../lib/f2-import-parse';
import { resNarxlashPreview, resQatorlariniOl, resVaraqlariniTop, type ResNarx, type ResPreview } from '../../lib/res-narxlash';
import { sbT2SmetaNarxlaRes } from '../../api/t2-smeta-narxlash';
import { yangiOperationId, sbT2DaraxtOl, sbT2ObyektlarOlKomp, type T2Obyekt, type T2Qator } from '../../api/supabase';
import { useKompaniya } from '../../umumiy/kontekst/KompaniyaKontekst';

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const SABAB_NOMI = {
  QATOR_IDENTIYASI_YOQ: 'qatorning nomi yoki birligi yo‘q',
  RES_MANBASI_TOPILMADI: 'RESda aynan mos qator topilmadi',
  RES_MANBA_ZIDDIYATI: 'bir RES kalitida turli narxlar bor',
  BIR_NECHTA_NARX_VARIANTI: 'bir nechta mos narx varianti bor',
} as const;

function Sessiya({ companyId, fixedObjectId }: { companyId: number; fixedObjectId?: number }) {
  const [objects, setObjects] = useState<T2Obyekt[]>([]);
  const [objectId, setObjectId] = useState(fixedObjectId ? String(fixedObjectId) : '');
  const [qatorlar, setQatorlar] = useState<T2Qator[]>([]);
  const [book, setBook] = useState<XlsxWorkbook | null>(null);
  const [tanlanganVaraqlar, setTanlanganVaraqlar] = useState<string[]>([]);
  const [preview, setPreview] = useState<ResPreview | null>(null);
  const [reslar, setReslar] = useState<ResNarx[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [natija, setNatija] = useState('');
  const operationId = useRef('');

  useEffect(() => {
    let active = true;
    void sbT2ObyektlarOlKomp(companyId).then((r) => {
      if (active) setObjects(r.ok ? (r.qatorlar || []) as T2Obyekt[] : []);
    });
    return () => { active = false; };
  }, [companyId]);

  async function obyektniYukla(id: string) {
    setObjectId(id); setPreview(null); setNatija(''); setError(''); operationId.current = '';
    if (!id) { setQatorlar([]); return; }
    const r = await sbT2DaraxtOl(Number(id));
    if (!r.ok) { setQatorlar([]); setError('Smeta qatorlari o‘qilmadi.'); return; }
    setQatorlar((r.qatorlar || []) as T2Qator[]);
  }

  useEffect(() => { if (fixedObjectId) void obyektniYukla(String(fixedObjectId)); }, [fixedObjectId]);

  function qaytaHisobla(workbook: XlsxWorkbook, varaqlar: string[], tree: T2Qator[]) {
    const topilgan = resVaraqlariniTop(workbook);
    const prices = topilgan
      .filter((x) => varaqlar.includes(x.nom))
      .flatMap((x) => {
        const sheet = workbook.sheet(x.nom);
        return sheet ? resQatorlariniOl(sheet.rows, x.cols) : [];
      });
    setReslar(prices);
    setPreview(resNarxlashPreview(tree, prices));
    operationId.current = yangiOperationId();
  }

  async function faylYukla(file: File) {
    setError(''); setNatija(''); setPreview(null); setBook(null); setReslar([]);
    if (file.size > MAX_FILE_BYTES) { setError('RES fayli 50 MB dan katta.'); return; }
    if (!objectId || qatorlar.length === 0) { setError('Avval smetasi bor obyektni tanlang.'); return; }
    setBusy(true);
    try {
      const workbook = await readXlsx(await file.arrayBuffer());
      const topilgan = resVaraqlariniTop(workbook);
      if (!topilgan.length) throw new Error('RES ustunlari topilmadi. Kod, nom, birlik va “na. ed. izm.” narx ustuni bo‘lgan varaqni yuklang.');
      const names = topilgan.map((x) => x.nom);
      setBook(workbook); setTanlanganVaraqlar(names); qaytaHisobla(workbook, names, qatorlar);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'RES fayli o‘qilmadi.');
    } finally { setBusy(false); }
  }

  function varaqniAlmashtir(name: string, checked: boolean) {
    if (!book) return;
    const next = checked ? [...tanlanganVaraqlar, name] : tanlanganVaraqlar.filter((x) => x !== name);
    setTanlanganVaraqlar(next); qaytaHisobla(book, next, qatorlar);
  }

  async function tasdiqla() {
    if (!preview || !objectId || !reslar.length || preview.mos === 0) return;
    setBusy(true); setError(''); setNatija('');
    try {
      const r = await sbT2SmetaNarxlaRes({ kompaniyaId: companyId, obyektId: Number(objectId), operationId: operationId.current || yangiOperationId(), narxlar: reslar });
      if (!r.ok) throw new Error(r.error || r.code || 'Narxlash bajarilmadi.');
      await obyektniYukla(objectId);
      setNatija(`${r.yozildi ?? 0} qator narxlandi; ${r.narxsiz_qoldi ?? 0} qator narxsiz qoldi.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Narxlash bajarilmadi.'); }
    finally { setBusy(false); }
  }

  const topilgan = book ? resVaraqlariniTop(book) : [];
  return <div className="space-y-3 p-1">
    {!fixedObjectId && <label className="block text-sm">Obyekt
      <select aria-label="Narxlash obyekti" className="ml-2 border rounded px-2 py-1" value={objectId} onChange={(e) => void obyektniYukla(e.target.value)}>
        <option value="">Tanlang</option>{objects.map((o) => <option key={o.id} value={o.id}>{o.nom}</option>)}
      </select>
    </label>}
    <p className="text-[12px] text-text-mute">Bu ekran faqat narxi yo‘q (`NULL` yoki `0`) RS/MAT/OB qatorlarini RES bilan to‘ldiradi. Mavjud narx, F2 va tarixiy certified qiymatlar o‘zgarmaydi.</p>
    {objectId && <label className="block text-sm">RES fayli (XLSX/XLS)
      <input aria-label="RES narx fayli" type="file" accept=".xlsx,.xlsm,.xls" className="ml-2" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void faylYukla(f); }} />
    </label>}
    {busy && <p role="status">Hisoblanmoqda…</p>}
    {error && <p role="alert" className="text-danger">{error}</p>}
    {topilgan.length > 0 && <div className="karta p-3 space-y-1">
      <p className="font-semibold text-[12px]">RES varaqlari</p>
      {topilgan.map((x) => <label key={x.nom} className="block text-[12px]"><input type="checkbox" className="mr-2" checked={tanlanganVaraqlar.includes(x.nom)} onChange={(e) => varaqniAlmashtir(x.nom, e.target.checked)} />{x.nom}</label>)}
    </div>}
    {preview && <div className="karta p-3 space-y-1 text-[12px]" aria-live="polite">
      <p><b>Oldindan ko‘rish:</b> {preview.narxsiz} ta narxsiz resurs qatori.</p>
      <p className="text-success">{preview.mos} tasiga RES narxi aniq topildi.</p>
      <p>{preview.narxsizQoldi} tasi narxsiz qoladi — ular taxmin qilinmaydi.</p>
      <p className="text-text-mute">RS: {preview.turBoyicha.rs.mos}/{preview.turBoyicha.rs.narxsiz} · MAT: {preview.turBoyicha.mat.mos}/{preview.turBoyicha.mat.narxsiz} · OB: {preview.turBoyicha.ob.mos}/{preview.turBoyicha.ob.narxsiz}</p>
      {preview.ziddiyatliManba > 0 && <p className="text-amber-600">{preview.ziddiyatliManba} ta RES kalitida turli narx bor; ular avtomatik qo‘llanmaydi.</p>}
      {preview.moslashmagan.length > 0 && <details className="mt-2 rounded border border-border p-2">
        <summary className="cursor-pointer font-medium">Narxsiz qoladigan qatorlar sababi ({preview.moslashmagan.length})</summary>
        <ul className="mt-2 max-h-52 space-y-1 overflow-auto text-text-dim">
          {preview.moslashmagan.slice(0, 100).map((q, i) => <li key={`${q.tur}:${q.kod}:${q.nom}:${i}`}>
            <b>{q.tur.toUpperCase()}</b> · {q.kod || 'kodsiz'} · {q.nom || 'nomsiz'} ({q.birlik || 'birliksiz'}) — {SABAB_NOMI[q.sabab]}
          </li>)}
          {preview.moslashmagan.length > 100 && <li>Yana {preview.moslashmagan.length - 100} ta qator bor.</li>}
        </ul>
      </details>}
      <button type="button" className="tugma tugma-asosiy" disabled={busy || preview.mos === 0} onClick={() => void tasdiqla()}>Tasdiqlab narxlash</button>
    </div>}
    {natija && <p role="status" className="text-success">{natija}</p>}
  </div>;
}

export default function SmetaNarxlashResNative({ obyektId }: { obyektId?: number } = {}) {
  const { joriy, yuklanmoqda } = useKompaniya();
  if (yuklanmoqda) return <p>Kompaniya yuklanmoqda…</p>;
  if (!joriy?.id) return <p>Kompaniyani tanlang.</p>;
  return <Sessiya key={`${joriy.id}:${obyektId ?? 'all'}`} companyId={joriy.id} fixedObjectId={obyektId} />;
}
