import { useState, useEffect } from 'react';
import { sbKorzinkaOqish, sbKorzinkadanTiklash, sbButunlayOchirish } from '../api/supabase';
import { Trash2, RefreshCw, AlertTriangle, Building2, FileText, Package } from 'lucide-react';
import { toast } from '../umumiy/ui/Toast';
import { useKompaniya } from './KompaniyaTanlov';

export default function TestKorzinka() {
  const { joriy } = useKompaniya();
  const [items, setItems] = useState<any[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [xato, setXato] = useState('');
  const [tab, setTab] = useState<'t2_obyekt' | 't2_shaxsiy_smeta' | 't2_sklad_harakat'>('t2_obyekt');

  const yuklash = async () => {
    setYuklanmoqda(true);
    setXato('');
    const res = await sbKorzinkaOqish(joriy?.id);
    setYuklanmoqda(false);
    if (res.ok) {
      setItems(res.qatorlar || []);
    } else {
      setXato(res.error || 'O\'qilmadi');
      setItems([]);
    }
  };

  useEffect(() => {
    yuklash();
  }, [joriy]);

  const handleTiklash = async (id: number, nomi: string) => {
    try {
      await sbKorzinkadanTiklash(tab, id, nomi);
      toast('Muvaffaqiyatli tiklandi', 'ok');
      yuklash();
    } catch(e) {
      toast('Xatolik yuz berdi', 'danger');
    }
  };

  const handleOchirish = async (id: number, nomi: string) => {
    if (!confirm('Rostdan ham butunlay o\'chirasizmi? (Drive dan ham o\'chib ketadi!)')) return;
    try {
      await sbButunlayOchirish(tab, id, nomi);
      toast('Butunlay o\'chirildi', 'ok');
      yuklash();
    } catch(e) {
      toast('Xatolik yuz berdi', 'danger');
    }
  };

  const currentItems = items.filter(i => i.jadval === tab);

  return (
    <div className="p-6 h-full flex flex-col bg-bg">
      <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
        <div className="p-3 bg-red-500/20 text-red-500 rounded-xl">
          <Trash2 size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-2">
            Korzinka 
            <span className="text-xs px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded">
              Xavfli Hudud
            </span>
          </h1>
          <p className="text-sm text-text-dim">
            O'chirilgan obyektlar, smetalar va hujjatlar (Supabase + Google Drive)
          </p>
        </div>
        <button onClick={yuklash} className="ml-auto p-2 bg-surface hover:bg-surface-2 text-text rounded-lg">
          <RefreshCw size={18} className={yuklanmoqda ? "animate-spin" : ""} />
        </button>
      </div>

      {xato && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 text-red-400 rounded-lg text-sm">
          {xato}
        </div>
      )}

      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('t2_obyekt')} className={"px-4 py-2 rounded-lg font-medium flex items-center gap-2 " + (tab === 't2_obyekt' ? 'bg-accent text-white' : 'bg-surface text-text hover:bg-surface-2')}>
          <Building2 size={16}/> Obyektlar
        </button>
        <button onClick={() => setTab('t2_shaxsiy_smeta')} className={"px-4 py-2 rounded-lg font-medium flex items-center gap-2 " + (tab === 't2_shaxsiy_smeta' ? 'bg-accent text-white' : 'bg-surface text-text hover:bg-surface-2')}>
          <FileText size={16}/> Smetalar
        </button>
        <button onClick={() => setTab('t2_sklad_harakat')} className={"px-4 py-2 rounded-lg font-medium flex items-center gap-2 " + (tab === 't2_sklad_harakat' ? 'bg-accent text-white' : 'bg-surface text-text hover:bg-surface-2')}>
          <Package size={16}/> Sklad Hujjatlari
        </button>
      </div>

      <div className="flex-1 bg-surface border border-border rounded-xl overflow-hidden flex flex-col">
        {yuklanmoqda ? (
          <div className="flex-1 flex items-center justify-center text-text-dim">Yuklanmoqda...</div>
        ) : currentItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-text-dim">
            <Trash2 size={48} className="mb-4 opacity-20" />
            <p>Korzinka bo'sh</p>
          </div>
        ) : (
          <div className="overflow-auto p-2 space-y-2">
            {currentItems.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-bg border border-border rounded-lg hover:border-red-500/30 transition-colors">
                <div>
                  <h3 className="font-bold text-text">{item.nomi || item.nom || 'Nomsiz'}</h3>
                  <p className="text-xs text-text-dim">O'chirilgan vaqt: {new Date(item.ochirilgan_vaqt).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleTiklash(item.id, item.nomi || item.nom || 'Nomsiz')} className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded flex items-center gap-1 text-sm font-medium transition-colors">
                    <RefreshCw size={14}/> Tiklash
                  </button>
                  <button onClick={() => handleOchirish(item.id, item.nomi || item.nom || 'Nomsiz')} className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded flex items-center gap-1 text-sm font-medium transition-colors">
                    <AlertTriangle size={14}/> Butunlay O'chirish
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
