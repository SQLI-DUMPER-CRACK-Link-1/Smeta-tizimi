/**
 * QatorTahrir.tsx — TIZIM_02: bitta qatorni tahrirlash (ziddiyat bilan)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Bu — reja bo'yicha C bosqichi: BIRINCHI teng klientning yozuvi.
 *
 * ⚠️ ZIDDIYAT — «xato» EMAS, normal holat.
 * Foydalanuvchi misoli bilan:
 *     10:00:01  Frontend → narx = 20 000
 *     10:00:02  Sheets   → narx = 21 000
 * Ikkinchisi eski versiyani ko'rgan bo'lsa, baza uni RAD ETADI va joriy
 * qiymatni qaytaradi. Bu yerda o'sha holat aniq tushuntiriladi va
 * foydalanuvchiga tanlov beriladi — «yangi qiymatni olish» yoki
 * «o'zimniki bilan qayta yozish».
 *
 * «Oxirgi yozgan yutadi» qoidasi moliyaviy ma'lumotda qabul qilinmaydi:
 * birovning ishi jim yo'qoladi va buni hech kim sezmaydi.
 */
import { useState } from 'react';
import { X, Save, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from '../umumiy/ui/Toast';
import { sbT2QatorTahrir, type T2TahrirNatija } from '../api/supabase';

export type TahrirNishon = {
  qatorId: number;
  versiya: number;
  nom: string;
  maydon: 'nom' | 'hajm' | 'narx' | 'birlik' | 'kat';
  joriyQiymat: string;
};

const MAYDON_NOMI: Record<TahrirNishon['maydon'], string> = {
  nom: 'Nomi', hajm: 'Hajm', narx: 'Narx', birlik: 'Birlik', kat: 'Kategoriya',
};

export function QatorTahrir({
  nishon, yop, saqlandi,
}: {
  nishon: TahrirNishon;
  yop: () => void;
  saqlandi: (yangiVersiya: number) => void;
}) {
  const [qiymat, setQiymat] = useState(nishon.joriyQiymat);
  const [ketyapti, setKetyapti] = useState(false);
  const [ziddiyat, setZiddiyat] = useState<T2TahrirNatija | null>(null);

  const saqla = async (kutilganVersiya: number) => {
    setKetyapti(true); setZiddiyat(null);
    const r = await sbT2QatorTahrir(nishon.qatorId, nishon.maydon, qiymat, kutilganVersiya);
    setKetyapti(false);

    if (r.ok && r.versiya != null) {
      toast('Saqlandi', 'ok');
      saqlandi(r.versiya);
      yop();
      return;
    }
    if (r.sabab === 'ziddiyat') {
      /* Bu XATO EMAS — boshqa klient tezroq yozgan. Ko'rsatamiz. */
      setZiddiyat(r);
      return;
    }
    toast(r.xabar || r.error || 'Saqlanmadi', 'danger', undefined, 9000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
         onClick={yop}>
      <div className="karta w-full max-w-lg p-4 bg-[var(--surface-1)]"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold text-text">
              {MAYDON_NOMI[nishon.maydon]} — tahrir
            </h3>
            <p className="text-[11px] text-text-mute truncate">{nishon.nom}</p>
          </div>
          <button onClick={yop} aria-label="Yopish" title="Yopish"
            className="text-text-mute hover:text-text p-1 rounded hover:bg-white/10">
            <X size={16} />
          </button>
        </div>

        {!ziddiyat && (
          <>
            <input
              value={qiymat}
              onChange={(e) => setQiymat(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saqla(nishon.versiya); }}
              autoFocus
              type={nishon.maydon === 'hajm' || nishon.maydon === 'narx' ? 'number' : 'text'}
              step="any"
              className="w-full bg-[var(--surface-2)] border border-border rounded-lg
                         px-3 py-2 text-[13px] text-text outline-none focus:border-accent/50"
            />
            <p className="text-[10px] text-text-mute mt-1.5">
              Bo‘sh qoldirilsa qiymat <b>yo‘q</b> bo‘ladi (0 emas). 0 va
              «kiritilmagan» — boshqa-boshqa narsa.
            </p>
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={yop}
                className="px-3 py-1.5 rounded-lg text-[12px] text-text-dim hover:bg-white/5">
                Bekor
              </button>
              <button onClick={() => saqla(nishon.versiya)} disabled={ketyapti}
                className="px-4 py-1.5 rounded-lg bg-accent text-white text-[12px]
                           font-medium hover:bg-accent/90 disabled:opacity-40
                           inline-flex items-center gap-1.5">
                <Save size={13} />
                {ketyapti ? 'Saqlanmoqda…' : 'Saqlash'}
              </button>
            </div>
          </>
        )}

        {ziddiyat && (
          <div className="rounded-lg border border-warn/40 bg-warn/5 p-3">
            <p className="text-[13px] font-medium text-warn flex items-center gap-2 mb-2">
              <AlertTriangle size={15} />
              Bu qatorni boshqa foydalanuvchi o‘zgartirdi
            </p>
            <p className="text-[11px] text-text-dim mb-3">
              Siz {ziddiyat.sizning_versiya}-versiyani ko‘rgansiz, bazada esa
              allaqachon {ziddiyat.bazadagi_versiya}-versiya. Sizning yozuvingiz
              <b> saqlanmadi</b> — birovning ishini bilmasdan o‘chirib
              yubormaslik uchun.
            </p>

            <div className="grid grid-cols-2 gap-2 text-[11px] mb-3">
              <div className="rounded border border-border p-2">
                <p className="text-text-mute mb-0.5">Hozir bazada</p>
                <p className="text-text font-mono">
                  {String((ziddiyat.joriy as any)?.[nishon.maydon] ?? '—')}
                </p>
              </div>
              <div className="rounded border border-accent/40 p-2">
                <p className="text-text-mute mb-0.5">Siz yozmoqchisiz</p>
                <p className="text-accent font-mono">{qiymat || '—'}</p>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button onClick={yop}
                className="px-3 py-1.5 rounded-lg text-[12px] text-text-dim hover:bg-white/5">
                Bekor qilish
              </button>
              <button
                onClick={() => {
                  /* Bazadagi qiymatni olamiz — o'zimnikidan voz kechamiz */
                  const j = (ziddiyat.joriy as any)?.[nishon.maydon];
                  setQiymat(j == null ? '' : String(j));
                  setZiddiyat(null);
                }}
                className="px-3 py-1.5 rounded-lg text-[12px] text-text
                           border border-border hover:bg-white/5 inline-flex items-center gap-1.5">
                <RefreshCw size={12} /> Bazadagini olish
              </button>
              <button
                onClick={() => saqla(ziddiyat.bazadagi_versiya!)}
                disabled={ketyapti}
                className="px-3 py-1.5 rounded-lg bg-warn/20 text-warn text-[12px]
                           font-medium hover:bg-warn/30 disabled:opacity-40">
                Baribir o‘zimniki bilan yozish
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
