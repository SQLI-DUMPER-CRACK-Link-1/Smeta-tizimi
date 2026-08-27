import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  sbT2TolovlarOl, sbT2BuxDashboardOl, sbT2TolovYoz, sbT2XarajatYoz,
  type Tolov, type BuxDashboard,
} from '../api/t2-buxgalteriya';
import { sbT2ShartnomalarOl, sbT2ShartnomaBogOl, type Shartnoma } from '../api/t2-shartnoma';
import { Calculator, Plus, ArrowUpRight, ArrowDownRight, RefreshCcw, FileSpreadsheet, Building2, Search, ArrowRightLeft, CreditCard, Banknote, History, Wallet, BarChart3 } from 'lucide-react';
import { FmtN } from '../lib/format';
import { toast } from '../umumiy/ui/Toast';

export default function TestTolov() {
  const [params] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'reestr' | 'kassa' | 'cashflow' | '1c'>('reestr');
  
  // MOCK DATA FOR DEMO OF THE NEW UI ARCHITECTURE (UNTIL CLAUDE FINISHES API)
  const kpi = {
    jamiKassa: 4520000000,
    kreditor: 1250000000,
    debitor: 340000000,
    oylikSarflov: 890000000
  };

  const tolovlar = [
    { id: 1, sana: '2026-08-25', turi: 'kirim', toifa: 'Avans tushumi', kontragent: 'Buyurtmachi A', summa: 1200000000, holat: 'tasdiqlangan', izoh: 'Blok A uchun 30% avans' },
    { id: 2, sana: '2026-08-26', turi: 'chiqim', toifa: 'Material xaridi', kontragent: 'Sement Zavodi MCHJ', summa: -45000000, holat: 'tasdiqlangan', izoh: 'M400 sement 50 tonna' },
    { id: 3, sana: '2026-08-27', turi: 'chiqim', toifa: 'Ish haqi', kontragent: 'O\'zimizning ishchilar', summa: -125000000, holat: 'kutilmoqda', izoh: 'Avgust 1-qism avans' },
    { id: 4, sana: '2026-08-27', turi: 'chiqim', toifa: 'Sub-pudrat', kontragent: 'Santex-Master MCHJ', summa: -60000000, holat: 'tasdiqlangan', izoh: 'Forma-2 bo\'yicha to\'lov' },
  ];

  return (
    <div className="p-6 bg-bg min-h-screen text-text">
      
      {/* HEADER */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-2">
            <Wallet className="text-emerald-500" />
            Moliya va G'aznachilik (Kassa)
          </h1>
          <p className="text-text-dim text-sm max-w-2xl">
            Markazlashtirilgan moliya boshqaruvi. To'lovlar reestri, kassa operatsiyalari, debitor/kreditor qarzdorliklar tahlili va 1C:Korxona bilan ikki tomonlama ko'prik.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="bg-surface border border-border hover:bg-surface-2 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors">
            <FileSpreadsheet size={16} className="text-emerald-500" />
            Excel Eksport
          </button>
          <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-lg shadow-emerald-900/20">
            <Plus size={16} />
            Yangi To'lov
          </button>
        </div>
      </div>

      {/* KPI WIDGETS */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-surface border border-border p-5 rounded-xl shadow-md">
          <div className="flex items-center gap-2 text-text-dim mb-3">
            <Banknote size={16} className="text-emerald-400" />
            <h3 className="text-sm font-medium">Jami Kassa Qoldig'i</h3>
          </div>
          <p className="text-2xl font-bold font-mono tracking-tight text-white mb-1">
            {FmtN(kpi.jamiKassa)} <span className="text-sm text-text-dim font-sans">UZS</span>
          </p>
          <div className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
            <ArrowUpRight size={14} /> 12% o'tgan oydan ko'p
          </div>
        </div>

        <div className="bg-surface border border-border p-5 rounded-xl shadow-md">
          <div className="flex items-center gap-2 text-text-dim mb-3">
            <ArrowDownRight size={16} className="text-rose-400" />
            <h3 className="text-sm font-medium">Kreditor (Bizning Qarzimiz)</h3>
          </div>
          <p className="text-2xl font-bold font-mono tracking-tight text-white mb-1">
            {FmtN(kpi.kreditor)} <span className="text-sm text-text-dim font-sans">UZS</span>
          </p>
          <div className="flex items-center gap-1 text-xs text-rose-400 font-medium">
            Ochiq Forma-2 lar bo'yicha
          </div>
        </div>

        <div className="bg-surface border border-border p-5 rounded-xl shadow-md">
          <div className="flex items-center gap-2 text-text-dim mb-3">
            <ArrowUpRight size={16} className="text-sky-400" />
            <h3 className="text-sm font-medium">Debitor (Bizga Qarzlar)</h3>
          </div>
          <p className="text-2xl font-bold font-mono tracking-tight text-white mb-1">
            {FmtN(kpi.debitor)} <span className="text-sm text-text-dim font-sans">UZS</span>
          </p>
          <div className="flex items-center gap-1 text-xs text-text-dim font-medium">
            Berilgan avanslar hisobidan
          </div>
        </div>

        <div className="bg-surface border border-border p-5 rounded-xl shadow-md">
          <div className="flex items-center gap-2 text-text-dim mb-3">
            <History size={16} className="text-amber-400" />
            <h3 className="text-sm font-medium">Oylik Sarflov</h3>
          </div>
          <p className="text-2xl font-bold font-mono tracking-tight text-white mb-1">
            {FmtN(kpi.oylikSarflov)} <span className="text-sm text-text-dim font-sans">UZS</span>
          </p>
          <div className="flex items-center gap-1 text-xs text-amber-400 font-medium">
            Joriy oy xarajatlari
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-1 bg-surface border border-border p-1 rounded-lg w-max mb-6">
        {[
          { id: 'reestr', label: 'To\'lovlar Reestri', icon: CreditCard },
          { id: 'kassa', label: 'Bank va Kassa', icon: Banknote },
          { id: 'cashflow', label: 'Cashflow (Prognoz)', icon: BarChart3 },
          { id: '1c', label: '1C:Buxgalteriya Sinxron', icon: RefreshCcw }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-bg text-white shadow-sm border border-border' : 'text-text-dim hover:text-white hover:bg-surface-2'}`}
          >
            <tab.icon size={16} className={activeTab === tab.id ? 'text-emerald-400' : ''} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* CONTENT: REESTR */}
      {activeTab === 'reestr' && (
        <div className="bg-surface border border-border rounded-xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-border flex justify-between items-center bg-bg/50">
            <div className="relative w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" size={16} />
              <input 
                type="text" 
                placeholder="Kontragent, maqsad yoki summani qidiring..."
                className="w-full bg-surface border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-accent focus:ring-1 focus:ring-accent outline-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <select className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-dim outline-none">
                <option>Barcha toifalar</option>
                <option>Material xaridi</option>
                <option>Sub-pudrat</option>
                <option>Ish haqi</option>
              </select>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-surface-2 border-b border-border text-text-dim font-medium">
                  <th className="px-6 py-4">ID</th>
                  <th className="px-6 py-4">Sana</th>
                  <th className="px-6 py-4">Kontragent</th>
                  <th className="px-6 py-4">To'lov Toifasi</th>
                  <th className="px-6 py-4">Izoh / Maqsad</th>
                  <th className="px-6 py-4 text-right">Summa (UZS)</th>
                  <th className="px-6 py-4 text-center">Holat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tolovlar.map(t => (
                  <tr key={t.id} className="hover:bg-bg/50 transition-colors">
                    <td className="px-6 py-4 text-text-dim font-mono">#{t.id.toString().padStart(4, '0')}</td>
                    <td className="px-6 py-4 text-white whitespace-nowrap">{t.sana}</td>
                    <td className="px-6 py-4 font-medium text-sky-300">
                      <div className="flex items-center gap-2">
                        <Building2 size={14} className="text-sky-500/50" />
                        {t.kontragent}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-text-dim">{t.toifa}</td>
                    <td className="px-6 py-4 text-text-dim truncate max-w-[200px]" title={t.izoh}>{t.izoh}</td>
                    <td className={`px-6 py-4 text-right font-mono font-bold whitespace-nowrap ${t.turi === 'kirim' ? 'text-emerald-400' : 'text-white'}`}>
                      {t.turi === 'kirim' ? '+' : ''}{FmtN(t.summa)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${t.holat === 'tasdiqlangan' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                        {t.holat}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === '1c' && (
        <div className="bg-surface border border-border rounded-xl p-12 text-center shadow-xl">
          <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-blue-500/20">
            <RefreshCcw size={32} className="text-blue-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-3">1C:Korxona (Buxgalteriya) API Ko'prigi</h2>
          <p className="text-text-dim max-w-lg mx-auto mb-8">
            Bu yerda barcha moliyaviy tranzaksiyalar (Provodkalar, F2 aktlar va EHF lar) avtomatik ravishda tashkilotning 1C bazasi bilan ikki tomonlama sinxronlanadi.
          </p>
          <button className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 mx-auto transition-colors shadow-lg shadow-blue-900/20">
            Sinxronizatsiyani ishga tushirish
          </button>
        </div>
      )}

    </div>
  );
}
