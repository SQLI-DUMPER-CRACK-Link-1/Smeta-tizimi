import { useCallback, useMemo, useState } from 'react';
import { Download, Search, X } from 'lucide-react';
import { hujjatKorinishi, type KorinishQator, type KorinishVaraq } from '../../lib/hujjat-yozuvchi';
import { downloadBlob } from '../../lib/construction-document-control/export/download-helper';

/**
 * Hujjatni saytda AYNAN hujjatdagiday ko'rish (egasi, 2026-09-25): "hamma hujjatni
 * saytda har bir qatorini aynan hujjatdagiday qulay ko'ra olishimiz, tushuna
 * olishimiz, ajrata olishimiz kerak".
 *
 * Manba — yuklab olinadigan faylning o'zi (ikkinchi haqiqat yo'q): qatorlar,
 * birlashmalar, ustun kengligi, qalin shrift, son formatlari; yashirin texnik
 * ustunlar ko'rinmaydi. Qidiruv, "faqat bo'lim va jamilar", katta hujjatda
 * sahifalash.
 */
const SAHIFA = 400;

export function HujjatKorinish({ bytes, faylNomi, onClose }: { bytes: Uint8Array; faylNomi: string; onClose: () => void }) {
  const varaqlar = useMemo<KorinishVaraq[]>(() => { try { return hujjatKorinishi(bytes); } catch { return []; } }, [bytes]);
  const [vi, setVi] = useState(0);
  const [qidiruv, setQidiruv] = useState('');
  const [faqatJami, setFaqatJami] = useState(false);
  const [sahifa, setSahifa] = useState(0);
  const v = varaqlar[vi];

  const { yuqori, bosh, malumot } = useMemo(() => {
    if (!v) return { yuqori: [] as KorinishQator[], bosh: [] as KorinishQator[], malumot: [] as KorinishQator[] };
    const chegara = v.raqamQatori ?? 0;
    const hammasi = v.qatorlar.filter((q) => q.r <= chegara);
    // Jadval sarlavhasi — raqamlash qatoridan yuqoriga bo'sh qatorgacha (sticky);
    // undan yuqorisi — hujjat nomi va titul (Объект, Заказчик…).
    let k = hammasi.length - 1;
    while (k > 0 && hammasi[k - 1].turi !== 'bosh') k--;
    const b = chegara ? hammasi.slice(k) : [];
    const y = chegara ? hammasi.slice(0, k) : hammasi;
    let m = v.qatorlar.filter((q) => q.r > chegara);
    const f = qidiruv.trim().toLowerCase();
    if (faqatJami) m = m.filter((q) => q.turi === 'bolim' || q.turi === 'jami');
    if (f) m = m.filter((q) => q.turi === 'bolim' || q.kataklar.some((k) => k.matn.toLowerCase().includes(f)));
    return { yuqori: y, bosh: b, malumot: m };
  }, [v, qidiruv, faqatJami]);

  const sahifalar = Math.max(1, Math.ceil(malumot.length / SAHIFA));
  const korinadigan = malumot.slice(sahifa * SAHIFA, sahifa * SAHIFA + SAHIFA);

  if (!v) {
    return (
      <div role="dialog" aria-label="Hujjatni ko‘rish" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="karta p-4 text-[13px]">Hujjatni ko‘rsatib bo‘lmadi. <button onClick={onClose} className="ml-2 underline">Yopish</button></div>
      </div>
    );
  }

  const qatorRender = (q: KorinishQator) => {
    const cells: React.ReactNode[] = [];
    const joy = new Map(q.kataklar.map((k) => [k.c, k]));
    for (let i = 0; i < v.ustunlar.length;) {
      const col = v.ustunlar[i].c;
      const k = joy.get(col);
      if (!k) { cells.push(<td key={`${q.r}-${col}`} className={q.turi === 'sarlavha' && !v.raqamQatori ? '' : 'border border-[#9aa3ad] px-1.5 py-0.5'} />); i++; continue; }
      cells.push(
        <td key={`${q.r}-${col}`} colSpan={k.span}
          className={`border border-[#9aa3ad] px-1.5 py-0.5 align-top ${k.qalin ? 'font-semibold' : ''} ${k.tekis === 'right' ? 'text-right tabular-nums' : k.tekis === 'center' ? 'text-center' : 'text-left'} ${k.formula ? 'text-[#0b3a6e]' : ''}`}
          title={k.formula ? 'Excel formulasi bilan hisoblanadi (Excelda o‘zgartirsangiz qayta hisoblanadi)' : undefined}>
          {k.matn}
        </td>,
      );
      i += k.span;
    }
    // Qog'oz ko'rinishi — mavzudan qat'i nazar oq fon, qora matn (hujjatdagiday).
    const fon = q.turi === 'bolim' ? 'bg-[#e8eef6]' : q.turi === 'jami' ? 'bg-[#fff6dc]' : q.turi === 'sarlavha' ? 'bg-[#f3f4f6]' : 'bg-white';
    return <tr key={q.r} className={fon}>{cells}</tr>;
  };

  return (
    <div role="dialog" aria-label="Hujjatni ko‘rish" className="fixed inset-0 z-50 flex flex-col bg-black/50 p-3">
      <div className="karta flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-2 text-[12px]">
          <b className="mr-2 truncate text-[13px]">{faylNomi}</b>
          {varaqlar.length > 1 && varaqlar.map((x, i) => (
            <button key={x.nom} onClick={() => { setVi(i); setSahifa(0); }} className={`rounded border px-2 py-0.5 ${i === vi ? 'border-accent text-accent' : 'border-border'}`}>{x.nom}</button>
          ))}
          <label className="relative ml-auto">
            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-mute" />
            <input aria-label="Hujjatdan qidirish" value={qidiruv} onChange={(e) => { setQidiruv(e.target.value); setSahifa(0); }} placeholder="Qidirish (kod, nom)…" className="w-56 rounded border border-border bg-bg py-1 pl-7 pr-2" />
          </label>
          <label className="inline-flex items-center gap-1"><input type="checkbox" checked={faqatJami} onChange={(e) => { setFaqatJami(e.target.checked); setSahifa(0); }} /> faqat bo‘lim va jamilar</label>
          <button onClick={() => downloadBlob(bytes, faylNomi)} className="inline-flex items-center gap-1 rounded bg-accent px-2 py-1 text-white"><Download size={13} /> Excel</button>
          <button onClick={onClose} aria-label="Yopish" className="rounded border border-border p-1"><X size={14} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-[#e5e7eb] p-3 text-[11px] text-black">
          <div className="inline-block min-w-full bg-white p-4 shadow">
          {/* Hujjat nomi va titul — ramkasiz, hujjatdagiday. */}
          <table className="mb-2 border-collapse" style={{ tableLayout: 'fixed' }}>
            <colgroup>{v.ustunlar.map((u) => <col key={u.c} style={{ width: Math.round(u.kenglik * 7.2) }} />)}</colgroup>
            <tbody>{yuqori.map((q) => (
              <tr key={q.r}>{q.kataklar.length ? q.kataklar.map((k) => (
                <td key={k.c} colSpan={k.span} className={`px-1.5 py-0.5 ${k.qalin ? 'font-semibold' : ''} ${k.tekis === 'center' ? 'text-center' : k.tekis === 'right' ? 'text-right' : ''}`}>{k.matn}</td>
              )) : <td colSpan={v.ustunlar.length} className="h-2" />}</tr>
            ))}</tbody>
          </table>
          <table className="border-collapse" style={{ tableLayout: 'fixed' }}>
            <colgroup>{v.ustunlar.map((u) => <col key={u.c} style={{ width: Math.round(u.kenglik * 7.2) }} />)}</colgroup>
            <thead className="sticky top-0 z-10 bg-[#f3f4f6]">{bosh.map(qatorRender)}</thead>
            <tbody>{korinadigan.filter((q) => q.turi !== 'bosh').map(qatorRender)}</tbody>
          </table>
          {!korinadigan.length && <p className="mt-3 text-[#555]">Mos qator yo‘q.</p>}
          </div>
        </div>
        {sahifalar > 1 && (
          <div className="flex items-center gap-2 border-t border-border p-2 text-[12px]">
            <button disabled={sahifa === 0} onClick={() => setSahifa((p) => p - 1)} className="rounded border px-2 py-0.5 disabled:opacity-40">Oldingi</button>
            <span>{sahifa + 1} / {sahifalar} ({malumot.length} qator)</span>
            <button disabled={sahifa + 1 >= sahifalar} onClick={() => setSahifa((p) => p + 1)} className="rounded border px-2 py-0.5 disabled:opacity-40">Keyingi</button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Ko'rish oynasi holati: `ochish(bytes, nom)` — oynani ochadi; `oyna` — render qilinadigan element. */
export function useHujjatKorinish() {
  const [hujjat, setHujjat] = useState<{ bytes: Uint8Array; nom: string } | null>(null);
  const ochish = useCallback((bytes: Uint8Array, nom: string) => setHujjat({ bytes, nom }), []);
  const oyna = hujjat ? <HujjatKorinish bytes={hujjat.bytes} faylNomi={hujjat.nom} onClose={() => setHujjat(null)} /> : null;
  return { ochish, oyna };
}
