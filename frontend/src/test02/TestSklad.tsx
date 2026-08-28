import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, ArrowDownToLine, ArrowUpFromLine, RefreshCcw, Search, Barcode, ClipboardCheck, QrCode, Building2, PackageOpen, AlertTriangle } from 'lucide-react';
import { useKompaniya } from './KompaniyaTanlov';
import { FmtN } from '../lib/format';
import { toast } from '../umumiy/ui/Toast';
import { sbT2ObyektlarOl, sbSkladQoldiqOl, sbSkladgaYozish, yangiOperationId, type T2Obyekt, type T2SkladQoldiq } from '../api/supabase';
import { sbSkladlarOl } from '../api/t2-resurs';
import { sbSkladKonsolidatsiyaOl, type SkladKonsolidatsiya } from '../api/t2-sklad-konsolidatsiya';

export default function TestSklad() {
  const [params] = useSearchParams();
  const { joriy } = useKompaniya();
  const aktKomp = joriy?.id ?? 0;
  
  const [activeTab, setActiveTab] = useState<'qoldiq' | 'kirim' | 'chiqim' | 'm29' | 'konsolidatsiya'>('konsolidatsiya');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [opType, setOpType] = useState<'kirim'|'chiqim'>('kirim');

  const [obyektlar, setObyektlar] = useState<T2Obyekt[]>([]);
  const [obyektId, setObyektId] = useState<number | null>(null);
  
  const [skladQoldiq, setSkladQoldiq] = useState<T2SkladQoldiq[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');

  // Konsolidatsiya State
  const [markaziySkladlar, setMarkaziySkladlar] = useState<any[]>([]);
  const [markaziyId, setMarkaziyId] = useState<number | null>(null);
  const [konsQoldiqlar, setKonsQoldiqlar] = useState<SkladKonsolidatsiya[]>([]);


  // Form State
  const [formNomi, setFormNomi] = useState('');
  const [formHajmi, setFormHajmi] = useState('');
  const [formBirligi, setFormBirligi] = useState('dona');

  useEffect(() => {
    sbT2ObyektlarOl().then(r => {
      if (r.ok && r.qatorlar) {
        setObyektlar(r.qatorlar);
        if (r.qatorlar.length > 0 && !obyektId) {
          setObyektId(r.qatorlar[0].id);
        }
      }
    });
    if (aktKomp) {
      sbSkladlarOl(aktKomp).then(r => {
        if (r.ok && r.qatorlar) {
          setMarkaziySkladlar(r.qatorlar);
          if (r.qatorlar.length > 0 && !markaziyId) {
            setMarkaziyId(r.qatorlar[0].id);
          }
        }
      });
    }
  }, [aktKomp]);

  // Yuklash logika: Agar konsolidatsiya tanlangan bo'lsa, konsolidatsiya yuklaymiz
  useEffect(() => {
    if (activeTab === 'konsolidatsiya' && markaziyId) {
      setYuklanmoqda(true);
      sbSkladKonsolidatsiyaOl(markaziyId).then(r => {
        if (r.ok && r.qatorlar) setKonsQoldiqlar(r.qatorlar as SkladKonsolidatsiya[]);
        setYuklanmoqda(false);
      });
    }
  }, [activeTab, markaziyId]);


  const qoldiqYukla = () => {
    if (!obyektId) return;
    setYuklanmoqda(true);
    sbSkladQoldiqOl(obyektId).then(r => {
      setYuklanmoqda(false);
      if (r.ok && r.qatorlar) {
        setSkladQoldiq(r.qatorlar);
      } else {
        setSkladQoldiq([]);
      }
    });
  };

  useEffect(() => {
    qoldiqYukla();
  }, [obyektId]);

  const handleSave = async () => {
    if (!obyektId || !formNomi || !formHajmi || !formBirligi) {
      toast("Barcha maydonlarni to'ldiring", "warn");
      return;
    }
    
    setYuklanmoqda(true);
    const operatsiya = opType === 'kirim' ? 'prixod' : 'rasxod';
    const res = await sbSkladgaYozish(aktKomp, operatsiya, {
      obyekt_id: obyektId,
      operatsiya: operatsiya,
      turi: 'mat',
      sana: new Date().toISOString().split('T')[0],
      nomi: formNomi,
      birligi: formBirligi,
      obyomi: Number(formHajmi)
    });
    
    setYuklanmoqda(false);
    
    if (res.ok) {
      toast(`Omborga ${opType} amaliyoti Ledgerga yozildi!`, "ok");
      setIsFormOpen(false);
      setFormNomi('');
      setFormHajmi('');
      qoldiqYukla();
    } else {
      toast(`Xato yuz berdi: ${res.error}`, "danger");
    }
  };

  const filteredQoldiq = skladQoldiq.filter(item => item.nomi.toLowerCase().includes(searchTerm.toLowerCase()));
  const totalSum = filteredQoldiq.reduce((acc, curr) => acc + (curr.qoldiq || 0), 0); // Warning: we don't have price in qoldiq yet, so this sum is just qty right now.

  return (
    <div className="p-6 bg-transparent min-h-screen text-text h-full overflow-y-auto">
      
      {/* HEADER */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-2 text-white">
            <PackageOpen className="text-amber-500" />
            Ombor (WMS) va Tranzaksion Ledger
          </h1>
          <p className="text-text-dim text-sm max-w-2xl">
            Materiallar qoldig'i, Kirim/Chiqim tranzaksiyalari, QR-kodli sifat pasportlari va oylik M-29 hisobotini yuritish tizimi.
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="flex items-center gap-2 bg-[var(--surface-1)] border border-border p-1.5 rounded-lg mr-4">
            <Building2 className="text-zinc-400 ml-2" size={18} />
            <select 
              className="bg-transparent text-sm text-white font-medium outline-none pr-4 cursor-pointer"
              value={obyektId || ''}
              onChange={(e) => setObyektId(Number(e.target.value))}
            >
              {obyektlar.map(o => (
                <option key={o.id} value={o.id} className="bg-zinc-900">{o.nom}</option>
              ))}
            </select>
          </div>

          <button 
            onClick={() => { setOpType('chiqim'); setIsFormOpen(true); }}
            className="bg-surface border border-border hover:bg-surface-2 text-rose-400 px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            <ArrowUpFromLine size={18} />
            Chiqim (Rasxod)
          </button>
          <button 
            onClick={() => { setOpType('kirim'); setIsFormOpen(true); }}
            className="bg-amber-600 hover:bg-amber-500 text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-lg shadow-amber-900/20"
          >
            <ArrowDownToLine size={18} />
            Kirim (Prixod)
          </button>
        </div>
      </div>

      {/* KPI WIDGETS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-[var(--surface-2)] border border-border p-5 rounded-xl">
          <h3 className="text-sm font-medium text-text-dim mb-1">Jami Turlari</h3>
          <p className="text-2xl font-bold font-mono text-white">{skladQoldiq.length} <span className="text-sm text-text-dim font-sans">pozitsiya</span></p>
        </div>
        <div className="bg-[var(--surface-1)] border border-border p-5 rounded-xl">
          <h3 className="text-sm font-medium text-text-dim mb-1">Umumiy Hajm</h3>
          <p className="text-2xl font-bold font-mono text-emerald-400"><FmtN val={totalSum}/> <span className="text-sm text-text-dim font-sans">birlik</span></p>
        </div>
        <div className="bg-[var(--surface-1)] border border-border p-5 rounded-xl">
          <h3 className="text-sm font-medium text-text-dim mb-1">So'nggi Yangilanish</h3>
          <p className="text-2xl font-bold font-mono text-white text-sm mt-2">{skladQoldiq.length > 0 ? skladQoldiq[0].oxirgi_harakat : 'Yo\'q'}</p>
        </div>
      </div>

      {/* TABS */}
        <div className="flex items-center gap-2 mb-4 border-b border-border pb-2 overflow-x-auto">
          <button onClick={() => setActiveTab('konsolidatsiya')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'konsolidatsiya' ? 'border-accent text-accent' : 'border-transparent text-text-dim hover:text-white'}`}>
            Jamlangan Ombor (Konsolidatsiya)
          </button>
          <div className="w-px h-6 bg-border mx-2" />
          <button onClick={() => setActiveTab('qoldiq')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'qoldiq' ? 'border-accent text-accent' : 'border-transparent text-text-dim hover:text-white'}`}>
            Obyekt Qoldiqlari
          </button>
          <button onClick={() => setActiveTab('kirim')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'kirim' ? 'border-accent text-accent' : 'border-transparent text-text-dim hover:text-white'}`}>
            Prixod (Kirim)
          </button>
          <button onClick={() => setActiveTab('chiqim')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'chiqim' ? 'border-accent text-accent' : 'border-transparent text-text-dim hover:text-white'}`}>
            Rasxod (Chiqim)
          </button>
          <button onClick={() => setActiveTab('m29')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'm29' ? 'border-accent text-accent' : 'border-transparent text-text-dim hover:text-white'}`}>
            M-29 Hisobot
          </button>
        </div>
      <div className="flex gap-1 bg-[var(--surface-1)] border border-border p-1 rounded-lg w-max mb-6">
        {[
          { id: 'qoldiq', label: 'Haqiqiy Qoldiq', icon: Box },
          { id: 'kirim', label: 'Kirim Jurnali', icon: ArrowDownToLine },
          { id: 'chiqim', label: 'Chiqim Jurnali', icon: ArrowUpFromLine },
          { id: 'm29', label: 'M-29 (Moddiy Hisobot)', icon: ClipboardCheck }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-black text-white shadow-sm border border-border' : 'text-text-dim hover:text-white hover:bg-white/5'}`}
          >
            <tab.icon size={16} className={activeTab === tab.id ? 'text-amber-400' : ''} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* TRANSACTION MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-black border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-border flex justify-between items-center bg-[var(--surface-1)]">
              <h3 className="font-bold text-white flex items-center gap-2">
                {opType === 'kirim' ? <ArrowDownToLine className="text-emerald-400"/> : <ArrowUpFromLine className="text-rose-400"/>}
                {opType === 'kirim' ? 'Omborga Kirim Qilish' : 'Ombordan Chiqim Qilish'}
              </h3>
            </div>
            <div className="p-5 space-y-4 bg-[var(--surface-0)]">
              <div>
                <label className="block text-sm font-medium text-text-dim mb-1">Material Nomi</label>
                <div className="relative">
                  <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" size={16} />
                  <input 
                    type="text" 
                    value={formNomi}
                    onChange={(e) => setFormNomi(e.target.value)}
                    className="w-full bg-black border border-border rounded-lg pl-9 pr-3 py-2 text-white focus:border-sky-500 outline-none" 
                    placeholder="Masalan, Sement M400"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-dim mb-1">Hajmi</label>
                  <input 
                    type="number" 
                    value={formHajmi}
                    onChange={(e) => setFormHajmi(e.target.value)}
                    className="w-full bg-black border border-border rounded-lg px-3 py-2 text-white font-mono focus:border-sky-500 outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-dim mb-1">O'lchov Birligi</label>
                  <select 
                    value={formBirligi}
                    onChange={(e) => setFormBirligi(e.target.value)}
                    className="w-full bg-black border border-border rounded-lg px-3 py-2 text-white focus:border-sky-500 outline-none"
                  >
                    <option value="tonna">tonna</option>
                    <option value="dona">dona</option>
                    <option value="m2">m2</option>
                    <option value="m3">m3</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>
              
              <div className="pt-4 flex justify-end gap-3 border-t border-border mt-4">
                <button onClick={() => setIsFormOpen(false)} className="px-4 py-2 text-text-dim hover:text-white transition-colors">Bekor qilish</button>
                <button 
                  onClick={handleSave} 
                  disabled={yuklanmoqda}
                  className={`px-5 py-2 rounded-lg font-medium transition-colors shadow-lg disabled:opacity-50 ${opType === 'kirim' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20 text-white' : 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/20 text-white'}`}>
                  {yuklanmoqda ? 'Yozilmoqda...' : 'Tasdiqlash'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTENT: QOLDIQ */}
      
        {activeTab === 'konsolidatsiya' && (
          <div className="space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1 max-w-sm">
                <label className="block text-xs text-text-dim mb-1">Markaziy Skladni tanlang</label>
                <select value={markaziyId || ''} onChange={e => setMarkaziyId(Number(e.target.value))} className="w-full bg-bg border border-border rounded-xl p-2.5 text-sm outline-none focus:border-accent">
                  <option value="">-- Tanlang --</option>
                  {markaziySkladlar.map(s => (
                    <option key={s.id} value={s.id}>{s.nomi} {s.manzil ? `(${s.manzil})` : ''}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {yuklanmoqda ? <div className="skel h-40 rounded-xl" /> : (
              <div className="karta overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-2/50 text-text-dim">
                      <th className="text-left px-4 py-3 font-medium">Material</th>
                      <th className="text-right px-4 py-3 font-medium text-emerald-400">JAMI QOLDIQ</th>
                      <th className="text-left px-4 py-3 font-medium border-l border-border/50">Obyektlardagi Taqsimot (Filiallar kesimida)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {konsQoldiqlar.length === 0 && (
                      <tr><td colSpan={3} className="px-4 py-8 text-center text-text-mute">Ushbu markaziy sklad va unga bog'langan obyektlarda qoldiq yo'q.</td></tr>
                    )}
                    {konsQoldiqlar.map((kq, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-surface-2/30">
                        <td className="px-4 py-3 text-white font-medium">{kq.material_nomi}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-400 font-bold bg-emerald-500/5">
                          <FmtN val={kq.jami_qoldiq} /> {kq.birligi}
                        </td>
                        <td className="px-4 py-3 border-l border-border/50">
                          <div className="flex flex-wrap gap-2">
                            {kq.obyektlar_boyicha?.map((ob, j) => (
                              <div key={j} className="inline-flex items-center gap-1.5 bg-bg border border-border px-2 py-1 rounded-md text-[11px]">
                                <span className="text-text-dim truncate max-w-[120px]">{ob.obyekt_nom}:</span>
                                <span className="text-white font-medium"><FmtN val={ob.qoldiq} /></span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'qoldiq' && (
        <div className="bg-[var(--surface-1)] border border-border rounded-xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-border bg-[var(--surface-2)]">
            <div className="relative w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" size={16} />
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Material nomi bo'yicha..."
                className="w-full bg-black border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-sky-500 outline-none"
              />
            </div>
          </div>
          
          {yuklanmoqda ? (
            <div className="p-10 text-center text-text-dim animate-pulse">Yuklanmoqda...</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-black/40 border-b border-border text-text-dim font-medium">
                  <th className="px-6 py-4">ID</th>
                  <th className="px-6 py-4">Material Nomi</th>
                  <th className="px-6 py-4 text-right">Qoldiq Hajmi</th>
                  <th className="px-6 py-4 text-center">QR Pasport</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredQoldiq.map(item => (
                  <tr key={item.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-mono text-text-dim">#{item.id.toString().padStart(4, '0')}</td>
                    <td className="px-6 py-4 font-bold text-white flex items-center gap-2">
                      <Box size={16} className="text-amber-500/50" />
                      {item.nomi}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-white">
                      {item.qoldiq} <span className="text-text-dim font-sans text-xs">{item.birligi}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button className="text-sky-400 hover:text-sky-300 p-1.5 bg-sky-500/10 rounded border border-sky-500/20 mx-auto transition-colors">
                        <QrCode size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredQoldiq.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-10 text-center text-text-dim">
                      Omborda qoldiq mavjud emas yoki topilmadi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* CONTENT: M29 */}
      {activeTab === 'm29' && (
        <div className="bg-[var(--surface-1)] border border-border rounded-xl p-12 text-center shadow-xl mt-6">
          <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-amber-500/20">
            <ClipboardCheck size={32} className="text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-3">M-29: Materiallarning Oylik Sarf Hisoboti</h2>
          <p className="text-text-dim max-w-lg mx-auto mb-8">
            Bu yerda Smeta (Norma) bo'yicha belgilangan materiallar miqdori va Ombor (Fakt) bo'yicha sarflangan miqdorlar solishtiriladi. Hozircha faqat qoldiq ko'rish rejimida.
          </p>
        </div>
      )}
      
      {(activeTab === 'kirim' || activeTab === 'chiqim') && (
        <div className="bg-[var(--surface-1)] border border-border rounded-xl p-12 text-center shadow-xl mt-6">
          <h2 className="text-xl font-bold text-white mb-3">Jurnallar Hali Yasalmadi</h2>
          <p className="text-text-dim max-w-lg mx-auto mb-8">
            Bu sahifada {activeTab} jurnali tarixi (tranzaksiyalar) chiqadi. 
            Jarayonlar hozircha "Qoldiq" orqali shakllanmoqda.
          </p>
        </div>
      )}

    </div>
  );
}
