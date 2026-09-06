import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileText, RefreshCw, ShieldAlert } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Sahifa } from '../../umumiy/ui/Sahifa';
import { toast } from '../../umumiy/ui/Toast';
import { FmtN } from '../../lib/format';
import { useKompaniya } from '../../test02/KompaniyaTanlov';
import {
  sbT2AktReestrOl, sbT2AktTasdiqlash, sbT2ObyektlarOlKomp,
  yangiOperationId, type T2AktReestr, type T2Obyekt,
} from '../../api/supabase';
import { sbT2F2TafsilotOl, type F2Tafsilot } from '../../api/t2-narx';

type F2Detail = F2Tafsilot;

const holatMatni: Record<string, string> = {
  qoralama: 'Qoralama',
  tasdiqlangan: 'Tasdiqlangan',
  bekor: 'Bekor qilingan',
};

const reestrMatni: Record<string, string> = {
  mos: 'Mos',
  farq: 'Farq bor',
  jami_nomalum: 'Hujjat jami noma’lum',
};

function xavfsizXato() {
  return 'F2 reestri yoki tafsiloti o‘qilmadi. Birozdan so‘ng qayta urinib ko‘ring.';
}

/**
 * F2 ning kundalik ko‘rib chiqish va tasdiqlash oynasi.
 *
 * Qoralama alohida ko‘rinadi, lekin LRV/Nakopitelniyga faqat tasdiqlangan
 * hujjat ta’sir qiladi. Qator summasi `gorunish_*` orqali read-modeldan
 * olinadi; bu komponentda qty*price hisoblanmaydi.
 */
