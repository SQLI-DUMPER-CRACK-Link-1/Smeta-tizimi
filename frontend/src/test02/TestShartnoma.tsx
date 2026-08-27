import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { sbT2ShartnomalarOl, sbT2ShartnomaSaqla, type Shartnoma } from '../api/t2-shartnoma';
import { Briefcase, Plus, FileSignature, AlertCircle, Search, FileText, CheckCircle2, Calculator, PieChart, RefreshCw, Save, X } from 'lucide-react';
import { FmtN } from '../lib/format';
import { toast } from '../umumiy/ui/Toast';
import { useKompaniya } from './KompaniyaTanlov';

export default function TestShartnoma() {
  const { joriy } = useKompaniya();
  const [params] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'shartnomalar' | 'dop' | 'kalkulyator' | 'radar'>('shartnomalar');
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [saqlamoqda, setSaqlamoqda] = useState(false);
  const [shartnomalar, setShartnomalar] = useState<Shartnoma[]>([]);

  // Yangi shartnoma form
  const [formData, setFormData] = useState({
    raqam: '',
    nom: '',
    taraf: '',
    summa_bez_nds: '',
    nds: '12',
    izoh: ''
  });

  const yukla = async () => {
    if (!joriy) return;
    setYuklanmoqda(true);
    try {
      const res = await sbT2ShartnomalarOl(false); // hammasini oqiymiz
      // Faqat shu kompaniyanikini filtrlaymiz garchi DB da qilingan bo'lsa ham ishonch uchun
      setShartnomalar((res.qatorlar || []).filter((s: Shartnoma) => s.kompaniya_id === joriy.id));
    } catch (e: any) {
      toast(e.message, 'danger');
    } finally {
      setYuklanmoqda(false);
    }
  };

  useEffect(() => {
    yukla();
  }, [joriy]);

  const handleSaqlash = async () => {
    if (!formData.raqam || !formData.nom) return toast("Raqam va nomni kiriting!", "warn");

    setSaqlamoqda(true);
    try {
      const sum = Number(formData.summa_bez_nds) || 0;
      const ndsFoiz = Number(formData.nds) || 0;
      const ndsSumma = (sum * ndsFoiz) / 100;
      const jami = sum + ndsSumma;

      const res = await sbT2ShartnomaSaqla({
        raqam: formData.raqam,
        nom: formData.nom,
        taraf: formData.taraf,
        summaBezNds: sum,
        nds: ndsSumma,
        jamiNdsBilan: jami,
        izoh: formData.izoh
      });

      if (!res.ok) throw new Error(res.error || "Noma'lum xato");

      toast("Shartnoma muvaffaqiyatli saqlandi!", "ok");
      setIsFormOpen(false);
      setFormData({ raqam: '', nom: '', taraf: '', summa_bez_nds: '', nds: '12', izoh: '' });
      yukla();
    } catch (e: any) {
      toast(e.message, "danger");
    } finally {
      setSaqlamoqda(false);
    }
  };

  // Hisoblashlar
  const stats = shartnomalar.reduce((acc, s) => {
    acc.jami += Number(s.jami_nds_bilan) || 0;
    if (s.holat === 'faol' || s.holat === 'yopilgan') {
      // Daromad va xarajatni farqlash qiyin "taraf" orqali, hozircha faol/yopilganini daromad deymiz demo uchun
      acc.bosh += Number(s.jami_nds_bilan) || 0;
    }
    return acc;
  }, { jami: 0, bosh: 0, sub: 0, ret: 0 });

  return (
    <div className="p-6 bg-bg min-h-screen text-text overflow-y-auto">
      
      {/* HEADER */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-2">
            <FileSignature className="text-purple-400" />
            Polimorfik Shartnomalar (B2B Kontraktlar)
          </h1>
          <p className="text-text-dim text-sm max-w-2xl">
            Bosh pudrat, sub-pudrat, va xarid shartnomalarining markazlashgan reestri. Qo'shimcha kelishuvlar (Dop. Soglasheniye), ustamalar va bo'nak (avans) nazorati.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={yukla} className="p-2.5 bg-surface border border-border rounded-lg text-text hover:text-white transition-colors">
            <RefreshCw size={18} className={yuklanmoqda ? "animate-spin" : ""} />
          </button>
          <button 
            onClick={() => setIsFormOpen(true)}
            className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-lg shadow-purple-900/20"
          >
            <Plus size={18} />
            Yangi Shartnoma
          </button>
        </div>
      </div>

      {/* KPI WIDGETS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface border border-border p-5 rounded-xl">
          <h3 className="text-sm font-medium text-text-dim mb-1">Jami Shartnomalar (Portfolio)</h3>
          <p className="text-2xl font-bold font-mono text-white"><FmtN val={stats.jami} /> <span className="text-sm text-text-dim font-sans">UZS</span></p>
        </div>
        <div className="bg-gradient-to-br from-emerald-900/20 to-emerald-900/5 border border-emerald-500/20 p-5 rounded-xl">
          <h3 className="text-sm font-medium text-emerald-400 mb-1">Bosh Pudrat (Daromad)</h3>
          <p className="text-2xl font-bold font-mono text-white"><FmtN val={stats.bosh} /> <span className="text-sm text-text-dim font-sans">UZS</span></p>
        </div>
        <div className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-xl opacity-50">
          <h3 className="text-sm font-medium text-rose-400 mb-1">Sub-Pudrat / Xarid</h3>
          <p className="text-2xl font-bold font-mono text-white">0 <span className="text-sm text-text-dim font-sans">UZS</span></p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-xl opacity-50">
          <h3 className="text-sm font-medium text-amber-400 mb-1">Kafolat Depoziti (Retention)</h3>
          <p className="text-2xl font-bold font-mono text-white">0 <span className="text-sm text-text-dim font-sans">UZS</span></p>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-1 bg-surface border border-border p-1 rounded-lg w-max mb-6">
        {[
          { id: 'shartnomalar', label: 'Bosh Shartnomalar', icon: Briefcase },
          { id: 'dop', label: 'Qo\'shimcha Kelishuvlar (Dop)', icon: FileText },
          { id: 'kalkulyator', label: 'Ustama va Soliqlar', icon: Calculator },
          { id: 'radar', label: 'Limitlar Radari', icon: PieChart }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-bg text-white shadow-sm border border-border' : 'text-text-dim hover:text-white hover:bg-surface-2'}`}
          >
            <tab.icon size={16} className={activeTab === tab.id ? 'text-purple-400' : ''} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* WRITE FORM MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-5 border-b border-border flex justify-between items-center bg-bg/50">
              <h3 className="font-bold text-white flex items-center gap-2">
                <FileSignature className="text-purple-400"/>
                Yangi Shartnomani Ro'yxatga Olish
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-text-dim hover:text-white"><X size={20}/></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-dim mb-1">Shartnoma Raqami (№)</label>
                  <input 
                    type="text" 
                    value={formData.raqam}
                    onChange={e => setFormData({...formData, raqam: e.target.value})}
                    placeholder="masalan: 24/01"
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white focus:border-purple-500 outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-dim mb-1">Kontragent (2-Taraf)</label>
                  <input 
                    type="text" 
                    value={formData.taraf}
                    onChange={e => setFormData({...formData, taraf: e.target.value})}
                    placeholder="Kompaniya nomi..." 
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white focus:border-purple-500 outline-none" 
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-dim mb-1">Shartnoma Nomi (Predmeti)</label>
                <input 
                  type="text" 
                  value={formData.nom}
                  onChange={e => setFormData({...formData, nom: e.target.value})}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white focus:border-purple-500 outline-none" 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
                <div>
                  <label className="block text-sm font-medium text-text-dim mb-1">Summa QQS siz (UZS)</label>
                  <input 
                    type="number" 
                    value={formData.summa_bez_nds}
                    onChange={e => setFormData({...formData, summa_bez_nds: e.target.value})}
                    placeholder="0.00" 
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white font-mono focus:border-purple-500 outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-dim mb-1">QQS Toifasi</label>
                  <select 
                    value={formData.nds}
                    onChange={e => setFormData({...formData, nds: e.target.value})}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white focus:border-purple-500 outline-none appearance-none"
                  >
                    <option value="12">QQS (12%) bilan</option>
                    <option value="0">QQS siz (0%)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-dim mb-1">Izoh</label>
                <input 
                  type="text" 
                  value={formData.izoh}
                  onChange={e => setFormData({...formData, izoh: e.target.value})}
                  placeholder="Ixtiyoriy izoh..." 
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white focus:border-purple-500 outline-none" 
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-border mt-4">
                <button onClick={() => setIsFormOpen(false)} className="px-4 py-2 text-text-dim hover:text-white transition-colors">Bekor qilish</button>
                <button 
                  onClick={handleSaqlash} 
                  disabled={saqlamoqda}
                  className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-lg shadow-purple-900/20"
                >
                  {saqlamoqda ? <RefreshCw className="animate-spin" size={18}/> : <Save size={18}/>}
                  Saqlash
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTENT: SHARTNOMALAR */}
      {activeTab === 'shartnomalar' && (
        <div className="bg-surface border border-border rounded-xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-border bg-bg/50">
            <div className="relative w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" size={16} />
              <input 
                type="text" 
                placeholder="Raqam, nom yoki kontragent bo'yicha..."
                className="w-full bg-surface border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-accent outline-none"
              />
            </div>
          </div>
          
          {shartnomalar.length === 0 && !yuklanmoqda ? (
            <div className="p-8 text-center text-text-dim">
              Hech qanday shartnoma topilmadi.
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-surface-2 border-b border-border text-text-dim font-medium">
                  <th className="px-6 py-4">Shartnoma №</th>
                  <th className="px-6 py-4">Nomlanishi va Predmeti</th>
                  <th className="px-6 py-4">Kontragent (2-taraf)</th>
                  <th className="px-6 py-4 text-right">Summa (UZS)</th>
                  <th className="px-6 py-4 text-center">Holat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shartnomalar.map(s => (
                  <tr key={s.id} className="hover:bg-bg/50 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-purple-400">
                      № {s.raqam}
                      <br/><span className="text-[10px] text-text-dim font-sans">{new Date(s.yaratildi).toLocaleDateString('uz-UZ')}</span>
                    </td>
                    <td className="px-6 py-4 font-bold text-white">
                      {s.nom}
                      {s.izoh && <div className="text-xs text-text-dim font-normal mt-1">{s.izoh}</div>}
                    </td>
                    <td className="px-6 py-4 text-text-dim">{s.taraf || '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="font-mono font-bold text-white"><FmtN val={s.jami_nds_bilan || 0} /></div>
                      {(s.nds || 0) > 0 ? (
                        <span className="text-[10px] text-emerald-400 font-bold">QQS (12%) bilan</span>
                      ) : (
                        <span className="text-[10px] text-amber-400 font-bold">QQS siz (0%)</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {s.holat === 'faol' ? (
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1"><CheckCircle2 size={12}/> Faol</span>
                      ) : (
                        <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1"><AlertCircle size={12}/> {s.holat}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* CONTENT: DOP SOGLASHENIYE */}
      {activeTab === 'dop' && (
        <div className="bg-surface border border-border rounded-xl p-12 text-center shadow-xl">
          <div className="w-20 h-20 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-purple-500/20">
            <FileText size={32} className="text-purple-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-3">Qo'shimcha Kelishuvlar Reestri</h2>
          <p className="text-text-dim max-w-lg mx-auto mb-8">
            Asosiy shartnomaga qilingan barcha qo'shimcha kelishuvlar (Dop. Soglasheniyalar) ushbu modulda markazlashgan tarzda yuritiladi va asosiy summa bilan avtomatik jamlanadi.
          </p>
        </div>
      )}
    </div>
  );
}
