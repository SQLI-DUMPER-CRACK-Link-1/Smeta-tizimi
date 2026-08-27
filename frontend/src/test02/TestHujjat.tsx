import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { sbHujjatlarOl, sbHujjatYoz, sbHujjatOchir, uploadFayl, type ObyektHujjat } from '../api/t2-hujjat';
import { sbT2ObyektlarOlKomp } from '../api/supabase';
import { useKompaniya } from './KompaniyaTanlov';
import { toast } from '../umumiy/ui/Toast';
import { FileText, Upload, Trash2, FolderOpen } from 'lucide-react';

/* ⚠️ 2026-08-27 (Claude): avval bu sahifa "Cloudflare R2 Chizmalar
 * Arxivi" nomi bilan obyektga UMUMAN bog'lanmagan, ro'yxatsiz
 * bitta-fayl-yuklovchi edi (foydalanuvchi shikoyati: "arxiv r2 degan
 * tabingni nomini o'zi noto'g'ri, bu har bir obyekt tabida bo'lishi
 * kerak va unga tasdiqlangan loyiha va hujjatlar yuklab borilishi
 * kerak"). Endi: obyekt tanlanadi (yoki mindmap/obyekt sahifasidan
 * ?obyektId= bilan ochiladi), fayl haqiqiy R2 ga yuklanadi va
 * t2_obyekt_hujjat ga (turi: loyiha|hujjat) yozib boriladi — ro'yxat,
 * o'chirish bilan birga. */
