import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, ArrowDownToLine, ArrowUpFromLine, RefreshCcw, Search, Barcode, ClipboardCheck, QrCode, Building2, PackageOpen, AlertTriangle } from 'lucide-react';
import { useKompaniya } from './KompaniyaTanlov';
import { FmtN } from '../lib/format';
import { toast } from '../umumiy/ui/Toast';

export default function TestSklad() {
  const [params] = useSearchParams();
  const { joriy } = useKompaniya();
  const [activeTab, setActiveTab] = useState<'qoldiq' | 'kirim' | 'chiqim' | 'm29'>('qoldiq');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [opType, setOpType] = useState<'kirim'|'chiqim'>('kirim');

  // MOCK DATA for WMS Dashboard (Phase 7)
  const skladQoldiq = [
    { id: 1, nomi: "Sement M400", birlik: "tonna", qoldiq: 45.5, zaxira_norma: 20, narx: 820000, holat: 'yaxshi' },
    { id: 2, nomi: "D12 Armatura A500C", birlik: "tonna", qoldiq: 5.2, zaxira_norma: 15, narx: 8100000, holat: 'tanqis' },
    { id: 3, nomi: "Fasad Bo'yog'i Oq", birlik: "kg", qoldiq: 150, zaxira_norma: 50, narx: 45000, holat: 'yaxshi' },
  ];

  const handleSave = () => {
    toast(`Omborga ${opType} amaliyoti Ledgerga yozildi!`, "ok");
    setIsFormOpen(false);
  };

  return (
    <div className="p-6 bg-bg min-h-screen text-text">
      
      {/* HEADER */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-2">
            <PackageOpen className="text-amber-500" />
            Ombor (WMS) va Tranzaksion Ledger
          </h1>
          <p className="text-text-dim text-sm max-w-2xl">
            Materiallar qoldig'i, Kirim/Chiqim tranzaksiyalari, QR-kodli sifat pasportlari va oylik M-29 hisobotini yuritish tizimi.
          </p>
        </div>
        <div className="flex gap-3">
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
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-gradient-to-br from-amber-500/10 to-amber-900/5 border border-amber-500/20 p-5 rounded-xl">
          <h3 className="text-sm font-medium text-amber-500 mb-1">Jami Ombor Qoldig'i (Summada)</h3>
          <p className="text-2xl font-bold font-mono text-white">415 600 000 <span className="text-sm text-text-dim font-sans">UZS</span></p>
        </div>
        <div className="bg-surface border border-border p-5 rounded-xl">
          <h3 className="text-sm font-medium text-text-dim mb-1">Bugungi Kirimlar</h3>
          <p className="text-2xl font-bold font-mono text-emerald-400">12 <span className="text-sm text-text-dim font-sans">ta yuk xati</span></p>
        </div>
        <div className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-xl">
          <h3 className="text-sm font-medium text-rose-400 mb-1">Tanqislik xavfi (Defitsit)</h3>
          <p className="text-2xl font-bold font-mono text-white">3 <span className="text-sm text-text-dim font-sans">pozitsiya</span></p>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-1 bg-surface border border-border p-1 rounded-lg w-max mb-6">
        {[
          { id: 'qoldiq', label: 'Haqiqiy Qoldiq', icon: Box },
          { id: 'kirim', label: 'Kirim Jurnali', icon: ArrowDownToLine },
          { id: 'chiqim', label: 'Chiqim Jurnali', icon: ArrowUpFromLine },
          { id: 'm29', label: 'M-29 (Moddiy Hisobot)', icon: ClipboardCheck }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-bg text-white shadow-sm border border-border' : 'text-text-dim hover:text-white hover:bg-surface-2'}`}
          >
            <tab.icon size={16} className={activeTab === tab.id ? 'text-amber-400' : ''} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* TRANSACTION MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-border flex justify-between items-center bg-bg/50">
              <h3 className="font-bold text-white flex items-center gap-2">
                {opType === 'kirim' ? <ArrowDownToLine className="text-emerald-400"/> : <ArrowUpFromLine className="text-rose-400"/>}
                {opType === 'kirim' ? 'Omborga Kirim Qilish' : 'Ombordan Chiqim Qilish'}
              </h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-dim mb-1">Material Nomi (Shtrixkod)</label>
                <div className="relative">
                  <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" size={16} />
                  <input 
                    type="text" 
                    className="w-full bg-bg border border-border rounded-lg pl-9 pr-3 py-2 text-white focus:border-accent outline-none" 
                    placeholder="Qidirish yoki Skanerlash..."
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-dim mb-1">Hajmi</label>
                  <input 
                    type="number" 
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white font-mono focus:border-accent outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-dim mb-1">O'lchov Birligi</label>
                  <select className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white focus:border-accent outline-none">
                    <option>tonna</option>
                    <option>sht</option>
                    <option>m2</option>
                    <option>kg</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-dim mb-1">Yuk Xati / Asos Hujjati (№)</label>
                <input 
                  type="text" 
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white focus:border-accent outline-none" 
                />
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-border mt-4">
                <button onClick={() => setIsFormOpen(false)} className="px-4 py-2 text-text-dim hover:text-white transition-colors">Bekor qilish</button>
                <button onClick={handleSave} className={`px-5 py-2 rounded-lg font-medium transition-colors shadow-lg ${opType === 'kirim' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20 text-white' : 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/20 text-white'}`}>
                  Tasdiqlash
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTENT: QOLDIQ */}
      {activeTab === 'qoldiq' && (
        <div className="bg-surface border border-border rounded-xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-border bg-bg/50">
            <div className="relative w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" size={16} />
              <input 
                type="text" 
                placeholder="Material nomi yoki artikul bo'yicha..."
                className="w-full bg-surface border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-accent outline-none"
              />
            </div>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-surface-2 border-b border-border text-text-dim font-medium">
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Material Nomi</th>
                <th className="px-6 py-4 text-right">Qoldiq Hajmi</th>
                <th className="px-6 py-4 text-right">O'rtacha Narxi</th>
                <th className="px-6 py-4 text-center">Ta'minot Holati</th>
                <th className="px-6 py-4 text-center">QR Pasport</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {skladQoldiq.map(item => (
                <tr key={item.id} className="hover:bg-bg/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-text-dim">#{item.id.toString().padStart(4, '0')}</td>
                  <td className="px-6 py-4 font-bold text-white flex items-center gap-2">
                    <Box size={16} className="text-amber-500/50" />
                    {item.nomi}
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-white">
                    {item.qoldiq} <span className="text-text-dim font-sans text-xs">{item.birlik}</span>
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-text-dim">
                    {FmtN(item.narx)} UZS
                  </td>
                  <td className="px-6 py-4 text-center">
                    {item.holat === 'yaxshi' ? (
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider">Normada</span>
                    ) : (
                      <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 justify-center uppercase tracking-wider"><AlertTriangle size={12}/> Tanqislik</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button className="text-sky-400 hover:text-sky-300 p-1.5 bg-sky-500/10 rounded border border-sky-500/20 mx-auto transition-colors">
                      <QrCode size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CONTENT: M29 */}
      {activeTab === 'm29' && (
        <div className="bg-surface border border-border rounded-xl p-12 text-center shadow-xl">
          <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-amber-500/20">
            <ClipboardCheck size={32} className="text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-3">M-29: Materiallarning Oylik Sarf Hisoboti</h2>
          <p className="text-text-dim max-w-lg mx-auto mb-8">
            Bu yerda Smeta (Norma) bo'yicha belgilangan materiallar miqdori va Ombor (Fakt) bo'yicha sarflangan miqdorlar solishtiriladi va ortiqcha sarflar (perexod) tahlil qilinadi.
          </p>
          <button className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 mx-auto transition-colors shadow-lg shadow-amber-900/20">
            M-29 Yopish (Oy yakuni)
          </button>
        </div>
      )}

    </div>
  );
}
