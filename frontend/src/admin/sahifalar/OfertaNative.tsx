import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Info, RefreshCw } from 'lucide-react';
import { readXlsx, type XlsxWorkbook } from '../../lib/f2-import-parse';
import { ofertaQatorlariniHisobla, type OfertaNarxRejimi, type OfertaQatorNatija, type OfertaNarxSozlamasi } from '../../lib/tender-oferta';
import { ofertaFaylNomi, tenderOfertaXlsx } from '../../lib/tender-oferta-export';
import { ofertaResursVaraqlariniAniqla, ofertaTanlanganQatorlari, type OfertaSheetTahlili } from '../../lib/tender-oferta-parser';
import { downloadBlob } from '../../lib/construction-document-control/export/download-helper';
import { Sahifa } from '../../umumiy/ui/Sahifa';

const MAX_FILE_BYTES = 80 * 1024 * 1024;
const NUMBER = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 4 });

function fmt(value: number | null): string {
  return value == null ? '—' : NUMBER.format(value);
}

function parseInput(value: string): number | null {
  const normalized = value.replace(/[\s\u00a0]/g, '').replace(',', '.');
  if (!normalized.trim()) return null;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function roleText(role: OfertaSheetTahlili['role']): string {
  if (role === 'res') return 'RES';
  if (role === 'transport') return 'TRANSPORT XARAJATI';
  if (role === 'lrv') return 'LRV — tanlanmaydi';
  return 'Noma’lum — tekshirish kerak';
}

function confidenceText(confidence: OfertaSheetTahlili['confidence']): string {
  if (confidence === 'yuqori') return 'yuqori ishonch';
  if (confidence === 'o‘rta') return 'o‘rta ishonch';
  return 'past ishonch';
}

const MUAMMO_MATNI: Record<string, string> = {
  HAJM_YOQ: 'smeta hajmi yo‘q — taklif summasi bo‘sh qoldirildi',
  PUDRATCHI_NARXI_YOQ: 'pudratchi narxi/summasi kiritilmagan',
  SMETA_NARXI_YOQ: 'smeta narxi yoki manba summasi topilmadi',
  FOIZ_XATO: 'foiz qiymati noto‘g‘ri',
  NARX_MANFIY: 'hisoblangan narx manfiy bo‘lishi mumkin emas',
  JAMI_CHILDREN_YOQ: 'JAMI uchun hisoblanadigan bolalar topilmadi',
};

function qatorMuammosi(qator: OfertaQatorNatija): string {
  if (!qator.muammolar.length) return 'TAYYOR';
  return qator.muammolar.map((muammo) => MUAMMO_MATNI[muammo] ?? muammo).join('; ');
}

function qatorTuri(qator: OfertaQatorNatija): string {
  if (qator.turi === 'jami') return 'JAMI — qayta qo‘shilmaydi';
  if (qator.turi === 'sklad_xarajati') return 'SKLAD XARAJATI';
  if (qator.turi === 'transport_xarajati') return 'TRANSPORT XARAJATI';
  if (qator.turi === 'bolim') return 'BO‘LIM';
  return 'RESURS';
}

function Sessiya() {
  const [workbook, setWorkbook] = useState<XlsxWorkbook | null>(null);
  const [manbaBytes, setManbaBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState('');
  const [tahlillar, setTahlillar] = useState<OfertaSheetTahlili[]>([]);
  const [tanlanganVaraqlar, setTanlanganVaraqlar] = useState<string[]>([]);
  const [manualNarxlar, setManualNarxlar] = useState<Record<string, string>>({});
  const [manualHajmlar, setManualHajmlar] = useState<Record<string, string>>({});
  const [rejim, setRejim] = useState<OfertaNarxRejimi>('foiz');
  const [yon, setYon] = useState<OfertaNarxSozlamasi['yon']>('pasaytirish');
  const [foiz, setFoiz] = useState('0');
  const [qidiruv, setQidiruv] = useState('');
  const [obyektNomi, setObyektNomi] = useState('');
  const [sozlama, setSozlama] = useState<OfertaNarxSozlamasi>({ rejim: 'foiz', yon: 'pasaytirish', foiz: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const qatorlar = useMemo(() => ofertaTanlanganQatorlari(tahlillar, tanlanganVaraqlar), [tahlillar, tanlanganVaraqlar]);
  const hisobQatorlari = useMemo(() => qatorlar.map((qator) => {
    const raw = manualHajmlar[qator.sourceId];
    const hajm = raw == null ? null : parseInput(raw);
    return raw != null && hajm != null ? { ...qator, hajm } : qator;
  }), [qatorlar, manualHajmlar]);
  const hisob = useMemo(() => ofertaQatorlariniHisobla(hisobQatorlari, sozlama, Object.fromEntries(
    Object.entries(manualNarxlar).map(([key, value]) => [key, parseInput(value)]),
  )), [hisobQatorlari, sozlama, manualNarxlar]);
  const filtr = qidiruv.trim().toUpperCase();
  const korinadigan = filtr
    ? hisob.qatorlar.filter((q) => `${q.nom} ${q.shifr ?? ''} ${q.sourceSheet}`.toUpperCase().includes(filtr))
    : hisob.qatorlar;
  const muammoliQatorlar = hisob.qatorlar.filter((qator) => qator.muammolar.length > 0);

  async function faylniOqish(file: File) {
    setError(''); setMessage(''); setWorkbook(null); setManbaBytes(null); setTahlillar([]); setTanlanganVaraqlar([]); setManualNarxlar({}); setManualHajmlar({});
    if (file.size > MAX_FILE_BYTES) { setError('Fayl 80 MB dan katta. Kichikroq RES faylini tanlang.'); return; }
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const parsed = await readXlsx(bytes);
      const analyzed = ofertaResursVaraqlariniAniqla(parsed);
      const auto = analyzed.filter((sheet) => (sheet.role === 'res' || sheet.role === 'transport') && !sheet.alternativVaraq && sheet.qatorlar.length > 0).map((sheet) => sheet.nom);
      const fallback = auto.length ? auto : analyzed.filter((sheet) => sheet.role === 'unknown' && sheet.qatorlar.length > 0).map((sheet) => sheet.nom);
      if (!analyzed.some((sheet) => sheet.qatorlar.length > 0)) {
        throw new Error('RES_RESOURCE_SHEETS_NOT_FOUND: resurs nomi, birlik va narx ustunlari bo‘lgan satrlar topilmadi.');
      }
      setWorkbook(parsed); setManbaBytes(bytes); setFileName(file.name); setTahlillar(analyzed); setTanlanganVaraqlar(fallback); setManualNarxlar({});
      setObyektNomi(file.name.replace(/\.(xlsx|xlsm|xls)$/i, ''));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'RES fayli o‘qilmadi.');
    } finally { setBusy(false); }
  }

  function varaqniTanlash(name: string, checked: boolean) {
    const sheet = tahlillar.find((item) => item.nom === name);
    if (sheet?.role === 'lrv') return;
    if (checked && sheet?.alternativVaraq && tanlanganVaraqlar.includes(sheet.alternativVaraq)) {
      setError(`${name} — ${sheet.alternativVaraq} varag‘ining alternativ ko‘rinishi. Ikki variantni birga tanlash mumkin emas.`);
      return;
    }
    setError('');
    setTanlanganVaraqlar((old) => {
      if (!checked) return old.filter((item) => item !== name);
      const alternativNomlar = [
        ...(sheet?.alternativVaraq ? [sheet.alternativVaraq] : []),
        ...tahlillar.filter((item) => item.alternativVaraq === name).map((item) => item.nom),
      ];
      return [...old.filter((item) => !alternativNomlar.includes(item)), ...(old.includes(name) ? [] : [name])];
    });
  }

  function narxniOzgartir(sourceId: string, value: string) {
    setManualNarxlar((old) => {
      if (!value.trim()) {
        const next = { ...old };
        delete next[sourceId];
        return next;
      }
      return { ...old, [sourceId]: value };
    });
  }

  function hajmniOzgartir(sourceId: string, value: string) {
    setManualHajmlar((old) => {
      if (!value.trim()) {
        const next = { ...old };
        delete next[sourceId];
        return next;
      }
      return { ...old, [sourceId]: value };
    });
  }

  function smetaNarxiniBoshlangichQil() {
    const next: Record<string, string> = {};
    for (const qator of qatorlar) {
      if (qator.hisobTuri === 'manba_jami' && qator.smetaSumma != null) next[qator.sourceId] = String(qator.smetaSumma);
      else if (qator.turi === 'resurs' && qator.smetaBirlikNarx != null) next[qator.sourceId] = String(qator.smetaBirlikNarx);
    }
    setManualNarxlar(next);
    setSozlama({ rejim: 'qolda' });
    setRejim('qolda');
  }

  function foizniQollash() {
    const value = parseInput(foiz);
    if (value == null) { setError('Foiz 0 yoki undan katta son bo‘lishi kerak.'); return; }
    setError(''); setRejim('foiz'); setSozlama({ rejim: 'foiz', yon, foiz: value });
  }

  function qoldaKiritishgaOtish() {
    setError(''); setRejim('qolda'); setSozlama({ rejim: 'qolda' });
  }

  async function eksportQilish() {
    setError(''); setMessage('');
    if (!qatorlar.length) { setError('Avval kamida bitta RES varag‘ini tanlang.'); return; }
    if (!manbaBytes) { setError('Asl RES fayli topilmadi. Faylni qayta tanlang.'); return; }
    setBusy(true);
    try {
      const data = await tenderOfertaXlsx({ obyektNomi, manbaFaylNomi: fileName, manbaBytes, tanlanganVaraqlar, tahlillar, sozlama, qatorlar: hisob.qatorlar });
      downloadBlob(data, ofertaFaylNomi(fileName));
      setMessage(hisob.muammolarSoni > 0
        ? `Fayl muammolar bilan ham berildi. ${hisob.muammolarSoni} ta nazorat qaydi bo‘yicha qiymatlar bo‘sh qoldirildi; pastdagi logdan tekshiring.`
        : 'Asl RES faylining barcha varaqlari saqlandi. Faqat tanlangan RES/transport varaqlariga pudratchi narxi va taklif summasi ustunlari qo‘shildi.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Oferta fayli yaratilmadi.'); }
    finally { setBusy(false); }
  }

  return <div className="space-y-3">
    <div className="karta grid gap-3 p-3 md:grid-cols-[1fr_1fr_1fr]">
      <label className="block text-[12px] font-medium text-text">RES fayli (XLSX/XLSM/XLS)
        <input aria-label="Oferta RES fayli" type="file" accept=".xlsx,.xlsm,.xls" disabled={busy}
          onChange={(e) => { const file = e.target.files?.[0]; if (file) void faylniOqish(file); }}
          className="input mt-1.5 block h-9 w-full px-2 py-1.5 text-[12px] file:mr-2 file:rounded file:border-0 file:bg-surface file:px-2 file:py-1 file:text-[12px] file:text-text" />
      </label>
      <label className="block text-[12px] font-medium text-text">Obyekt nomi
        <input aria-label="Oferta obyekt nomi" value={obyektNomi} onChange={(e) => setObyektNomi(e.target.value)} className="input mt-1.5 block h-9 w-full px-2 text-[13px]" placeholder="Obyekt nomi" />
      </label>
      <div className="rounded-lg border border-border/70 bg-surface-2 p-2 text-[11px] text-text-dim">
        <div className="flex items-center gap-1.5 font-semibold text-text"><Info size={14} /> Ishlash qoidasi</div>
        <p className="mt-1">Yangi jadval yaratilmaydi: yuklangan RES faylining barcha varaqlari saqlanadi. Faqat tanlangan varaqlarning oxiriga pudratchi narxi va taklif summasi ustunlari qo‘shiladi; JAMI, sklad va transport hisoblari resurs bilan aralashtirilmaydi.</p>
      </div>
    </div>

    {busy && <p role="status" className="text-[13px] text-text-dim">Fayl tahlil qilinmoqda…</p>}
    {error && <p role="alert" className="karta border-danger/40 bg-danger/5 p-3 text-[13px] text-danger">{error}</p>}
    {message && <p role="status" className="karta border-ok/40 bg-ok/5 p-3 text-[13px] text-success">{message}</p>}

    {workbook && <section className="karta space-y-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[13px] font-semibold text-text">Varaq roli — foydalanuvchi tasdig‘i</h2>
          <p className="mt-1 text-[11px] text-text-mute">Tizim mazmun bo‘yicha taxmin qildi. LRV varag‘i oferta qatorlariga qo‘shilmaydi; RES va alohida transport hisob varaqlarini tasdiqlab tanlang. Yakuniy faylda qolgan barcha varaqlar o‘z joyida qoladi.</p>
        </div>
        <span className="rounded bg-surface-2 px-2 py-1 text-[11px] text-text-dim">{tanlanganVaraqlar.length} ta varaq / {qatorlar.length} ta qator</span>
      </div>
      <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-[11px]">
          <thead><tr className="border-b border-border text-left text-text-mute"><th className="py-2">Qo‘shish</th><th>Varaq</th><th>Rol</th><th>Format</th><th>Ishonch</th><th>Topilmalar</th><th>Qator</th></tr></thead>
          <tbody>{tahlillar.map((sheet) => <tr key={sheet.nom} className="border-b border-border/50 align-top">
            <td className="py-2">{sheet.role === 'lrv' ? <span className="text-text-mute">—</span> : <input aria-label={`${sheet.nom} varag‘ini tanlash`} type="checkbox" checked={tanlanganVaraqlar.includes(sheet.nom)} onChange={(e) => varaqniTanlash(sheet.nom, e.target.checked)} />}</td>
            <td className="py-2 font-medium text-text">{sheet.nom}</td>
            <td className={sheet.role === 'res' ? 'py-2 font-semibold text-ok' : 'py-2 text-warn'}>{roleText(sheet.role)}</td>
            <td className="py-2 text-text-dim">{sheet.format.toUpperCase()}</td>
            <td className="py-2 text-text-dim">{confidenceText(sheet.confidence)}</td>
            <td className="max-w-[460px] py-2 text-text-dim">{sheet.evidence.join(' · ')}{sheet.alternativVaraq && <span className="ml-1 font-semibold text-warn">(alternativ: {sheet.alternativVaraq})</span>}</td>
            <td className="py-2 text-right tabular-nums text-text-dim">{sheet.qatorlar.length}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>}

    {qatorlar.length > 0 && <>
      <section className="karta space-y-3 p-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="block text-[12px] font-medium text-text">Narx berish usuli
            <select aria-label="Oferta narx usuli" value={rejim} onChange={(e) => e.target.value === 'foiz' ? setRejim('foiz') : qoldaKiritishgaOtish()} className="input mt-1 block h-9 px-2 text-[12px]">
              <option value="foiz">Smeta narxidan foiz bilan</option>
              <option value="qolda">Har qator bo‘yicha qo‘lda</option>
            </select>
          </label>
          {rejim === 'foiz' && <>
            <label className="block text-[12px] font-medium text-text">Amal
              <select aria-label="Oferta foiz amali" value={yon} onChange={(e) => setYon(e.target.value as OfertaNarxSozlamasi['yon'])} className="input mt-1 block h-9 px-2 text-[12px]"><option value="pasaytirish">Pasaytirish</option><option value="oshirish">Oshirish</option></select>
            </label>
            <label className="block text-[12px] font-medium text-text">Foiz
              <input aria-label="Oferta foiz miqdori" inputMode="decimal" value={foiz} onChange={(e) => setFoiz(e.target.value)} className="input mt-1 h-9 w-24 px-2 text-[12px]" />
            </label>
            <button type="button" className="tugma tugma-asosiy h-9" onClick={foizniQollash}><RefreshCw size={14} /> Foizni qo‘llash</button>
          </>}
          {rejim === 'qolda' && <button type="button" className="tugma h-9" onClick={smetaNarxiniBoshlangichQil}>Smeta narxlarini boshlang‘ich qilish</button>}
          <button type="button" className="tugma tugma-asosiy h-9" onClick={() => void eksportQilish()} disabled={busy}><Download size={14} /> Asl RES faylini oferta qilish</button>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-lg border border-border p-2"><span className="text-[10px] text-text-mute">Qatorlar</span><strong className="mt-1 block text-lg text-text">{qatorlar.length}</strong></div>
          <div className="rounded-lg border border-border p-2"><span className="text-[10px] text-text-mute">Smeta jami</span><strong className="mt-1 block text-lg text-text">{fmt(hisob.smetaJami)}</strong></div>
          <div className="rounded-lg border border-border p-2"><span className="text-[10px] text-text-mute">Resurs oferta</span><strong className="mt-1 block text-lg text-text">{fmt(hisob.resursJami)}</strong></div>
          <div className="rounded-lg border border-border p-2"><span className="text-[10px] text-text-mute">Sklad xarajati</span><strong className="mt-1 block text-lg text-text">{fmt(hisob.skladJami)}</strong></div>
          <div className="rounded-lg border border-border p-2"><span className="text-[10px] text-text-mute">Transport xarajati</span><strong className="mt-1 block text-lg text-text">{fmt(hisob.transportJami)}</strong></div>
          <div className="rounded-lg border border-border p-2"><span className="text-[10px] text-text-mute">Oferta jami</span><strong className="mt-1 block text-lg text-ok">{fmt(hisob.ofertaJami)}</strong></div>
        </div>
        <div className={`rounded-lg border p-2 ${hisob.valid ? 'border-ok/40 bg-ok/5' : 'border-warn/40 bg-warn/5'}`}><span className="text-[10px] text-text-mute">Tekshiruv</span><strong className="mt-1 block text-sm text-text">{hisob.valid ? 'TAYYOR' : `${hisob.muammolarSoni} ta nazorat qaydi — faylni olish mumkin`}</strong></div>
        {muammoliQatorlar.length > 0 && <div role="status" className="rounded-lg border border-warn/40 bg-warn/5 p-3 text-[11px] text-text-dim">
          <strong className="text-text">Muammoli qatorlar logi</strong>
          <p className="mt-1">Bu qaydlar eksportni to‘smasligi uchun manba fayl saqlandi. Aniqlanmagan qiymatlar hujjatga taxminan yozilmadi va bo‘sh qoldirildi.</p>
          <ul className="mt-2 max-h-36 list-disc space-y-1 overflow-auto pl-5">
            {muammoliQatorlar.slice(0, 50).map((qator) => <li key={qator.sourceId}>{qator.sourceSheet}, {qator.sourceRow}-qator — {qator.nom}: {qatorMuammosi(qator)}</li>)}
          </ul>
          {muammoliQatorlar.length > 50 && <p className="mt-1">Yana {muammoliQatorlar.length - 50} ta qayd mavjud; qatorlar jadvalidagi “Holat” ustunida ko‘rishingiz mumkin.</p>}
        </div>}
      </section>

      <section className="karta p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[13px] font-semibold text-text"><FileSpreadsheet className="mr-1 inline" size={15} />Oferta satrlari</h2>
          <input aria-label="Oferta qatorlarini qidirish" value={qidiruv} onChange={(e) => setQidiruv(e.target.value)} placeholder="Kod, resurs yoki varaq…" className="input h-8 w-64 px-2 text-[12px]" />
        </div>
        <div className="max-h-[58vh] overflow-auto rounded border border-border/60">
          <table className="w-full min-w-[1240px] text-[11px]">
            <thead className="sticky top-0 z-10 bg-surface-2 text-left text-text-mute"><tr><th className="px-2 py-2">№</th><th className="px-2">Shifr</th><th className="px-2">RES/TN turi</th><th className="px-2">Resurs nomi</th><th className="px-2">Birlik</th><th className="px-2 text-right">Miqdor</th><th className="px-2 text-right">Smeta narxi</th><th className="px-2 text-right">Smeta summa</th><th className="px-2 text-right">Pudratchi narxi/summa</th><th className="px-2 text-right">Taklif summasi</th><th className="px-2">Holat</th></tr></thead>
            <tbody>{korinadigan.map((qator) => <tr key={qator.sourceId} className="border-t border-border/50 align-top">
              <td className="px-2 py-1.5 text-text-dim">{qator.tartibRaqami ?? '—'}</td>
              <td className="px-2 py-1.5 text-text-dim">{qator.shifr ?? '—'}</td>
              <td className="px-2 py-1.5 text-text-dim">{qatorTuri(qator)}</td>
              <td className={`max-w-[340px] px-2 py-1.5 font-medium text-text ${qator.turi === 'jami' ? 'font-semibold' : ''}`} title={`${qator.sourceSheet} / ${qator.sourceRow}-qator`}>{qator.nom}</td>
              <td className="px-2 py-1.5 text-text-dim">{qator.birlik ?? '—'}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-text">{qator.turi === 'bolim' || qator.turi === 'jami' || qator.hisobTuri === 'manba_jami' ? '—' : qator.hajm == null
                ? <input aria-label={`${qator.nom} hajmi`} inputMode="decimal" value={manualHajmlar[qator.sourceId] ?? ''} onChange={(e) => hajmniOzgartir(qator.sourceId, e.target.value)} placeholder="Hajm" className="w-24 rounded border border-warn/50 bg-white px-1.5 py-1 text-right" />
                : fmt(qator.hajm)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-text-dim">{fmt(qator.smetaBirlikNarx)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-text-dim">{fmt(qator.smetaSumma)}</td>
              <td className="bg-surface-2 px-2 py-1">{qator.turi === 'jami' || qator.turi === 'bolim' ? '—' : <input aria-label={`${qator.nom} pudratchi ${qator.hisobTuri === 'manba_jami' ? 'summasi' : 'narxi'}`} inputMode="decimal" value={manualNarxlar[qator.sourceId] ?? ''} onChange={(e) => narxniOzgartir(qator.sourceId, e.target.value)} placeholder={qator.hisobTuri === 'manba_jami' ? 'Taklif summasi' : fmt(qator.pudratchiBirlikNarx)} className="w-32 rounded border border-border bg-surface-2 px-1.5 py-1 text-right tabular-nums" />}</td>
              <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-ok">{fmt(qator.pudratchiSumma)}</td>
              <td className={`px-2 py-1.5 ${qator.muammolar.length ? 'font-semibold text-danger' : 'text-ok'}`}>{qatorMuammosi(qator)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        {!korinadigan.length && <p className="py-6 text-center text-[12px] text-text-mute">Qidiruv bo‘yicha qator topilmadi.</p>}
      </section>
    </>}
  </div>;
}

export default function OfertaNative() {
  return <Sahifa sarlavha="Tender oferta" tavsif="RES faylidan smeta va pudratchi narxlarini ajratib, tender taklifini xavfsiz hisoblash va XLSX ko‘rinishida chiqarish">
    <Sessiya />
  </Sahifa>;
}
