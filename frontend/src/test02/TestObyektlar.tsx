/**
 * TestObyektlar.tsx — TIZIM_02: obyektlar ro'yxati SUPABASE'dan
 *
 * Tizim_01 dagi «Obyektlar» sahifasining aynan shu vazifani bajaradigan
 * nusxasi, farqi — ma'lumot GAS orqali Sheets'dan emas, to'g'ridan-to'g'ri
 * Postgres'dan keladi.
 *
 * ⚠️ Ko'rsatilgan raqamlar KO'ZGUdan. Ko'zgu qachon yangilanganini bilish
 * uchun har qatorda `updated_at` ko'rsatiladi — eskirgan bo'lsa
 * foydalanuvchi buni KO'RADI va soxta ishonch hosil qilmaydi.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, RefreshCw, AlertTriangle, Trash2, Edit3 } from 'lucide-react';
import { Sahifa } from '../umumiy/ui/Sahifa';
import { FmtN } from '../lib/format';
/* WARN 2026-08-19: endi TIZIM_02 ning O’Z jadvallari o’qiladi (t2_*),
   eski ko’zgu jadvallari (obyektlar/holat) EMAS. Foydalanuvchi talabi:
   «tizim_02 ni supabase ni yangi shu tizim uchun ochilgan jadvallargagina
   bog’lash». Ikkisi aralashsa qaysi raqam qaysi tizimdan kelgani
   bilinmay qoladi. */
import { sbT2ObyektlarOlKomp, sbObyektOchirish, sbObyektTahrirlash, type T2Obyekt } from '../api/supabase';
import { toast } from '../umumiy/ui/Toast';
import { useKompaniya } from './KompaniyaTanlov';

type Qator = T2Obyekt;

/** «5 daqiqa oldin» ko'rinishi — eskirganini ko'rish uchun. */
function yosh(iso: string | null | undefined): { matn: string; eski: boolean } {
  if (!iso) return { matn: 'noma\'lum', eski: true };
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return { matn: 'noma\'lum', eski: true };
  const daq = Math.floor((Date.now() - t) / 60000);
  if (daq < 1) return { matn: 'hozirgina', eski: false };
  if (daq < 60) return { matn: daq + ' daqiqa oldin', eski: daq > 90 };
  const soat = Math.floor(daq / 60);
  if (soat < 24) return { matn: soat + ' soat oldin', eski: soat >= 2 };
  return { matn: Math.floor(soat / 24) + ' kun oldin', eski: true };
}

