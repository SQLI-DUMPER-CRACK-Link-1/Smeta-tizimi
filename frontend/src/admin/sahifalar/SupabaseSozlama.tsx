/**
 * SupabaseSozlama.tsx — SUPABASE SINXRONI (eski GAS paneldagi «🌐 Supabase»)
 *
 * Audit (2026-08-16): eski panelning 12 bo'limidan 4 tasi saytda yo'q edi.
 * Bu — uchinchisi.
 *
 * NIMA UCHUN KERAK: `70_Supabase.js` LRV_PLUS ma'lumotini Postgres'ga
 * ko'chiradi (o'qish tezligi uchun). Lekin ULANISH SOZLAMASI va sinx
 * holatini ko'radigan joy saytda yo'q edi — kalit o'zgarsa yoki sinx
 * to'xtasa, buni bilishning iloji yo'q edi.
 *
 * ⚠ XAVFSIZLIK: `service_role` kaliti EMAS, faqat `anon` yoki cheklangan
 * kalit kiritilishi kerak. Kalit GAS ScriptProperties'da saqlanadi.
 */
import { useState, useEffect } from 'react';
import { Database, Save, RotateCcw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Sahifa } from '../../umumiy/ui/Sahifa';
import { toast } from '../../umumiy/ui/Toast';
import {
  useSupabaseSozlama, useSupabaseSozlamaSaqla,
  useSupabaseKursor, useSupabaseReset,
} from '../../api/hooks';

export default function SupabaseSozlama() {
  const soz = useSupabaseSozlama();
  const saqla = useSupabaseSozlamaSaqla();
  const kursor = useSupabaseKursor();
  const reset = useSupabaseReset();

  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [tegildi, setTegildi] = useState(false);

  /* Serverdan kelgan qiymatni bir marta formaga qo'yamiz */
  useEffect(() => {
    if (tegildi || !soz.data) return;
    setUrl(soz.data.url || '');
    setKey(soz.data.key || '');
  }, [soz.data, tegildi]);

  const saqlash = () => {
    if (!url.trim()) { toast('URL kiriting', 'warn'); return; }
    saqla.mutate({ url: url.trim(), key: key.trim() }, {
      onSuccess: (r) => {
        toast(r.xabar || 'Saqlandi', r.ok ? 'ok' : 'danger', undefined, 8000);
        setTegildi(false);
      },
      onError: (e: Error) => toast(e.message, 'danger', undefined, 9000),
    });
  };

  const ulangan = !!soz.data?.ulangan || (!!soz.data?.url && !!soz.data?.key);

  return (
    <Sahifa
      sarlavha="Supabase"
      tavsif="Ma'lumot sinxronizatsiyasi — LRV_PLUS ni Postgres'ga ko'chirish sozlamasi"
    >
      <div className="space-y-4 max-w-2xl">
        {/* Holat */}
        <div className={`karta p-4 flex items-start gap-3 ${
          ulangan ? 'border-emerald-500/30' : 'border-warn/30'}`}>
          {ulangan
            ? <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0 mt-0.5" />
            : <AlertTriangle size={18} className="text-warn flex-shrink-0 mt-0.5" />}
          <div className="flex-1">
            <p className="text-[13px] font-medium text-text">
              {ulangan ? 'Ulanish sozlangan' : 'Ulanish sozlanmagan'}
            </p>
            <p className="text-[11px] text-text-mute mt-0.5 leading-snug">
              {ulangan
                ? 'Sinxronizatsiya ishlashi mumkin. Kursor holati pastda ko\'rsatilgan.'
                : 'URL va kalit kiritilmagan — Supabase\'ga hech narsa yozilmaydi. '
                  + 'Bu XATO EMAS: sinx ixtiyoriy, tizim usiz ham to\'liq ishlaydi.'}
            </p>
          </div>
        </div>

        {/* Sozlama */}
        <div className="karta p-4 space-y-3">
          <h3 className="text-[15px] font-semibold text-text flex items-center gap-2">
            <Database size={17} className="text-accent" />
            Ulanish
          </h3>

          <div>
            <label className="text-[12px] font-medium text-text block mb-1.5">Project URL</label>
            <input value={url}
              onChange={(e) => { setUrl(e.target.value); setTegildi(true); }}
              placeholder="https://xxxxx.supabase.co"
              className="w-full bg-[var(--surface-2)] border border-border rounded
                         px-3 py-2 text-[12px] text-text font-mono outline-none
                         focus:border-accent/50" />
          </div>

          <div>
            <label className="text-[12px] font-medium text-text block mb-1.5">
              API kalit
            </label>
            <input value={key} type="password"
              onChange={(e) => { setKey(e.target.value); setTegildi(true); }}
              placeholder="eyJhbGciOi…"
              className="w-full bg-[var(--surface-2)] border border-border rounded
                         px-3 py-2 text-[12px] text-text font-mono outline-none
                         focus:border-accent/50" />
            {/* ⚠ Ochiq ogohlantirish — service_role kaliti butun bazaga
                to'liq huquq beradi va uni bu yerda saqlash xavfli */}
            <p className="text-[11px] text-warn mt-1.5 leading-snug">
              ⚠ <b>service_role</b> kalitini kiritmang — u butun bazaga to'liq huquq
              beradi. Faqat <b>anon</b> yoki cheklangan huquqli kalit ishlating.
            </p>
          </div>

          <button onClick={saqlash} disabled={saqla.isPending || !tegildi}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white
                       text-[13px] font-medium hover:bg-accent/90 transition-colors
                       disabled:opacity-40">
            <Save size={14} />
            {saqla.isPending ? 'Saqlanmoqda…' : 'Saqlash'}
          </button>
        </div>

        {/* Sinx kursori */}
        <div className="karta p-4">
          <h3 className="text-[15px] font-semibold text-text mb-1">Sinxronizatsiya holati</h3>
          <p className="text-[12px] text-text-mute mb-3">
            Kursor — qaysi ma'lumot qayergacha ko'chirilganini eslab qoladi.
            Reset qilinsa keyingi sinx <b>boshidan</b> boshlanadi.
          </p>

          {kursor.isLoading && <div className="skel h-16 rounded" />}
          {kursor.data && (
            <pre className="text-[11px] text-text-dim bg-[var(--surface-2)]/50 rounded
                            p-3 overflow-x-auto max-h-56 leading-relaxed">
{JSON.stringify(kursor.data, null, 2)}
            </pre>
          )}

          <button
            onClick={() => {
              if (!window.confirm(
                'Sinx kursori tozalanadi.\n\n' +
                'Keyingi sinxronizatsiya BOSHIDAN boshlanadi — bu uzoq vaqt\n' +
                'olishi mumkin. Smetadagi ma\'lumotga TEGILMAYDI.\n\nDavom etamizmi?')) return;
              reset.mutate(undefined, {
                onSuccess: (r) => toast(r.xabar || 'Kursor tozalandi', 'ok', undefined, 7000),
                onError: (e: Error) => toast(e.message, 'danger'),
              });
            }}
            disabled={reset.isPending}
            className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5
                       hover:bg-warn/20 border border-border hover:border-warn/40
                       text-[12px] text-text-mute hover:text-warn transition-colors
                       disabled:opacity-50">
            <RotateCcw size={13} />
            {reset.isPending ? 'Tozalanmoqda…' : 'Kursorni tozalash'}
          </button>
        </div>
      </div>
    </Sahifa>
  );
}
