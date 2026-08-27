import React, { useState } from 'react';
import { Mail, Building2, UserPlus, Send, CheckCircle2, XCircle, Search, Users, ExternalLink, Activity } from 'lucide-react';
import { toast } from '../umumiy/ui/Toast';

export default function TestInvite() {
  const [activeTab, setActiveTab] = useState<'yuborilgan' | 'tarmoq' | 'yangi'>('yangi');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState('subpudratchi');

  const handleYuborish = () => {
    if (!email) {
      toast("Email manzilni kiriting", "warn");
      return;
    }
    toast(`Taklifnoma ${email} manziliga yuborildi!`, "ok");
    setEmail('');
  };

  const tarmoqList = [
    { id: 1, nomi: "GOLDEN BRIDGE MCHJ", rol: "Bosh Pudratchi", inn: "301234567", holat: "faol", loyihalar: 3 },
    { id: 2, nomi: "SANTEX-MASTER", rol: "Subpudratchi", inn: "302998877", holat: "faol", loyihalar: 1 },
    { id: 3, nomi: "TOSHKENT SEMENT", rol: "Yetkazib Beruvchi", inn: "200112233", holat: "faol", loyihalar: 5 },
  ];

  const yuborilganList = [
    { id: 1, email: "director@stroy.uz", rol: "Subpudratchi", sana: "2026-08-27 14:30", holat: "kutilmoqda" },
    { id: 2, email: "sales@metal.uz", rol: "Yetkazib Beruvchi", sana: "2026-08-25 09:15", holat: "qabul qilingan" },
    { id: 3, email: "arch@design.uz", rol: "Loyihachi", sana: "2026-08-20 11:00", holat: "rad etilgan" },
  ];

  return (
    <div className="p-6 bg-bg min-h-screen text-text">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-2">
            <Users className="text-indigo-400" />
            B2B Kontragentlar Tarmog'i va Takliflar
          </h1>
          <p className="text-sm text-text-dim max-w-2xl">
            Loyiha qatnashchilarini (Subpudratchilar, Yetkazib beruvchilar, Loyihachilar) tizimga taklif qilish va ro'yxatdan o'tgan hamkorlar bilan ishlash muhiti.
          </p>
        </div>
      </div>

      <div className="flex gap-1 bg-surface border border-border p-1 rounded-lg w-max mb-6">
        {[
          { id: 'yangi', label: 'Taklif Yuborish', icon: UserPlus },
          { id: 'tarmoq', label: 'Faol Hamkorlar', icon: Building2 },
          { id: 'yuborilgan', label: 'Taklifnomalar Tarixi', icon: Mail }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-bg text-white shadow-sm border border-border' : 'text-text-dim hover:text-white hover:bg-surface-2'}`}
          >
            <tab.icon size={16} className={activeTab === tab.id ? 'text-indigo-400' : ''} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'yangi' && (
        <div className="max-w-2xl">
          <div className="bg-surface border border-border rounded-xl p-8 shadow-xl">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Send size={20} className="text-indigo-400" />
              Yangi hamkorni platformaga taklif qilish
            </h2>
            
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-text-dim mb-2">Hamkorning e-mail manzili</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="masalan: info@kompaniya.uz"
                  className="w-full bg-bg border border-border rounded-lg px-4 py-3 text-white focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-dim mb-2">Loyihadagi Roli (Polimorfik)</label>
                <div className="grid grid-cols-2 gap-3">
                  {['Subpudratchi', 'Yetkazib beruvchi', 'Loyihachi', 'Texnik Nazoratchi'].map(r => (
                    <label key={r} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${rol === r.toLowerCase() ? 'bg-indigo-500/10 border-indigo-500/50' : 'bg-bg border-border hover:border-text-dim'}`}>
                      <input 
                        type="radio" 
                        name="rol" 
                        value={r.toLowerCase()}
                        checked={rol === r.toLowerCase()}
                        onChange={e => setRol(e.target.value)}
                        className="accent-indigo-500"
                      />
                      <span className={rol === r.toLowerCase() ? 'text-indigo-300 font-medium' : 'text-text-dim'}>{r}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="bg-indigo-950/30 border border-indigo-900/50 rounded-lg p-4 mt-6">
                <p className="text-sm text-indigo-300 leading-relaxed">
                  <strong>Eslatma:</strong> Taklif qilingan kompaniya ro'yxatdan o'tgach, o'zining STIR (INN) raqamini kiritishi bilan tizim barcha yuridik va bank rekvizitlarini avtomatik tortib oladi va sizning B2B tarmog'ingizga qo'shiladi.
                </p>
              </div>

              <button 
                onClick={handleYuborish}
                className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-900/20"
              >
                <Mail size={18} />
                Taklifnomani yuborish
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tarmoq' && (
        <div className="bg-surface border border-border rounded-xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-border bg-bg/50">
            <div className="relative w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" size={16} />
              <input 
                type="text" 
                placeholder="Hamkor nomi yoki STIR orqali izlash..."
                className="w-full bg-surface border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-accent outline-none"
              />
            </div>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-surface-2 border-b border-border text-text-dim font-medium">
                <th className="px-6 py-4">Kompaniya Nomi</th>
                <th className="px-6 py-4">STIR (INN)</th>
                <th className="px-6 py-4">Siz bilan roli</th>
                <th className="px-6 py-4">Birgalikdagi loyihalar</th>
                <th className="px-6 py-4">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tarmoqList.map(t => (
                <tr key={t.id} className="hover:bg-bg/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-white flex items-center gap-2">
                    <Building2 size={16} className="text-indigo-400" />
                    {t.nomi}
                  </td>
                  <td className="px-6 py-4 font-mono text-text-dim">{t.inn}</td>
                  <td className="px-6 py-4">
                    <span className="bg-surface-2 text-text px-2.5 py-1 rounded-md text-xs font-medium border border-border">
                      {t.rol}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                      <Activity size={14} /> {t.loyihalar} ta faol
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button className="text-sky-400 hover:text-sky-300 flex items-center gap-1 text-xs font-medium">
                      Pasport <ExternalLink size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'yuborilgan' && (
        <div className="bg-surface border border-border rounded-xl shadow-xl overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-surface-2 border-b border-border text-text-dim font-medium">
                <th className="px-6 py-4">Email / Qabul qiluvchi</th>
                <th className="px-6 py-4">Taklif qilingan rol</th>
                <th className="px-6 py-4">Yuborilgan sana</th>
                <th className="px-6 py-4">Holat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {yuborilganList.map(t => (
                <tr key={t.id} className="hover:bg-bg/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-white">{t.email}</td>
                  <td className="px-6 py-4 text-text-dim">{t.rol}</td>
                  <td className="px-6 py-4 font-mono text-text-dim">{t.sana}</td>
                  <td className="px-6 py-4">
                    {t.holat === 'qabul qilingan' && <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold uppercase"><CheckCircle2 size={14}/> Qabul qilingan</span>}
                    {t.holat === 'kutilmoqda' && <span className="flex items-center gap-1.5 text-amber-400 text-xs font-bold uppercase"><Lock size={14}/> Kutilmoqda</span>}
                    {t.holat === 'rad etilgan' && <span className="flex items-center gap-1.5 text-rose-400 text-xs font-bold uppercase"><XCircle size={14}/> Rad etilgan</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