export default function TestObyektlar() {
  const navigate = useNavigate();
  /* ⚠️ Ro’yxat FAQAT tanlangan kompaniyaniki. Kompaniyalar aralashsa
     foydalanuvchi boshqa mijozning raqamini o’ziniki deb o’qiydi. */
  const { joriy, yuklanmoqda: kompYuklanmoqda } = useKompaniya();
  const [qatorlar, setQatorlar] = useState<Qator[] | null>(null);
  const [xato, setXato] = useState('');
  const [ms, setMs] = useState(0);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [editObj, setEditObj] = useState<Qator | null>(null);
  const [nomi, setNomi] = useState('');
  const [tur, setTur] = useState('');

  const handleOchirish = async (e: any, o: Qator) => {
    e.stopPropagation();
    if (!confirm(o.nom + " obyektini Korzinkaga o'tkazasizmi? (Drive dan ham axlat qutiga o'tadi)")) return;
    try {
      setYuklanmoqda(true);
      await sbObyektOchirish(o.id, o.nom);
      toast('Obyekt Korzinkaga o\'tkazildi', 'ok');
      yukla();
    } catch(err: any) {
      toast('Xatolik: ' + err.message, 'danger');
      setYuklanmoqda(false);
    }
  };

  const handleTahrir = (e: any, o: Qator) => {
    e.stopPropagation();
    setEditObj(o);
    setNomi(o.nom);
    setTur(o.tur || '');
  };

  const saqlashTahrir = async () => {
    if(!editObj) return;
    try {
      setYuklanmoqda(true);
      await sbObyektTahrirlash(editObj.id, nomi, tur);
      toast('Obyekt tahrirlandi', 'ok');
      setEditObj(null);
      yukla();
    } catch(err: any) {
      toast('Xatolik: ' + err.message, 'danger');
      setYuklanmoqda(false);
    }
  };

  const yukla = async () => {
    if (kompYuklanmoqda) return;          // kompaniya hali aniqlanmagan
    setYuklanmoqda(true); setXato('');
    const r = await sbT2ObyektlarOlKomp(joriy?.id);
    setMs(r.ms || 0);
    if (!r.ok) { setXato(r.error || 'O\'qilmadi'); setQatorlar(null); }
    else setQatorlar((r.qatorlar as Qator[]) || []);
    setYuklanmoqda(false);
  };

  /* Kompaniya almashsa ro’yxat qayta o’qiladi */
  useEffect(() => { yukla(); /* eslint-disable-next-line */ }, [joriy?.id, kompYuklanmoqda]);

  const jami = useMemo(() => {
    const q = qatorlar || [];
    return {
      soni: q.length,
      jami: q.reduce((a, x) => a + (Number(x.jami) || 0), 0),
      qator: q.reduce((a, x) => a + (Number(x.qator_soni) || 0), 0),
      /* ⚠️ Narx TOPILMAGAN qatorlar. >0 bo’lsa jami TO’LIQ EMAS — buni
         yashirish mumkin emas ([[narx-oz-idan-toqilmaydi]] qoidasi). */
      narxsiz: q.reduce((a, x) => a + (Number(x.narxsiz) || 0), 0),
    };
  }, [qatorlar]);

  return (
    <Sahifa
      sarlavha="Obyektlar (Tizim_02)"
      tavsif="Ma'lumot t2_ jadvallaridan — bu yerda BAZA haqiqat manbai"
      amallar={
        <button onClick={yukla} disabled={yuklanmoqda}
          className="h-9 px-3 inline-flex items-center gap-2 rounded-[10px] karta text-sm
                     text-text hover:border-[var(--accent)]/50 transition-colors
                     disabled:opacity-50">
          <RefreshCw size={15} className={yuklanmoqda ? 'animate-spin' : ''} />
          Yangilash
        </button>
      }
    >
      <div className="space-y-3">
        {editObj && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-surface border border-border p-5 rounded-xl w-[400px]">
              <h3 className="font-bold text-lg mb-4 text-text">Obyektni Tahrirlash</h3>
              <input value={nomi} onChange={e=>setNomi(e.target.value)} className="w-full bg-bg border border-border rounded p-2 mb-3 text-text outline-none focus:border-sky-500" placeholder="Yangi nomi..." />
              <input value={tur} onChange={e=>setTur(e.target.value)} className="w-full bg-bg border border-border rounded p-2 mb-4 text-text outline-none focus:border-sky-500" placeholder="Obyekt turi..." />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditObj(null)} className="px-4 py-2 rounded text-text-dim hover:bg-surface-2">Bekor qilish</button>
                <button onClick={saqlashTahrir} className="px-4 py-2 rounded bg-accent text-white">Saqlash</button>
              </div>
            </div>
          </div>
        )}
        <div className="karta p-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px]">
          <span className="inline-flex items-center gap-2 text-text">
            <Database size={14} className="text-accent" />
            <b>{jami.soni}</b> obyekt · <b>{ms}</b> ms
          </span>
          <span className="text-text-dim">Jami: <FmtN val={jami.jami} /></span>
          <span className="text-text-dim">{jami.qator} qator</span>
          {jami.narxsiz > 0 && (
            <span className="text-warn inline-flex items-center gap-1.5">
              <AlertTriangle size={13} />
              {jami.narxsiz} qator NARXLANMAGAN — jami to'liq emas
            </span>
          )}
        </div>

        {xato && (
          <div className="karta p-4 border-danger/40 bg-danger/5">
            <p className="text-[13px] text-danger flex items-center gap-2">
              <AlertTriangle size={15} /> {xato}
            </p>
          </div>
        )}

        {yuklanmoqda && !qatorlar && <div className="skel h-40 rounded-xl" />}

        {qatorlar && !qatorlar.length && !xato && (
          <div className="karta p-6 text-center">
            <p className="text-[13px] text-text-dim">
              Tizim_02 hali BO’SH — bu kutilgan holat.
            </p>
            <p className="text-[12px] text-text-mute mt-1">
              Obyekt qo’shish uchun smeta faylini import qiling (GAS: apiT2ObyektImport).
            </p>
          </div>
        )}

        {!!qatorlar?.length && (
          <div className="karta overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-border text-text-dim">
                    <th className="text-left px-3 py-2 font-medium">Obyekt</th>
                    <th className="text-right px-3 py-2 font-medium">Jami</th>
                    <th className="text-right px-3 py-2 font-medium">Razdel</th>
                    <th className="text-right px-3 py-2 font-medium">Ish</th>
                    <th className="text-right px-3 py-2 font-medium">Resurs</th>
                    <th className="text-right px-3 py-2 font-medium">Narxsiz</th>
                    <th className="text-left px-3 py-2 font-medium">Hisoblandi</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {qatorlar.map((o) => {
                    const y = yosh(o.yangilandi);
                    return (
                      <tr key={o.nom}
                        onClick={() => navigate('/admin/test/daraxt?obyekt=' + encodeURIComponent(o.nom))}
                        className="border-b border-border last:border-0 cursor-pointer
                                   hover:bg-[var(--surface-2)]/60 transition-colors">
                        <td className="px-3 py-2 text-text">{o.nom}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-text">
                          <FmtN val={Number(o.jami) || 0} /></td>
                        <td className="px-3 py-2 text-right tabular-nums text-text-dim">
                          {o.razdel ?? 0}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-text-dim">
                          {o.ish ?? 0}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-text-dim">
                          {o.resurs ?? 0}</td>
                        <td className={'px-3 py-2 text-right tabular-nums ' +
                          ((o.narxsiz ?? 0) > 0 ? 'text-warn font-medium' : 'text-text-mute')}>
                          {o.narxsiz ?? 0}</td>
                        <td className={`px-3 py-2 ${y.eski ? 'text-warn' : 'text-text-mute'}`}>
                          {y.matn}
                        </td>
                        <td className="px-3 py-2 flex items-center gap-2 justify-end">
                           <button onClick={(e) => handleTahrir(e, o)} className="p-1.5 hover:bg-sky-500/20 text-sky-500 rounded transition-colors"><Edit3 size={15}/></button>
                           <button onClick={(e) => handleOchirish(e, o)} className="p-1.5 hover:bg-red-500/20 text-red-500 rounded transition-colors"><Trash2 size={15}/></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Sahifa>
  );
}
