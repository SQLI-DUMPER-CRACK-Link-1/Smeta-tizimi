import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  sbT2TolovlarOl, sbT2BuxDashboardOl,
  type Tolov, type BuxDashboard,
} from '../api/t2-buxgalteriya';
import { Calculator, Plus, ArrowUpRight, ArrowDownRight, RefreshCcw, FileSpreadsheet, Building2, Search, ArrowRightLeft, CreditCard, Banknote, History, Wallet, BarChart3 } from 'lucide-react';
import { FmtN } from '../lib/format';
import { toast } from '../umumiy/ui/Toast';
import { useKompaniya } from './KompaniyaTanlov';

export default function TestTolov() {
  const [params] = useSearchParams();
  const { joriy } = useKompaniya();
  const aktKomp = joriy?.id ?? 0;

  const [activeTab, setActiveTab] = useState<'reestr' | 'kassa' | 'cashflow' | '1c'>('reestr');
  
  const [dashboard, setDashboard] = useState<{bajarilgan: number, tolangan: number, debitor: number, avans: number}>({bajarilgan: 0, tolangan: 0, debitor: 0, avans: 0});
  const [tolovlar, setTolovlar] = useState<Tolov[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!aktKomp) return;
    
    setYuklanmoqda(true);
    Promise.all([
      sbT2BuxDashboardOl(aktKomp),
      sbT2TolovlarOl()
    ]).then(([dashRes, tolovRes]) => {
      setYuklanmoqda(false);
      
      if (dashRes.ok && dashRes.qatorlar) {
        // Hozirgi kompaniyaga tegishli shartnomalar ekanligini qanday bilamiz?
        // t2_bux_dashboard'da kompaniya_id yo'q bo'lishi mumkin. Hozircha hamma dashboard summalarini qo'shamiz
        const jami = dashRes.qatorlar.reduce((acc, curr) => {
          return {
            bajarilgan: acc.bajarilgan + (curr.bajarilgan || 0),
            tolangan: acc.tolangan + (curr.tolangan || 0),
            debitor: acc.debitor + (curr.debitor || 0),
            avans: acc.avans + (curr.avans || 0)
          };
        }, {bajarilgan: 0, tolangan: 0, debitor: 0, avans: 0});
        setDashboard(jami);
      } else {
        setDashboard({bajarilgan: 0, tolangan: 0, debitor: 0, avans: 0});
      }

      if (tolovRes.ok && tolovRes.qatorlar) {
        // Filtrlash faqat hozirgi kompaniya uchun (chunki tolovRes barchasini beradi, agar rls bo'lmasa)
        // API 't2-buxgalteriya' dagi sbT2TolovlarOl hozircha shartnomaId bilan chaqirilishi mumkin.
        // Biz filter orqali kompaniyani ajratib olamiz.
        setTolovlar(tolovRes.qatorlar.filter(t => t.kompaniya_id === aktKomp));
      } else {
        setTolovlar([]);
      }
    });
  }, [aktKomp]);

  const filteredTolovlar = tolovlar.filter(t => 
    t.izoh?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.shartnoma_id?.toString().includes(searchTerm)
  );

  return (
    <div className="p-6 bg-transparent h-full overflow-y-auto text-text">
      
      {/* HEADER */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-2 text-white">
            <Wallet className="text-emerald-500" />
            Moliya va G'aznachilik (Kassa)
          </h1>
          <p className="text-text-dim text-sm max-w-2xl">
            Markazlashtirilgan moliya boshqaruvi. To'lovlar reestri, kassa operatsiyalari, debitor/kreditor qarzdorliklar tahlili.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="bg-[var(--surface-2)] border border-border hover:bg-[var(--surface-3)] text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors">
            <FileSpreadsheet size={16} className="text-emerald-500" />
            Excel Eksport
          </button>
          <button 
            onClick={() => toast("Yangi to'lov oynasi faqat 'Shartnomalar' ichidan ochilishi kerak (biznes logika)", "warn")}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-lg shadow-emerald-900/20"
          >
            <Plus size={16} />
            Yangi To'lov
          </button>
        </div>
      </div>

      {/* KPI WIDGETS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-[var(--surface-1)] border border-border p-5 rounded-xl shadow-md">
          <div className="flex items-center gap-2 text-text-dim mb-3">
            <Banknote size={16} className="text-emerald-400" />
            <h3 className="text-sm font-medium">Bajarilgan Jami Qoldiq</h3>
          </div>
          <p className="text-2xl font-bold font-mono tracking-tight text-white mb-1">
            <FmtN val={dashboard?.bajarilgan || 0} /> <span className="text-sm text-text-dim font-sans">UZS</span>
          </p>
          <div className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
            Forma-2 lar yig'indisi
          </div>
        </div>

        <div className="bg-[var(--surface-1)] border border-border p-5 rounded-xl shadow-md">
          <div className="flex items-center gap-2 text-text-dim mb-3">
            <ArrowDownRight size={16} className="text-emerald-400" />
            <h3 className="text-sm font-medium">To'langan Summa</h3>
          </div>
          <p className="text-2xl font-bold font-mono tracking-tight text-white mb-1">
            <FmtN val={dashboard?.tolangan || 0} /> <span className="text-sm text-text-dim font-sans">UZS</span>
          </p>
          <div className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
            Tizimdagi to'lovlar
          </div>
        </div>

        <div className="bg-[var(--surface-1)] border border-border p-5 rounded-xl shadow-md">
          <div className="flex items-center gap-2 text-text-dim mb-3">
            <ArrowUpRight size={16} className="text-rose-400" />
            <h3 className="text-sm font-medium">Qarzdorlik (Balans)</h3>
          </div>
          <p className="text-2xl font-bold font-mono tracking-tight text-white mb-1">
            <FmtN val={dashboard?.debitor || 0} /> <span className="text-sm text-text-dim font-sans">UZS</span>
          </p>
          <div className="flex items-center gap-1 text-xs text-text-dim font-medium">
            Bizga qarzlar
          </div>
        </div>

        <div className="bg-[var(--surface-1)] border border-border p-5 rounded-xl shadow-md">
          <div className="flex items-center gap-2 text-text-dim mb-3">
            <History size={16} className="text-amber-400" />
            <h3 className="text-sm font-medium">To'langan Avans</h3>
          </div>
          <p className="text-2xl font-bold font-mono tracking-tight text-white mb-1">
            <FmtN val={dashboard?.avans || 0} /> <span className="text-sm text-text-dim font-sans">UZS</span>
          </p>
          <div className="flex items-center gap-1 text-xs text-amber-400 font-medium">
            Oldindan to'lovlar
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-1 bg-[var(--surface-1)] border border-border p-1 rounded-lg w-max mb-6">
        {[
          { id: 'reestr', label: 'To\'lovlar Reestri', icon: CreditCard },
          { id: 'kassa', label: 'Bank va Kassa', icon: Banknote },
          { id: 'cashflow', label: 'Cashflow (Prognoz)', icon: BarChart3 },
          { id: '1c', label: '1C:Buxgalteriya Sinxron', icon: RefreshCcw }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-black text-white shadow-sm border border-border' : 'text-text-dim hover:text-white hover:bg-white/5'}`}
          >
            <tab.icon size={16} className={activeTab === tab.id ? 'text-emerald-400' : ''} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* CONTENT: REESTR */}
      {activeTab === 'reestr' && (
        <div className="bg-[var(--surface-1)] border border-border rounded-xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-border flex justify-between items-center bg-[var(--surface-2)]">
            <div className="relative w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" size={16} />
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Izoh yoki shartnoma № bo'yicha qidiring..."
                className="w-full bg-black border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-sky-500 outline-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <select className="bg-black border border-border rounded-lg px-3 py-2 text-sm text-text-dim outline-none">
                <option>Barcha toifalar</option>
                <option>Kirim</option>
                <option>Chiqim</option>
              </select>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-black/40 border-b border-border text-text-dim font-medium">
                  <th className="px-6 py-4">ID</th>
                  <th className="px-6 py-4">Sana</th>
                  <th className="px-6 py-4">Shartnoma / Tur</th>
                  <th className="px-6 py-4">Izoh</th>
                  <th className="px-6 py-4 text-right">Summa (UZS)</th>
                  <th className="px-6 py-4 text-center">Holat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {yuklanmoqda ? (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-text-dim animate-pulse">Yuklanmoqda...</td>
                  </tr>
                ) : filteredTolovlar.map(t => (
                  <tr key={t.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 text-text-dim font-mono">#{t.id.toString().padStart(4, '0')}</td>
                    <td className="px-6 py-4 text-white whitespace-nowrap">{t.sana}</td>
                    <td className="px-6 py-4 font-medium text-sky-300">
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center gap-2"><Building2 size={14} className="text-sky-500/50" /> Shartnoma ID: {t.shartnoma_id}</span>
                        <span className="text-xs text-text-dim uppercase tracking-wider">{t.tur}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-text-dim max-w-[250px] truncate" title={t.izoh || ''}>{t.izoh || '-'}</td>
                    <td className={`px-6 py-4 text-right font-mono font-bold whitespace-nowrap ${t.summa > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {t.summa > 0 ? '+' : ''}<FmtN val={t.summa} />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${t.holat === 'faol' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                        {t.holat}
                      </span>
                    </td>
                  </tr>
                ))}
                {!yuklanmoqda && filteredTolovlar.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-text-dim">Hech qanday to'lov yozuvi topilmadi.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === '1c' && (
        <div className="bg-[var(--surface-1)] border border-border rounded-xl p-12 text-center shadow-xl mt-6">
          <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-blue-500/20">
            <RefreshCcw size={32} className="text-blue-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-3">1C:Korxona (Buxgalteriya) API Ko'prigi</h2>
          <p className="text-text-dim max-w-lg mx-auto mb-8">
            Bu yerda barcha moliyaviy tranzaksiyalar (Provodkalar, F2 aktlar va EHF lar) avtomatik ravishda tashkilotning 1C bazasi bilan ikki tomonlama sinxronlanadi. Hozircha ishlab chiqilmoqda.
          </p>
          <button className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 mx-auto transition-colors shadow-lg shadow-blue-900/20">
            Sinxronizatsiyani ishga tushirish
          </button>
        </div>
      )}
      
      {(activeTab === 'kassa' || activeTab === 'cashflow') && (
        <div className="bg-[var(--surface-1)] border border-border rounded-xl p-12 text-center shadow-xl mt-6">
          <h2 className="text-xl font-bold text-white mb-3">Bo'lim yasalmoqda</h2>
          <p className="text-text-dim max-w-lg mx-auto mb-8">
            Bu bo'lim keyingi fazalarda ishga tushiriladi. Hozircha to'lovlar reestridan foydalaning.
          </p>
        </div>
      )}

    </div>
  );
}
