import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardList, Plus, Search, Building2, Calendar, AlertTriangle, Send, Warehouse, Trash2, CheckCircle2, Clock, XCircle, Edit, FileText } from 'lucide-react';
import { useKompaniya } from './KompaniyaTanlov';
import { toast } from '../umumiy/ui/Toast';
import { sbZayavkalarOl, sbZayavkaYoz, sbZayavkaHolatYoz, type T2Zayavka, type ZayavkaHolat } from '../api/t2-zayavka';
import { yozAmali } from '../api/supabase';
import { sbT2ObyektlarOlKomp, type T2Obyekt } from '../api/supabase';
import { Sahifa } from '../umumiy/ui/Sahifa';
import { FmtN } from '../lib/format';
import { motion, AnimatePresence } from 'framer-motion';

const HOLAT_RANG: Record<ZayavkaHolat, string> = {
  draft: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  submitted: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  approved: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  procurement: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  ordered: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  partially_delivered: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  delivered: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  closed: 'bg-zinc-800 text-zinc-500 border-zinc-700/50',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const HOLAT_NOM: Record<ZayavkaHolat, string> = {
  draft: 'Qoralama (Draft)',
  submitted: 'Yuborildi (Submitted)',
  approved: 'Tasdiqlandi (Approved)',
  procurement: 'Ta\'minotda (Procurement)',
  ordered: 'Buyurtma berildi (Ordered)',
  partially_delivered: 'Qisman yetkazildi',
  delivered: 'Yetkazildi (Delivered)',
  closed: 'Yopildi (Closed)',
  cancelled: 'Bekor qilindi',
};

export default function TestZayavka() {
  const { joriy } = useKompaniya();
  const [params] = useSearchParams();
  const initialObyekt = params.get('obyekt') || '';
  const initYarat = params.get('yarat') === '1';

  const [zayavkalar, setZayavkalar] = useState<T2Zayavka[]>([]);
  const [obyektlar, setObyektlar] = useState<T2Obyekt[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(initYarat);
  const [formObyektId, setFormObyektId] = useState('');
  const [formMaxsulot, setFormMaxsulot] = useState('');
  const [formMiqdor, setFormMiqdor] = useState('');
  const [formBirlik, setFormBirlik] = useState('metr');
  const [formBuyurtma, setFormBuyurtma] = useState('');
  const [formSana, setFormSana] = useState('');
  const [formMuhimlik, setFormMuhimlik] = useState('orta');
  const [formIzoh, setFormIzoh] = useState('');

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

  useEffect(() => {
    if (!initialObyekt) {
      setFormObyektId('');
      return;
    }
    const obyekt = obyektlar.find((o) =>
      String(o.id) === initialObyekt || o.nom === initialObyekt,
    );
    setFormObyektId(obyekt ? String(obyekt.id) : '');
  }, [initialObyekt, obyektlar]);

  const handleYuborish = async () => {
    if (!joriy) return;
    if (!formObyektId || !formMaxsulot || !formMiqdor) {
      toast("Obyekt, maxsulot va miqdorni kiriting", "warn");
      return;
    }
    
    setYuklanmoqda(true);
    try {
      const natija = await sbZayavkaYoz(joriy.id, {
        obyektId: parseInt(formObyektId),
        itemText: formMaxsulot,
        requestedQty: parseFloat(formMiqdor),
        unit: formBirlik,
        requiredDate: formSana,
        priority: formMuhimlik,
        note: formIzoh
      });

      if (!natija.ok) throw new Error(natija.error || "Xato yuz berdi");

      toast("Zayavka muvaffaqiyatli yaratildi!", "ok");
      setIsModalOpen(false);
      setFormMaxsulot('');
      setFormMiqdor('');
      setFormBuyurtma('');
      setFormSana('');
      setFormIzoh('');
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
      const request = zayavkalar.find((item) => item.id === id);
      if (!request) throw new Error("Zayavka topilmadi");
      const natija = await sbZayavkaHolatYoz(joriy.id, request, yHolat);
      if (!natija.ok) throw new Error(natija.error || "Xato yuz berdi");
      toast("Holat o'zgardi: " + HOLAT_NOM[yHolat], "ok");
      yukla();
    } catch (err: any) {
      toast(err.message, "danger");
    } finally {
      setAmalId(null);
    }
  };

  const sanaKorsat = (sana?: string | null) => {
    if (!sana) return '�';
    return new Date(sana).toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const hisoblaYosh = (sanaS: string) => {
    const d1 = new Date(sanaS).getTime();
    const d2 = new Date().getTime();
    const diff = (d2 - d1) / (1000 * 3600 * 24);
    if (diff < 1) return '< 1 kun';
    return Math.floor(diff) + ' kun';
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
                <th className="px-4 py-3 font-medium">� / Yosh</th>
                <th className="px-4 py-3 font-medium">Obyekt / Sana</th>
                <th className="px-4 py-3 font-medium">Maxsulot</th>
                <th className="px-4 py-3 font-medium text-right">So'ralgan</th>
                <th className="px-4 py-3 font-medium text-right">Yetkazilgan</th>
                <th className="px-4 py-3 font-medium text-right">Qolgan</th>
                <th className="px-4 py-3 font-medium">Holat</th>
                <th className="px-4 py-3 font-medium text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white">
              {zayavkalar.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-zinc-500">
                    Hozircha zayavkalar yo'q.
                  </td>
                </tr>
              ) : (
                zayavkalar.map((z) => {
                  const yetkazildi = z.deliveredQty || 0;
                  const qoldi = z.remainingQty ?? Math.max(z.requestedQty - yetkazildi, 0);

                  return (
                  <tr key={z.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-zinc-400">{"#" + z.id}</div>
                      <div className="text-[10px] text-zinc-500 mt-1">{hisoblaYosh(z.createdAt || '')}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium flex items-center gap-1">
                        <Building2 size={12} className="text-indigo-400" />
                        {obyektlar.find((o) => o.id === z.obyektId)?.nom || "Noma'lum"}
                      </div>
                      <div className="text-[10px] text-zinc-400 flex gap-1 items-center mt-1">
                        <Calendar size={10} /> Kutilmoqda: {z.requiredDate || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sky-300 font-medium">{z.itemText}</div>
                      {z.note && <div className="text-[10px] text-zinc-500 mt-1 line-clamp-1">{z.note}</div>}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-amber-400">
                      <FmtN val={z.requestedQty} /> <span className="text-[10px]">{z.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-400">
                      <FmtN val={yetkazildi} /> <span className="text-[10px]">{z.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-rose-400">
                      <FmtN val={qoldi > 0 ? qoldi : 0} /> <span className="text-[10px]">{z.unit}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={"inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-medium " + (HOLAT_RANG[z.status] || '')}>
                        {HOLAT_NOM[z.status] || z.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {amalId === z.id ? (
                        <span className="text-zinc-500 text-xs animate-pulse">Kuting...</span>
                      ) : (
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          {z.status === 'draft' && (
                            <button onClick={() => holatOzgartir(z.id, 'submitted')} className="px-2 py-1 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 rounded text-[10px] transition-colors" title="Yuborish">Yuborish</button>
                          )}
                          {z.status === 'submitted' && (
                            <button onClick={() => holatOzgartir(z.id, 'approved')} className="px-2 py-1 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 rounded text-[10px] transition-colors" title="Tasdiqlash">Tasdiqlash</button>
                          )}
                          {z.status === 'approved' && (
                            <button onClick={() => holatOzgartir(z.id, 'procurement')} className="px-2 py-1 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 rounded text-[10px] transition-colors" title="Ta'minotga berish">Ta'minotga</button>
                          )}
                          {z.status === 'procurement' && (
                            <button onClick={() => holatOzgartir(z.id, 'ordered')} className="px-2 py-1 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 rounded text-[10px] transition-colors" title="Buyurtma berish">Buyurtma</button>
                          )}
                          {(z.status === 'ordered' || z.status === 'partially_delivered') && (
                            <button onClick={() => holatOzgartir(z.id, 'delivered')} className="px-2 py-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded text-[10px] transition-colors" title="Yetkazildi deb belgilash">Yetkazildi</button>
                          )}
                          {z.status === 'delivered' && (
                            <button onClick={() => holatOzgartir(z.id, 'closed')} className="px-2 py-1 bg-zinc-700/50 text-zinc-300 hover:bg-zinc-700 rounded text-[10px] transition-colors" title="Yopish">Yopish</button>
                          )}
                          {(z.status === 'draft' || z.status === 'submitted') && (
                            <button onClick={() => holatOzgartir(z.id, 'cancelled')} className="px-2 py-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded text-[10px] transition-colors" title="Bekor qilish">Bekor qilish</button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )}))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
            
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-[#0f172a] border border-white/10 p-6 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
              <h3 className="font-bold text-lg mb-4 text-white flex items-center gap-2">
                <ClipboardList className="text-indigo-400" /> Yangi Zayavka
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Obyekt *</label>
                  <select value={formObyektId} onChange={e => setFormObyektId(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-xl p-2 text-sm text-white focus:border-indigo-500 outline-none">
                    <option value="">-- Tanlang --</option>
                    {obyektlar.map(o => (
                      <option key={o.id} value={o.id}>{o.nom}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Material / Xizmat nomi *</label>
                  <input type="text" value={formMaxsulot} onChange={e => setFormMaxsulot(e.target.value)} placeholder="M400 Beton" className="w-full bg-black/30 border border-white/10 rounded-xl p-2 text-sm text-white focus:border-indigo-500 outline-none" />
                </div>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-zinc-400 mb-1">Miqdor *</label>
                    <input type="number" min="0" step="any" value={formMiqdor} onChange={e => setFormMiqdor(e.target.value)} placeholder="0.00" className="w-full bg-black/30 border border-white/10 rounded-xl p-2 text-sm text-white focus:border-indigo-500 outline-none" />
                  </div>
                  <div className="w-1/3">
                    <label className="block text-xs text-zinc-400 mb-1">Birlik</label>
                    <input type="text" value={formBirlik} onChange={e => setFormBirlik(e.target.value)} placeholder="tonna, m3" className="w-full bg-black/30 border border-white/10 rounded-xl p-2 text-sm text-white focus:border-indigo-500 outline-none" />
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-zinc-400 mb-1">Qachonga kerak?</label>
                    <input type="date" value={formSana} onChange={e => setFormSana(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-xl p-2 text-sm text-white focus:border-indigo-500 outline-none" />
                  </div>
                  <div className="w-1/3">
                    <label className="block text-xs text-zinc-400 mb-1">Muhimlik</label>
                    <select value={formMuhimlik} onChange={e => setFormMuhimlik(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-xl p-2 text-sm text-white focus:border-indigo-500 outline-none">
                      <option value="past">Past</option>
                      <option value="orta">O'rta</option>
                      <option value="yuqori">Yuqori</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Izoh</label>
                  <textarea value={formIzoh} onChange={e => setFormIzoh(e.target.value)} rows={2} placeholder="Qo'shimcha ma'lumotlar..." className="w-full bg-black/30 border border-white/10 rounded-xl p-2 text-sm text-white focus:border-indigo-500 outline-none"></textarea>
                </div>
              </div>

              <div className="flex gap-3 justify-end mt-6 pt-5 border-t border-white/10">
                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-400 hover:bg-white/5 transition-colors">Bekor qilish</button>
                <button onClick={handleYuborish} disabled={yuklanmoqda} className="px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition-colors flex items-center gap-2">
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
