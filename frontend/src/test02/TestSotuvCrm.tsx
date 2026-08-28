import React, { useState } from 'react';
import { Home, Users, Search, Phone, Calendar, CheckSquare, Plus, ArrowRight, DollarSign } from 'lucide-react';
import { motion } from 'framer-motion';

export default function TestSotuvCrm() {
  const [activeTab, setActiveTab] = useState<'kanban' | 'shaxmatka' | 'mijozlar'>('kanban');

  return (
    <div className="h-full flex flex-col bg-[#0a0f1d] text-white p-6 overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Home className="text-sky-400" /> Ko'chmas Mulk Sotuv (CRM)
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Developerlar uchun kvartira savdosi va mijozlar bilan ishlash moduli</p>
        </div>
        <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-lg shadow-emerald-500/20">
          <Plus size={16} /> Yangi Lid qo'shish
        </button>
      </div>

      <div className="flex gap-2 mb-6 border-b border-white/10 pb-2">
        <button onClick={() => setActiveTab('kanban')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'kanban' ? 'bg-sky-500/20 text-sky-400' : 'hover:bg-white/5 text-zinc-400'}`}>Savdo Voronkasi (Kanban)</button>
        <button onClick={() => setActiveTab('shaxmatka')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'shaxmatka' ? 'bg-sky-500/20 text-sky-400' : 'hover:bg-white/5 text-zinc-400'}`}>Kvartiralar Shaxmatkasi</button>
        <button onClick={() => setActiveTab('mijozlar')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'mijozlar' ? 'bg-sky-500/20 text-sky-400' : 'hover:bg-white/5 text-zinc-400'}`}>Mijozlar Bazasi</button>
      </div>

      {activeTab === 'kanban' && (
        <div className="flex gap-4 h-[calc(100vh-280px)] overflow-x-auto pb-4">
          {[
            { id: 'yangi', title: 'Yangi Lidlar', color: 'bg-sky-500', count: 3, items: [
              { ism: "Alisher Ubaydullayev", tel: "+998 90 123 45 67", qiziqish: "3 xonali, 1-qavat" },
              { ism: "Zuhra Karimova", tel: "+998 93 987 65 43", qiziqish: "2 xonali (ipoteka)" }
            ]},
            { id: 'muzokara', title: 'Muzokara / Uchrashuv', color: 'bg-amber-500', count: 2, items: [
              { ism: "Rustam aka", tel: "+998 97 777 77 77", qiziqish: "Ofis uchun 1-qavat" }
            ]},
            { id: 'bron', title: 'Bron qilingan', color: 'bg-indigo-500', count: 1, items: [
              { ism: "Dilshod", tel: "+998 99 111 22 33", qiziqish: "Kvartira #42 (Zaklad berilgan)" }
            ]},
            { id: 'shartnoma', title: 'Shartnoma & To\'lov', color: 'bg-emerald-500', count: 0, items: [] }
          ].map(col => (
            <div key={col.id} className="min-w-[320px] max-w-[320px] bg-white/5 border border-white/5 rounded-xl flex flex-col">
              <div className="p-4 border-b border-white/10 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${col.color}`}></div>
                  <h3 className="font-bold">{col.title}</h3>
                </div>
                <span className="bg-white/10 text-white text-xs px-2 py-1 rounded-md">{col.count}</span>
              </div>
              <div className="p-3 flex-1 overflow-y-auto space-y-3">
                {col.items.map((item, idx) => (
                  <div key={idx} className="bg-white/5 border border-white/10 p-4 rounded-lg hover:border-white/20 cursor-pointer transition-colors shadow-sm">
                    <h4 className="font-semibold text-sky-400 mb-1">{item.ism}</h4>
                    <p className="text-xs text-zinc-400 flex items-center gap-2 mb-2"><Phone size={12}/> {item.tel}</p>
                    <div className="bg-black/30 p-2 rounded text-xs text-zinc-300">
                      Qiziqish: {item.qiziqish}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'shaxmatka' && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">"Yashil Makon" TJM - A blok</h2>
            <div className="flex gap-4 text-sm font-medium">
              <span className="flex items-center gap-2"><div className="w-4 h-4 bg-emerald-500/20 border border-emerald-500 rounded"></div> Bo'sh</span>
              <span className="flex items-center gap-2"><div className="w-4 h-4 bg-amber-500/20 border border-amber-500 rounded"></div> Bron</span>
              <span className="flex items-center gap-2"><div className="w-4 h-4 bg-rose-500/20 border border-rose-500 rounded"></div> Sotilgan</span>
            </div>
          </div>
          
          <div className="space-y-2">
            {[9, 8, 7, 6, 5, 4, 3, 2, 1].map(qavat => (
              <div key={qavat} className="flex items-center gap-4">
                <div className="w-16 text-center font-bold text-zinc-500">{qavat}-qavat</div>
                <div className="flex-1 grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map(kv => {
                    const kvNum = (qavat - 1) * 4 + kv;
                    // Random logic for mockup
                    const holat = kvNum % 5 === 0 ? 'sotilgan' : kvNum % 7 === 0 ? 'bron' : 'bosh';
                    const color = holat === 'sotilgan' ? 'bg-rose-500/20 border-rose-500/50 text-rose-300' : 
                                  holat === 'bron' ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 
                                  'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 cursor-pointer';
                    
                    return (
                      <div key={kvNum} className={`p-3 rounded-lg border flex justify-between items-center transition-colors ${color}`}>
                        <div>
                          <div className="font-bold">#{kvNum}</div>
                          <div className="text-[10px] opacity-70">{kv === 1 || kv === 4 ? '3 xona' : '2 xona'} • {kv === 1 || kv === 4 ? '85m²' : '65m²'}</div>
                        </div>
                        {holat === 'sotilgan' && <CheckSquare size={16} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
