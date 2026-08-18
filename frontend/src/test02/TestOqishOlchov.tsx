/**
 * TestOqishOlchov.tsx — «GAS faqat O'QISA qancha vaqt oladi?»
 *
 * Foydalanuvchining e'tirozi: «katta smetalarda gas juda sekin va ko'p
 * time limitiga urar edida — shuning uchun ikkilanib qoldim».
 *
 * E'tiroz o'rinli, shuning uchun QAROR TAXMIN BILAN QABUL QILINMAYDI.
 * Bu sahifa haqiqiy obyektni GAS orqali FAQAT O'QIYDI (hech narsa
 * yozmaydi) va vaqtni bosqichlarga bo'lib ko'rsatadi.
 *
 * Solishtirish uchun: Tizim_01 dagi to'liq ishlash bunga QO'SHIMCHA
 * ravishda LRV_PLUS varag'ini quradi — 21 ta merge, 51 ta formula,
 * varaq yaratish/o'chirish. Vaqtning katta qismi o'shanga ketadi.
 * Agar shu sahifadagi raqam kichik chiqsa — GAS ni «o'quvchi» sifatida
 * qoldirish xavfsiz degani.
 */
import { useState } from 'react';
import { Timer, Play, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { Sahifa } from '../umumiy/ui/Sahifa';
import { useObyektlar } from '../api/hooks';
import { gas } from '../api/client';

type Natija = {
  ok: boolean;
  obyekt?: string;
  xabar?: string;
  fayllar?: Array<{ nom: string; varaqlar: number; qatorlar: number; kataklar: number; xato: string }>;
  jami?: {
    fayl: number; qator: number; katak: number;
    msPapkaTopish: number; msRoyxat: number;
    msFaylOchish: number; msQatorOqish: number; msJami: number;
  };
  izoh?: string;
};

export default function TestOqishOlchov() {
  const obyektlar = useObyektlar();
  const [obyekt, setObyekt] = useState('');
  const [natija, setNatija] = useState<Natija | null>(null);
  const [toliqMs, setToliqMs] = useState(0);
  const [ishlayapti, setIshlayapti] = useState(false);
  const [xato, setXato] = useState('');

  const olcha = async () => {
    if (!obyekt) return;
    setIshlayapti(true); setXato(''); setNatija(null);
    const t0 = performance.now();
    try {
      const r = await gas<Natija>('apiT2OqishOlchov', obyekt);
      setToliqMs(Math.round(performance.now() - t0));
      setNatija(r);
      if (!r?.ok) setXato(r?.xabar || 'O\'lchab bo\'lmadi');
    } catch (e: any) {
      setToliqMs(Math.round(performance.now() - t0));
      setXato(e?.message || String(e));
    }
    setIshlayapti(false);
  };

  const j = natija?.jami;

  return (
    <Sahifa
      sarlavha="GAS o'qish tezligi"
      tavsif="GAS faqat o'qisa qancha vaqt oladi — hech narsa yozilmaydi"
    >
      <div className="space-y-3 max-w-4xl">
        <div className="karta p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[260px]">
              <label className="text-[12px] font-medium text-text block mb-1.5">
                Obyekt (eng kattasini tanlang — sinov shunda ma'noli)
              </label>
              <input list="olchov-obyektlar" value={obyekt}
                onChange={(e) => setObyekt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') olcha(); }}
                placeholder="obyekt nomini tanlang yoki yozing"
                className="w-full bg-[var(--surface-2)] border border-border rounded-lg
                           px-3 py-2 text-[13px] text-text outline-none focus:border-accent/50" />
              <datalist id="olchov-obyektlar">
                {(obyektlar.data ?? []).map((o: any) => (
                  <option key={o.obyekt} value={o.obyekt} />
                ))}
              </datalist>
            </div>
            <button onClick={olcha} disabled={!obyekt || ishlayapti}
              className="px-4 py-2 rounded-lg bg-accent text-white text-[13px] font-medium
                         hover:bg-accent/90 transition-colors disabled:opacity-40
                         inline-flex items-center gap-2">
              <Play size={15} />
              {ishlayapti ? 'O‘lchanmoqda…' : 'O‘lchash'}
            </button>
          </div>
          <p className="text-[11px] text-text-mute mt-2">
            Faqat o‘qiladi: papka topiladi, fayllar ochiladi, qatorlar o‘qiladi.
            Sheets qurish, merge, formula — <b>YO‘Q</b>.
          </p>
        </div>

        {xato && (
          <div className="karta p-4 border-danger/40 bg-danger/5">
            <p className="text-[13px] text-danger flex items-center gap-2">
              <AlertTriangle size={15} /> {xato}
            </p>
          </div>
        )}

        {ishlayapti && <div className="skel h-32 rounded-xl" />}

        {j && (
          <>
            <div className="karta p-4">
              <p className="text-[12px] font-medium text-text mb-3 flex items-center gap-2">
                <Timer size={15} className="text-accent" /> Vaqt taqsimoti
              </p>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-[30px] font-bold text-accent tabular-nums leading-none">
                  {j.msJami}
                </span>
                <span className="text-[13px] text-text-dim">ms — GAS ichida</span>
                <span className="text-[11px] text-text-mute ml-2">
                  (brauzergacha to‘liq yo‘l: {toliqMs} ms)
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                <Qism nom="Papka topish" ms={j.msPapkaTopish} jami={j.msJami} />
                <Qism nom="Fayl ro‘yxati" ms={j.msRoyxat} jami={j.msJami} />
                <Qism nom="Fayl ochish" ms={j.msFaylOchish} jami={j.msJami} />
                <Qism nom="Qator o‘qish" ms={j.msQatorOqish} jami={j.msJami} />
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 pt-3 border-t border-border text-[11px] text-text-dim">
                <span><b className="text-text">{j.fayl}</b> fayl</span>
                <span><b className="text-text">{j.qator.toLocaleString('ru-RU')}</b> qator</span>
                <span><b className="text-text">{j.katak.toLocaleString('ru-RU')}</b> katak</span>
              </div>
            </div>

            {natija?.izoh && (
              <div className="karta p-3 border-accent/30 bg-accent/5">
                <p className="text-[11px] text-text-dim leading-relaxed">{natija.izoh}</p>
              </div>
            )}

            {!!natija?.fayllar?.length && (
              <div className="karta overflow-hidden">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-border text-text-dim">
                      <th className="text-left px-3 py-2 font-medium">Fayl</th>
                      <th className="text-right px-3 py-2 font-medium">Varaq</th>
                      <th className="text-right px-3 py-2 font-medium">Qator</th>
                      <th className="text-right px-3 py-2 font-medium">Katak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {natija.fayllar.map((f, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 text-text">
                          <span className="inline-flex items-center gap-1.5">
                            <FileSpreadsheet size={12} className="text-accent flex-shrink-0" />
                            <span className="truncate max-w-[380px]">{f.nom}</span>
                          </span>
                          {f.xato && <div className="text-warn mt-0.5">{f.xato}</div>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-text-dim">{f.varaqlar}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-text-dim">
                          {f.qatorlar.toLocaleString('ru-RU')}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-text-dim">
                          {f.kataklar.toLocaleString('ru-RU')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </Sahifa>
  );
}

function Qism({ nom, ms, jami }: { nom: string; ms: number; jami: number }) {
  const foiz = jami > 0 ? Math.round((ms / jami) * 100) : 0;
  return (
    <div>
      <p className="text-text-mute mb-0.5">{nom}</p>
      <p className="text-text font-medium tabular-nums">{ms} ms</p>
      <div className="h-1 rounded bg-[var(--surface-2)] mt-1 overflow-hidden">
        <div className="h-full bg-accent" style={{ width: foiz + '%' }} />
      </div>
      <p className="text-text-mute mt-0.5">{foiz}%</p>
    </div>
  );
}
