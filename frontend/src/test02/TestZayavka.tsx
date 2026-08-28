import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardList, Plus, Search, Building2, Calendar, AlertTriangle, Send, Warehouse, Trash2, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useKompaniya } from './KompaniyaTanlov';
import { toast } from '../umumiy/ui/Toast';
import { sbZayavkalarOl, type T2Zayavka, type ZayavkaHolat } from '../api/t2-zayavka';
import { yozAmali } from '../api/supabase';
import { sbT2ObyektlarOlKomp, type T2Obyekt } from '../api/supabase';
import { Sahifa } from '../umumiy/ui/Sahifa';
import { FmtN } from '../lib/format';
import { motion, AnimatePresence } from 'framer-motion';

const HOLAT_RANG: Record<ZayavkaHolat, string> = {
  kutilmoqda: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  tasdiqlandi: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  yopildi: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  rad: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const HOLAT_NOM: Record<ZayavkaHolat, string> = {
  kutilmoqda: 'Kutilmoqda',
  tasdiqlandi: 'Tasdiqlandi (Birjada)',
  yopildi: 'Yopildi (Berildi)',
  rad: 'Rad etildi',
};

export default function TestZayavka() {
  const { joriy } = useKompaniya();
  const [params] = useSearchParams();
  const initialObyekt = params.get('obyekt') || '';

  const [zayavkalar, setZayavkalar] = useState<T2Zayavka[]>([]);
  const [obyektlar, setObyektlar] = useState<T2Obyekt[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formObyektId, setFormObyektId] = useState<string>(initialObyekt);
  const [formMaxsulot, setFormMaxsulot] = useState('');
  const [formMiqdor, setFormMiqdor] = useState('');
  const [formBirlik, setFormBirlik] = useState('metr');
  const [formBuyurtma, setFormBuyurtma] = useState('');

  const [amalId, setAmalId] = useState<number | null>(null);

  const yukla = async () => {
    if (!joriy) return;
    setYuklanmoqda(true);
    
    try {
      const [zRes, oRes] = await Promise.all([
        sbZayavkalarOl(joriy.id),
        sbT2ObyektlarOlKomp(joriy.id)
      ]);
      
      if (zRes.error) throw new Error(zRes.error);
      if (oRes.error) throw new Error(oRes.error);
      
      setZayavkalar(zRes.qatorlar || []);
      setObyektlar(oRes.qatorlar || []);
    } catch (err: any) {
      toast(err.message, "danger");
    } finally {
      setYuklanmoqda(false);
    }
  };

  useEffect(() => {
    yukla();
  }, [joriy]);

  const handleYuborish = async () => {
    if (!joriy) return;
    if (!formMaxsulot || !formMiqdor) {
      toast("Maxsulot va miqdorni kiriting", "warn");
      return;
    }
    
    setYuklanmoqda(true);
    try {
      const payload = {
        obyekt_id: formObyektId ? parseInt(formObyektId) : null,
        maxsulot: formMaxsulot,
        miqdor: parseFloat(formMiqdor),
        birlik: formBirlik,
        buyurtma_raqami: formBuyurtma
      };

      const natija = await yozAmali({
        amal: 'erp_amal',
        kompaniya_id: joriy.id,
        operatsiya: 'zayavka_yarat',
        payload
      });

      if (!natija.ok) throw new Error(natija.error || "Xato yuz berdi");

      toast("Zayavka muvaffaqiyatli yaratildi!", "ok");
      setIsModalOpen(false);
      setFormMaxsulot('');
      setFormMiqdor('');
      setFormBuyurtma('');
      yukla();
    } catch (err: any) {
      toast(err.message, "danger");
    } finally {
      setYuklanmoqda(false);
    }
  };

  const holatOzgartir = async (id: number, yHolat: ZayavkaHolat) => {
    if (!joriy) return;
    setAmalId(id);
    try {
      const natija = await yozAmali({
        amal: 'erp_amal',
        kompaniya_id: joriy.id,
        operatsiya: 'zayavka_holat',
        payload: { id, holat: yHolat }
      });
      if (!natija.ok) throw new Error(natija.error || "Xato yuz berdi");
      toast(`Holat o'zgardi: ${HOLAT_NOM[yHolat]}`, "ok");
      yukla();
    } catch (err: any) {
      toast(err.message, "danger");
    } finally {
      setAmalId(null);
    }
  };

  const zayavkaOchir = async (id: number) => {
    if (!joriy) return;
    if (!confirm("Haqiqatan ham rad etasizmi? (O'chiriladi)")) return;
    
    setAmalId(id);
    try {
      const natija = await yozAmali({
        amal: 'erp_amal',
        kompaniya_id: joriy.id,
        operatsiya: 'zayavka_ochir',
        payload: { id }
      });
      if (!natija.ok) throw new Error(natija.error || "Xato yuz berdi");
      toast("Zayavka rad etildi", "ok");
      yukla();
    } catch (err: any) {
      toast(err.message, "danger");
    } finally {
      setAmalId(null);
    }
  };

  const sanaKorsat = (sana: string) => {
    return new Date(sana).toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Sahifa sarlavha="Zayavkalar (Ta'minot talabnomasi)">
      
      <div className="flex justify-between items-center mb-6">
        <p className="text-zinc-400 text-sm">Obyektlardan kelgan barcha ta'minot talabnomalari ro'yxati.</p>
        <div className="flex gap-2">
          <button onClick={yukla} disabled={yuklanmoqda} className="px-4 py-2 border border-white/10 rounded-xl text-sm font-medium hover:bg-white/5 transition-colors text-white">
            Yangilash
          </button>
          <button onClick={() => setIsModalOpen(true)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-medium text-white transition-colors flex items-center gap-2 shadow-[0_0_15px_rgba(79,70,229,0.3)]">
            <Plus size={16} /> Yangi Zayavka
          </button>
        </div>
      </div>

      <div className="bg-[#0a0f1d] border border-white/10 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white/5 text-zinc-400 border-b border-white/10">
              <tr>
                <th className="px-4 py-3 font-medium">№</th>
                <th className="px-4 py-3 font-medium">Sana</th>
                <th className="px-4 py-3 font-medium">Obyekt</th>
                <th className="px-4 py-3 font-medium">Maxsulot</th>
                <th className="px-4 py-3 font-medium text-right">Miqdor</th>
                <th className="px-4 py-3 font-medium">Holat</th>
                <th className="px-4 py-3 font-medium text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white">
              {zayavkalar.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                    Hozircha zayavkalar yo'q.
                  </td>
                </tr>
              ) : (
                zayavkalar.map((z) => (
                  <tr key={z.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                      {z.buyurtma_raqami || `#${z.id}`}
                    </td>
                    <td className="px-4 py-3 text-zinc-300 text-xs">
                      {sanaKorsat(z.yaratilgan_vaqt)}
                    </td>
                    <td className="px-4 py-3 font-medium flex items-center gap-2">
                      <Building2 size={14} className="text-indigo-400" />
                      {z.obyekt_nomi || "Noma'lum"}
                    </td>
                    <td className="px-4 py-3 text-sky-300 font-medium">
                      {z.maxsulot}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-400">
                      <FmtN val={z.miqdor} /> {z.birlik}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${HOLAT_RANG[z.holat]}`}>
                        {z.holat === 'kutilmoqda' && <Clock size={12} />}
                        {z.holat === 'tasdiqlandi' && <Send size={12} />}
                        {z.holat === 'yopildi' && <CheckCircle2 size={12} />}
                        {z.holat === 'rad' && <XCircle size={12} />}
                        {HOLAT_NOM[z.holat]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {amalId === z.id ? (
                        <span className="text-zinc-500 text-xs animate-pulse">Kuting...</span>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          {z.holat === 'kutilmoqda' && (
                            <>
                              <button onClick={() => holatOzgartir(z.id, 'tasdiqlandi')} className="px-2 py-1.5 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 rounded-lg text-xs font-medium transition-colors" title="Birjaga yuborish (Tasdiqlash)">
                                <Send size={14} />
                              </button>
                              <button onClick={() => zayavkaOchir(z.id)} className="px-2 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-xs font-medium transition-colors" title="Rad etish (O'chirish)">
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                          {z.holat === 'tasdiqlandi' && (
                            <button onClick={() => holatOzgartir(z.id, 'yopildi')} className="px-2 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg text-xs font-medium transition-colors flex items-center gap-1" title="Skladdan berildi (Yopish)">
                              <Warehouse size={14} /> Berildi
                            </button>
                          )}
                          {(z.holat === 'yopildi' || z.holat === 'rad') && (
                            <span className="text-zinc-600 text-xs">—</span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
            
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-[#0f172a] border border-white/10 p-6 rounded-2xl w-full max-w-md shadow-2xl flex flex-col">
              <h3 className="font-bold text-lg mb-4 text-white flex items-center gap-2">
                <ClipboardList className="text-indigo-400" /> Yangi Zayavka Yaratish
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Obyekt (Majburiy emas) *</label>
                  <select value={formObyektId} onChange={e => setFormObyektId(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-indigo-500 outline-none transition-colors">
                    <option value="">-- Obyektni tanlang --</option>
                    {obyektlar.map(o => (
                      <option key={o.id} value={o.id}>{o.nom}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Material yoki Xizmat nomi *</label>
                  <input type="text" value={formMaxsulot} onChange={e => setFormMaxsulot(e.target.value)} placeholder="Masalan: M400 Beton, 90 metr parapet" className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-indigo-500 outline-none transition-colors" />
                </div>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-zinc-400 mb-1">Miqdor *</label>
                    <input type="number" min="0" step="any" value={formMiqdor} onChange={e => setFormMiqdor(e.target.value)} placeholder="0.00" className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-indigo-500 outline-none transition-colors" />
                  </div>
                  <div className="w-1/3">
                    <label className="block text-xs text-zinc-400 mb-1">O'lchov birligi</label>
                    <input type="text" value={formBirlik} onChange={e => setFormBirlik(e.target.value)} placeholder="tonna, m3, dona" className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-indigo-500 outline-none transition-colors" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Buyurtma Raqami (Majburiy emas)</label>
                  <input type="text" value={formBuyurtma} onChange={e => setFormBuyurtma(e.target.value)} placeholder="Avtomat generatsiya qilinadi" className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm text-zinc-500 focus:border-indigo-500 outline-none transition-colors" disabled />
                </div>
              </div>

              <div className="flex gap-3 justify-end mt-6 pt-5 border-t border-white/10">
                <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:bg-white/5 transition-colors">Bekor qilish</button>
                <button onClick={handleYuborish} disabled={yuklanmoqda} className="px-5 py-2.5 rounded-xl text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/30 flex items-center gap-2">
                  {yuklanmoqda ? 'Yuborilmoqda...' : <><Send size={16} /> Yuborish</>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Sahifa>
  );
}
