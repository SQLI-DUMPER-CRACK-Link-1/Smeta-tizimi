import { useCallback, useEffect, useMemo, useState } from 'react';
import { yangiOperationId, type T2Qator, type T2QatorHolat } from '../../api/supabase';
import { ostatkaIstisnoYarat, ozgarishQaytar, ozgarishRoyxatOl, ozgarishTasdiqla, type OstatkaIstisnoQator } from '../../api/t2-document-control';
import { ostatkaIstisnolari, type OstatkaIstisno } from '../../lib/ostatka-export';
import { FmtN } from '../../lib/format';

/**
 * Bajarilmaydigan / bekor qilingan ishlar (egasi 2026-09-25: "smetada qilinmagan
 * ishlar yoki bekor qilingan ishlar bo'lishi mumkin — bunga ham bir yechim
 * bo'lishi kerak").
 *
 * Yangi jadval yo'q — kanonik o'zgartirish nazorati (t2_smeta_ozgarish,
 * tur='olib_tashlash'): operator sabab bilan QORALAMA yaratadi, vakolatli
 * xodim TASDIQLAYDI (audit + smeta revision). Tasdiqlangach smeta hajmi
 * bajarilgan hajmga tushadi (bajarilmagan bo'lsa — 0), ostatkadan chiqadi va
 * «ВЕДОМОСТЬ ОСТАТКА РАБОТ» da «ИСКЛЮЧЕНО ИЗ ОСТАТКА» bo'limida asosi bilan
 * turadi. Jim yo'qotish yo'q.
 */

type OzgarishXom = Parameters<typeof ostatkaIstisnolari>[0][number] & { versiya?: number | null; kind?: string | null };

export function useOstatkaIstisnolari(obyektId: number | null) {
  const [royxat, setRoyxat] = useState<OzgarishXom[]>([]);
  const [xato, setXato] = useState('');
  const yangila = useCallback(async (): Promise<OstatkaIstisno[]> => {
    if (!obyektId) { setRoyxat([]); return []; }
    try {
      const j = await ozgarishRoyxatOl(obyektId, 500);
      const r = ((j.ozgarishlar ?? []) as OzgarishXom[]).filter((o) => o.tur === 'olib_tashlash');
      setRoyxat(r); setXato('');
      return ostatkaIstisnolari(r);
    } catch (e) {
      setXato(e instanceof Error ? e.message : 'O‘zgarishlar ro‘yxati o‘qilmadi');
      throw e;
    }
  }, [obyektId]);
  useEffect(() => { void yangila().catch(() => undefined); }, [yangila]);
  const istisnolar = useMemo(() => ostatkaIstisnolari(royxat), [royxat]);
  return { royxat, istisnolar, xato, yangila };
}

const BARG = new Set(['rs', 'mat', 'ob']);

/** Server kodlari → tushunarli matn (egasi: PTO va undan yuqori + prorab tasdiqlaydi, sabab shart). */
function xatoMatni(e: unknown): string {
  const code = (e as { code?: string } | null)?.code ?? '';
  if (code === 'SABAB_MAJBURIY') return 'Sabab yozilmagan — bekor qilishni tasdiqlab bo‘lmaydi.';
  if (code === 'CHANGE_APPROVAL_DENIED' || code === 'HTTP_403') return 'Tasdiqlash huquqingiz yo‘q: PTO, rahbar, boss yoki prorab tasdiqlaydi.';
  if (code === 'SCOPE_DRIFT' || code === 'CHANGE_PREFLIGHT_FAILED') return 'Qator o‘zgargan — sahifani yangilab, qayta urinib ko‘ring.';
  return e instanceof Error ? e.message : 'Amal bajarilmadi';
}
const HOLAT: Record<string, string> = { qoralama: 'tasdiq kutilmoqda', tasdiqlangan: 'tasdiqlangan', rad: 'qaytarilgan', bekor: 'bekor qilingan' };

