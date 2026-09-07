import { useEffect, useRef, useState } from 'react';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { sbT2ObyektlarOlKomp, sbT2ResursKategoriyaBelgila, yangiOperationId, type T2Obyekt, type T2ResursKategoriya } from '../../api/supabase';
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

export type ImportQadam = { kalit: string; nom: string; holat: 'ishlamoqda' | 'tayyor' | 'xato'; tafsilot?: string };

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

/** Server t2_kat_birlik bilan bir xil mantiq (birlik matnida ЧЕЛ/МАШ),
 *  faqat mijoz tomonda ko'rib chiqish uchun taxmin -- yakuniy kategoriya
 *  hamisha serverda (registr + t2_kat_birlik) hisoblanadi. ОБ/КАБ/М/К hech
 *  qachon shu taxmindan chiqmaydi -- T1 GAS ham buni faqat registr orqali
 *  hal qilardi (10_Engine.js), shuning uchun МАТ (standart) qatorlar
 *  ko'rib chiqish uchun ko'rsatiladi. */
export function katTaxmini(nom: string, birlik: string): 'ЧЕЛ' | 'МАШ' | 'МАТ' {
  const b = birlik.toUpperCase();
  if (nom.toUpperCase().includes('ТРУДА МАШИНИСТОВ')) return 'МАШ';
  if (b.includes('ЧЕЛ')) return 'ЧЕЛ';
  if (b.includes('МАШ')) return 'МАШ';
  return 'МАТ';
}

export type VaraqTegi = 'lrv' | 'res' | 'etibor_bermaslik';

/**
 * Owner: "smeta lrv res... nomni farqi yo'q tizim o'zi aniqlashga harakat
 * qilishi kerak hujjatni ko'rib ... bitta hujjat ichida ham lrv ham res
 * sahifalari ham bo'lishi mumkin". Varaq nomiga qaraganda YOMON heuristika
 * -- odamlar varaqni istalgan narsa deb ataydi ("Sheet1", "Лист2" va h.k.).
 * Buning o'rniga MAZMUNGA qaraladi:
 *   RES (tekis narx katalogi): deyarli har bir qatorda narx bor, lekin
 *     hajm deyarli YO'Q (loyihaga bog'liq emas -- umumiy narxnoma).
 *   LRV (ish/hajm ierarxiyasi): hajm ustuni bor va ko'p qatorda
 *     to'ldirilgan (narx bo'lsin-bo'lmasin -- LRV ko'pincha narxsiz keladi).
 * Ikkalasi ham yo'q yoki juda kam ma'lumot -- "nomalum" (foydalanuvchi
 * qo'lda belgilaydi, hech narsa taxmin qilib yozilmaydi).
 */
