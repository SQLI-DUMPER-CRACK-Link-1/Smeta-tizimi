import React, { useState, useEffect } from 'react';
import { ShoppingCart, Gavel, PackageSearch, Plus, MapPin, Building2, TrendingDown, Clock, Search, ChevronRight, CheckCircle2 } from 'lucide-react';
import { toast } from '../umumiy/ui/Toast';
import { FmtN } from '../lib/format';

export default function TestBirja() {
  const [activeTab, setActiveTab] = useState<'rfq' | 'taklif' | 'tarix'>('rfq');

  // MOCK DATA: B2B Marketplace UI Demo
  const rfqList = [
    { id: 'RFQ-26-0801', nomi: 'M400 Sement (Yangi Obyekt)', hajm: 500, birlik: 'tonna', muddat: '2026-09-05', holat: 'faol', taklifSoni: 4, minNarx: 820000 },
    { id: 'RFQ-26-0802', nomi: 'D12 Armatura (A500C)', hajm: 120, birlik: 'tonna', muddat: '2026-09-10', holat: 'faol', taklifSoni: 2, minNarx: 8100000 },
    { id: 'RFQ-26-0799', nomi: 'Fasad oynalari (Alyuminiy)', hajm: 1500, birlik: 'm2', muddat: '2026-08-30', holat: 'yopilgan', taklifSoni: 6, minNarx: 1200000 },
  ];

  return (
    <div className="p-6 bg-bg min-h-screen text-text">
      
      {/* HEADER */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-2">
            <ShoppingCart className="text-cyan-400" />
            B2B Xarid Birjasi (Tenderlar)
          </h1>
          <p className="text-text-dim text-sm max-w-2xl">
            Moddiy ehtiyojlar asosida (Viborka) zavodlarga avtomatik tender so'rovlari (RFQ) yuborish va tijoriy takliflarni taqqoslash.
          </p>
        </div>
        <button className="bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-lg shadow-cyan-900/20">
          <Plus size={18} />
          Yangi RFQ Yaratish
        </button>
      </div>

      {/* KPI & AI INSIGHT */}
      <div className="bg-gradient-to-r from-cyan-900/20 to-blue-900/10 border border-cyan-500/20 rounded-xl p-5 mb-8 flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center shrink-0">
          <TrendingDown className="text-cyan-400" size={20} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-cyan-300 mb-1">AI Bozor Tahlili</h3>
          <p className="text-sm text-text-dim leading-relaxed">
            Siz izlayotgan <strong className="text-white">M400 Sement</strong> o'rtacha bozor narxi joriy haftada 2% ga pasaydi. 
            Tizim taklif qiladi: "Bekobod Sement" MCHJ o'tgan loyihalaringizda eng yaxshi yetkazib berish intizomini ko'rsatgan (98% o'z vaqtida). 
          </p>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-1 bg-surface border border-border p-1 rounded-lg w-max mb-6">
        {[
          { id: 'rfq', label: 'Faol So\'rovlar (RFQ)', icon: Gavel },
          { id: 'taklif', label: 'Kelgan Takliflar', icon: PackageSearch },
          { id: 'tarix', label: 'Xarid Tarixi', icon: Clock }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-bg text-white shadow-sm border border-border' : 'text-text-dim hover:text-white hover:bg-surface-2'}`}
          >
            <tab.icon size={16} className={activeTab === tab.id ? 'text-cyan-400' : ''} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* CONTENT: RFQ LIST */}
      {activeTab === 'rfq' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {rfqList.map(rfq => (
            <div key={rfq.id} className="bg-surface border border-border hover:border-cyan-500/50 transition-colors rounded-xl p-5 shadow-lg flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <span className="text-xs font-mono font-bold text-text-dim bg-bg px-2 py-1 rounded">{rfq.id}</span>
                <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-full ${rfq.holat === 'faol' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'}`}>
                  {rfq.holat}
                </span>
              </div>
              
              <h3 className="text-lg font-bold text-white mb-2 leading-tight">{rfq.nomi}</h3>
              
              <div className="flex gap-4 mb-6">
                <div>
                  <p className="text-[10px] uppercase text-text-dim mb-0.5">Talab Hajmi</p>
                  <p className="text-sm font-bold text-sky-400">{FmtN(rfq.hajm)} {rfq.birlik}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-text-dim mb-0.5">So'nggi Muddat</p>
                  <p className="text-sm font-bold text-rose-400">{rfq.muddat}</p>
                </div>
              </div>

              <div className="mt-auto bg-bg border border-border rounded-lg p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-text-dim">Kelib tushgan takliflar:</span>
                  <span className="text-xs font-bold text-white bg-surface-2 px-1.5 rounded">{rfq.taklifSoni} ta zavoddan</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-text-dim">Eng arzon taklif:</span>
                  <span className="text-sm font-bold font-mono text-emerald-400">{FmtN(rfq.minNarx)} UZS/{rfq.birlik}</span>
                </div>
              </div>

              <button className="w-full mt-4 bg-surface-2 hover:bg-cyan-900/30 hover:text-cyan-300 text-white py-2 rounded-lg text-sm font-medium transition-colors border border-transparent hover:border-cyan-500/30 flex items-center justify-center gap-2">
                Takliflarni solishtirish <ChevronRight size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* CONTENT: TAKLIFLAR EMPTY STATE FOR DEMO */}
      {activeTab === 'taklif' && (
        <div className="bg-surface border border-border rounded-xl p-12 text-center shadow-xl">
          <div className="w-20 h-20 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-cyan-500/20">
            <PackageSearch size={32} className="text-cyan-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-3">Tijoriy Takliflarni Taqqoslash</h2>
          <p className="text-text-dim max-w-lg mx-auto mb-8">
            Bu yerda barcha zavod va yetkazib beruvchilardan kelgan takliflar qiyosiy tahlil qilinadi. Tizim eng arzon narx, sifat pasporti va logistika masofasi asosida g'olibni tavsiya qiladi.
          </p>
        </div>
      )}
    </div>
  );
}
