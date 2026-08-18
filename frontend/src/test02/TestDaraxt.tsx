/**
 * TestDaraxt.tsx — TIZIM_02: og'ir smeta daraxti SUPABASE'dan
 *
 * Foydalanuvchining asosiy sinovi: «og'ir smeta daraxtlarini ochmoqchiman,
 * shunda sinovdan o'ta olishi kerak».
 *
 * Daraxtni MAVJUD komponent chizadi (`umumiy/daraxt/SmetaTree`) — virtual
 * ro'yxat, qidiruv, ranglar, yoyish/yig'ish. Bu ataylab: ikkita boshqa-boshqa
 * daraxt ikki xil ko'rinadi va ikki xil buziladi. Bu yerda faqat MANBA
 * boshqacha (Postgres), chizish bir xil.
 *
 * ⚠️ Faqat O'QISH. Tahrir rejimi ochilmaydi — Tizim_02 hozircha yozmaydi.
 */
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Database, Play, AlertTriangle, Layers } from 'lucide-react';
import { Sahifa } from '../umumiy/ui/Sahifa';
import { SmetaTree } from '../umumiy/daraxt/SmetaTree';
import { FmtN } from '../lib/format';
import { useObyektlar } from '../api/hooks';
import { sbHolatOl, sbTreeQur } from '../api/supabase';
import type { TreeNode } from '../api/types';

export default function TestDaraxt() {
  const [params, setParams] = useSearchParams();
  const obyektlar = useObyektlar();
  const [obyekt, setObyekt] = useState(params.get('obyekt') || '');
  const [tree, setTree] = useState<TreeNode[] | null>(null);
  const [xato, setXato] = useState('');
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [olcham, setOlcham] = useState<{
    ms: number; qatorlar: number; soro?: number; toliq?: boolean;
    jamiServerda?: number | null; qurishMs: number;
  } | null>(null);

  const ochish = useCallback(async (nom: string) => {
    if (!nom) return;
    setYuklanmoqda(true); setXato(''); setTree(null); setOlcham(null);

    const r = await sbHolatOl(nom);
    if (!r.ok) {
      setXato(r.error || 'O\'qilmadi');
      setYuklanmoqda(false);
      return;
    }
    const q = r.qatorlar || [];
    /* Daraxt qurish vaqtini ALOHIDA o'lchaymiz: sekinlik tarmoqdanmi
       yoki brauzerdagi ishlovdanmi — buni bilmasdan optimallashtirish
       taxminga aylanadi. */
    const t0 = performance.now();
    const t = sbTreeQur(q);
    const qurishMs = Math.round(performance.now() - t0);

    setTree(t);
    setOlcham({ ms: r.ms || 0, qatorlar: q.length, soro: r.soro,
                toliq: r.toliq, jamiServerda: r.jamiServerda, qurishMs });
    setYuklanmoqda(false);
  }, []);

  /* Obyektlar sahifasidan havola bilan kelinsa — darhol ochamiz */
  useEffect(() => {
    const q = params.get('obyekt');
    if (q && q !== obyekt) { setObyekt(q); ochish(q); }
    else if (q && !tree && !yuklanmoqda) ochish(q);
    /* eslint-disable-next-line */
  }, [params]);

  const toliqEmas = olcham?.toliq === false;

  return (
    <Sahifa
      sarlavha="Smeta daraxti (Tizim_02)"
      tavsif="Og'ir daraxtni Supabase'dan ochish sinovi — faqat o'qish"
    >
      <div className="flex flex-col h-full min-h-0 gap-3">
        <div className="karta p-3 flex-shrink-0">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[260px]">
              <label className="text-[12px] font-medium text-text block mb-1.5">
                Obyekt
              </label>
              <input list="test-obyektlar" value={obyekt}
                onChange={(e) => setObyekt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { setParams({ obyekt }); ochish(obyekt); } }}
                placeholder="obyekt nomini tanlang yoki yozing"
                className="w-full bg-[var(--surface-2)] border border-border rounded-lg
                           px-3 py-2 text-[13px] text-text outline-none focus:border-accent/50" />
              <datalist id="test-obyektlar">
                {(obyektlar.data ?? []).map((o: any) => (
                  <option key={o.obyekt} value={o.obyekt} />
                ))}
              </datalist>
            </div>
            <button onClick={() => { setParams({ obyekt }); ochish(obyekt); }}
              disabled={!obyekt || yuklanmoqda}
              className="px-4 py-2 rounded-lg bg-accent text-white text-[13px] font-medium
                         hover:bg-accent/90 transition-colors disabled:opacity-40
                         inline-flex items-center gap-2">
              <Play size={15} />
              {yuklanmoqda ? 'Ochilmoqda…' : 'Ochish'}
            </button>
          </div>

          {olcham && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2.5 text-[11px]">
              <span className="inline-flex items-center gap-1.5 text-text">
                <Database size={13} className="text-accent" />
                <b>{olcham.ms}</b> ms — o'qish
                {olcham.soro && olcham.soro > 1 && (
                  <span className="text-text-mute"> ({olcham.soro} so'rov)</span>
                )}
              </span>
              <span className="inline-flex items-center gap-1.5 text-text-dim">
                <Layers size={13} />
                <b>{olcham.qurishMs}</b> ms — daraxt qurish
              </span>
              <span className="text-text-dim">{olcham.qatorlar} qator</span>
              {toliqEmas && (
                <span className="text-warn">
                  ⚠️ to'liq emas ({olcham.jamiServerda ?? '?'} dan) — bu daraxt
                  YARIM, hisob-kitob qilmang
                </span>
              )}
            </div>
          )}
        </div>

        {xato && (
          <div className="karta p-4 border-danger/40 bg-danger/5 flex-shrink-0">
            <p className="text-[13px] text-danger flex items-center gap-2">
              <AlertTriangle size={15} /> {xato}
            </p>
          </div>
        )}

        {yuklanmoqda && <div className="skel flex-1 rounded-xl min-h-[300px]" />}

        {tree && !tree.length && !yuklanmoqda && (
          <div className="karta p-6 text-center flex-shrink-0">
            <p className="text-[13px] text-text-dim">
              Bu obyekt uchun ko'zguda ma'lumot yo'q.
            </p>
            <p className="text-[12px] text-text-mute mt-1">
              Tizim_01 → Supabase bo'limidan sinxronizatsiyani ishga tushiring.
            </p>
          </div>
        )}

        {!!tree?.length && (
          <>
            <div className="karta p-2.5 flex-shrink-0 flex flex-wrap gap-x-5 gap-y-1 text-[11px]">
              <span className="text-text-dim">
                Razdel: <b className="text-text">{tree.length}</b>
              </span>
              <span className="text-text-dim">
                Smeta: <b className="text-text"><FmtN val={tree.reduce((a, r) => a + (r.smeta || 0), 0)} /></b>
              </span>
              <span className="text-text-dim">
                Fakt: <b className="text-text"><FmtN val={tree.reduce((a, r) => a + (r.stFakt || 0), 0)} /></b>
              </span>
              <span className="text-text-dim">
                Ф2: <b className="text-text"><FmtN val={tree.reduce((a, r) => a + (r.stF2 || 0), 0)} /></b>
              </span>
            </div>
            <div className="flex-1 min-h-0">
              <SmetaTree data={tree} />
            </div>
          </>
        )}
      </div>
    </Sahifa>
  );
}
