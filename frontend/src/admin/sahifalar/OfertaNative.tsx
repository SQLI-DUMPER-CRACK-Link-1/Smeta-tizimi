import { useEffect, useMemo, useState } from 'react';
import { CheckCheck, Download, FileSpreadsheet, Info, RefreshCw } from 'lucide-react';
import { readXlsx, type XlsxWorkbook } from '../../lib/f2-import-parse';
import {
  OFERTA_KATEGORIYALAR, ofertaHisobla,
  type OfertaFoiz, type OfertaFoizYon, type OfertaMalumKategoriya, type OfertaNarxRejimi,
  type OfertaNarxSozlamasi, type OfertaQatorNatija, type OfertaTransportSiyosati,
} from '../../lib/tender-oferta';
import { ofertaHolatMatni, tenderOfertaXlsx } from '../../lib/tender-oferta-export';
import { ofertaResursVaraqlariniAniqla, ofertaTanlanganQatorlari, type OfertaSheetTahlili } from '../../lib/tender-oferta-parser';
import { NAKRUTKA_STANDART, type NakrutkaQadamlar } from '../../lib/nakrutka-kaskad';
import { NAKRUTKA_KOEF_IZOH, NAKRUTKA_KOEF_KODLAR, t2NakrutkaKoefOl, type NakrutkaKoefKod, type NakrutkaKoeffitsientlar } from '../../api/t2-nakrutka';
import { downloadBlob } from '../../lib/construction-document-control/export/download-helper';
import { useKompaniya } from '../../test02/KompaniyaTanlov';
import { Sahifa } from '../../umumiy/ui/Sahifa';

const MAX_FILE_BYTES = 80 * 1024 * 1024;
const NUMBER = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const fmt = (value: number | null | undefined): string => (value == null ? '—' : NUMBER.format(value));