export function OstatkaIstisnoPanel({ obyektId, qatorlar, holatlar, royxat, yangila, onSmetaOzgardi }: {
  obyektId: number;
  qatorlar: readonly T2Qator[];
  holatlar: readonly T2QatorHolat[];
  royxat: readonly OzgarishXom[];
  yangila: () => Promise<unknown>;
  onSmetaOzgardi: () => void;
}) {
  const [qidiruv, setQidiruv] = useState('');
  const [tanlangan, setTanlangan] = useState<T2Qator | null>(null);
  const [sabab, setSabab] = useState('');
  const [asos, setAsos] = useState('');
  const [band, setBand] = useState(false);
  const [xabar, setXabar] = useState<{ tur: 'ok' | 'xato'; matn: string } | null>(null);

  const faktOf = useMemo(() => new Map(holatlar.map((h) => [h.qator_id, Number(h.fakt_hajm ?? 0)])), [holatlar]);
  const bolalar = useMemo(() => {
    const m = new Map<number, T2Qator[]>();
    for (const q of qatorlar) if (q.ota_id != null) { const a = m.get(q.ota_id); if (a) a.push(q); else m.set(q.ota_id, [q]); }
    return m;
  }, [qatorlar]);

  const topildi = useMemo(() => {
    const f = qidiruv.trim().toLowerCase();
    if (f.length < 2) return [];
    return qatorlar.filter((q) => (q.tur === 'bl' || BARG.has(q.tur ?? '')) && q.hajm != null && q.hajm > 0
      && ((q.kod ?? '').toLowerCase().includes(f) || (q.nom ?? '').toLowerCase().includes(f))).slice(0, 20);
  }, [qatorlar, qidiruv]);

  /** Yangi hajm = bajarilgan hajm (fakt); bajarilmagan bo'lsa — 0 (to'liq bekor). */
  const reja = useMemo<OstatkaIstisnoQator[]>(() => {
    if (!tanlangan) return [];
    const yangi = (q: T2Qator) => Math.max(0, Math.min(faktOf.get(q.id) ?? 0, q.hajm ?? 0));
    const out: OstatkaIstisnoQator[] = [{ qatorId: tanlangan.id, yangiHajm: yangi(tanlangan) }];
    if (tanlangan.tur === 'bl') {
      // Normali resurslar ish hajmidan norma bo'yicha kamayadi (server kaskadi);
      // normasiz resurslar alohida qator bo'lib o'zgarishga kiradi.
      for (const k of bolalar.get(tanlangan.id) ?? []) if (BARG.has(k.tur ?? '') && k.norma == null && (k.hajm ?? 0) > 0) out.push({ qatorId: k.id, yangiHajm: yangi(k) });
    }
    return out;
  }, [tanlangan, faktOf, bolalar]);

  const yarat = async () => {
    if (!tanlangan || !sabab.trim()) return;
    setBand(true); setXabar(null);
    try {
      await ostatkaIstisnoYarat({ obyektId, qatorlar: reja, sabab: sabab.trim(), asos: asos.trim() || null, operationId: yangiOperationId() });
      setXabar({ tur: 'ok', matn: 'Qoralama yaratildi. Tasdiqlangandan keyin ish ostatkadan chiqadi.' });
      setTanlangan(null); setSabab(''); setAsos(''); setQidiruv('');
      await yangila();
    } catch (e) {
      setXabar({ tur: 'xato', matn: e instanceof Error ? e.message : 'Qoralama yaratilmadi' });
    } finally { setBand(false); }
  };

  const qaror = async (o: OzgarishXom, tasdiq: boolean) => {
    setBand(true); setXabar(null);
    try {
      if (tasdiq) await ozgarishTasdiqla({ ozgarishId: o.id, versiya: Number(o.versiya ?? 1), operationId: yangiOperationId() });
      else await ozgarishQaytar({ ozgarishId: o.id, sabab: 'Operator qaytardi', operationId: yangiOperationId() });
      await yangila();
      if (tasdiq) onSmetaOzgardi();
      setXabar({ tur: 'ok', matn: tasdiq ? 'Tasdiqlandi: smeta hajmi yangilandi, ish ostatkadan chiqdi.' : 'Qaytarildi.' });
    } catch (e) {
      setXabar({ tur: 'xato', matn: xatoMatni(e) });
    } finally { setBand(false); }
  };

  const nomOf = useMemo(() => new Map(qatorlar.map((q) => [q.id, q])), [qatorlar]);
  const fakt = tanlangan ? faktOf.get(tanlangan.id) ?? 0 : 0;

  return (
    <div className="space-y-3 text-[12px]">
      <p className="text-text-dim">
        Smetadagi ish bajarilmaydigan yoki bekor qilingan bo‘lsa, shu yerda sababi bilan belgilang. Tasdiqlangach ish ostatkadan chiqadi va
        «Ostatka Excel» hujjatida «ИСКЛЮЧЕНО ИЗ ОСТАТКА» bo‘limida asosi bilan ko‘rsatiladi (jamiga kirmaydi).
      </p>
      <div className="space-y-2">
        <input aria-label="Ishni qidirish" value={qidiruv} onChange={(e) => { setQidiruv(e.target.value); setTanlangan(null); }}
          placeholder="Ish yoki resursni kod/nom bo‘yicha qidiring…" className="w-full rounded border border-border bg-bg px-2 py-1" />
        {!tanlangan && topildi.length > 0 && (
          <ul className="max-h-48 overflow-auto rounded border border-border" role="listbox" aria-label="Topilgan ishlar">
            {topildi.map((q) => (
              <li key={q.id}>
                <button type="button" onClick={() => setTanlangan(q)} className="w-full px-2 py-1 text-left hover:bg-surface-2">
                  <span className="text-text-mute">{q.tur === 'bl' ? 'Ish' : 'Resurs'} {q.kod ?? ''}</span> {q.nom} — <FmtN val={q.hajm ?? 0} /> {q.birlik ?? ''}
                </button>
              </li>
            ))}
          </ul>
        )}
        {tanlangan && (
          <div className="rounded border border-border p-2 space-y-2">
            <div><b>{tanlangan.nom}</b> ({tanlangan.birlik ?? '—'}) — smeta: <FmtN val={tanlangan.hajm ?? 0} />, bajarilgan: <FmtN val={fakt} /></div>
            <div className="text-text-dim">
              {fakt > 0
                ? <>Bajarilgan qismi qoladi; bajarilmaydigan qismi (<FmtN val={(tanlangan.hajm ?? 0) - Math.min(fakt, tanlangan.hajm ?? 0)} />) ostatkadan chiqadi.</>
                : <>Ish umuman bajarilmagan — to‘liq bekor qilinadi (smeta hajmi 0).</>}
              {reja.length > 1 && <> Normasiz {reja.length - 1} ta resurs ham shu o‘zgarishga kiradi.</>}
            </div>
            <label className="block">Sabab (majburiy)
              <textarea aria-label="Sabab" value={sabab} onChange={(e) => setSabab(e.target.value)} rows={2}
                placeholder="Masalan: buyurtmachi loyihadan chiqardi; boshqa pudratchiga berildi" className="mt-1 w-full rounded border border-border bg-bg px-2 py-1" />
            </label>
            <label className="block">Asos hujjat (ixtiyoriy)
              <input aria-label="Asos hujjat" value={asos} onChange={(e) => setAsos(e.target.value)}
                placeholder="Masalan: письмо заказчика № 45 от 20.09.2026" className="mt-1 w-full rounded border border-border bg-bg px-2 py-1" />
            </label>
            <div className="flex gap-2">
              <button type="button" disabled={band || !sabab.trim()} onClick={() => void yarat()} className="rounded bg-accent px-3 py-1 text-white disabled:opacity-40">Qoralama yaratish</button>
              <button type="button" onClick={() => setTanlangan(null)} className="rounded border border-border px-3 py-1">Bekor</button>
            </div>
          </div>
        )}
      </div>
      {xabar && <p role={xabar.tur === 'xato' ? 'alert' : 'status'} className={xabar.tur === 'xato' ? 'text-danger' : 'text-success'}>{xabar.matn}</p>}
      {royxat.length > 0 && (
        <table className="w-full border-collapse">
          <thead><tr className="text-left text-text-mute"><th className="py-1">№</th><th>Ish</th><th>Sabab / asos</th><th>Holat</th><th /></tr></thead>
          <tbody>
            {royxat.map((o) => (
              <tr key={o.id} className="border-t border-border/60 align-top">
                <td className="py-1 pr-2">{o.raqam || o.id}</td>
                <td className="pr-2">{(o.qatorlar ?? []).map((z) => nomOf.get(Number(z.qator_id))?.nom ?? `#${z.qator_id}`).join('; ')}</td>
                <td className="pr-2">{o.sabab}{o.evidence_izoh ? ` — ${o.evidence_izoh}` : ''}</td>
                <td className="pr-2">{HOLAT[o.holat ?? ''] ?? o.holat}</td>
                <td className="whitespace-nowrap">
                  {o.holat === 'qoralama' && (<>
                    <button type="button" disabled={band} onClick={() => void qaror(o, true)} className="mr-1 rounded border border-accent/50 px-2 text-accent disabled:opacity-40">Tasdiqlash</button>
                    <button type="button" disabled={band} onClick={() => void qaror(o, false)} className="rounded border border-border px-2 disabled:opacity-40">Qaytarish</button>
                  </>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default OstatkaIstisnoPanel;
