import { useState } from 'react';
import { Home, Phone, Plus, CheckSquare } from 'lucide-react';

/* ⚠️ 2026-08-28 (Claude) — QATTIQ QOIDA BUZILISHI TOPILDI VA TUZATILDI.
 *
 * Bu komponent avval 100% O'YLAB TOPILGAN ma'lumot ko'rsatardi (hech
 * qanday backend chaqiruvi yo'q edi):
 *   - soxta lidlar ("Alisher Ubaydullayev", "+998 90 123 45 67"...)
 *   - mavjud bo'lmagan bino nomi ("Yashil Makon TJM")
 *   - kvartira "sotilgan/bron/bo'sh" holati `kvNum % 5 === 0` kabi
 *     MODULO ARIFMETIKA bilan "hisoblangan" — ya'ni raqam qanchalik
 *     "haqiqiy"ga o'xshamasin, u shunchaki matematik formuladan kelib
 *     chiqqan, hech qanday sotuvga aloqasi yo'q edi.
 *
 * Bu 00_BOSH_QONUN.md Q1 qoidasining ANIQ o'zi ("Qotirilgan «namuna»
 * ma'lumot" + "haqiqiy raqamni soxta joyga qo'yish" — bu yerda esa
 * hatto asl raqam ham yo'q, hammasi to'qima edi). Sotuv/Ko'chmas mulk
 * CRM moduli hali REAL backend (t2_sotuv_* jadvallari, unit/lid/
 * bron RPC) bilan qurilmagan — shuning uchun bu yerda soxta
 * to'ldirish O'RNIGA halol "hali ulanmagan" holati ko'rsatiladi.
 *
 * Real backend keyingi bosqichda (MASTER_REJA FAZA 10, band 23 —
 * "Sales/Real Estate") quriladi.
 */
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
        <button disabled title="Backend hali ulanmagan (MASTER_REJA FAZA 10)"
          className="bg-zinc-700 text-zinc-400 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 cursor-not-allowed">
          <Plus size={16} /> Yangi Lid qo'shish
        </button>
      </div>

      <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm text-amber-300">
        Bu modul hali haqiqiy ma'lumotlarga ulanmagan — quyida ko'rinayotgan
        bo'lim tuzilishi tayyor, lekin lidlar/binolar/kvartira holati
        REAL bazadan kelmaydi (hozircha bunday jadval yo'q).
      </div>

      <div className="flex gap-2 mb-6 border-b border-white/10 pb-2">
        <button onClick={() => setActiveTab('kanban')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'kanban' ? 'bg-sky-500/20 text-sky-400' : 'hover:bg-white/5 text-zinc-400'}`}>Savdo Voronkasi (Kanban)</button>
        <button onClick={() => setActiveTab('shaxmatka')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'shaxmatka' ? 'bg-sky-500/20 text-sky-400' : 'hover:bg-white/5 text-zinc-400'}`}>Kvartiralar Shaxmatkasi</button>
        <button onClick={() => setActiveTab('mijozlar')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'mijozlar' ? 'bg-sky-500/20 text-sky-400' : 'hover:bg-white/5 text-zinc-400'}`}>Mijozlar Bazasi</button>
      </div>

      {activeTab === 'kanban' && (
        <div className="flex gap-4 h-[calc(100vh-280px)] overflow-x-auto pb-4">
          {[
            { id: 'yangi', title: 'Yangi Lidlar', color: 'bg-sky-500' },
            { id: 'muzokara', title: 'Muzokara / Uchrashuv', color: 'bg-amber-500' },
            { id: 'bron', title: 'Bron qilingan', color: 'bg-indigo-500' },
            { id: 'shartnoma', title: 'Shartnoma & To\'lov', color: 'bg-emerald-500' },
          ].map(col => (
            <div key={col.id} className="min-w-[320px] max-w-[320px] bg-white/5 border border-white/5 rounded-xl flex flex-col">
              <div className="p-4 border-b border-white/10 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${col.color}`}></div>
                  <h3 className="font-bold">{col.title}</h3>
                </div>
                <span className="bg-white/10 text-white text-xs px-2 py-1 rounded-md">0</span>
              </div>
              <div className="p-3 flex-1 overflow-y-auto space-y-3">
                <p className="text-xs text-zinc-500 text-center py-6">Hali lid yo'q — backend ulanmagan.</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'shaxmatka' && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-zinc-500">Bino tanlanmagan</h2>
            <div className="flex gap-4 text-sm font-medium">
              <span className="flex items-center gap-2"><div className="w-4 h-4 bg-emerald-500/20 border border-emerald-500 rounded"></div> Bo'sh</span>
              <span className="flex items-center gap-2"><div className="w-4 h-4 bg-amber-500/20 border border-amber-500 rounded"></div> Bron</span>
              <span className="flex items-center gap-2"><div className="w-4 h-4 bg-rose-500/20 border border-rose-500 rounded"></div> Sotilgan</span>
            </div>
          </div>
          <p className="text-sm text-zinc-500 text-center py-12">
            Kvartira shaxmatkasi hali haqiqiy binolar ro'yxatiga ulanmagan
            — real ma'lumot bo'lmagani uchun bo'sh ko'rsatilmoqda
            (o'ylab topilgan holat ko'rsatish o'rniga).
          </p>
        </div>
      )}

      {activeTab === 'mijozlar' && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center text-zinc-500">
          <CheckSquare size={28} className="mx-auto mb-3 opacity-40" />
          Mijozlar bazasi hali qurilmagan.
        </div>
      )}
    </div>
  );
}
