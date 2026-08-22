/**
 * TestF2Import.tsx — TIZIM_02: TASHQI F2/AKT FAYLINI IMPORT QILISH
 * ═══════════════════════════════════════════════════════════════════
 *
 * Hujjatni qo'lda yig'ish `/admin/test/f2` da. Bu sahifa boshqa ish
 * uchun: pudratchi Excel'da F2 yuboradi va uni smetaga bog'lash kerak.
 *
 * ── UCH QADAM, ATAYLAB AJRATILGAN ──
 *
 *   1. Fayl va varaq tanlash
 *   2. KO'RISH — nechta qator moslandi, nechtasi yo'q (hech nima
 *      yozilmaydi)
 *   3. Import — faqat 2-qadamni ko'rgandan keyin
 *
 * ⚠️ 2-qadam majburiy. Moslashtirish noaniq bo'lishi mumkin va odam
 * yozishdan OLDIN nima bo'lishini ko'rishi kerak. Fast food obyektida
 * bir resurs o'rtacha 3 marta uchraydi (1 262 qator, 404 unikal
 * nom+birlik) — ota blok yordam bermasa bitta nom uchun 106 tagacha
 * nomzod chiqadi.
 *
 * ⚠️ IKKILAMCHI VA TOPILMAGAN QATORLAR HUJJATGA KIRMAYDI, lekin
 * YASHIRILMAYDI ham. Reestr kafolati ekranda ko'rsatiladi:
 *     kirgan = hujjatga kirdi + ikkilamchi + topilmadi
 * Bu tenglik buzilsa qator yo'qolgan degani.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  FileInput, Upload, FolderOpen, RefreshCw, CheckCircle, AlertTriangle,
  XCircle, HelpCircle, ArrowRight, ExternalLink,
} from 'lucide-react';
import { Sahifa } from '../umumiy/ui/Sahifa';
import { FmtN } from '../lib/format';
import { toast } from '../umumiy/ui/Toast';
import { gas } from '../api/client';
import { sbT2ObyektlarOlKomp, yangiOperationId, type T2Obyekt } from '../api/supabase';
import { useKompaniya } from './KompaniyaTanlov';

type ManbaFayl = { fayl_id: string; nom: string; sana: string; oqiladi: boolean };

type MosQator = {
  n: number; holat: 'moslandi' | 'ikkilamchi' | 'topilmadi';
  nom: string; birlik: string; hajm: number; narx: number | null;
  qator_id: number | null; nomzod_soni: number;
};

type Moslash = {
  ok: boolean; kirgan: number; moslandi: number; ikkilamchi: number;
  topilmadi: number; kafolat: boolean; qatorlar: MosQator[];
};

type Ustunlar = Record<string, number>;

type KorishNatija = {
  ok: boolean; xabar?: string; fayl_qator?: number; moslash?: Moslash;
  cols?: Ustunlar; avto?: boolean; usul?: string; hdrQator?: number;
  sozlash?: boolean; ms?: number;
};

/** Ustun nomlari — ekranda shu tartibda ko'rsatiladi. */
const USTUN_NOM: Array<[string, string]> = [
  ['kod', 'КОД'], ['nom', 'НОМ'], ['bir', 'БИРЛИК'], ['norma', 'НОРМА'],
  ['obyom', 'ҲАЖМ'], ['narx', 'НАРХ'], ['sum', 'СУММА'],
];

/** 0-based indeksni Excel harfiga (0→A, 25→Z, 26→AA). */
const HARF = (i: number): string => {
  let s = '', n = i;
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
};

type ImportNatija = {
  ok: boolean; xabar?: string;
  natija?: {
    ok: boolean; izoh?: string;
    akt?: { ok: boolean; akt_id?: number; jami?: number | null;
            qator_soni?: number; narxsiz?: number; xabar?: string };
    kafolat?: { kirgan: number; hujjatga_kirdi: number;
                ikkilamchi: number; topilmadi: number; togri: boolean };
  };
};