/** Foydalanuvchi kiritgan son: bo'sh — null (0 EMAS); manfiy yoki matn — null. */
function parseInput(value: string): number | null {
  const normalized = value.replace(/[\s ]/g, '').replace(',', '.');
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

const ROL_MATNI: Record<string, string> = {
  RESOURCE: 'Resurs', SECTION: 'Bo‘lim', SUBTOTAL: 'Oraliq jami', GRAND_TOTAL: 'Umumiy jami',
  TRANSPORT: 'Transport', STORAGE: 'Sklad', MARKUP: 'Ustama', INFO: 'Ma’lumot', UNKNOWN: 'Noma’lum',
};

const KASKAD_QADAMLARI: Array<[keyof NakrutkaQadamlar, string]> = [
  ['pryamye', 'To‘g‘ridan-to‘g‘ri xarajatlar'], ['tr_mat', 'Material transporti'], ['skl_mat', 'Material sklad xarajati'],
  ['tr_kab', 'Kabel transporti'], ['itogo1', 'Itogo 1'], ['prochie', 'Pudratchi boshqa xarajatlari'], ['itogo2', 'Itogo 2'],
  ['tr_ob', 'Uskuna transporti'], ['zag_ob', 'Uskuna zagotovka/sklad'], ['itogo3', 'Itogo 3'], ['strax', 'Sug‘urta'],
  ['risk', 'Risk'], ['itogo4', 'Itogo 4'], ['nds', 'QQS (NDS)'], ['vsego', 'JAMI (yakuniy)'],
];

type Koef = { qiymatlar: NakrutkaKoeffitsientlar; manba: 'kompaniya' | 'standart' | 'tahrirlangan' };

function Sessiya() {
  const { joriy } = useKompaniya();
  const [workbook, setWorkbook] = useState<XlsxWorkbook | null>(null);
  const [manbaBytes, setManbaBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState('');
  const [tahlillar, setTahlillar] = useState<OfertaSheetTahlili[]>([]);
  const [tanlanganVaraqlar, setTanlanganVaraqlar] = useState<string[]>([]);
  const [manualNarxlar, setManualNarxlar] = useState<Record<string, string>>({});
  const [manualHajmlar, setManualHajmlar] = useState<Record<string, string>>({});
  const [manualKategoriyalar, setManualKategoriyalar] = useState<Record<string, OfertaMalumKategoriya>>({});
  const [rejim, setRejim] = useState<OfertaNarxRejimi>('foiz');
  const [yon, setYon] = useState<OfertaFoizYon>('pasaytirish');
  const [foiz, setFoiz] = useState('0');
  const [katFoizMatn, setKatFoizMatn] = useState<Partial<Record<OfertaMalumKategoriya, { yon: OfertaFoizYon; foiz: string }>>>({});
  const [sozlama, setSozlama] = useState<OfertaNarxSozlamasi>({ rejim: 'foiz', yon: 'pasaytirish', foiz: 0 });
  const [transport, setTransport] = useState<OfertaTransportSiyosati>('kaskad');
  const [koef, setKoef] = useState<Koef>({ qiymatlar: { ...NAKRUTKA_STANDART }, manba: 'standart' });
  const [qidiruv, setQidiruv] = useState('');
  const [faqatMuammo, setFaqatMuammo] = useState(false);
  const [obyektNomi, setObyektNomi] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Nakrutka koeffitsientlari: kompaniyaniki, bo'lmasa T1 standarti (SQL t2_nakrutka_default_v1).
  useEffect(() => {
    let active = true;
    if (!joriy?.id) return;
    void t2NakrutkaKoefOl(joriy.id).then((r) => {
      if (!active) return;
      const toliq = r.ok && NAKRUTKA_KOEF_KODLAR.every((k) => Number.isFinite(Number(r.koeffitsientlar[k])));
      setKoef(toliq ? { qiymatlar: r.koeffitsientlar, manba: 'kompaniya' } : { qiymatlar: { ...NAKRUTKA_STANDART }, manba: 'standart' });
    });
    return () => { active = false; };
  }, [joriy?.id]);

  const qatorlar = useMemo(() => ofertaTanlanganQatorlari(tahlillar, tanlanganVaraqlar), [tahlillar, tanlanganVaraqlar]);
  const raqamlar = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, parseInput(v)]));
  const hisob = useMemo(() => ofertaHisobla(qatorlar, {
    sozlama,
    manualNarxlar: raqamlar(manualNarxlar),
    manualHajmlar: raqamlar(manualHajmlar),
    manualKategoriyalar,
    nakrutka: koef.qiymatlar,
    transportSiyosati: transport,
  }), [qatorlar, sozlama, manualNarxlar, manualHajmlar, manualKategoriyalar, koef.qiymatlar, transport]);

  const taklifKutmoqda = hisob.qatorlar.filter((q) => q.kategoriyaTaklifi && !manualKategoriyalar[q.sourceId] && q.samaraliKategoriya === 'UNKNOWN');
  const filtr = qidiruv.trim().toUpperCase();
  const korinadigan = hisob.qatorlar.filter((q) =>
    (!faqatMuammo || q.muammolar.length > 0)
    && (!filtr || `${q.nom} ${q.shifr ?? ''} ${q.sourceSheet}`.toUpperCase().includes(filtr)));

  async function faylniOqish(file: File) {
    setError(''); setMessage(''); setWorkbook(null); setManbaBytes(null); setTahlillar([]); setTanlanganVaraqlar([]);
    setManualNarxlar({}); setManualHajmlar({}); setManualKategoriyalar({});
    if (file.size > MAX_FILE_BYTES) { setError('Fayl 80 MB dan katta. Kichikroq RES faylini tanlang.'); return; }
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const parsed = await readXlsx(bytes);
      const analyzed = ofertaResursVaraqlariniAniqla(parsed);
      const auto = analyzed.filter((s) => (s.role === 'res' || s.role === 'transport') && !s.alternativVaraq && s.qatorlar.length > 0).map((s) => s.nom);
      const fallback = auto.length ? auto : analyzed.filter((s) => s.role === 'unknown' && s.qatorlar.length > 0).map((s) => s.nom);
      if (!analyzed.some((s) => s.qatorlar.length > 0)) {
        throw new Error('RES_RESOURCE_SHEETS_NOT_FOUND: resurs nomi, birlik va narx ustunlari bo‘lgan satrlar topilmadi.');
      }
      setWorkbook(parsed); setManbaBytes(bytes); setFileName(file.name); setTahlillar(analyzed); setTanlanganVaraqlar(fallback);
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
      const alternativ = [
        ...(sheet?.alternativVaraq ? [sheet.alternativVaraq] : []),
        ...tahlillar.filter((item) => item.alternativVaraq === name).map((item) => item.nom),
      ];
      return [...old.filter((item) => !alternativ.includes(item)), ...(old.includes(name) ? [] : [name])];
    });
  }

  const matnniYoz = (set: (f: (o: Record<string, string>) => Record<string, string>) => void) => (sourceId: string, value: string) =>
    set((old) => {
      const next = { ...old };
      if (!value.trim()) delete next[sourceId]; else next[sourceId] = value;
      return next;
    });
  const narxniOzgartir = matnniYoz(setManualNarxlar);
  const hajmniOzgartir = matnniYoz(setManualHajmlar);

  function kategoriyaniOzgartir(sourceId: string, value: string) {
    setManualKategoriyalar((old) => {
      const next = { ...old };
      if (!value) delete next[sourceId]; else next[sourceId] = value as OfertaMalumKategoriya;
      return next;
    });
  }

  /* БЕЗСКЛАД va boshqa kategoriya takliflari avtomatik qo'llanmaydi (dalil to'liq
     isbotlanmagan) — operator bitta tugma bilan barchasini tasdiqlaydi. */
  function takliflarniQabulQilish() {
    setManualKategoriyalar((old) => {
      const next = { ...old };
      for (const q of taklifKutmoqda) next[q.sourceId] = q.kategoriyaTaklifi!;
      return next;
    });
  }

  function foizniQollash() {
    const value = parseInput(foiz);
    if (value == null) { setError('Foiz 0 yoki undan katta son bo‘lishi kerak.'); return; }
    const kategoriyaFoizlari: Partial<Record<OfertaMalumKategoriya, OfertaFoiz>> = {};
    for (const [kat, v] of Object.entries(katFoizMatn) as Array<[OfertaMalumKategoriya, { yon: OfertaFoizYon; foiz: string }]>) {
      if (!v.foiz.trim()) continue;
      const n = parseInput(v.foiz);
      if (n == null) { setError(`${kat} foizi noto‘g‘ri — 0 yoki undan katta son kiriting.`); return; }
      kategoriyaFoizlari[kat] = { yon: v.yon, foiz: n };
    }
    setError(''); setRejim('foiz'); setSozlama({ rejim: 'foiz', yon, foiz: value, kategoriyaFoizlari });
  }

  function smetaNarxiniBoshlangichQil() {
    const next: Record<string, string> = {};
    for (const q of qatorlar) {
      if (q.rol !== 'RESOURCE' && q.rol !== 'TRANSPORT') continue;
      if (q.hisobTuri === 'manba_jami' && q.smetaSumma != null) next[q.sourceId] = String(q.smetaSumma);
      else if (q.smetaBirlikNarx != null) next[q.sourceId] = String(q.smetaBirlikNarx);
    }
    setManualNarxlar(next); setSozlama({ rejim: 'qolda' }); setRejim('qolda');
  }

  function koefniOzgartir(kod: NakrutkaKoefKod, value: string) {
    const n = parseInput(value);
    if (n == null) return;
    setKoef((old) => ({ qiymatlar: { ...old.qiymatlar, [kod]: n }, manba: 'tahrirlangan' }));
  }

  async function eksportQilish() {
    setError(''); setMessage('');
    if (!qatorlar.length) { setError('Avval kamida bitta RES varag‘ini tanlang.'); return; }
    if (!manbaBytes) { setError('Asl RES fayli topilmadi. Faylni qayta tanlang.'); return; }
    setBusy(true);
    try {
      const natija = await tenderOfertaXlsx({
        obyektNomi, manbaFaylNomi: fileName, manbaBytes, tanlanganVaraqlar, tahlillar, hisob,
        koeffitsientManbasi: koef.manba === 'kompaniya' ? 'kompaniya koeffitsientlari' : koef.manba === 'tahrirlangan' ? 'qo‘lda tahrirlangan' : 'T1 standarti',
      });
      downloadBlob(natija.bytes, natija.faylNomi);
      const saqlanish = natija.saqlanish === 'toliq'
        ? 'Asl faylning barcha qismlari bayt-bayt saqlandi.'
        : '.xls fayl .xlsx ga o‘girildi — ba’zi stil/format qisman o‘zgargan bo‘lishi mumkin.';
      setMessage(`${saqlanish} Yakuniy oferta ${natija.jamiVaraq}!${natija.yakuniyHujayra} katagida.${hisob.halQilinmagan ? ` ${hisob.halQilinmagan} ta resurs hal qilinmagan — yakuniy summa bo‘sh.` : ''}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Oferta fayli yaratilmadi.'); }
    finally { setBusy(false); }
  }

  const tahrirlanadi = (q: OfertaQatorNatija) => q.rol === 'RESOURCE' || (q.rol === 'TRANSPORT' && !q.hosila);

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
        <p className="mt-1">Asl RES faylining barcha varaqlari saqlanadi: tanlangan varaqlarga 5 ta ustun va OFERTA_JAMI varag‘i qo‘shiladi. Manba hajm va summasi o‘zgarmaydi; noma’lum narx yoki kategoriya — yakuniy summa bo‘sh (taxmin yo‘q).</p>
      </div>
    </div>

    {busy && <p role="status" className="text-[13px] text-text-dim">Ishlanmoqda…</p>}
    {error && <p role="alert" className="karta border-danger/40 bg-danger/5 p-3 text-[13px] text-danger">{error}</p>}
    {message && <p role="status" className="karta border-ok/40 bg-ok/5 p-3 text-[13px] text-success">{message}</p>}

    {workbook && <section className="karta space-y-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold text-text">Varaq roli — foydalanuvchi tasdig‘i</h2>
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
            <td className="py-2 text-text-dim">{sheet.confidence}</td>
            <td className="max-w-[460px] py-2 text-text-dim">{sheet.evidence.join(' · ')}{sheet.alternativVaraq && <span className="ml-1 font-semibold text-warn">(alternativ: {sheet.alternativVaraq})</span>}</td>
            <td className="py-2 text-right tabular-nums text-text-dim">{sheet.qatorlar.length}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>}

    {qatorlar.length > 0 && <>
      <section className="karta space-y-3 p-3" aria-label="Narx sozlamasi">
        <div className="flex flex-wrap items-end gap-2">
          <label className="block text-[12px] font-medium text-text">Narx berish usuli
            <select aria-label="Oferta narx usuli" value={rejim} onChange={(e) => { const r = e.target.value as OfertaNarxRejimi; setRejim(r); if (r === 'qolda') setSozlama({ rejim: 'qolda' }); }} className="input mt-1 block h-9 px-2 text-[12px]">
              <option value="foiz">Smeta narxidan foiz bilan</option>
              <option value="qolda">Har qator bo‘yicha qo‘lda</option>
            </select>
          </label>
          {rejim === 'foiz' && <>
            <label className="block text-[12px] font-medium text-text">Umumiy amal
              <select aria-label="Oferta foiz amali" value={yon} onChange={(e) => setYon(e.target.value as OfertaFoizYon)} className="input mt-1 block h-9 px-2 text-[12px]"><option value="pasaytirish">Pasaytirish</option><option value="oshirish">Oshirish</option></select>
            </label>
            <label className="block text-[12px] font-medium text-text">Umumiy foiz
              <input aria-label="Oferta foiz miqdori" inputMode="decimal" value={foiz} onChange={(e) => setFoiz(e.target.value)} className="input mt-1 h-9 w-20 px-2 text-[12px]" />
            </label>
          </>}
          {rejim === 'qolda' && <button type="button" className="tugma h-9" onClick={smetaNarxiniBoshlangichQil}>Smeta narxlarini boshlang‘ich qilish</button>}
          <label className="block text-[12px] font-medium text-text">Transport
            <select aria-label="Transport siyosati" value={transport} onChange={(e) => setTransport(e.target.value as OfertaTransportSiyosati)} className="input mt-1 block h-9 px-2 text-[12px]">
              <option value="kaskad">Kaskad foizi (ТРАНСПОРТ_МАТЕРИАЛ)</option>
              <option value="varaq">Transport varag‘i summasi</option>
            </select>
          </label>
        </div>
        {rejim === 'foiz' && <div className="flex flex-wrap items-end gap-2">
          <span className="text-[11px] text-text-mute">Kategoriya foizi (bo‘sh — umumiy foiz; qatordagi qo‘lda narx ustun):</span>
          {OFERTA_KATEGORIYALAR.map((kat) => {
            const v = katFoizMatn[kat] ?? { yon, foiz: '' };
            return <label key={kat} className="flex items-center gap-1 text-[11px] text-text">
              <span className="w-16 font-semibold">{kat}</span>
              <select aria-label={`${kat} foiz amali`} value={v.yon} onChange={(e) => setKatFoizMatn((o) => ({ ...o, [kat]: { ...v, yon: e.target.value as OfertaFoizYon } }))} className="input h-8 px-1 text-[11px]"><option value="pasaytirish">−</option><option value="oshirish">+</option></select>
              <input aria-label={`${kat} foizi`} inputMode="decimal" value={v.foiz} onChange={(e) => setKatFoizMatn((o) => ({ ...o, [kat]: { ...v, foiz: e.target.value } }))} placeholder="%" className="input h-8 w-14 px-1 text-[11px]" />
            </label>;
          })}
          <button type="button" className="tugma tugma-asosiy h-9" onClick={foizniQollash}><RefreshCw size={14} /> Foizlarni qo‘llash</button>
        </div>}
        <details className="rounded-lg border border-border/70 p-2 text-[11px]">
          <summary className="cursor-pointer font-medium text-text">Nakrutka koeffitsientlari — {koef.manba === 'kompaniya' ? 'kompaniyaniki' : koef.manba === 'tahrirlangan' ? 'qo‘lda tahrirlangan' : 'T1 standarti'}</summary>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
            {NAKRUTKA_KOEF_KODLAR.map((kod) => <label key={kod} className="flex items-center justify-between gap-2 text-text-dim" title={NAKRUTKA_KOEF_IZOH[kod]}>
              <span className="truncate">{NAKRUTKA_KOEF_IZOH[kod]}</span>
              <input aria-label={`${kod} koeffitsienti`} inputMode="decimal" defaultValue={String(koef.qiymatlar[kod] ?? '')} key={`${kod}-${koef.manba}-${koef.qiymatlar[kod]}`}
                onBlur={(e) => koefniOzgartir(kod, e.target.value)} className="input h-7 w-20 px-1 text-right" />
            </label>)}
          </div>
        </details>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="tugma tugma-asosiy h-9" onClick={() => void eksportQilish()} disabled={busy}><Download size={14} /> Asl RES faylini oferta qilish</button>
          {taklifKutmoqda.length > 0 && <button type="button" className="tugma h-9" onClick={takliflarniQabulQilish}><CheckCheck size={14} /> {taklifKutmoqda.length} ta kategoriya taklifini qabul qilish ({[...new Set(taklifKutmoqda.map((q) => q.kategoriyaTaklifi))].join(', ')})</button>}
        </div>
      </section>

      <section className="karta grid gap-3 p-3 lg:grid-cols-[1fr_1.4fr]" aria-label="Oferta jamilari">
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-2"><span className="text-[10px] text-text-mute">SOURCE TOTAL (manba resurslar)</span><strong className="mt-1 block text-base text-text">{fmt(hisob.manbaTogridanJami)}</strong></div>
            <div className="rounded-lg border border-border p-2"><span className="text-[10px] text-text-mute">DIRECT (pudratchi resurslar)</span><strong className="mt-1 block text-base text-text">{fmt(hisob.togridanJami)}</strong></div>
            <div className="rounded-lg border border-border p-2"><span className="text-[10px] text-text-mute">QQS</span><strong className="mt-1 block text-base text-text">{fmt(hisob.kaskad.nds)}</strong></div>
            <div className={`rounded-lg border p-2 ${hisob.yakuniyOferta != null ? 'border-ok/40 bg-ok/5' : 'border-warn/40 bg-warn/5'}`}>
              <span className="text-[10px] text-text-mute">FINAL OFFER</span>
              <strong className="mt-1 block text-base text-ok">{hisob.yakuniyOferta != null ? fmt(hisob.yakuniyOferta) : `hal qilinmagan: ${hisob.halQilinmagan} ta`}</strong>
            </div>
          </div>
          <table className="w-full text-[11px]">
            <thead><tr className="text-left text-text-mute"><th>Kategoriya</th><th className="text-right">Manba</th><th className="text-right">Taklif</th></tr></thead>
            <tbody>{[...OFERTA_KATEGORIYALAR, 'UNKNOWN' as const].map((kat) => <tr key={kat} className={`border-t border-border/40 ${kat === 'UNKNOWN' && hisob.kategoriyaJami.UNKNOWN ? 'text-danger' : ''}`}>
              <td className="py-0.5">{kat === 'UNKNOWN' ? 'Noma’lum (kaskadga kirmaydi)' : kat}</td>
              <td className="text-right tabular-nums">{fmt(hisob.manbaKategoriyaJami[kat])}</td>
              <td className="text-right tabular-nums">{fmt(hisob.kategoriyaJami[kat])}</td>
            </tr>)}</tbody>
          </table>
          {hisob.transportVaraqJami > 0 && <p className="text-[11px] text-text-dim">Transport varag‘i (pudratchi): {fmt(hisob.transportVaraqJami)} — {transport === 'varaq' ? 'material transporti o‘rnida ishlatiladi' : 'faqat dalil (kaskad foizi ishlatiladi)'}.</p>}
        </div>
        <table className="w-full text-[11px]">
          <thead><tr className="text-left text-text-mute"><th>Kaskad qadami</th><th className="text-right">Manba asosida</th><th className="text-right">Taklif</th></tr></thead>
          <tbody>{KASKAD_QADAMLARI.map(([k, nom]) => <tr key={k} className={`border-t border-border/40 ${k.startsWith('itogo') || k === 'vsego' ? 'font-semibold text-text' : 'text-text-dim'}`}>
            <td className="py-0.5">{nom}</td>
            <td className="text-right tabular-nums">{fmt(hisob.manbaKaskad[k])}</td>
            <td className="text-right tabular-nums">{fmt(hisob.kaskad[k])}</td>
          </tr>)}</tbody>
        </table>
      </section>

      <section className="karta p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[13px] font-semibold text-text"><FileSpreadsheet className="mr-1 inline" size={15} />Oferta satrlari <span className="font-normal text-text-mute">({korinadigan.length} / {hisob.qatorlar.length}; muammo: {hisob.muammolarSoni})</span></h2>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-[12px] text-text"><input type="checkbox" checked={faqatMuammo} onChange={(e) => setFaqatMuammo(e.target.checked)} /> Faqat muammolar</label>
            <input aria-label="Oferta qatorlarini qidirish" value={qidiruv} onChange={(e) => setQidiruv(e.target.value)} placeholder="Kod, resurs yoki varaq…" className="input h-8 w-56 px-2 text-[12px]" />
          </div>
        </div>
        <div className="max-h-[58vh] overflow-auto rounded border border-border/60">
          <table className="w-full min-w-[1400px] text-[11px]">
            <thead className="sticky top-0 z-10 bg-surface-2 text-left text-text-mute"><tr>
              <th className="px-2 py-2">№</th><th className="px-2">Shifr</th><th className="px-2">Rol</th><th className="px-2">Kategoriya</th><th className="px-2">Nomi</th><th className="px-2">Birlik</th>
              <th className="px-2 text-right">Manba hajm</th><th className="px-2 text-right">Taklif hajmi</th><th className="px-2 text-right">Smeta narx</th><th className="px-2 text-right">Smeta summa</th>
              <th className="px-2 text-right">Pudratchi narx/summa</th><th className="px-2 text-right">Taklif summa</th><th className="px-2">Holat</th>
            </tr></thead>
            <tbody>{korinadigan.map((q) => <tr key={q.sourceId} className={`border-t border-border/50 align-top ${q.rol === 'SUBTOTAL' || q.rol === 'GRAND_TOTAL' ? 'font-semibold' : ''}`}>
              <td className="px-2 py-1.5 text-text-dim">{q.tartibRaqami ?? '—'}</td>
              <td className="px-2 py-1.5 text-text-dim">{q.shifr ?? '—'}</td>
              <td className="px-2 py-1.5 text-text-dim">{ROL_MATNI[q.rol] ?? q.rol}{q.hosila ? ' (hosila)' : ''}</td>
              <td className="px-2 py-1">{q.rol === 'RESOURCE'
                ? <select aria-label={`${q.nom} kategoriyasi`} value={manualKategoriyalar[q.sourceId] ?? ''} onChange={(e) => kategoriyaniOzgartir(q.sourceId, e.target.value)}
                    className={`rounded border px-1 py-0.5 ${q.samaraliKategoriya === 'UNKNOWN' ? 'border-danger/60 text-danger' : 'border-border'}`}>
                    <option value="">{q.kategoriya && q.kategoriya !== 'UNKNOWN' ? `${q.kategoriya} (fayldan)` : q.kategoriyaTaklifi ? `? taklif: ${q.kategoriyaTaklifi}` : 'Noma’lum'}</option>
                    {OFERTA_KATEGORIYALAR.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                : <span className="text-text-mute">—</span>}</td>
              <td className="max-w-[320px] px-2 py-1.5 font-medium text-text" title={`${q.sourceSheet} / ${q.sourceRow}-qator`}>{q.nom}</td>
              <td className="px-2 py-1.5 text-text-dim">{q.birlik ?? '—'}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-text-dim">{fmt(q.hajm)}</td>
              <td className="px-2 py-1">{tahrirlanadi(q) && q.hisobTuri === 'birlik'
                ? <input aria-label={`${q.nom} taklif hajmi`} inputMode="decimal" value={manualHajmlar[q.sourceId] ?? ''} onChange={(e) => hajmniOzgartir(q.sourceId, e.target.value)}
                    placeholder={fmt(q.hajm)} className={`w-24 rounded border px-1.5 py-1 text-right tabular-nums ${q.hajm == null && !manualHajmlar[q.sourceId] ? 'border-warn/60' : 'border-border'}`} />
                : <span className="block text-right text-text-mute">—</span>}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-text-dim">{fmt(q.smetaBirlikNarx)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-text-dim">{fmt(q.smetaSumma)}</td>
              <td className="bg-surface-2 px-2 py-1">{tahrirlanadi(q)
                ? <input aria-label={`${q.nom} pudratchi ${q.hisobTuri === 'manba_jami' ? 'summasi' : 'narxi'}`} inputMode="decimal" value={manualNarxlar[q.sourceId] ?? ''} onChange={(e) => narxniOzgartir(q.sourceId, e.target.value)}
                    placeholder={q.hisobTuri === 'manba_jami' ? 'Taklif summasi' : fmt(q.pudratchiBirlikNarx)} className="w-32 rounded border border-border bg-surface-2 px-1.5 py-1 text-right tabular-nums" />
                : '—'}</td>
              <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-ok">{fmt(q.pudratchiSumma)}</td>
              <td className={`px-2 py-1.5 ${q.muammolar.length ? 'font-semibold text-danger' : 'text-ok'}`}>{ofertaHolatMatni(q)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        {!korinadigan.length && <p className="py-6 text-center text-[12px] text-text-mute">{faqatMuammo ? 'Muammoli qator yo‘q.' : 'Qidiruv bo‘yicha qator topilmadi.'}</p>}
      </section>
    </>}
  </div>;
}

export default function OfertaNative() {
  return <Sahifa sarlavha="Tender oferta" tavsif="RES faylidan pudratchi taklifini hisoblash: kategoriya foizlari, nakrutka kaskadi, asl faylni saqlagan holda XLSX">
    <Sessiya />
  </Sahifa>;
}