export default function TestHujjat() {
  const { joriy } = useKompaniya();
  const [params] = useSearchParams();
  const obyektIdParam = params.get('obyektId');

  const [obyektlar, setObyektlar] = useState<any[]>([]);
  const [obyektId, setObyektId] = useState<number | null>(obyektIdParam ? Number(obyektIdParam) : null);
  const [data, setData] = useState<ObyektHujjat[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [xato, setXato] = useState('');

  const [fayl, setFayl] = useState<File | null>(null);
  const [turi, setTuri] = useState<'loyiha' | 'hujjat'>('hujjat');
  const [izoh, setIzoh] = useState('');
  const [yozilmoqda, setYozilmoqda] = useState(false);

  useEffect(() => {
    if (!joriy?.id) return;
    sbT2ObyektlarOlKomp(joriy.id).then((r: any) => setObyektlar(r?.qatorlar || r || []));
  }, [joriy]);

  const yukla = () => {
    if (!obyektId) { setData([]); return; }
    setYuklanmoqda(true);
    setXato('');
    sbHujjatlarOl(obyektId).then((r) => {
      setYuklanmoqda(false);
      if (r.ok) setData(r.qatorlar || []);
      else setXato(r.error || 'O\'qilmadi');
    });
  };

  useEffect(() => { yukla(); }, [obyektId]);

  const yuklashVaSaqlash = async () => {
    if (!obyektId) { toast('Avval obyekt tanlang', 'danger'); return; }
    if (!fayl) { toast('Fayl tanlanmagan', 'danger'); return; }
    setYozilmoqda(true);
    try {
      const yuk = await uploadFayl(fayl);
      if (!yuk.ok) { toast('Fayl yuklanmadi: ' + (yuk.error || ''), 'danger'); setYozilmoqda(false); return; }
      const r = await sbHujjatYoz({ obyektId, turi, nom: fayl.name, url: yuk.url, izoh: izoh || undefined });
      if (r.ok) {
        toast('Hujjat saqlandi', 'ok');
        setFayl(null); setIzoh('');
        yukla();
      } else {
        toast('Saqlanmadi: ' + (r.error || ''), 'danger');
      }
    } catch (e: any) {
      toast('Xatolik: ' + (e?.message || String(e)), 'danger');
    }
    setYozilmoqda(false);
  };

  const ochirish = async (h: ObyektHujjat) => {
    if (!confirm('"' + h.nom + '" hujjatini o\'chirasizmi?')) return;
    const r = await sbHujjatOchir(h.id);
    if (r.ok) { toast('O\'chirildi', 'ok'); yukla(); }
    else toast('O\'chirilmadi: ' + (r.error || ''), 'danger');
  };

  return (
    <div className="p-6 bg-zinc-900 text-white min-h-screen">
      <div className="mb-6 border-b border-zinc-800 pb-4">
        <h1 className="text-2xl font-bold text-sky-400 flex items-center gap-2">
          <FolderOpen /> Obyekt hujjatlari
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Tasdiqlangan loyiha chizmalari va boshqa hujjatlar — har biri aniq obyektga bog'lanadi.
        </p>
      </div>

      <div className="mb-4 max-w-md">
        <label className="block text-sm text-zinc-400 mb-1">Obyekt</label>
        <select
          value={obyektId ?? ''}
          onChange={(e) => setObyektId(e.target.value ? Number(e.target.value) : null)}
          className="w-full bg-zinc-800 border border-zinc-700 p-2 rounded"
        >
          <option value="">— tanlang —</option>
          {obyektlar.map((o: any) => (
            <option key={o.id} value={o.id}>{o.nom}</option>
          ))}
        </select>
      </div>

      {!obyektId ? (
        <div className="p-8 text-center text-zinc-600 font-medium border border-zinc-800 rounded-lg">
          Hujjatlarni ko'rish/yuklash uchun avval obyekt tanlang.
        </div>
      ) : (
        <>
          <div className="border border-zinc-700 p-4 bg-black rounded-lg mb-6 flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Fayl</label>
              <input type="file" onChange={(e) => setFayl(e.target.files?.[0] || null)} className="text-sm" />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Turi</label>
              <select value={turi} onChange={(e) => setTuri(e.target.value as any)} className="bg-zinc-800 border border-zinc-700 p-2 rounded text-sm">
                <option value="hujjat">Boshqa hujjat</option>
                <option value="loyiha">Loyiha chizmasi (tasdiqlangan)</option>
              </select>
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs text-zinc-500 mb-1">Izoh</label>
              <input value={izoh} onChange={(e) => setIzoh(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 p-2 rounded text-sm" placeholder="ixtiyoriy" />
            </div>
            <button onClick={yuklashVaSaqlash} disabled={yozilmoqda || !fayl}
              className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 px-4 py-2 rounded flex items-center gap-2 text-sm">
              <Upload size={16} /> {yozilmoqda ? 'Yuklanmoqda...' : 'Yuklash'}
            </button>
          </div>

          {xato && <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 text-red-400 rounded-lg text-sm">{xato}</div>}

          <div className="border border-zinc-800 rounded-lg overflow-hidden">
            {yuklanmoqda ? (
              <div className="p-8 text-center text-zinc-500 animate-pulse">Yuklanmoqda...</div>
            ) : data.length === 0 ? (
              <div className="p-8 text-center text-zinc-600 font-medium">Bu obyektda hali hujjat yo'q.</div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-800 text-zinc-400">
                  <tr>
                    <th className="p-3">Nomi</th>
                    <th className="p-3">Turi</th>
                    <th className="p-3">Izoh</th>
                    <th className="p-3">Kim / Qachon</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((h) => (
                    <tr key={h.id} className="border-t border-zinc-800/50 hover:bg-zinc-800/30">
                      <td className="p-3">
                        <a href={h.url} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline flex items-center gap-2">
                          <FileText size={14} /> {h.nom}
                        </a>
                      </td>
                      <td className="p-3">
                        <span className={'px-2 py-0.5 rounded text-xs ' + (h.turi === 'loyiha' ? 'bg-emerald-900/40 text-emerald-300' : 'bg-zinc-800 text-zinc-400')}>
                          {h.turi === 'loyiha' ? 'Loyiha chizmasi' : 'Hujjat'}
                        </span>
                      </td>
                      <td className="p-3 text-zinc-400">{h.izoh || '-'}</td>
                      <td className="p-3 text-zinc-500 text-xs">{h.kim || '-'} · {(h.yaratildi || '').substring(0, 10)}</td>
                      <td className="p-3">
                        <button onClick={() => ochirish(h)} className="text-red-400 hover:text-red-300">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