const HOLAT: Record<string, { rang: string; Ikonka: typeof CheckCircle; nom: string }> = {
  moslandi:   { rang: 'text-ok',     Ikonka: CheckCircle,  nom: 'moslandi' },
  ikkilamchi: { rang: 'text-warn',   Ikonka: HelpCircle,   nom: 'ikkilamchi' },
  topilmadi:  { rang: 'text-danger', Ikonka: XCircle,      nom: 'topilmadi' },
};

export default function TestF2Import() {
  const { joriy } = useKompaniya();
  const [obyektlar, setObyektlar] = useState<T2Obyekt[]>([]);
  const [obyekt, setObyekt] = useState('');

  const [manba, setManba] = useState<ManbaFayl[]>([]);
  const [faylId, setFaylId] = useState('');
  const [varaqlar, setVaraqlar] = useState<string[]>([]);
  const [varaq, setVaraq] = useState('');
  const [yuklanmoqda, setYuklanmoqda] = useState(false);

  const [tur, setTur] = useState<'f2' | 'fakt'>('f2');
  const [oy, setOy] = useState(() => new Date().toISOString().slice(0, 7));
  const [raqam, setRaqam] = useState('');

  const [korish, setKorish] = useState<KorishNatija | null>(null);
  const [korilmoqda, setKorilmoqda] = useState(false);
  const [natija, setNatija] = useState<ImportNatija | null>(null);
  const [importda, setImportda] = useState(false);
  /* ⚠️ Oqim boshlanganda BIR MARTA. Qayta urinishda o'zgarmasin —
     aks holda ikkinchi hujjat yaraladi. */
  const [opId, setOpId] = useState('');
  const [ustunOchiq, setUstunOchiq] = useState(false);
  /* Qo'lda tuzatilgan ustunlar — bo'sh bo'lsa avtoaniqlangani ishlatiladi */
  const [qolUstun, setQolUstun] = useState<Ustunlar>({});

  useEffect(() => {
    sbT2ObyektlarOlKomp(joriy?.id).then((r) => {
      if (!r.ok) return;
      const o = (r.qatorlar as T2Obyekt[]) || [];
      setObyektlar(o);
      setObyekt((p) => p || (o[0]?.nom ?? ''));
    });
  }, [joriy?.id]);

  const manbaYukla = useCallback(() => {
    gas<any>('apiT2ManbaFayllar')
      .then((r) => { if (r.ok) setManba(r.fayllar || []); })
      .catch(() => {});
  }, []);
  useEffect(() => { manbaYukla(); }, [manbaYukla]);

  /* Fayl tanlanganda varaqlari tortiladi */
  const faylTanla = async (id: string) => {
    setFaylId(id); setVaraq(''); setVaraqlar([]);
    setKorish(null); setNatija(null);
    if (!id) return;
    try {
      const r = await gas<any>('apiT2F2Varaqlar', id);
      if (!r.ok) { toast(r.xabar || 'Varaqlar o\'qilmadi', 'danger', undefined, 9000); return; }
      setVaraqlar(r.varaqlar || []);
      if ((r.varaqlar || []).length === 1) setVaraq(r.varaqlar[0]);
    } catch (e: any) { toast(e?.message || 'Xato', 'danger'); }
  };

  const fayllarYukla = async (list: FileList | null) => {
    if (!list?.length) return;
    setYuklanmoqda(true);
    try {
      const f = list[0];
      const b64: string = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result).split(',')[1] || '');
        fr.onerror = () => rej(new Error('Faylni o\'qib bo\'lmadi'));
        fr.readAsDataURL(f);
      });
      const r = await gas<any>('apiT2FaylYukla', f.name, b64, f.type);
      if (!r.ok) { toast(r.xabar || 'Yuklanmadi', 'danger', undefined, 12000); return; }
      toast('Fayl yuklandi', 'ok');
      manbaYukla();
      await faylTanla(r.fayl_id);
    } catch (e: any) {
      toast(e?.message || 'Xato', 'danger', undefined, 9000);
    } finally { setYuklanmoqda(false); }
  };

  const kor = async (qoldan?: boolean) => {
    if (!obyekt || !faylId) { toast('Obyekt va fayl tanlang', 'warn'); return; }
    setKorilmoqda(true); setNatija(null);
    try {
      /* Qo'lda tuzatilgan bo'lsa o'shani yuboramiz, aks holda
         server o'zi aniqlaydi. */
      const cfg = qoldan && Object.keys(qolUstun).length
        ? { ...(korish?.cols || {}), ...qolUstun } : null;
      const r = await gas<KorishNatija>('apiT2F2Korish', obyekt, faylId, varaq, cfg);
      setKorish(r);
      setOpId(yangiOperationId());      // ⚠️ faqat shu yerda
      if (!r.ok) toast(r.xabar || 'O\'qilmadi', 'danger', undefined, 12000);
    } catch (e: any) {
      setKorish({ ok: false, xabar: e?.message || String(e) });
    } finally { setKorilmoqda(false); }
  };

  const importQil = async () => {
    if (!korish?.moslash?.moslandi) { toast('Moslangan qator yo\'q', 'warn'); return; }
    setImportda(true);
    try {
      const r = await gas<ImportNatija>('apiT2F2Import', obyekt, faylId, varaq,
        oy + '-01', tur, raqam.trim() || null, opId,
        /* ⚠️ Ko'rishda ishlatilgan AYNI ustunlar. Aks holda ekranda
           bir narsa ko'rinib, hujjatga boshqasi tushishi mumkin. */
        korish?.cols || null);
      setNatija(r);
      const a = r.natija?.akt;
      toast(r.ok ? 'Hujjat yaratildi (qoralama)'
                 : (a?.xabar || r.xabar || 'Import qilinmadi'),
            r.ok ? 'ok' : 'danger', undefined, 12000);
    } catch (e: any) {
      setNatija({ ok: false, xabar: e?.message || String(e) });
    } finally { setImportda(false); }
  };

  const m = korish?.moslash;

  return (
    <Sahifa
      sarlavha="F2 / Fakt faylini import qilish (Tizim_02)"
      tavsif="Tashqi Excel hujjatini smeta qatorlariga bog'laydi"
    >
      <div className="space-y-3 max-w-5xl">

        {/* ── 1. Obyekt va fayl ── */}
        <div className="karta p-3 space-y-2">
          <p className="text-[12px] font-medium text-text">1-qadam · Obyekt va fayl</p>

          <select value={obyekt} onChange={(e) => { setObyekt(e.target.value); setKorish(null); }}
            className="w-full bg-[var(--surface-2)] border border-border rounded-lg
                       px-3 py-2 text-[13px] text-text outline-none focus:border-accent/50">
            <option value="">— obyekt tanlang —</option>
            {obyektlar.map((o) => <option key={o.id} value={o.nom}>{o.nom}</option>)}
          </select>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col items-center justify-center gap-1 py-3
                              border-2 border-dashed border-border rounded-lg cursor-pointer
                              hover:border-accent/50 transition-colors">
              <Upload size={16} className="text-accent" />
              <span className="text-[11px] text-text">
                {yuklanmoqda ? 'Yuklanmoqda…' : 'Kompyuterdan yuklash'}
              </span>
              <input type="file" className="hidden" disabled={yuklanmoqda}
                accept=".xlsx,.xls,.xlsm"
                onChange={(e) => { fayllarYukla(e.target.files); e.currentTarget.value = ''; }} />
            </label>

            <div>
              <label className="text-[11px] text-text-dim block mb-1 flex items-center gap-1">
                <FolderOpen size={11} /> yoki yuklanganlardan ({manba.length})
              </label>
              <select value={faylId} onChange={(e) => faylTanla(e.target.value)}
                className="w-full bg-[var(--surface-2)] border border-border rounded-lg
                           px-2.5 py-1.5 text-[12px] text-text outline-none">
                <option value="">— tanlanmagan —</option>
                {manba.filter((f) => f.oqiladi).map((f) => (
                  <option key={f.fayl_id} value={f.fayl_id}>{f.nom} · {f.sana}</option>
                ))}
              </select>
            </div>
          </div>

          {varaqlar.length > 1 && (
            <div>
              <label className="text-[11px] text-text-dim block mb-1">Varaq</label>
              <select value={varaq} onChange={(e) => { setVaraq(e.target.value); setKorish(null); }}
                className="w-full bg-[var(--surface-2)] border border-border rounded-lg
                           px-2.5 py-1.5 text-[12px] text-text outline-none">
                <option value="">— birinchisi —</option>
                {varaqlar.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          )}

          <button onClick={() => kor()} disabled={korilmoqda || !obyekt || !faylId}
            className="px-4 py-2 rounded-lg bg-accent text-white text-[13px] font-medium
                       hover:bg-accent/90 disabled:opacity-40 inline-flex items-center gap-2">
            {korilmoqda ? <RefreshCw size={15} className="animate-spin" /> : <FileInput size={15} />}
            {korilmoqda ? 'O\'qilmoqda…' : 'Ko\'rish (hech nima yozilmaydi)'}
          </button>
        </div>

        {/* ── Xato / ustun sozlash ── */}
        {korish && !korish.ok && (
          <div className="karta p-4 border-danger/40 bg-danger/5">
            <p className="text-[13px] text-danger flex items-start gap-2">
              <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
              {korish.xabar}
            </p>
          </div>
        )}
        {/* ── Aniqlangan ustunlar — ko'rinib tursin va tuzatsa bo'lsin ──
          * Avval bu yerda «ustunlar aniqlanmadi» degan NOTO'G'RI xabar
          * chiqardi: `apiF2FaylOqi` colConfig berilmasa ustunlarni
          * topgan bo'lsa ham `mode:'config'` qaytaradi (Tizim_01 da
          * odam tasdiqlashi uchun). Endi aniqlangani avtomatik
          * qabul qilinadi va shu yerda ko'rsatiladi. */}
        {korish?.ok && korish.cols && (
          <div className="karta p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <p className="text-[12px] font-medium text-text">
                Aniqlangan ustunlar
                {korish.hdrQator ? ` · sarlavha ${korish.hdrQator}-qatorda` : ''}
              </p>
              <button onClick={() => setUstunOchiq((v) => !v)}
                className="text-[11px] text-accent hover:underline">
                {ustunOchiq ? 'yopish' : 'noto\'g\'ri bo\'lsa tuzatish'}
              </button>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text-dim">
              {USTUN_NOM.map(([k, nm]) => (
                <span key={k}>
                  {nm}: <b className={korish.cols![k] >= 0 ? 'text-text' : 'text-text-mute'}>
                    {korish.cols![k] >= 0 ? HARF(korish.cols![k]) : '—'}
                  </b>
                </span>
              ))}
            </div>

            {ustunOchiq && (
              <div className="mt-2 pt-2 border-t border-border">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {USTUN_NOM.map(([k, nm]) => (
                    <div key={k}>
                      <label className="text-[10px] text-text-mute block mb-0.5">{nm}</label>
                      <select value={String(qolUstun[k] ?? korish.cols![k] ?? -1)}
                        onChange={(e) => setQolUstun((p) =>
                          ({ ...p, [k]: Number(e.target.value) }))}
                        className="w-full bg-[var(--surface-2)] border border-border rounded
                                   px-1.5 py-1 text-[11px] text-text outline-none">
                        <option value="-1">— yo'q —</option>
                        {Array.from({ length: 15 }, (_, i) => (
                          <option key={i} value={i}>{HARF(i)}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <button onClick={() => kor(true)}
                  className="mt-2 px-3 py-1.5 rounded-lg border border-border text-[12px]
                             text-text hover:bg-white/5">
                  Shu ustunlar bilan qayta o'qish
                </button>
              </div>
            )}
          </div>
        )}

        {korish && !korish.ok && (korish as any).sozlash && (
          <div className="karta p-3 border-warn/40 bg-warn/5">
            <p className="text-[12px] text-warn">
              Sarlavha topilmadi — ustunlarni qo'lda ko'rsating.
            </p>
          </div>
        )}

        {/* ── 2. Moslashtirish natijasi ── */}
        {m && (
          <div className="karta p-3">
            <p className="text-[12px] font-medium text-text mb-2">
              2-qadam · Moslashtirish — {korish?.fayl_qator} qator o'qildi
            </p>

            <div className="grid grid-cols-3 gap-2 mb-2">
              {([['moslandi', m.moslandi], ['ikkilamchi', m.ikkilamchi],
                 ['topilmadi', m.topilmadi]] as const).map(([k, v]) => {
                const h = HOLAT[k];
                return (
                  <div key={k} className="rounded-lg bg-[var(--surface-2)]/50 px-2.5 py-2">
                    <div className={'text-[10px] flex items-center gap-1 ' + h.rang}>
                      <h.Ikonka size={11} /> {h.nom}
                    </div>
                    <div className={'text-[16px] tabular-nums ' + h.rang}>{v}</div>
                  </div>
                );
              })}
            </div>

            {/* ⚠️ Reestr kafolati — buzilsa qator yo'qolgan */}
            <p className={'text-[11px] mb-2 ' + (m.kafolat ? 'text-text-mute' : 'text-danger')}>
              {m.kafolat
                ? `Reestr: ${m.kirgan} kirdi = ${m.moslandi} + ${m.ikkilamchi} + ${m.topilmadi}`
                : '⚠️ REESTR BUZILGAN — qator yo\'qolgan, import qilmang!'}
            </p>

            {(m.ikkilamchi > 0 || m.topilmadi > 0) && (
              <p className="text-[11px] text-warn mb-2">
                Ikkilamchi va topilmagan qatorlar hujjatga <b>KIRMAYDI</b>.
                Ikkilamchi — bir nechta nomzod bor, tizim taxmin qilmaydi.
              </p>
            )}

            <div className="max-h-72 overflow-auto">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-[var(--surface-1)]">
                  <tr className="border-b border-border text-text-dim">
                    <th className="text-left py-1.5 font-medium w-20">Holat</th>
                    <th className="text-left py-1.5 font-medium">Resurs</th>
                    <th className="text-left py-1.5 font-medium w-16">Бирлик</th>
                    <th className="text-right py-1.5 font-medium w-24">Ҳажм</th>
                    <th className="text-right py-1.5 font-medium w-16">Nomzod</th>
                  </tr>
                </thead>
                <tbody>
                  {m.qatorlar.slice(0, 400).map((q) => {
                    const h = HOLAT[q.holat];
                    return (
                      <tr key={q.n} className="border-b border-border last:border-0">
                        <td className={'py-1 ' + h.rang}>
                          <span className="inline-flex items-center gap-1">
                            <h.Ikonka size={11} /> {h.nom}
                          </span>
                        </td>
                        <td className="py-1 text-text truncate max-w-[300px]" title={q.nom}>
                          {q.nom}
                        </td>
                        <td className="py-1 text-text-mute">{q.birlik}</td>
                        <td className="py-1 text-right tabular-nums text-text-dim">{q.hajm}</td>
                        <td className={'py-1 text-right tabular-nums ' +
                          (q.nomzod_soni > 1 ? 'text-warn' : 'text-text-mute')}>
                          {q.nomzod_soni}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {m.qatorlar.length > 400 && (
                <p className="text-[10px] text-text-mute pt-1">
                  … va yana {m.qatorlar.length - 400} ta
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── 3. Import ── */}
        {m && m.moslandi > 0 && (
          <div className="karta p-3">
            <p className="text-[12px] font-medium text-text mb-2">3-qadam · Hujjat yaratish</p>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="text-[11px] text-text-dim block mb-1">Turi</label>
                <select value={tur} onChange={(e) => setTur(e.target.value as any)}
                  className="bg-[var(--surface-2)] border border-border rounded-lg
                             px-2.5 py-1.5 text-[12px] text-text outline-none">
                  <option value="f2">Ф2 — topshiriladigan</option>
                  <option value="fakt">ФАКТ — bajarilgan ish</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-text-dim block mb-1">Oy</label>
                <input type="month" value={oy} onChange={(e) => setOy(e.target.value)}
                  className="bg-[var(--surface-2)] border border-border rounded-lg
                             px-2.5 py-1.5 text-[12px] text-text outline-none" />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="text-[11px] text-text-dim block mb-1">Hujjat №</label>
                <input value={raqam} onChange={(e) => setRaqam(e.target.value)}
                  placeholder="ixtiyoriy"
                  className="w-full bg-[var(--surface-2)] border border-border rounded-lg
                             px-2.5 py-1.5 text-[12px] text-text outline-none" />
              </div>
              <button onClick={importQil} disabled={importda || !m.kafolat}
                className="px-4 py-2 rounded-lg bg-accent text-white text-[13px] font-medium
                           hover:bg-accent/90 disabled:opacity-40 inline-flex items-center gap-2">
                {importda ? <RefreshCw size={15} className="animate-spin" />
                          : <ArrowRight size={15} />}
                {importda ? 'Import qilinmoqda…' : `${m.moslandi} qatorni import qilish`}
              </button>
            </div>
          </div>
        )}

        {/* ── Natija ── */}
        {natija && (
          <div className={'karta p-4 ' + (natija.ok
            ? 'border-ok/40 bg-ok/5' : 'border-danger/40 bg-danger/5')}>
            <p className={'text-[13px] font-medium flex items-center gap-2 mb-2 ' +
              (natija.ok ? 'text-ok' : 'text-danger')}>
              {natija.ok ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
              {natija.ok ? 'Hujjat yaratildi (qoralama)'
                         : (natija.natija?.akt?.xabar || natija.xabar || 'Import qilinmadi')}
            </p>

            {natija.natija?.akt?.ok && (
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-text-dim">
                <span>Hujjat: <b className="text-text">#{natija.natija.akt.akt_id}</b></span>
                <span>Qator: <b className="text-text">{natija.natija.akt.qator_soni}</b></span>
                <span>Jami: <b className="text-text">
                  {natija.natija.akt.jami == null
                    ? 'to\'liq emas'
                    : <FmtN val={Number(natija.natija.akt.jami)} />}
                </b></span>
                {!!natija.natija.akt.narxsiz && (
                  <span className="text-warn">Narxsiz: {natija.natija.akt.narxsiz}</span>
                )}
              </div>
            )}

            {natija.natija?.kafolat && (
              <p className={'text-[11px] mt-2 ' +
                (natija.natija.kafolat.togri ? 'text-text-mute' : 'text-danger')}>
                Reestr: {natija.natija.kafolat.kirgan} kirdi ={' '}
                {natija.natija.kafolat.hujjatga_kirdi} hujjatga +{' '}
                {natija.natija.kafolat.ikkilamchi} ikkilamchi +{' '}
                {natija.natija.kafolat.topilmadi} topilmadi
                {natija.natija.kafolat.togri ? '' : '  ⚠️ TENGLIK BUZILGAN'}
              </p>
            )}
            {natija.natija?.izoh && (
              <p className="text-[11px] text-text-mute mt-1">{natija.natija.izoh}</p>
            )}

            {natija.ok && (
              <a href="/admin/test/f2"
                 className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                            bg-accent/15 text-accent text-[12px] font-medium hover:bg-accent/25">
                Hujjatlar ro'yxatiga o'tish <ExternalLink size={12} />
              </a>
            )}
          </div>
        )}
      </div>
    </Sahifa>
  );
}
