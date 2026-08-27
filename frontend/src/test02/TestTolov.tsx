import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  sbT2TolovlarOl, sbT2BuxDashboardOl, sbT2TolovYoz, sbT2XarajatYoz,
  type Tolov, type BuxDashboard,
} from '../api/t2-buxgalteriya';
import { sbT2ShartnomalarOl, sbT2ShartnomaBogOl, type Shartnoma } from '../api/t2-shartnoma';
import { Calculator, Plus } from 'lucide-react';
import { FmtN } from '../lib/format';
import { yangiOperationId } from '../api/supabase';
import { toast } from '../umumiy/ui/Toast';

export default function TestTolov() {
  const [params] = useSearchParams();
  const obyektId = params.get('obyektId');
  const [tolovlar, setTolovlar] = useState<Tolov[]>([]);
  const [dash, setDash] = useState<BuxDashboard[]>([]);
  const [shartnomalar, setShartnomalar] = useState<Shartnoma[]>([]);
  const [shartnomaId, setShartnomaId] = useState<number | null>(null);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);

  const [modalOchiq, setModalOchiq] = useState(false);
  const [fTur, setFTur] = useState<'tolov_avans' | 'xarajat'>('tolov_avans');
  const [fShartnoma, setFShartnoma] = useState<number | ''>('');
  const [fTolovTuri, setFTolovTuri] = useState<'avans' | 'tolov' | 'qaytarim'>('tolov');
  const [fSumma, setFSumma] = useState('');
  const [fIzoh, setFIzoh] = useState('');
  const [fToifa, setFToifa] = useState('');
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);

  const yukla = async () => {
    setYuklanmoqda(true);
    let sId: number | null = null;
    if (obyektId) {
      const bogRes = await sbT2ShartnomaBogOl(Number(obyektId));
      if (bogRes.ok && bogRes.qatorlar && bogRes.qatorlar.length > 0) {
        sId = bogRes.qatorlar[0].shartnoma_id;
        setShartnomaId(sId);
      }
    }

    const [tRes, sRes] = await Promise.all([
      sbT2TolovlarOl(sId || undefined),
      sbT2ShartnomalarOl(true),
    ]);
    if (tRes.ok) setTolovlar((tRes.qatorlar as Tolov[]) || []);
    else toast(tRes.error || 'To\'lovlar o\'qilmadi', 'danger');
    if (sRes.ok) setShartnomalar((sRes.qatorlar as Shartnoma[]) || []);

    if (!obyektId) {
      const dRes = await sbT2BuxDashboardOl();
      if (dRes.ok) setDash((dRes.qatorlar as BuxDashboard[]) || []);
    } else if (sId) {
      const dRes = await sbT2BuxDashboardOl();
      if (dRes.ok) setDash((dRes.qatorlar as BuxDashboard[]).filter(d => d.shartnoma_id === sId));
    }
    setYuklanmoqda(false);
  };

  useEffect(() => { yukla(); }, [obyektId]);

  const modalOch = () => {
    setFShartnoma(shartnomaId || '');
    setFTur('tolov_avans');
    setFTolovTuri('tolov');
    setFSumma(''); setFIzoh(''); setFToifa('');
    setModalOchiq(true);
  };

  const saqlash = async () => {
    const summa = Number(fSumma);
    if (!summa || summa <= 0) {
      toast('Summani kiriting', 'warn');
      return;
    }
    setSaqlanmoqda(true);
    if (fTur === 'tolov_avans') {
      if (!fShartnoma) {
        setSaqlanmoqda(false);
        toast('Shartnoma tanlang', 'warn');
        return;
      }
      const r = await sbT2TolovYoz({
        shartnomaId: Number(fShartnoma), summa, tur: fTolovTuri,
        obyektId: obyektId ? Number(obyektId) : undefined,
        izoh: fIzoh || undefined, operationId: yangiOperationId(),
      });
      setSaqlanmoqda(false);
      if (r.ok) {
        toast('✓ To\'lov yozildi', 'ok');
        setModalOchiq(false);
        yukla();
      } else {
        toast(r.error || 'Xato', 'danger');
      }
    } else {
      const r = await sbT2XarajatYoz({
        summa, toifa: fToifa || undefined, izoh: fIzoh || undefined,
        operationId: yangiOperationId(),
      });
      setSaqlanmoqda(false);
      if (r.ok) {
        toast('✓ Xarajat yozildi', 'ok');
        setModalOchiq(false);
        yukla();
      } else {
        toast(r.error || 'Xato', 'danger');
      }
    }
  };

  return (
    <div className="p-6 bg-zinc-900 text-white min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-emerald-400 flex items-center gap-2">
            <Calculator />
            Moliya & Buxgalteriya {obyektId ? '(Obyekt)' : ''}
          </h1>
          <p className="text-sm text-zinc-400">To'lovlar, avans, xarajat va debitorlik qarzlari Tizim_02 da</p>
        </div>
        <div className="flex gap-2">
          <button onClick={modalOch} className="bg-emerald-600 px-4 py-2 hover:bg-emerald-500 rounded text-sm font-medium flex items-center gap-1">
            <Plus size={16} /> Yangi to'lov/xarajat
          </button>
          <button onClick={yukla} className="bg-zinc-700 px-4 py-2 hover:bg-zinc-600 rounded text-sm font-medium">Yangilash</button>
        </div>
      </div>

      {yuklanmoqda ? <div className="text-zinc-500 animate-pulse">Yuklanmoqda...</div> : (
        <div className="flex flex-col gap-6">
          {dash.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dash.map(d => (
                <div key={d.shartnoma_id} className="border border-zinc-700 bg-black p-4 rounded-lg relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                  <h3 className="font-bold mb-1">№ {d.raqam}</h3>
                  <div className="text-xs text-zinc-400 mb-3">{d.nom || 'Shartnoma'} | {d.taraf}</div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Jami summa:</div><div className="text-right text-emerald-300 font-medium"><FmtN val={d.dog_summa} /></div>
                    <div>Bajarilgan F2:</div><div className="text-right font-medium"><FmtN val={d.bajarilgan} /></div>
                    <div>To'langan:</div><div className="text-right font-medium text-emerald-400"><FmtN val={d.tolangan} /></div>
                    <div>Debitor qarz:</div><div className="text-right font-bold text-red-400"><FmtN val={d.debitor} /></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="border border-zinc-800 rounded-lg overflow-hidden mt-4">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-800 text-zinc-400">
                <tr>
                  <th className="p-3">Sana</th>
                  <th className="p-3">Tur</th>
                  <th className="p-3">Summa</th>
                  <th className="p-3">Izoh</th>
                  <th className="p-3">Holat</th>
                </tr>
              </thead>
              <tbody>
                {tolovlar.length === 0 && <tr><td colSpan={5} className="p-3 text-center text-zinc-500">Hech qanday to'lov mavjud emas</td></tr>}
                {tolovlar.map(t => (
                  <tr key={t.id} className="border-t border-zinc-800 hover:bg-zinc-800/50">
                    <td className="p-3">{t.sana.substring(0,10)}</td>
                    <td className="p-3">
                      <span className={
                        "px-2 py-0.5 rounded text-xs " +
                        (t.tur === 'qaytarim' ? 'bg-red-500/20 text-red-400'
                          : t.tur === 'avans' ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-emerald-500/20 text-emerald-400')
                      }>
                        {t.tur.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-emerald-400"><FmtN val={t.summa} /></td>
                    <td className="p-3 text-zinc-400">{t.izoh || '-'}</td>
                    <td className="p-3">{t.holat}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOchiq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-zinc-900 border border-zinc-700 w-full max-w-md rounded-lg shadow-2xl p-5 flex flex-col gap-3">
            <h3 className="text-lg font-bold text-emerald-400">Yangi yozuv</h3>

            <div className="flex gap-2">
              <button onClick={() => setFTur('tolov_avans')}
                className={"flex-1 px-3 py-1.5 rounded text-sm font-medium " + (fTur === 'tolov_avans' ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400')}>
                Shartnoma to'lovi
              </button>
              <button onClick={() => setFTur('xarajat')}
                className={"flex-1 px-3 py-1.5 rounded text-sm font-medium " + (fTur === 'xarajat' ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400')}>
                Kompaniya xarajati
              </button>
            </div>

            {fTur === 'tolov_avans' ? (
              <>
                <select value={fShartnoma} onChange={(e) => setFShartnoma(e.target.value ? Number(e.target.value) : '')}
                  className="bg-zinc-800 border border-zinc-700 p-2 rounded text-white text-sm">
                  <option value="">— Shartnoma tanlang —</option>
                  {shartnomalar.map(s => <option key={s.id} value={s.id}>№ {s.raqam} — {s.nom || 'Nomsiz'}</option>)}
                </select>
                <select value={fTolovTuri} onChange={(e) => setFTolovTuri(e.target.value as any)}
                  className="bg-zinc-800 border border-zinc-700 p-2 rounded text-white text-sm">
                  <option value="tolov">To'lov</option>
                  <option value="avans">Avans</option>
                  <option value="qaytarim">Qaytarim</option>
                </select>
              </>
            ) : (
              <input value={fToifa} onChange={(e) => setFToifa(e.target.value)}
                placeholder="Xarajat toifasi (masalan: ofis, transport)"
                className="bg-zinc-800 border border-zinc-700 p-2 rounded text-white text-sm" />
            )}

            <input type="number" value={fSumma} onChange={(e) => setFSumma(e.target.value)}
              placeholder="Summa (so'm) *"
              className="bg-zinc-800 border border-zinc-700 p-2 rounded text-white text-sm" />
            <input value={fIzoh} onChange={(e) => setFIzoh(e.target.value)}
              placeholder="Izoh (ixtiyoriy)"
              className="bg-zinc-800 border border-zinc-700 p-2 rounded text-white text-sm" />

            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => setModalOchiq(false)} disabled={saqlanmoqda}
                className="px-4 py-1.5 rounded border border-zinc-700 text-zinc-400 text-sm disabled:opacity-40">
                Bekor qilish
              </button>
              <button onClick={saqlash} disabled={saqlanmoqda}
                className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-40">
                {saqlanmoqda ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
