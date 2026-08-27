import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  sbT2ShartnomalarOl, sbT2ShartnomaBogOl, sbT2ShartnomaSaqla, sbT2ShartnomaBogSaqla,
  type Shartnoma,
} from '../api/t2-shartnoma';
import { Briefcase, Plus } from 'lucide-react';
import { FmtN } from '../lib/format';
import { toast } from '../umumiy/ui/Toast';
import { useKompaniya } from './KompaniyaTanlov';

export default function TestShartnoma() {
  const { joriy } = useKompaniya();
  const [params] = useSearchParams();
  const [shartnomalar, setShartnomalar] = useState<Shartnoma[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const obyektId = params.get('obyektId');

  const [modalOchiq, setModalOchiq] = useState(false);
  const [fRaqam, setFRaqam] = useState('');
  const [fNom, setFNom] = useState('');
  const [fTaraf, setFTaraf] = useState('');
  const [fSumma, setFSumma] = useState('');
  const [fNds, setFNds] = useState('');
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);

  const yukla = async () => {
    setYuklanmoqda(true);
    let boundId: number | null = null;
    if (obyektId) {
      const bRes = await sbT2ShartnomaBogOl(Number(obyektId));
      if (bRes.ok && bRes.qatorlar && bRes.qatorlar.length > 0) {
        boundId = bRes.qatorlar[0].shartnoma_id;
      }
    }

    const r = await sbT2ShartnomalarOl(false); // get all contracts
    if (r.ok) {
      const all = (r.qatorlar as Shartnoma[]) || [];
      if (obyektId && boundId) {
        setShartnomalar(all.filter(s => s.id === boundId));
      } else if (obyektId && !boundId) {
        setShartnomalar([]); // none bound
      } else {
        setShartnomalar(all);
      }
    } else {
      toast(r.error || 'Shartnomalar o\'qilmadi', 'danger');
    }
    setYuklanmoqda(false);
  };

  useEffect(() => { yukla(); }, [obyektId]);

  const shartnomaYarat = async () => {
    if (!fRaqam.trim()) {
      toast('Shartnoma raqamini kiriting', 'warn');
      return;
    }
    setSaqlanmoqda(true);
    const r = await sbT2ShartnomaSaqla({
      raqam: fRaqam, nom: fNom || undefined, taraf: fTaraf || undefined,
      summaBezNds: fSumma ? Number(fSumma) : undefined,
      nds: fNds ? Number(fNds) : undefined,
    });
    if (!r.ok || !r.shartnoma_id) {
      setSaqlanmoqda(false);
      toast(r.error || 'Xato', 'danger');
      return;
    }

    // Agar obyekt kontekstida ochilgan bo'lsa — darhol shu obyektga bog'laymiz
    if (obyektId) {
      const bogRes = await sbT2ShartnomaBogSaqla(Number(obyektId), r.shartnoma_id);
      if (!bogRes.ok) {
        toast('Shartnoma yaratildi, lekin obyektga bog\'lanmadi: ' + (bogRes.error || ''), 'warn');
      }
    }

    setSaqlanmoqda(false);
    toast('✓ Shartnoma yaratildi', 'ok');
    setModalOchiq(false);
    setFRaqam(''); setFNom(''); setFTaraf(''); setFSumma(''); setFNds('');
    yukla();
  };

  return (
    <div className="p-6 bg-zinc-900 text-white min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-fuchsia-400 flex items-center gap-2">
            <Briefcase />
            Bosh Shartnomalar {obyektId ? '(Obyekt boyicha)' : ''}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            {obyektId ? 'Faqat tanlangan obyektga boglangan shartnomalar' : 'Kompaniyaning barcha bosh shartnomalari'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setModalOchiq(true)}
            className="bg-fuchsia-600 hover:bg-fuchsia-500 px-4 py-2 rounded text-sm font-medium flex items-center gap-1">
            <Plus size={16} /> Yangi shartnoma
          </button>
          <button onClick={yukla} className="bg-zinc-700 px-4 py-2 hover:bg-zinc-600 rounded text-sm font-medium">
            Yangilash
          </button>
        </div>
      </div>

      {yuklanmoqda ? (
        <div className="text-zinc-500 animate-pulse">Yuklanmoqda...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shartnomalar.length === 0 && <div className="text-zinc-500">Hech narsa topilmadi. "Yangi shartnoma" tugmasi orqali yarating.</div>}
          {shartnomalar.map(s => (
            <div key={s.id} className="border border-zinc-700 bg-black p-4 rounded-lg relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-fuchsia-500"></div>
              <div className="flex justify-between mb-2">
                <span className="font-bold text-lg">№ {s.raqam}</span>
                <span className={
                  "text-xs px-2 py-1 rounded " +
                  (s.holat === 'faol' ? 'bg-emerald-500/20 text-emerald-400'
                    : s.holat === 'bekor' ? 'bg-red-500/20 text-red-400'
                    : 'bg-zinc-700 text-zinc-400')
                }>
                  {s.holat.toUpperCase()}
                </span>
              </div>
              <div className="text-sm text-zinc-400 mb-4">{s.nom || 'Nomsiz shartnoma'}</div>
              <div className="flex flex-col gap-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Taraf:</span>
                  <span>{s.taraf || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Summa:</span>
                  <span className="text-emerald-400 font-medium"><FmtN val={s.summa_bez_nds} /></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">NDS:</span>
                  <span><FmtN val={s.nds} /></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOchiq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-zinc-900 border border-zinc-700 w-full max-w-md rounded-lg shadow-2xl p-5 flex flex-col gap-3">
            <h3 className="text-lg font-bold text-fuchsia-400">Yangi bosh shartnoma</h3>
            {!joriy && (
              <div className="text-xs text-amber-400 bg-amber-900/20 p-2 rounded">
                Kompaniya tanlanmagan — shartnoma joriy sessiya kompaniyasiga yoziladi.
              </div>
            )}
            <input value={fRaqam} onChange={(e) => setFRaqam(e.target.value)}
              placeholder="Shartnoma raqami *"
              className="bg-zinc-800 border border-zinc-700 p-2 rounded text-white text-sm" />
            <input value={fNom} onChange={(e) => setFNom(e.target.value)}
              placeholder="Nomi (ixtiyoriy)"
              className="bg-zinc-800 border border-zinc-700 p-2 rounded text-white text-sm" />
            <input value={fTaraf} onChange={(e) => setFTaraf(e.target.value)}
              placeholder="Taraf / Buyurtmachi"
              className="bg-zinc-800 border border-zinc-700 p-2 rounded text-white text-sm" />
            <div className="flex gap-2">
              <input type="number" value={fSumma} onChange={(e) => setFSumma(e.target.value)}
                placeholder="Summa (NDS siz)"
                className="bg-zinc-800 border border-zinc-700 p-2 rounded text-white text-sm flex-1" />
              <input type="number" value={fNds} onChange={(e) => setFNds(e.target.value)}
                placeholder="NDS"
                className="bg-zinc-800 border border-zinc-700 p-2 rounded text-white text-sm w-28" />
            </div>
            {obyektId && (
              <div className="text-xs text-zinc-500">
                Yaratilgach avtomatik shu obyektga bog'lanadi (obyekt ID: {obyektId}).
              </div>
            )}
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => setModalOchiq(false)} disabled={saqlanmoqda}
                className="px-4 py-1.5 rounded border border-zinc-700 text-zinc-400 text-sm disabled:opacity-40">
                Bekor qilish
              </button>
              <button onClick={shartnomaYarat} disabled={saqlanmoqda}
                className="px-4 py-1.5 rounded bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-sm font-medium disabled:opacity-40">
                {saqlanmoqda ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
