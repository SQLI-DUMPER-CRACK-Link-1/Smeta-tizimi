import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Save, Percent, HardHat, Database, FolderOpen, Loader2, PauseCircle, PlayCircle } from 'lucide-react';
import { AuroraBackground, GlassCard } from '../../boss/sahifalar/Umumiy';
import { Skelet } from '../../umumiy/ui/Sahifa';
import { toast } from '../../umumiy/ui/Toast';
import {
  useTizimSozlama, useTizimSozlamaSaqla,
  useNakrutka, useNakrutkaSaqla,
  useObyektlar, useStavka, useStavkaSaqla,
  useTizimHolat, useTizimHolatOzgartir,
} from '../../api/hooks';
import type { NakrutkaKoef, TizimSozlama } from '../../api/types';

export function Sozlamalar() {
  const [tab, setTab] = useState<'tizim' | 'nakrutka' | 'stavka'>('tizim');

  return (
    <AuroraBackground>
      <div className="max-w-[1200px] mx-auto p-6 flex flex-col h-full overflow-hidden relative z-10">
        <header className="mb-6">
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-200 to-slate-400 tracking-tight flex items-center gap-3">
            <Settings className="text-slate-300" size={32} />
            Sozlamalar
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            Tizim yo'llari, накрутка koeffitsientlari va ish haqi stavkalari
          </p>
        </header>

        <div className="flex gap-2 mb-6 bg-black/40 p-1 rounded-xl border border-white/10 self-start">
          {([
            { id: 'tizim', nom: 'Tizim', icon: Database },
            { id: 'nakrutka', nom: 'Накрутка', icon: Percent },
            { id: 'stavka', nom: 'Ish haqi stavkasi', icon: HardHat },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id ? 'bg-accent text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <t.icon size={16} /> {t.nom}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin pb-8">
          {tab === 'tizim' && <TizimBolimi />}
          {tab === 'nakrutka' && <NakrutkaBolimi />}
          {tab === 'stavka' && <StavkaBolimi />}
        </div>
      </div>
    </AuroraBackground>
  );
}

/* ══════════════ TIZIM ══════════════ */
function TizimBolimi() {
  /* ⚡ 2026-08-16: tizimni muzlatish kaliti */
  const tizim = useTizimHolat();
  const tizimOzgart = useTizimHolatOzgartir();
  const { data, isLoading } = useTizimSozlama();
  const saqla = useTizimSozlamaSaqla();
  const [form, setForm] = useState<TizimSozlama | null>(null);

  useEffect(() => { if (data && !form) setForm(data); }, [data, form]);

  if (isLoading || !form) return <Skelet qatorlar={4} />;

  const maydonlar: { key: keyof TizimSozlama; label: string; izoh: string }[] = [
    { key: 'rootId', label: 'ROOT papka ID', izoh: 'Barcha obyekt papkalari joylashgan Google Drive papkasi' },
    { key: 'serverId', label: 'Server fayl ID', izoh: 'Bo\'sh qoldirilsa, ROOT ichidan _SERVER_DASHBOARD avtomat topiladi' },
    { key: 'dataQator', label: 'Ma\'lumot boshlanadigan qator', izoh: 'Lokal smetada sarlavhadan keyingi birinchi qator raqami' },
    { key: 'narxMantiq', label: 'Narx mantig\'i', izoh: 'Narxlar markazidan narx tanlash qoidasi' },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      {/* ⚡⚡⚡ 2026-08-16 TIZIMNI MUZLATISH — eski paneldan yetishmayotgan kalit.
          Muzlatilsa BARCHA avtomatik ish (triggerlar, fon navbati, kunlik
          yangilanish) to'xtaydi. Katta tuzatish yoki tekshiruv paytida kerak:
          aks holda fon ishlari yarim holatda ma'lumotni buzishi mumkin.
          `apiTizimHolatOl/Ozgartir` GAS da BOR edi, saytda kalit yo'q edi. */}
      <GlassCard className="p-5 mb-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            {tizim.data?.paused
              ? <PauseCircle size={20} className="text-warn flex-shrink-0 mt-0.5" />
              : <PlayCircle size={20} className="text-ok flex-shrink-0 mt-0.5" />}
            <div>
              <h2 className="font-semibold text-slate-200 text-[15px]">
                {tizim.isLoading ? 'Tizim holati…'
                  : tizim.data?.paused ? 'Tizim MUZLATILGAN' : 'Tizim faol'}
              </h2>
              <p className="text-[12px] text-slate-400 mt-0.5 leading-snug max-w-xl">
                {tizim.data?.paused
                  ? 'Barcha avtomatik ish to\'xtatilgan: triggerlar, fon navbati, kunlik '
                    + 'yangilanish. Qo\'lda ishlar (F2 yozish, hisoblash) ishlaydi.'
                  : 'Triggerlar va fon navbati normal ishlamoqda. Katta tuzatish '
                    + 'oldidan muzlatib qo\'yish tavsiya etiladi.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              const yangi = !tizim.data?.paused;
              if (yangi && !window.confirm(
                'Tizim MUZLATILADI.\n\n' +
                'Barcha avtomatik ish to\'xtaydi (triggerlar, fon navbati).\n' +
                'Ma\'lumotga TEGILMAYDI.\n\nDavom etamizmi?')) return;
              tizimOzgart.mutate({ paused: yangi }, {
                onSuccess: () => toast(yangi ? 'Tizim muzlatildi' : 'Tizim faollashtirildi',
                                       yangi ? 'warn' : 'ok', undefined, 7000),
                onError: (e: Error) => toast(e.message, 'danger'),
              });
            }}
            disabled={tizimOzgart.isPending || tizim.isLoading}
            className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-colors
                        disabled:opacity-50 whitespace-nowrap ${tizim.data?.paused
              ? 'bg-ok/20 text-ok hover:bg-ok/30'
              : 'bg-warn/15 text-warn hover:bg-warn/25'}`}>
            {tizimOzgart.isPending ? 'Bajarilmoqda…'
              : tizim.data?.paused ? '▶ Faollashtirish' : '⏸ Muzlatish'}
          </button>
        </div>
      </GlassCard>

      <GlassCard className="p-6">
        <div className="flex items-center gap-2 mb-6 text-slate-300">
          <FolderOpen size={18} className="text-accent" />
          <h2 className="font-semibold">Drive yo'llari va o'qish qoidalari</h2>
        </div>

        <div className="space-y-5">
          {maydonlar.map(m => (
            <div key={m.key}>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                {m.label}
              </label>
              <input
                type="text"
                value={String(form[m.key] ?? '')}
                onChange={e => setForm({ ...form, [m.key]: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-accent/50"
              />
              <p className="text-xs text-slate-500 mt-1.5">{m.izoh}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-5 border-t border-white/10 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-xs text-amber-400/80">
            ⚠️ Bu qiymatlar o'zgarsa, keyingi «Ishla» da butun tizim qaytadan hisoblanadi.
          </p>
          <button
            onClick={async () => {
              try { await saqla.mutateAsync(form); toast('Sozlamalar saqlandi', 'ok'); }
              catch (e: any) { toast('Xato: ' + e.message, 'danger'); }
            }}
            disabled={saqla.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {saqla.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Saqlash
          </button>
        </div>
      </GlassCard>
    </motion.div>
  );
}

/* ══════════════ НАКРУТКА ══════════════ */
function NakrutkaBolimi() {
  const { data, isLoading } = useNakrutka();
  const saqla = useNakrutkaSaqla();
  const [items, setItems] = useState<NakrutkaKoef[] | null>(null);

  useEffect(() => { if (data && !items) setItems(data); }, [data, items]);

  if (isLoading) return <Skelet qatorlar={5} />;

  if (!items || items.length === 0) {
    return (
      <GlassCard className="p-8 text-center text-slate-400">
        Накрутка koeffitsientlari hali sozlanmagan.
        <p className="text-xs text-slate-500 mt-2">
          Ular <span className="font-mono">НАКРУТКА</span> varag'ida saqlanadi — avval Google Sheets
          menyusidan shartnoma bo'limini bir marta oching.
        </p>
      </GlassCard>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <GlassCard className="p-6">
        <div className="flex items-center gap-2 mb-2 text-slate-300">
          <Percent size={18} className="text-accent" />
          <h2 className="font-semibold">Umumiy (default) koeffitsientlar</h2>
        </div>
        <p className="text-xs text-slate-500 mb-6">
          Bular BARCHA shartnomalar uchun asos. Ayrim shartnomaga boshqacha qiymat kerak bo'lsa,
          u Shartnoma sahifasidan alohida belgilanadi (bu yerdagi qiymat tegilmaydi).
        </p>

        <div className="space-y-3">
          {items.map((it, i) => (
            <div key={it.koef} className="flex items-center gap-4 py-2 border-b border-white/5 last:border-0">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white font-medium">{it.koef}</div>
                {it.izoh && <div className="text-xs text-slate-500 mt-0.5">{it.izoh}</div>}
              </div>
              <input
                type="number"
                step="0.0001"
                value={it.qiymat}
                onChange={e => {
                  const yangi = [...items];
                  yangi[i] = { ...it, qiymat: Number(e.target.value) };
                  setItems(yangi);
                }}
                className="w-32 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono text-right focus:outline-none focus:border-accent/50"
              />
            </div>
          ))}
        </div>

        <div className="mt-6 pt-5 border-t border-white/10 flex justify-end">
          <button
            onClick={async () => {
              try { await saqla.mutateAsync({ items }); toast('Накрутка saqlandi — endi «Ishla» qiling', 'ok'); }
              catch (e: any) { toast('Xato: ' + e.message, 'danger'); }
            }}
            disabled={saqla.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {saqla.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Saqlash
          </button>
        </div>
      </GlassCard>
    </motion.div>
  );
}

/* ══════════════ СТАВКА (ЧЕЛ-Ч) ══════════════ */
function StavkaBolimi() {
  const { data: obyektlar, isLoading } = useObyektlar();
  const [tanlangan, setTanlangan] = useState('');
  const { data: stavka } = useStavka(tanlangan);
  const saqla = useStavkaSaqla();
  const [qiymat, setQiymat] = useState<number | ''>('');

  useEffect(() => { setQiymat(stavka?.chel ?? ''); }, [stavka]);

  if (isLoading) return <Skelet qatorlar={3} />;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <GlassCard className="p-6">
        <div className="flex items-center gap-2 mb-2 text-slate-300">
          <HardHat size={18} className="text-accent" />
          <h2 className="font-semibold">ЧЕЛ-Ч (ishchi soat) stavkasi</h2>
        </div>
        <p className="text-xs text-slate-500 mb-6">
          Agar obyekt shartnomaga biriktirilgan bo'lsa, shartnoma stavkasi USTUVOR bo'ladi va
          bu yerdagi qiymat e'tiborga olinmaydi.
        </p>

        <div className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">
              Obyekt
            </label>
            <select
              value={tanlangan}
              onChange={e => setTanlangan(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent/50"
            >
              <option value="" className="bg-slate-800 text-white">— obyektni tanlang —</option>
              {(obyektlar || []).map(o => (
                <option key={o.obyekt} value={o.obyekt} className="bg-slate-800 text-white">{o.obyekt}</option>
              ))}
            </select>
          </div>

          {tanlangan && (
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                ЧЕЛ-Ч stavkasi (so'm / soat)
              </label>
              <input
                type="number"
                value={qiymat}
                onChange={e => setQiymat(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-accent/50"
              />
            </div>
          )}
        </div>

        {tanlangan && (
          <div className="mt-6 pt-5 border-t border-white/10 flex justify-end">
            <button
              onClick={async () => {
                try {
                  const r = await saqla.mutateAsync({ obyekt: tanlangan, chel: Number(qiymat) || 0 });
                  toast(r.xabar || 'Saqlandi', 'ok');
                } catch (e: any) { toast('Xato: ' + e.message, 'danger'); }
              }}
              disabled={saqla.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {saqla.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Saqlash
            </button>
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
}