export function F2TarixNative() {
  const { joriy } = useKompaniya();
  const [params, setParams] = useSearchParams();
  const [obyektlar, setObyektlar] = useState<T2Obyekt[]>([]);
  const [reestr, setReestr] = useState<T2AktReestr[]>([]);
  const [tafsilot, setTafsilot] = useState<F2Detail[]>([]);
  const [selectedAktId, setSelectedAktId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const obyektId = Number(params.get('obyekt'));
  const validId = Number.isSafeInteger(obyektId) && obyektId > 0;
  const f2Reestr = useMemo(() => reestr.filter((a) => a.tur === 'f2'), [reestr]);
  const selectedAkt = f2Reestr.find((a) => a.id === selectedAktId) ?? f2Reestr[0] ?? null;
  const selectedLines = useMemo(
    () => selectedAkt ? tafsilot.filter((line) => line.akt_id === selectedAkt.id) : [],
    [selectedAkt, tafsilot],
  );

  useEffect(() => {
    if (!joriy?.id) { setObyektlar([]); return; }
    void sbT2ObyektlarOlKomp(joriy.id).then((r) => {
      setObyektlar((r.ok ? r.qatorlar : []) as T2Obyekt[]);
    });
  }, [joriy?.id]);

  const yuklash = useCallback(async () => {
    if (!validId) { setReestr([]); setTafsilot([]); setSelectedAktId(null); return; }
    setLoading(true); setError('');
    try {
      const [r, d] = await Promise.all([
        sbT2AktReestrOl(obyektId),
        sbT2F2TafsilotOl({ obyektId, tur: 'f2' }),
      ]);
      if (!r.ok) throw new Error(xavfsizXato());
      setReestr((r.qatorlar || []) as T2AktReestr[]);
      if (!d.ok) throw new Error(xavfsizXato());
      setTafsilot((d.qatorlar || []) as F2Detail[]);
      setSelectedAktId((old) => {
        const available = ((r.qatorlar || []) as T2AktReestr[]).filter((a) => a.tur === 'f2');
        return old && available.some((a) => a.id === old) ? old : (available[0]?.id ?? null);
      });
    } catch (e) {
      setReestr([]); setTafsilot([]); setSelectedAktId(null);
      setError(e instanceof Error && e.message === xavfsizXato() ? e.message : xavfsizXato());
    } finally { setLoading(false); }
  }, [obyektId, validId]);

  useEffect(() => { void yuklash(); }, [yuklash]);

  async function tasdiqlash(akt: T2AktReestr) {
    if (akt.holat !== 'qoralama' || savingId != null) return;
    setSavingId(akt.id); setError('');
    try {
      const result = await sbT2AktTasdiqlash(akt.id, akt.versiya, yangiOperationId());
      if (!result.ok) {
        toast('F2 tasdiqlanmadi. Hujjat holati yoki hajmlarni qayta tekshiring.', 'danger', undefined, 9000);
        return;
      }
      toast(result.takror ? 'F2 avval tasdiqlangan.' : 'F2 tasdiqlandi; LRV va Nakopitelniy yangilanadi.', 'ok');
      await yuklash();
    } catch {
      toast('F2 tasdiqlash javobi olinmadi. Shu hujjatni qayta yubormang; avval yangilang.', 'danger', undefined, 9000);
    } finally { setSavingId(null); }
  }

  return (
    <Sahifa
      sarlavha="F2 tarixi va tasdiqlash"
      tavsif="Qoralama ko‘rib chiqiladi; faqat tasdiqlangan aniq manba LRV va Nakopitelniyga kiradi"
      amallar={<button onClick={() => void yuklash()} disabled={!validId || loading} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[12px] disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Yangilash</button>}
    >
      <div className="flex h-full min-h-0 flex-col gap-3">
        <section className="karta flex flex-wrap items-end gap-3 p-3">
          <label className="min-w-[280px] flex-1 text-[12px] font-medium text-text">Kanonik obyekt
            <select aria-label="Kanonik obyekt" value={validId ? String(obyektId) : ''} onChange={(e) => setParams({ obyekt: e.target.value })} className="mt-1.5 block w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-text">
              <option value="">-- obyektni tanlang --</option>
              {obyektlar.map((o) => <option key={o.id} value={o.id}>{o.nom}</option>)}
            </select>
          </label>
          <div className="text-[12px] text-text-dim">{f2Reestr.length} ta F2 hujjati · {f2Reestr.filter((a) => a.holat === 'tasdiqlangan').length} tasi tasdiqlangan</div>
        </section>

        {!validId && <section className="karta p-4 text-[13px] text-text-dim">Avval kanonik obyektni tanlang.</section>}
        {error && <section role="alert" className="karta flex items-center gap-2 border-danger/40 bg-danger/5 p-4 text-[13px] text-danger"><ShieldAlert size={16} /> {error}</section>}
        {loading && <div className="skel min-h-[280px] flex-1 rounded-xl" />}

        {validId && !loading && !error && (
          <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(420px,0.9fr)_minmax(520px,1.4fr)]">
            <section className="karta min-h-0 overflow-auto">
              <table className="w-full text-left text-[12px]">
                <thead className="sticky top-0 bg-surface-2 text-text-dim"><tr><th className="p-3">Davr / hujjat</th><th>Holat</th><th className="text-right">Jami</th><th className="p-3" /></tr></thead>
                <tbody>
                  {f2Reestr.map((akt) => {
                    const active = (selectedAkt?.id ?? null) === akt.id;
                    return <tr key={akt.id} className={`border-t border-border/60 align-top ${active ? 'bg-accent/10' : ''}`}>
                      <td className="p-3"><button className="text-left" onClick={() => setSelectedAktId(akt.id)}><div className="font-medium text-text">{akt.oy?.slice(0, 7) || 'Davr noma’lum'}</div><div className="text-text-dim">{akt.raqam || 'F2 hujjati'}</div></button></td>
                      <td><span className={akt.holat === 'tasdiqlangan' ? 'text-ok' : akt.holat === 'qoralama' ? 'text-warn' : 'text-text-mute'}>{holatMatni[akt.holat] || 'Noma’lum holat'}</span><div className="text-[10px] text-text-mute">{reestrMatni[akt.reestr_holat] || 'Tekshirilmagan'}</div></td>
                      <td className="text-right tabular-nums"><FmtN val={akt.hujjat_jami} /><div className="text-[10px] text-text-mute">{akt.qator_soni ?? '—'} qator</div></td>
                      <td className="p-3 text-right">{akt.holat === 'qoralama' && <button onClick={() => void tasdiqlash(akt)} disabled={savingId != null} className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-[11px] text-white disabled:opacity-50"><CheckCircle2 size={13} />{savingId === akt.id ? '…' : 'Tasdiqlash'}</button>}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
              {f2Reestr.length === 0 && <div className="p-5 text-[13px] text-text-dim">Bu obyektda F2 hujjati hali yo‘q.</div>}
            </section>

            <section className="karta min-h-0 overflow-auto p-4">
              {selectedAkt ? <>
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3"><div><h2 className="flex items-center gap-2 text-sm font-semibold text-text"><FileText size={16} className="text-accent" />{selectedAkt.raqam || 'F2 hujjati'}</h2><p className="mt-1 text-[11px] text-text-dim">{selectedAkt.oy?.slice(0, 7)} · {holatMatni[selectedAkt.holat] || 'Noma’lum holat'} · manba qatorlari: {selectedLines.length}</p></div><div className="text-right text-[12px] text-text-dim">Hujjat jami <b className="text-text"><FmtN val={selectedAkt.hujjat_jami} /></b><br />O‘qilgan jami <b className="text-text"><FmtN val={selectedAkt.yozilgan_jami} /></b></div></div>
                <table className="w-full text-left text-[12px]"><thead className="text-text-dim"><tr><th className="py-2">Ish / resurs</th><th className="text-right">Hajm</th><th className="text-right">Narx</th><th className="text-right">Summa</th><th>Manba</th></tr></thead><tbody>{selectedLines.map((line) => <tr key={line.akt_qator_id} className="border-t border-border/60"><td className="py-2"><div className="font-medium">{line.kod || '—'}</div><div>{line.nom || 'Nomsiz qator'}</div><div className="text-[10px] text-text-dim">{line.birlik || '—'}</div></td><td className="text-right tabular-nums"><FmtN val={line.gorunish_hajm ?? line.certified_quantity ?? line.hajm} /></td><td className="text-right tabular-nums"><FmtN val={line.gorunish_narx ?? line.certified_unit_price ?? line.narx} /></td><td className="text-right tabular-nums"><FmtN val={line.gorunish_summa ?? line.certified_amount ?? line.summa} /></td><td className="text-text-dim">{line.provenance_status ? 'Qayd etilgan' : 'Manba qaydi mavjud'}</td></tr>)}</tbody></table>
                {selectedLines.length === 0 && <div className="p-5 text-[13px] text-text-dim">Bu hujjatda qator tafsiloti yo‘q. Tasdiqlashdan oldin manba va moslashtirishni tekshiring.</div>}
                {selectedAkt.holat === 'qoralama' && <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[12px] text-amber-100"><ShieldAlert size={15} className="mt-0.5 shrink-0" />Qoralama hali LRVning tasdiqlangan F2 tarixiga kirmaydi. Tasdiqlash serverdagi versiya va hajm chegaralarini qayta tekshiradi.</p>}
              </> : <div className="p-5 text-[13px] text-text-dim">Tafsilotlarni ko‘rish uchun F2 hujjatini tanlang.</div>}
            </section>
          </div>
        )}
      </div>
    </Sahifa>
  );
}

export default F2TarixNative;
