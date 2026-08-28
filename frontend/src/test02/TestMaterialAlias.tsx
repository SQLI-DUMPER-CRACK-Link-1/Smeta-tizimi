import React, { useState, useEffect } from 'react';
import { Network, Plus, Save, Trash2, RefreshCw, Layers, Sparkles } from 'lucide-react';
import { useKompaniya } from './KompaniyaTanlov';
import { toast } from '../umumiy/ui/Toast';
import { 
  sbMaterialAliaslarOl, 
  sbMaterialAliasYoz, 
  sbMaterialAliasOchir, 
  type MaterialAlias 
} from '../api/t2-material-alias';

export default function TestMaterialAlias() {
  const { joriy } = useKompaniya();
  const [aliaslar, setAliaslar] = useState<MaterialAlias[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  
  const [form, setForm] = useState({
    aliasNom: '',
    kanonikNomKey: '',
    kanonikBirlikKey: ''
  });
  
  const [qoshmoqda, setQoshmoqda] = useState(false);

  const yukla = async () => {
    setYuklanmoqda(true);
    try {
      // Hozirgi kompaniyaning aliaslari (yoki null bo'lsa global)
      const res = await sbMaterialAliaslarOl(joriy?.id || null);
      setAliaslar(res.qatorlar || []);
    } catch (e: any) {
      toast(e.message, 'danger');
    } finally {
      setYuklanmoqda(false);
    }
  };

  useEffect(() => {
    yukla();
  }, [joriy]);

  const handleSaqlash = async () => {
    if (!form.aliasNom || !form.kanonikNomKey) {
      return toast("Alias va Kanonik kalit majburiy!", "warn");
    }
    
    setQoshmoqda(true);
    try {
      await sbMaterialAliasYoz({
        aliasNom: form.aliasNom,
        kanonikNomKey: form.kanonikNomKey,
        kanonikBirlikKey: form.kanonikBirlikKey || undefined,
        kompaniyaId: joriy?.id
      });
      toast("Material aliasingiz saqlandi", "ok");
      setForm({ aliasNom: '', kanonikNomKey: '', kanonikBirlikKey: '' });
      yukla();
    } catch (e: any) {
      toast(e.message, 'danger');
    } finally {
      setQoshmoqda(false);
    }
  };

  const handleOchirish = async (id: number) => {
    if (!confirm("O'chirishni tasdiqlaysizmi?")) return;
    try {
      await sbMaterialAliasOchir(id);
      toast("Alias o'chirildi", "ok");
      yukla();
    } catch (e: any) {
      toast(e.message, 'danger');
    }
  };

  return (
    <div className="h-full flex flex-col bg-bg">
      <div className="p-4 border-b border-border flex items-center justify-between bg-surface z-10 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="text-amber-500" />
            Material Semantikasi (AI Config)
          </h1>
          <p className="text-xs text-text-dim mt-1">
            Har xil yozilgan material nomlarini bitta standart <b>Kanonik</b> kodga bog'lash
          </p>
        </div>
        <button onClick={yukla} className="p-2 text-text-dim hover:text-white transition-colors bg-surface-2 rounded-lg border border-border">
          <RefreshCw size={16} className={yuklanmoqda ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* YANGI QO'SHISH */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-surface border border-border rounded-xl shadow-xl p-5">
              <h2 className="font-bold text-white mb-4 border-b border-border pb-2 flex items-center gap-2">
                <Network size={16} className="text-amber-500" />
                Yangi Bog'lanish
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-text-dim mb-1 uppercase tracking-wider">Erkin Yozilish (Alias) *</label>
                  <input 
                    type="text"
                    value={form.aliasNom}
                    onChange={e => setForm(p => ({...p, aliasNom: e.target.value}))}
                    placeholder="Masalan: M-200 beton, sement M400"
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white font-mono focus:border-amber-500 outline-none text-sm"
                  />
                  <p className="text-[10px] text-text-dim mt-1">AI ushbu yozuvni qidirganda kanonik kodga o'tkazadi.</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-dim mb-1 uppercase tracking-wider flex items-center justify-between">
                    <span>Kanonik Nom (Key) *</span>
                    <Sparkles size={12} className="text-amber-500" />
                  </label>
                  <input 
                    type="text"
                    value={form.kanonikNomKey}
                    onChange={e => setForm(p => ({...p, kanonikNomKey: e.target.value}))}
                    placeholder="Masalan: M200"
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white focus:border-amber-500 outline-none text-sm font-bold tracking-wider"
                  />
                  <p className="text-[10px] text-text-dim mt-1">Smeta yoki Narxlash bazasidagi qat'iy nom/kod.</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-dim mb-1 uppercase tracking-wider">Kanonik Birlik</label>
                  <input 
                    type="text"
                    value={form.kanonikBirlikKey}
                    onChange={e => setForm(p => ({...p, kanonikBirlikKey: e.target.value}))}
                    placeholder="m3, tn, kg (ixtiyoriy)"
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white focus:border-amber-500 outline-none text-sm"
                  />
                </div>

                <div className="pt-2 border-t border-border mt-2">
                  <button 
                    onClick={handleSaqlash}
                    disabled={qoshmoqda || !form.aliasNom || !form.kanonikNomKey}
                    className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:hover:bg-amber-500 text-black px-4 py-2.5 rounded-lg font-bold flex justify-center items-center gap-2 transition-colors shadow-lg shadow-amber-500/20 text-sm"
                  >
                    {qoshmoqda ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                    Bog'lash
                  </button>
                </div>
              </div>
            </div>
            
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
              <h3 className="text-amber-500 font-bold text-sm flex items-center gap-2 mb-2">
                <Sparkles size={16} />
                Global va Lokal
              </h3>
              <p className="text-xs text-text leading-relaxed opacity-90">
                Agar siz admin sifatida kirsangiz va hech qanday kompaniya tanlanmagan bo'lsa, bu <b>Global AI qoidasiga</b> aylanadi va barcha foydalanuvchilar qidiruviga yordam beradi. Agar kompaniya tanlangan bo'lsa, bu faqat sizning obyektlaringiz uchun ishlaydi.
              </p>
            </div>
          </div>

          {/* JADVAL */}
          <div className="lg:col-span-8">
            <div className="bg-surface border border-border rounded-xl shadow-xl flex flex-col h-full min-h-[400px]">
              <div className="p-0 overflow-x-auto rounded-xl">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-surface-2 border-b border-border">
                    <tr className="text-text-dim text-[11px] uppercase tracking-wider font-bold">
                      <th className="px-5 py-4">Erkin Yozuv (Alias)</th>
                      <th className="px-5 py-4">Kanonik Standart (Key)</th>
                      <th className="px-5 py-4">Turi</th>
                      <th className="px-5 py-4 text-right">Amallar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {aliaslar.length === 0 && !yuklanmoqda ? (
                      <tr>
                        <td colSpan={4} className="px-5 py-8 text-center text-text-dim">
                          Hali hech qanday alias kiritilmagan.
                        </td>
                      </tr>
                    ) : yuklanmoqda ? (
                      <tr>
                        <td colSpan={4} className="px-5 py-8 text-center text-text-dim animate-pulse">
                          Yuklanmoqda...
                        </td>
                      </tr>
                    ) : (
                      aliaslar.map(a => (
                        <tr key={a.id} className="hover:bg-bg/50 transition-colors group">
                          <td className="px-5 py-3">
                            <div className="font-bold text-white text-[13px]">{a.alias_nom}</div>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-[12px] text-amber-400 bg-amber-500/10 px-2 py-1 rounded font-mono border border-amber-500/20">
                                {a.kanonik_nom_key}
                              </span>
                              {a.kanonik_birlik_key && (
                                <span className="text-[11px] text-text-dim">
                                  / {a.kanonik_birlik_key}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            {a.kompaniya_id === null ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border border-border bg-surface-2 text-text">
                                Global
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
                                Lokal
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => handleOchirish(a.id)}
                                className="p-1.5 text-text-dim hover:text-rose-400 bg-surface-2 hover:bg-rose-400/10 rounded transition-colors"
                                title="O'chirish"
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