export function varaqTuriTaxmin(rows: SheetGrid): 'lrv' | 'res' | 'nomalum' {
  const cols = f2UstunAniqla(rows);
  if (cols.nom < 0) return 'nomalum';
  let jami = 0, narxli = 0, hajmli = 0;
  for (const row of rows) {
    const nom = String(row[cols.nom] ?? '').trim();
    if (!nom) continue;
    jami++;
    const narx = cols.narx >= 0 ? son(row[cols.narx]) : undefined;
    const hajm = cols.obyom >= 0 ? son(row[cols.obyom]) : undefined;
    if (narx != null && narx > 0) narxli++;
    if (hajm != null) hajmli++;
  }
  if (jami < 3) return 'nomalum';
  const narxNisbat = narxli / jami;
  const hajmNisbat = hajmli / jami;
  if (hajmNisbat > 0.3) return 'lrv';
  if (narxNisbat > 0.6) return 'res';
  return 'nomalum';
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

/** Import jarayonining haqiqiy vaqtdagi qadam ro'yxati -- foydalanuvchi:
 *  "qanaqadir jarayon bo'layotganini bilib bo'lmaydi ... to'lib boruvchi
 *  ... animatsiya va loglar bilan ko'rsatib tursa". Progress-bar HAQIQIY
 *  tugagan qadamlar ulushi (simulyatsiya emas); har qadam o'z natijasi
 *  (tafsilot) bilan qatorlab ko'rsatiladi. */
export function ImportQadamlarPaneli({ qadamlar }: { qadamlar: ImportQadam[] }) {
  const tayyor = qadamlar.filter(q => q.holat === 'tayyor').length;
  const foiz = qadamlar.length ? Math.round((tayyor / qadamlar.length) * 100) : 0;
  return (
    <div className="karta p-3 space-y-2" role="status" aria-live="polite">
      <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <div className="h-full bg-accent transition-[width] duration-300 ease-out" style={{ width: Math.max(foiz, 6) + '%' }} />
      </div>
      <ul className="space-y-1 text-[12.5px]">
        {qadamlar.map(q => (
          <li key={q.kalit} className="flex items-center gap-2">
            {q.holat === 'ishlamoqda' && <Loader2 size={13} className="animate-spin text-accent flex-shrink-0" />}
            {q.holat === 'tayyor' && <CheckCircle2 size={13} className="text-ok flex-shrink-0" />}
            {q.holat === 'xato' && <XCircle size={13} className="text-danger flex-shrink-0" />}
            <span className={q.holat === 'xato' ? 'text-danger' : 'text-text'}>{q.nom}</span>
            {q.tafsilot && <span className="text-text-mute">— {q.tafsilot}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Sessiya({ companyId, fixedObjectId, onImportlandi }: { companyId: number; fixedObjectId?: number; onImportlandi?: () => void }) {
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
  const [katKorib, setKatKorib] = useState<Array<{ nom: string; birlik: string; tanlangan: T2ResursKategoriya }>>([]);
  const [katSaqlanmoqda, setKatSaqlanmoqda] = useState(false);
  /** Owner: "qanaqadir jarayon bo'layotganini bilib bo'lmaydi" -- import
   *  bosqichlari haqiqiy vaqtda, har bir qadam nima qilayotgani va
   *  natijasi bilan ko'rsatiladi (simulyatsiya emas -- har bir yozuv
   *  aynan shu qadam tugagach yoziladi). */
  const [importQadamlari, setImportQadamlari] = useState<ImportQadam[]>([]);
  /** Owner: bitta faylda ham LRV, ham RES varaqlari bo'lishi mumkin --
   *  har bir varaq turi mazmuniga qarab avtomatik taxmin qilinadi
   *  (varaqTuriTaxmin), foydalanuvchi shu yerda tasdiqlaydi/tuzatadi. */
  const [varaqTeglari, setVaraqTeglari] = useState<Record<string, VaraqTegi>>({});
  /** RES deb belgilangan har bir ICHKI varaq uchun avtomatik aniqlangan
   *  ustunlar -- f2UstunAniqla standart holatda ЕNKБ shakli (ikki qatorli
   *  sarlavha)ni kutadi, oddiy tekis kod/nom/narx jadvalida ustunlar
   *  noto'g'ri chiqishi mumkin, shuning uchun foydalanuvchi shu yerda ham
   *  tuzata oladi (alohida RES fayl bilan bir xil naqsh). */
  const [inFileResCols, setInFileResCols] = useState<Record<string, F2ColumnConfig>>({});
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
    setVaraqTeglari({}); setInFileResCols({});
  }

  /** Foydalanuvchi bir varaqni qo'lda LRV yoki RES deb belgilaydi (yoki
   *  e'tiborsiz qoldiradi). LRV -- radio kabi, faqat BITTASI bo'lishi
   *  mumkin (aynan shu varaqdan daraxt quriladi); RES -- checkbox kabi,
   *  bir nechtasi bo'lishi mumkin (barchasining narxlari birlashtiriladi). */
  function varaqTegBelgila(workbook: XlsxWorkbook, name: string, teg: VaraqTegi) {
    setVaraqTeglari(prev => {
      const next = { ...prev, [name]: teg };
      if (teg === 'lrv') {
        for (const k of Object.keys(next)) if (k !== name && next[k] === 'lrv') next[k] = 'etibor_bermaslik';
      }
      return next;
    });
    setResIndex(null); setResIndexSize(0);
    if (teg === 'lrv') chooseSheet(workbook, name);
    if (teg === 'res') {
      setInFileResCols(prev => {
        if (prev[name]) return prev; // avval belgilangan tuzatish saqlanadi
        const sheet = workbook.sheet(name);
        return sheet ? { ...prev, [name]: f2UstunAniqla(sheet.rows) } : prev;
      });
    }
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
      setBook(workbook);

      // Har bir varaq mazmuniga qarab LRV/RES/e'tiborsiz deb taxmin
      // qilinadi -- birinchi LRV-ga o'xshagan varaq daraxt qurish uchun
      // tanlanadi, qolgan LRV-ga o'xshaganlari (bo'lsa) ehtiyot uchun
      // e'tiborsiz qoldiriladi (foydalanuvchi qo'lda qayta belgilay oladi).
      const teglar: Record<string, VaraqTegi> = {};
      const resUstunlari: Record<string, F2ColumnConfig> = {};
      let lrvTanlandi = '';
      for (const s of workbook.sheets) {
        const sheet = workbook.sheet(s.name);
        const taxmin = sheet ? varaqTuriTaxmin(sheet.rows) : 'nomalum';
        teglar[s.name] = taxmin === 'nomalum' ? 'etibor_bermaslik' : taxmin;
        if (taxmin === 'res' && sheet) resUstunlari[s.name] = f2UstunAniqla(sheet.rows);
      }
      for (const s of workbook.sheets) {
        if (teglar[s.name] !== 'lrv') continue;
        if (!lrvTanlandi) lrvTanlandi = s.name; else teglar[s.name] = 'etibor_bermaslik';
      }
      if (!lrvTanlandi) { lrvTanlandi = workbook.sheets[0]?.name || ''; teglar[lrvTanlandi] = 'lrv'; }
      setVaraqTeglari(teglar); setInFileResCols(resUstunlari);

      chooseSheet(workbook, lrvTanlandi); setPhase('Varaq va ustunlarni tekshiring');
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
  /** Narx satrlarini BARCHA manbalardan yig'adi: (1) asosiy faylda RES deb
   *  belgilangan varaq(lar) -- ustunlar avtomatik aniqlanadi, (2) alohida
   *  yuklangan RES fayli (bor bo'lsa, ustunlari foydalanuvchi tuzatgan
   *  holda). Ikkalasi ham bo'lishi, faqat bittasi bo'lishi yoki hech biri
   *  bo'lmasligi mumkin -- owner: "bitta hujjat ichida ham lrv ham res
   *  sahifalari ham bo'lishi mumkin". */
  function resSatrlariBarchaManbadan(): ResNarxYozuv[] {
    const out: ResNarxYozuv[] = [];
    if (book) {
      for (const s of book.sheets) {
        if (varaqTeglari[s.name] !== 'res') continue;
        const sheet = book.sheet(s.name);
        if (!sheet) continue;
        out.push(...resSatrlariniOl(sheet.rows, inFileResCols[s.name] || f2UstunAniqla(sheet.rows)));
      }
    }
    if (resBook && resCols) {
      const sheet = resBook.sheet(resSheetName);
      if (sheet) out.push(...resSatrlariniOl(sheet.rows, resCols));
    }
    return out;
  }

  function resNarxlarniUlash() {
    const satrlar = resSatrlariBarchaManbadan();
    if (!satrlar.length) return;
    setResIndex(resNarxIndeksiQur(satrlar));
    setResIndexSize(satrlar.length);
    // "МАТ" (standart) chiqqan noyob nom+birlik juftlari -- aynan shular
    // haqiqatda ОБ/КАБ/М/К bo'lishi mumkin (T1 GAS ham buni faqat registr
    // orqali hal qilardi, hech qachon avtomatik taxmin qilmagan).
    const korilgan = new Set<string>();
    const kandidatlar: Array<{ nom: string; birlik: string; tanlangan: T2ResursKategoriya }> = [];
    for (const s of satrlar) {
      if (!s.nom || !s.birlik) continue;
      if (katTaxmini(s.nom, s.birlik) !== 'МАТ') continue;
      const key = s.nom.toUpperCase() + '|' + s.birlik.toUpperCase();
      if (korilgan.has(key)) continue;
      korilgan.add(key);
      kandidatlar.push({ nom: s.nom, birlik: s.birlik, tanlangan: 'МАТ' });
    }
    setKatKorib(kandidatlar);
  }

  /** O'zgartirilgan (МАТ'dan boshqa) kategoriyalarni registrga yozadi --
   *  best-effort, muvaffaqiyatsizlik importni to'xtatmaydi. */
  async function katlarniSaqla() {
    const ozgarganlar = katKorib.filter(k => k.tanlangan !== 'МАТ');
    if (!ozgarganlar.length) return;
    setKatSaqlanmoqda(true);
    try {
      await Promise.all(ozgarganlar.map(k =>
        sbT2ResursKategoriyaBelgila({ kompaniyaId: companyId, nom: k.nom, birlik: k.birlik, kategoriya: k.tanlangan }).catch(() => null)));
    } finally { setKatSaqlanmoqda(false); }
  }

  async function importQil() {
    if (!book || !cols || !objectId) return;
    setError(''); setResult(null); const token = generation.current; setBusy(true); setPhase('Import qilinmoqda');
    setImportQadamlari([]);
    const jonli = () => generation.current === token;
    /** Yangi qadam boshlanganini ko'rsatadi -- ro'yxatga qo'shiladi, holati "ishlamoqda". */
    const qadam = (nom: string) => { if (jonli()) setImportQadamlari(prev => [...prev, { kalit: String(prev.length), nom, holat: 'ishlamoqda' }]); };
    /** Oxirgi (hozir ishlayotgan) qadamni yakunlaydi -- muvaffaqiyat yoki xato, tafsilot bilan. */
    const yakunla = (holat: 'tayyor' | 'xato', tafsilot?: string) => {
      if (!jonli()) return;
      setImportQadamlari(prev => {
        if (!prev.length) return prev;
        const c = prev.slice();
        c[c.length - 1] = { ...c[c.length - 1], holat, tafsilot };
        return c;
      });
    };
    try {
      // Kategoriya tuzatishlar (agar bo'lsa) importdan OLDIN registrga
      // yoziladi -- shu import ham ulardan darhol foydalanishi uchun.
      if (katKorib.some(k => k.tanlangan !== 'МАТ')) {
        qadam('Kategoriya tuzatishlari saqlanmoqda');
        await katlarniSaqla();
        yakunla('tayyor');
      }

      qadam('Fayl tuzilishi (bo‘lim/ish/resurs) qurilmoqda');
      const sheet = book.sheet(sheetName)!;
      const built = f2FaylOqiCore(sheet.rows, cols);
      if (!('tree' in built) || !built.tree.length) {
        yakunla('xato', 'daraxt bo‘sh chiqdi');
        throw new Error('Ustunlarni tekshiring — daraxt bo‘sh chiqdi.');
      }
      yakunla('tayyor', built.tree.length + ' ta bo‘lim topildi');

      // RES fayli ulangan bo'lsa: narxi YO'Q rs/mat/ob barglariga kod/nom+birlik
      // bo'yicha narx qo'llanadi. LRV faylida allaqachon narx bo'lgan qatorlar
      // ustidan YOZILMAYDI (narxlarniDaraxtgaQoll'ning o'zi shuni ta'minlaydi).
      let importTree = built.tree;
      if (resIndex) {
        qadam('RES narxlari LRV daraxtiga ulanmoqda');
        const qollangan = narxlarniDaraxtgaQoll(built.tree, resIndex);
        importTree = qollangan.tree;
        yakunla('tayyor', qollangan.mosSoni + ' ta mos, ' + qollangan.mosEmasSoni + ' ta narxsiz qoldi');
      }

      if (!rawFile.current) throw new Error('Smeta manba fayli topilmadi. XLSX faylni qayta tanlang.');
      qadam('Manba fayl R2 saqlashga yuklanmoqda');
      const sourceDocumentId = await sourceniR2gaYukla(rawFile.current, Number(objectId));
      if (!jonli()) return;
      yakunla('tayyor', 'hujjat №' + sourceDocumentId);

      qadam('Kanonik bazaga yozilmoqda');
      const r = await fetch('/api/smeta-yukla', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amal: 'import', kompaniyaId: companyId, obyektId: Number(objectId),
          operationId: importOperationId.current || (importOperationId.current = yangiOperationId()), sourceDocumentId, tree: importTree,
        }),
      });
      const j = await r.json() as { ok: boolean; code?: string; xato?: string; qator_soni?: number };
      if (!jonli()) return;
      if (!j.ok) {
        if (j.code === 'SMETA_ALREADY_EXISTS') {
          yakunla('xato', 'smeta allaqachon mavjud');
          throw new Error('Bu obyektda smeta allaqachon mavjud — ustidan yozilmaydi (xavfsizlik uchun).');
        }
        yakunla('xato', j.xato || j.code || 'noma’lum xato');
        throw new Error('Import bajarilmadi (' + (j.code || 'xato') + ')' + (j.xato ? ': ' + j.xato : '') + '.');
      }
      yakunla('tayyor', (j.qator_soni || 0) + ' qator yozildi');
      setResult({ qator_soni: j.qator_soni || 0 }); setPhase('Tayyor');
      setObjects(prev => prev.map(o => o.id === Number(objectId) ? { ...o, qator_soni: j.qator_soni ?? o.qator_soni } : o));
      // Bu sahifa ko'pincha boshqa "asosiy" sahifa (masalan HolatNative)
      // ichida kichik panel sifatida ochiladi -- import muvaffaqiyatli
      // bo'lgach o'sha tashqi sahifa o'z daraxtini/summasini avtomatik
      // qayta yuklashi kerak, aks holda foydalanuvchi qo'lda "restart"
      // qilishga majbur bo'ladi (owner: shuni topib berdi).
      onImportlandi?.();
    } catch (e) {
      if (jonli()) {
        // Agar biror qadam "ishlamoqda" holatida to'xtab qolgan bo'lsa
        // (masalan kutilmagan istisno, yuqoridagi yakunla() chaqirilmagan
        // joyda) -- uni ham "xato" deb yakunlaymiz, osilib qolmasin.
        setImportQadamlari(prev => {
          if (!prev.length || prev[prev.length - 1].holat !== 'ishlamoqda') return prev;
          const c = prev.slice(); c[c.length - 1] = { ...c[c.length - 1], holat: 'xato' }; return c;
        });
        setError(e instanceof Error ? e.message : 'Import bajarilmadi.');
      }
    }
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
      {busy && importQadamlari.length === 0 && <p role="status">{phase}…</p>}
      {importQadamlari.length > 0 && <ImportQadamlarPaneli qadamlar={importQadamlari} />}
      {error && <p role="alert" className="text-danger">{error}</p>}
      {book && cols && !result && (
        <>
          {book.sheets.length > 1 && (
            <div className="karta p-3 space-y-1.5">
              <p className="text-[12px] font-semibold text-text">
                Varaqlar — har biri LRV yoki RES sifatida taxmin qilindi, kerak bo‘lsa tuzating
              </p>
              <p className="text-[11px] text-text-mute">
                Bitta faylda ham LRV (ish/hajm ierarxiyasi), ham RES (narx katalogi) varaqlari bo‘lishi mumkin.
                Aynan BITTA varaq LRV bo‘ladi (undan daraxt quriladi); RES belgilangan varaq(lar)ning narxlari
                birlashtirib qo‘llanadi.
              </p>
              <table className="w-full text-[12.5px]">
                <thead><tr className="text-text-mute text-left"><th className="font-normal pb-1">Varaq</th><th className="font-normal pb-1">LRV</th><th className="font-normal pb-1">RES</th></tr></thead>
                <tbody>
                  {book.sheets.map(s => (
                    <tr key={s.name} className="border-t border-border/40">
                      <td className="py-1 pr-2">{s.name}</td>
                      <td className="py-1 pr-2">
                        <input type="radio" name="lrv-varaq" aria-label={`${s.name} — LRV`}
                          checked={varaqTeglari[s.name] === 'lrv'}
                          onChange={() => varaqTegBelgila(book, s.name, 'lrv')} />
                      </td>
                      <td className="py-1">
                        <input type="checkbox" aria-label={`${s.name} — RES`}
                          checked={varaqTeglari[s.name] === 'res'}
                          onChange={e => varaqTegBelgila(book, s.name, e.target.checked ? 'res' : 'etibor_bermaslik')} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {book.sheets.filter(s => varaqTeglari[s.name] === 'res').map(s => {
                const c = inFileResCols[s.name];
                if (!c) return null;
                return (
                  <fieldset key={s.name} className="flex flex-wrap gap-3 items-end pt-1 border-t border-border/40">
                    <legend className="text-[11px] text-text-mute">«{s.name}» RES ustunlari (1 dan boshlab)</legend>
                    {(['kod', 'nom', 'bir', 'narx'] as const).map(k => (
                      <label key={k} className="text-[12px]">{k}
                        <input className="w-16 border rounded px-1 ml-1" type="number" min="1"
                          value={c[k] + 1}
                          onChange={e => { setResIndex(null); setResIndexSize(0); setInFileResCols(prev => ({ ...prev, [s.name]: { ...c, [k]: Number(e.target.value) - 1 } })); }} />
                      </label>
                    ))}
                  </fieldset>
                );
              })}
            </div>
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
              Agar RES yuqoridagi bir varaqqa BELGILANGAN bo‘lsa, alohida fayl shart emas — shu yerdagi tugma
              bilan ulang. Alohida RES fayli bo‘lsa, shu yerga ham yuklashingiz mumkin (ikkalasi ham birlashtiriladi).
              LRV faylida allaqachon narxi bor qatorlar ustidan yozilmaydi.
            </p>
            <label className="block text-sm">Alohida RES fayli (XLSX, ixtiyoriy)
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
                  <legend className="text-[11px] text-text-mute">Alohida RES fayl ustunlari (1 dan boshlab)</legend>
                  {(['kod', 'nom', 'bir', 'narx'] as const).map(k => (
                    <label key={k} className="text-[12px]">{k}
                      <input className="w-16 border rounded px-1 ml-1" type="number" min="1"
                        value={resCols[k] + 1}
                        onChange={e => { setResIndex(null); setResIndexSize(0); setResCols({ ...resCols, [k]: Number(e.target.value) - 1 }); }} />
                    </label>
                  ))}
                </fieldset>
              </>
            )}
            {(book?.sheets.some(s => varaqTeglari[s.name] === 'res') || (resBook && resCols)) && (
              <button type="button" className="tugma" onClick={resNarxlarniUlash}>Narxlarni ulash</button>
            )}
            {resIndex && (
              <p className="text-[12px] text-success">
                {resIndexSize} ta resurs narxi o‘qildi ({resIndex.byKod.size} ta kod bo‘yicha, {resIndex.byNomBir.size} ta nom+birlik bo‘yicha).
                Import bosilganda mos keluvchi narxsiz qatorlarga qo‘llanadi.
              </p>
            )}
            {katKorib.length > 0 && (
              <div className="karta p-2 space-y-1.5 border-amber-500/30">
                <p className="text-[11px] text-text-mute">
                  {katKorib.length} ta resurs standart МАТ (material) deb belgilangan — agar ular aslida
                  ОБ (uskuna), КАБ (kabel) yoki М/К bo‘lsa, shu yerda tuzating. Belgilangan tur keyingi
                  importlarda ham eslab qolinadi.
                </p>
                <div className="overflow-auto max-h-48 text-[12px]">
                  <table className="w-full">
                    <tbody>
                      {katKorib.slice(0, 300).map((k, i) => (
                        <tr key={k.nom + '|' + k.birlik} className="border-t border-border/40">
                          <td className="py-0.5 pr-2">{k.nom} <span className="text-text-mute">({k.birlik})</span></td>
                          <td className="py-0.5 text-right">
                            <select className="border rounded px-1 py-0.5" value={k.tanlangan}
                              onChange={e => setKatKorib(prev => prev.map((p, pi) => pi === i ? { ...p, tanlangan: e.target.value as T2ResursKategoriya } : p))}>
                              <option value="МАТ">МАТ</option>
                              <option value="ОБ">ОБ</option>
                              <option value="КАБ">КАБ</option>
                              <option value="М/К">М/К</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {katSaqlanmoqda && <p role="status" className="text-[11px]">Kategoriyalar saqlanmoqda…</p>}
              </div>
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

export default function SmetaYuklaNative({ obyektId, onImportlandi }: { obyektId?: number; onImportlandi?: () => void } = {}) {
  const { joriy, yuklanmoqda } = useKompaniya();
  if (yuklanmoqda) return <p>Kompaniya yuklanmoqda…</p>;
  if (!joriy?.id) return <p>Kompaniyani tanlang.</p>;
  return <Sessiya key={`${joriy.id}:${obyektId ?? 'all'}`} companyId={joriy.id} fixedObjectId={obyektId} onImportlandi={onImportlandi} />;
}
