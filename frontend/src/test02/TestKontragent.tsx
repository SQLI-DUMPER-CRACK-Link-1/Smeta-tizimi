import React, { useState } from 'react';
import { Search, Building2, UserCircle, MapPin, CreditCard, CheckCircle2, AlertCircle, Building } from 'lucide-react';
import { toast } from '../umumiy/ui/Toast';

export default function TestKontragent() {
  const [inn, setInn] = useState('');
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [topildi, setTopildi] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    nomi: '',
    rahbar: '',
    manzil: '',
    mfo: '',
    hisobRaqam: '',
    qqs: false
  });

  const handleFetchINN = async () => {
    if (inn.length !== 9) {
      toast("STIR (INN) 9 ta raqamdan iborat bo'lishi shart!", "danger");
      return;
    }

    setYuklanmoqda(true);
    setTopildi(false);

    // MOCK SOLIQ/DIDOX API DELAY
    setTimeout(() => {
      setFormData({
        nomi: "MCHJ 'GOLDEN BRIDGE CONSTRUCTION'",
        rahbar: "TOSHMATOV ESHMAT TOSHMATOVICH",
        manzil: "Toshkent sh., Yunusobod tumani, 19-daha, 45-uy",
        mfo: "01044",
        hisobRaqam: "20208000900123456789",
        qqs: true
      });
      setYuklanmoqda(false);
      setTopildi(true);
      toast("Kontragent ma'lumotlari muvaffaqiyatli tortib olindi!", "ok");
    }, 1500);
  };

  const handleSave = () => {
    // Bu yerda supabase API chaqiriladi (Claude yozadi)
    toast("Kompaniya bazaga saqlandi va Tarmoq Reestriga qo'shildi!", "ok");
  };

  return (
    <div className="p-6 bg-bg min-h-screen text-text">
      <div className="max-w-4xl mx-auto">
        
        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-2">
            <Building className="text-accent" />
            Kontragentlar va Hamkorlar (B2B Reestr)
          </h1>
          <p className="text-text-dim text-sm">
            Tizimga yangi Buyurtmachi, Pudratchi yoki Ta'minotchi qo'shish. Barcha rekvizitlar STIR (INN) orqali davlat bazasidan avtomat tortib olinadi.
          </p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6 shadow-xl mb-6">
          <label className="block text-sm font-medium text-text-dim mb-2">STIR (INN) ni kiriting</label>
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" size={18} />
              <input 
                type="text" 
                maxLength={9}
                value={inn}
                onChange={(e) => setInn(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Masalan: 301234567"
                className="w-full bg-bg border border-border rounded-lg pl-10 pr-4 py-3 text-lg font-mono text-white focus:border-accent focus:ring-1 focus:ring-accent transition-all outline-none"
              />
            </div>
            <button 
              onClick={handleFetchINN}
              disabled={yuklanmoqda || inn.length !== 9}
              className="bg-accent hover:bg-blue-600 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              {yuklanmoqda ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search size={18} />
              )}
              Ma'lumotlarni tortish
            </button>
          </div>
        </div>

        {/* NATIJA KARTOCHKASI */}
        <div className={`transition-all duration-500 ${topildi ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
          <div className="bg-surface border border-border rounded-xl p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-emerald-400 flex items-center gap-2 mb-6 pb-4 border-b border-border">
              <CheckCircle2 size={20} />
              Ma'lumotlar topildi (Davlat Soliq Qo'mitasi)
            </h2>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="flex items-center gap-2 text-xs font-medium text-text-dim mb-1"><Building2 size={14}/> Kompaniya To'liq Nomi</label>
                <input value={formData.nomi} readOnly className="w-full bg-bg/50 border border-border rounded-md p-2.5 text-white font-medium" />
              </div>
              
              <div>
                <label className="flex items-center gap-2 text-xs font-medium text-text-dim mb-1"><UserCircle size={14}/> Rahbar (Direktor)</label>
                <input value={formData.rahbar} readOnly className="w-full bg-bg/50 border border-border rounded-md p-2.5 text-white" />
              </div>

              <div className="col-span-2">
                <label className="flex items-center gap-2 text-xs font-medium text-text-dim mb-1"><MapPin size={14}/> Yuridik Manzil</label>
                <input value={formData.manzil} readOnly className="w-full bg-bg/50 border border-border rounded-md p-2.5 text-white" />
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-medium text-text-dim mb-1"><CreditCard size={14}/> Asosiy Hisob Raqam (20208...)</label>
                <input value={formData.hisobRaqam} readOnly className="w-full bg-bg/50 border border-border rounded-md p-2.5 font-mono text-emerald-300" />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="flex items-center gap-2 text-xs font-medium text-text-dim mb-1">MFO Kodi</label>
                  <input value={formData.mfo} readOnly className="w-full bg-bg/50 border border-border rounded-md p-2.5 font-mono text-white" />
                </div>
                <div className="flex-1">
                  <label className="flex items-center gap-2 text-xs font-medium text-text-dim mb-1">QQS To'lovchi</label>
                  <div className="w-full bg-bg/50 border border-border rounded-md p-2.5 flex items-center gap-2">
                    {formData.qqs ? (
                      <span className="flex items-center gap-1 text-emerald-400 font-bold text-sm"><CheckCircle2 size={16}/> FAOL (12%)</span>
                    ) : (
                      <span className="flex items-center gap-1 text-rose-400 font-bold text-sm"><AlertCircle size={16}/> YO'Q</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-border">
              <button onClick={() => setTopildi(false)} className="px-5 py-2.5 rounded-lg font-medium text-text-dim hover:text-white hover:bg-surface-2 transition-colors">
                Bekor qilish
              </button>
              <button onClick={handleSave} className="px-5 py-2.5 rounded-lg font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-lg shadow-emerald-900/20">
                Bazaga Saqlash
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
