import React, { useState } from 'react';
import { Mail, Send, CheckCircle2, XCircle, Clock, FileText, MessageSquare, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function TestKorrespondensiya() {
  const [activeTab, setActiveTab] = useState<'xatlar' | 'loyihalar' | 'etirozlar'>('loyihalar');

  return (
    <div className="h-full flex flex-col bg-[#0a0f1d] text-white p-6 overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="text-sky-400" /> B2B Korrespondensiya & EDO
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Zakazchik, Loyihachi va Pudratchi o'rtasida rasmiy xat almashinuv markazi</p>
        </div>
        <button className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-lg shadow-sky-500/20">
          <Send size={16} /> Yangi xat yuborish
        </button>
      </div>

      <div className="flex gap-2 mb-6 border-b border-white/10 pb-2">
        <button onClick={() => setActiveTab('loyihalar')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'loyihalar' ? 'bg-sky-500/20 text-sky-400' : 'hover:bg-white/5 text-zinc-400'}`}>Loyiha Tasdiqlash</button>
        <button onClick={() => setActiveTab('xatlar')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'xatlar' ? 'bg-sky-500/20 text-sky-400' : 'hover:bg-white/5 text-zinc-400'}`}>Rasmiy Xatlar</button>
        <button onClick={() => setActiveTab('etirozlar')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'etirozlar' ? 'bg-sky-500/20 text-sky-400' : 'hover:bg-white/5 text-zinc-400'}`}>E'tiroz va Takliflar</button>
      </div>

      {activeTab === 'loyihalar' && (
        <div className="grid grid-cols-1 gap-4">
          {[
            { id: 1, nomi: "Tashqi Fasad Chizmalari v2.0", loyihachi: "Loyiha-Stroy MChJ", holat: "zakazchik", sana: "24 Okt, 2026" },
            { id: 2, nomi: "Oqava suv tarmoqlari plani", loyihachi: "Suv-Loyiha XK", holat: "pudratchi", sana: "22 Okt, 2026" },
            { id: 3, nomi: "Ventilyatsiya tizimi (Qavat-1)", loyihachi: "Eco-Havo MChJ", holat: "tasdiqlangan", sana: "20 Okt, 2026" },
          ].map((l, i) => (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} key={l.id} className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 hover:bg-white/10 transition-colors">
              <div className="flex items-start gap-4 flex-1">
                <div className="w-12 h-12 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center shrink-0">
                  <FileText className="text-sky-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">{l.nomi}</h3>
                  <p className="text-sm text-zinc-400 flex items-center gap-4">
                    <span>Loyihachi: <span className="text-zinc-300">{l.loyihachi}</span></span>
                    <span>Sana: {l.sana}</span>
                  </p>
                </div>
              </div>

              {/* Workflow Pipeline */}
              <div className="flex items-center gap-2 flex-1 max-w-lg w-full">
                <div className="flex-1 flex flex-col items-center gap-2 relative">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]`}>
                    <CheckCircle2 size={16} />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold text-center">Loyihachi<br/>Yubordi</span>
                </div>
                <div className={`h-1 flex-1 -mx-4 z-0 ${l.holat === 'tasdiqlangan' || l.holat === 'pudratchi' || l.holat === 'zakazchik' ? 'bg-emerald-500' : 'bg-white/10'}`}></div>
                <div className="flex-1 flex flex-col items-center gap-2 relative">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 ${l.holat === 'tasdiqlangan' || l.holat === 'pudratchi' ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]' : l.holat === 'zakazchik' ? 'bg-amber-500 text-white animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'bg-white/10 text-zinc-500'}`}>
                    {l.holat === 'zakazchik' ? <Clock size={16} /> : <CheckCircle2 size={16} />}
                  </div>
                  <span className={`text-[10px] uppercase tracking-wider text-center font-bold ${l.holat === 'tasdiqlangan' || l.holat === 'pudratchi' ? 'text-emerald-400' : l.holat === 'zakazchik' ? 'text-amber-400' : 'text-zinc-500'}`}>Zakazchik<br/>Tasdig'i</span>
                </div>
                <div className={`h-1 flex-1 -mx-4 z-0 ${l.holat === 'tasdiqlangan' ? 'bg-emerald-500' : 'bg-white/10'}`}></div>
                <div className="flex-1 flex flex-col items-center gap-2 relative">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 ${l.holat === 'tasdiqlangan' ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]' : l.holat === 'pudratchi' ? 'bg-amber-500 text-white animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'bg-white/10 text-zinc-500'}`}>
                    {l.holat === 'tasdiqlangan' ? <CheckCircle2 size={16} /> : l.holat === 'pudratchi' ? <Clock size={16} /> : <Clock size={16} />}
                  </div>
                  <span className={`text-[10px] uppercase tracking-wider text-center font-bold ${l.holat === 'tasdiqlangan' ? 'text-emerald-400' : l.holat === 'pudratchi' ? 'text-amber-400' : 'text-zinc-500'}`}>Pudratchi<br/>Qabuli</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors" title="Ko'rish">
                  <Eye size={20} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {activeTab === 'etirozlar' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white/5 border border-amber-500/30 rounded-xl p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3">
              <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-1 rounded font-bold uppercase">Jarayonda</span>
            </div>
            <div className="flex gap-3 items-center mb-4">
              <AlertCircle className="text-amber-400" size={24} />
              <h3 className="font-bold text-lg">Poydevor beton markasi bo'yicha e'tiroz</h3>
            </div>
            <p className="text-zinc-400 text-sm mb-4 leading-relaxed">
              <strong>Zakazchik xati:</strong> Hurmatli loyihachi, geologik xulosaga asosan poydevor uchun M350 emas, balki sulfatga chidamli M400 markali beton ishlatilishi tavsiya qilingan. Iltimos, chizmaga o'zgartirish kiriting.
            </p>
            <div className="flex justify-between items-center text-xs text-zinc-500">
              <span>Kimga: Loyiha-Stroy MChJ, Bosh Pudratchi MChJ</span>
              <span>23 Okt, 2026</span>
            </div>
            <div className="mt-4 pt-4 border-t border-white/10 flex gap-2">
              <button className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 py-2 rounded-lg text-sm font-medium transition-colors">Javob yozish</button>
              <button className="flex-1 bg-white/5 hover:bg-white/10 text-white py-2 rounded-lg text-sm font-medium transition-colors">Yopish</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Temporary Eye icon since it's missing in imports above sometimes
function Eye(props: any) { return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>; }
