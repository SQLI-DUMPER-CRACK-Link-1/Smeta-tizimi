import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardList, Plus, Search, Building2, Calendar, AlertTriangle } from 'lucide-react';
import { useKompaniya } from './KompaniyaTanlov';
import { toast } from '../umumiy/ui/Toast';
import { sbZayavkalarOl, sbZayavkaYoz, type T2Zayavka, type ZayavkaHolat } from '../api/t2-zayavka';
import { sbT2ObyektlarOlKomp, type T2Obyekt } from '../api/supabase';
import { Sahifa } from '../umumiy/ui/Sahifa';
import { FmtN } from '../lib/format';

const HOLAT_RANG: Record<ZayavkaHolat, string> = {
  yangi: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  jarayonda: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  qisman: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  bajarildi: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  bekor_qilindi: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const HOLAT_NOM: Record<ZayavkaHolat, string> = {
  yangi: 'Yangi',
  jarayonda: 'Jarayonda',
  qisman: 'Qisman yetkazildi',
  bajarildi: 'Bajarildi',
  bekor_qilindi: 'Bekor qilindi',
};

export default function TestZayavka() {
  const { joriy } = useKompaniya();
  const [params] = useSearchParams();
  const initialObyekt = params.get('obyekt') || '';

  const [zayavkalar, setZayavkalar] = useState<T2Zayavka[]>([]);
  const [obyektlar, setObyektlar] = useState<T2Obyekt[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formObyektId, setFormObyektId] = useState<string>('');
  const [formMaterial, setFormMaterial] = useState('');
  const [formHajm, setFormHajm] = useState('');
  const [formBirlik, setFormBirlik] = useState('metr');
  const [formMuddat, setFormMuddat] = useState('');
  const [formIzoh, setFormIzoh] = useState('');

  const yukla = async () => {
    if (!joriy) return;
    setYuklanmoqda(true);
    
    // Obyektlar va Zayavkalarni yuklash
    const [zRes, oRes] = await Promise.all([
      sbZayavkalarOl(),
      sbT2ObyektlarOlKomp(joriy.id)
    ]);
    
    if (zRes.ok && zRes.qatorlar) setZayavkalar(zRes.qatorlar);
    if (oRes.ok && oRes.qatorlar) {
        setObyektlar(oRes.qatorlar as T2Obyekt[]);
        if (initialObyekt && !formObyektId) {
            const top = (oRes.qatorlar as T2Obyekt[]).find(o => o.nom === initialObyekt);
            if (top) setFormObyektId(top.id.toString());
        }
    }
    
    setYuklanmoqda(false);
  };

  useEffect(() => {
    yukla();
  }, [joriy]);

  const handleYuborish = async () => {
    if (!formObyektId || !formMaterial || !formHajm) {
      return toast("Iltimos barcha kerakli maydonlarni to'ldiring", "warn");
    }
    setYuklanmoqda(true);
    const r = await sbZayavkaYoz({
      obyektId: Number(formObyektId),
      tashabbuskor: 'PTO', // Hozircha hardcode, auth qo'shilganda user rolidan keladi
      material: formMaterial,
      hajm: Number(formHajm),
      birlik: formBirlik,
      muddat: formMuddat,
      izoh: formIzoh
    });
    setYuklanmoqda(false);
    
    if (r.ok) {
      toast("Zayavka yuborildi. Xaritada bildirishnoma hosil bo'ladi!", "ok");
      setIsModalOpen(false);
      setFormMaterial('');
      setFormHajm('');
      setFormIzoh('');
      yukla();
    } else {
      toast("Xato: " + r.error, "danger");
    }
  };

  return (
    <Sahifa
      sarlavha="Zayavkalar (Talabnomalar)"
      tavsif="PTO yoki Prorablar tomonidan material yoki texnikaga ehtiyoj so'rovlari"
      amallar={
        <div className="flex gap-2">
          <button onClick={yukla} className="px-3 py-1.5 rounded-lg border border-border hover:bg-surface-2 transition-colors">
            Yangilash
          </button>
          <button onClick={() => setIsModalOpen(true)} className="px-4 py-1.5 rounded-lg bg-accent text-white flex items-center gap-2">
            <Plus size={16} /> Zayavka Yaratish
          </button>
        </div>
      }
    >
      <div className="karta overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2/50 text-text-dim">
              <th className="text-left px-4 py-3 font-medium">№</th>
              <th className="text-left px-4 py-3 font-medium">Obyekt</th>
              <th className="text-left px-4 py-3 font-medium">Tashabbuskor</th>
              <th className="text-left px-4 py-3 font-medium">Material</th>
              <th className="text-right px-4 py-3 font-medium">Hajm</th>
              <th className="text-left px-4 py-3 font-medium">Holat</th>
              <th className="text-left px-4 py-3 font-medium">Sana</th>
              <th className="text-right px-4 py-3 font-medium">Amallar (Snabjeniya)</th>
            </tr>
          </thead>
          <tbody>
            {zayavkalar.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-text-mute">
                  Hozircha zayavkalar yo'q
                </td>
              </tr>
            )}
            {zayavkalar.map((z, i) => (
              <tr key={z.id} className="border-b border-border/50 hover:bg-surface-2/30">
                <td className="px-4 py-3 text-text-dim">#{z.id || i+1}</td>
                <td className="px-4 py-3 text-white font-medium flex items-center gap-2">
                  <Building2 size={14} className="text-sky-400"/>
                  {z.obyekt_nomi || 'Noma\'lum obyekt'}
                </td>
                <td className="px-4 py-3 text-text-dim">{z.tashabbuskor}</td>
                <td className="px-4 py-3 text-white">
                  {z.material}
                  {z.izoh && <p className="text-[11px] text-text-mute mt-0.5">{z.izoh}</p>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-emerald-400 font-medium">
                  <FmtN val={z.hajm} /> {z.birlik}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full border text-[11px] font-medium ${HOLAT_RANG[z.holat]}`}>
                    {HOLAT_NOM[z.holat]}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-dim text-xs">
                  {new Date(z.yaratildi).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  {z.holat === 'yangi' && (
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => alert('Birja va Tender moduliga yuboriladi...')} className="px-3 py-1.5 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 rounded-md text-[11px] font-medium transition-colors" title="Birja/Tenderga chiqarish">
                        Tenderga (Birja)
                      </button>
                      <button onClick={() => alert('Skladdan obyektga perebroska qilinib, zayavka yopiladi...')} className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-md text-[11px] font-medium transition-colors" title="Ombordan yopish (Bajarildi)">
                        Skladdan berish
                      </button>
                    </div>
                  )}
                  {z.holat === 'jarayonda' && (
                    <span className="text-[11px] text-amber-500/70">Tenderda kutilmoqda...</span>
                  )}
                  {z.holat === 'bajarildi' && (
                    <span className="text-[11px] text-emerald-500/70">Yopilgan</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border p-6 rounded-2xl w-[500px] shadow-2xl flex flex-col max-h-[90vh]">
            <h3 className="font-bold text-lg mb-4 text-white flex items-center gap-2">
              <ClipboardList className="text-accent" /> Yangi Zayavka
            </h3>
            
            <div className="space-y-4 flex-1 overflow-y-auto pr-2">
              <div>
                <label className="block text-xs text-text-dim mb-1">Obyektni tanlang *</label>
                <select value={formObyektId} onChange={e => setFormObyektId(e.target.value)} className="w-full bg-bg border border-border rounded-xl p-2.5 text-sm text-white focus:border-accent outline-none">
                  <option value="">-- Obyektni tanlang --</option>
                  {obyektlar.map(o => (
                    <option key={o.id} value={o.id}>{o.nom}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-text-dim mb-1">Material / Xizmat *</label>
                <input value={formMaterial} onChange={e => setFormMaterial(e.target.value)} placeholder="Masalan: Parog yoki Armatura d12" className="w-full bg-bg border border-border rounded-xl p-2.5 text-sm text-white focus:border-accent outline-none" />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-text-dim mb-1">Hajm (Soni) *</label>
                  <input type="number" value={formHajm} onChange={e => setFormHajm(e.target.value)} className="w-full bg-bg border border-border rounded-xl p-2.5 text-sm text-white focus:border-accent outline-none" />
                </div>
                <div className="w-1/3">
                  <label className="block text-xs text-text-dim mb-1">Birlik</label>
                  <input value={formBirlik} onChange={e => setFormBirlik(e.target.value)} className="w-full bg-bg border border-border rounded-xl p-2.5 text-sm text-white focus:border-accent outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-text-dim mb-1">Muddat (qachongacha kerak)</label>
                <input type="date" value={formMuddat} onChange={e => setFormMuddat(e.target.value)} className="w-full bg-bg border border-border rounded-xl p-2.5 text-sm text-white focus:border-accent outline-none [color-scheme:dark]" />
              </div>

              <div>
                <label className="block text-xs text-text-dim mb-1">Qo'shimcha izoh</label>
                <textarea value={formIzoh} onChange={e => setFormIzoh(e.target.value)} className="w-full bg-bg border border-border rounded-xl p-2.5 text-sm text-white focus:border-accent outline-none min-h-[80px]" placeholder="Qayerga o'rnatilishi, qanday marka..." />
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-6 pt-4 border-t border-border">
              <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl text-sm font-medium text-text-dim hover:bg-surface-2 transition-colors">Bekor qilish</button>
              <button onClick={handleYuborish} disabled={yuklanmoqda} className="px-5 py-2.5 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent/80 transition-colors shadow-lg shadow-accent/20">
                {yuklanmoqda ? 'Yuborilmoqda...' : 'Yuborish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Sahifa>
  );
}
