import React, { useState, useEffect } from 'react';
import { Users, Shield, UserPlus, Save, RefreshCw, Trash2, Edit2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { toast } from '../umumiy/ui/Toast';
import { useKompaniya } from './KompaniyaTanlov';
import { sbAzolikRoyxatOl, sbAzolikQosh, sbAzolikRolOzgartir, sbAzolikOchir, type Azolik, type AzolikRol } from '../api/t2-xodim';

export default function TestXodimlarRollar() {
  const { joriy } = useKompaniya();
  const [xodimlar, setXodimlar] = useState<Azolik[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [qoshmoqda, setQoshmoqda] = useState(false);

  const [tahrirId, setTahrirId] = useState<number | null>(null);
  const [tahrirRol, setTahrirRol] = useState<AzolikRol>('prorab');

  const [yangiLogin, setYangiLogin] = useState('');
  const [yangiIsm, setYangiIsm] = useState('');
  const [yangiEmail, setYangiEmail] = useState('');
  const [yangiRol, setYangiRol] = useState<AzolikRol>('prorab');

  const rolRanglari: Record<string, string> = {
    superadmin: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    admin: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    boss: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    rahbar: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
    bugalter: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    pto: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    prorab: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
  };

  const royxatniYangila = async () => {
    if (!joriy) return;
    setYuklanmoqda(true);
    try {
      const res = await sbAzolikRoyxatOl(joriy.id);
      setXodimlar(res.qatorlar || []);
    } catch (e: any) {
      toast(e.message, 'danger');
    } finally {
      setYuklanmoqda(false);
    }
  };

  useEffect(() => {
    royxatniYangila();
  }, [joriy]);

  const handleQoshish = async () => {
    if (!joriy) return;
    if (!yangiLogin.trim()) return toast("Login kiritish majburiy", "warn");
    
    setQoshmoqda(true);
    try {
      await sbAzolikQosh({
        kompaniyaId: joriy.id,
        login: yangiLogin.trim().toLowerCase(),
        ism: yangiIsm.trim() || undefined,
        email: yangiEmail.trim() || undefined,
        rol: yangiRol
      });
      toast("Xodim muvaffaqiyatli qo'shildi", "ok");
      setYangiLogin('');
      setYangiIsm('');
      setYangiEmail('');
      setYangiRol('prorab');
      royxatniYangila();
    } catch (e: any) {
      toast(e.message, 'danger');
    } finally {
      setQoshmoqda(false);
    }
  };

  const handleOchirish = async (id: number) => {
    if (!confirm("Haqiqatan ham bu xodimni kompaniyadan o'chirasizmi? Uning qilgan ishlari saqlanib qoladi.")) return;
    
    try {
      await sbAzolikOchir(id);
      toast("Xodim o'chirildi (bekor qilindi)", "ok");
      royxatniYangila();
    } catch (e: any) {
      toast(e.message, 'danger');
    }
  };

  const handleSaqlash = async (id: number) => {
    try {
      await sbAzolikRolOzgartir(id, tahrirRol);
      toast("Rol o'zgartirildi", "ok");
      setTahrirId(null);
      royxatniYangila();
    } catch (e: any) {
      toast(e.message, 'danger');
    }
  };

  return (
    <div className="h-full bg-bg flex flex-col font-sans">
      <div className="p-4 border-b border-border flex items-center justify-between bg-surface z-10 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldCheck className="text-accent" />
            Xodimlar va Rollar
          </h1>
          <p className="text-xs text-text-dim mt-1">
            Kompaniyaga a'zolarni taklif qilish va kirish huquqlarini (Role-Based Access) boshqarish
          </p>
        </div>
        <button onClick={royxatniYangila} className="p-2 text-text-dim hover:text-white transition-colors bg-surface-2 rounded-lg border border-border">
          <RefreshCw size={16} className={yuklanmoqda ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* YANGI QO'SHISH */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-surface border border-border rounded-xl shadow-xl p-5">
              <h2 className="font-bold text-white mb-4 border-b border-border pb-2 flex items-center gap-2">
                <UserPlus size={16} className="text-accent" />
                Yangi A'zo Qo'shish
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-text-dim mb-1 uppercase tracking-wider">Login / Username *</label>
                  <input 
                    type="text"
                    value={yangiLogin}
                    onChange={e => setYangiLogin(e.target.value)}
                    placeholder="user123"
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white font-mono focus:border-accent outline-none text-sm"
                  />
                  <p className="text-[10px] text-text-dim mt-1">Agar foydalanuvchi tizimda yo'q bo'lsa, u yangidan ro'yxatga olinadi.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-text-dim mb-1 uppercase tracking-wider">Ism-Familiya</label>
                    <input 
                      type="text"
                      value={yangiIsm}
                      onChange={e => setYangiIsm(e.target.value)}
                      placeholder="Eshmatov T."
                      className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white focus:border-accent outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-dim mb-1 uppercase tracking-wider">Email (ixtiyoriy)</label>
                    <input 
                      type="email"
                      value={yangiEmail}
                      onChange={e => setYangiEmail(e.target.value)}
                      placeholder="e@mail.com"
                      className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white focus:border-accent outline-none text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-dim mb-1 uppercase tracking-wider flex items-center justify-between">
                    <span>Kirish Huquqi (Rol) *</span>
                  </label>
                  <select
                    value={yangiRol}
                    onChange={e => setYangiRol(e.target.value as AzolikRol)}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white focus:border-accent outline-none appearance-none text-sm font-medium"
                  >
                    <option value="prorab">PRORAB (Sklad, Fakt, Talabnoma)</option>
                    <option value="pto">PTO (Smeta, F2, Obyekt tahlili)</option>
                    <option value="bugalter">BUGALTER (Kassa, Shartnoma, Tolov)</option>
                    <option value="rahbar">RAHBAR (Hisobotlar, Ruxsatnomalar)</option>
                    <option value="boss">BOSS (To'liq nazorat, kuzatuvchi)</option>
                    <option value="admin">ADMIN (Texnik xodim, bazaviy o'zgartirish)</option>
                  </select>
                </div>

                <div className="pt-2 border-t border-border mt-2">
                  <button 
                    onClick={handleQoshish}
                    disabled={qoshmoqda || !yangiLogin}
                    className="w-full bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:hover:bg-accent text-white px-4 py-2.5 rounded-lg font-bold flex justify-center items-center gap-2 transition-colors shadow-lg shadow-accent/20 text-sm"
                  >
                    {qoshmoqda ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                    Tizimga Qo'shish
                  </button>
                </div>
              </div>
            </div>
            
            <div className="bg-warn/10 border border-warn/20 rounded-xl p-4">
              <h3 className="text-warn font-bold text-sm flex items-center gap-2 mb-2">
                <AlertTriangle size={16} />
                Xavfsizlik Ogohlantirishi
              </h3>
              <p className="text-xs text-text leading-relaxed opacity-90">
                Rol berish foydalanuvchiga moliyaviy ma'lumotlarni ko'rish va o'zgartirish huquqini beradi. Obyekt menejerlariga asosan <b>PRORAB</b> roliga ruxsat bering, shunda ular faqat FAKT yozish va material so'rash imkoniga ega bo'ladilar.
              </p>
            </div>
          </div>

          {/* MAVJUD XODIMLAR JADVALI */}
          <div className="lg:col-span-8">
            <div className="bg-surface border border-border rounded-xl shadow-xl flex flex-col h-full min-h-[400px]">
              <div className="p-0 overflow-x-auto rounded-xl">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-surface-2 border-b border-border">
                    <tr className="text-text-dim text-[11px] uppercase tracking-wider font-bold">
                      <th className="px-5 py-4">Foydalanuvchi / Login</th>
                      <th className="px-5 py-4">Sistemadagi Roli</th>
                      <th className="px-5 py-4 text-right">Amallar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {xodimlar.length === 0 && !yuklanmoqda ? (
                      <tr>
                        <td colSpan={3} className="px-5 py-8 text-center text-text-dim">
                          Bu kompaniyada hozircha xodimlar yo'q
                        </td>
                      </tr>
                    ) : yuklanmoqda ? (
                      <tr>
                        <td colSpan={3} className="px-5 py-8 text-center text-text-dim animate-pulse">
                          Yuklanmoqda...
                        </td>
                      </tr>
                    ) : (
                      xodimlar.map(x => (
                        <tr key={x.azolik_id} className={`hover:bg-bg/50 transition-colors group ${x.holat !== 'faol' ? 'opacity-50' : ''}`}>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-surface-2 border border-border flex items-center justify-center text-text-dim">
                                <Users size={14} />
                              </div>
                              <div>
                                <div className="font-bold text-white text-[13px]">{x.ism || 'Ism kiritilmagan'}</div>
                                <div className="text-[11px] text-text-dim font-mono mt-0.5">@{x.login} • {x.email || 'Email yo`q'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            {tahrirId === x.azolik_id ? (
                              <div className="flex items-center gap-2">
                                <select
                                  value={tahrirRol}
                                  onChange={e => setTahrirRol(e.target.value as AzolikRol)}
                                  className="bg-bg border border-accent rounded px-2 py-1 text-white focus:outline-none text-xs"
                                >
                                  <option value="superadmin">SUPERADMIN</option>
                                  <option value="admin">ADMIN</option>
                                  <option value="boss">BOSS</option>
                                  <option value="rahbar">RAHBAR</option>
                                  <option value="bugalter">BUGALTER</option>
                                  <option value="pto">PTO</option>
                                  <option value="prorab">PRORAB</option>
                                </select>
                                <button 
                                  onClick={() => handleSaqlash(x.azolik_id)}
                                  className="text-emerald-400 hover:text-emerald-300 p-1 bg-emerald-500/10 rounded"
                                >
                                  <Save size={14} />
                                </button>
                                <button 
                                  onClick={() => setTahrirId(null)}
                                  className="text-text-dim hover:text-white p-1"
                                >
                                  ✖
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-1 rounded text-[10px] font-bold tracking-wider uppercase border ${rolRanglari[x.rol] || 'bg-surface border-border text-text'}`}>
                                  {x.rol}
                                </span>
                                {x.holat !== 'faol' && (
                                  <span className="text-[10px] text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                                    BEKOR QILINGAN
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => {
                                  setTahrirId(x.azolik_id);
                                  setTahrirRol(x.rol);
                                }}
                                className="p-1.5 text-text-dim hover:text-sky-400 bg-surface-2 hover:bg-sky-400/10 rounded transition-colors"
                                title="Rolni o'zgartirish"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button 
                                onClick={() => handleOchirish(x.azolik_id)}
                                className="p-1.5 text-text-dim hover:text-rose-400 bg-surface-2 hover:bg-rose-400/10 rounded transition-colors"
                                title="Kompaniyadan o'chirish"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
