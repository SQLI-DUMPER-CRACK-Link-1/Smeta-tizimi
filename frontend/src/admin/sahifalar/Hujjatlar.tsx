/**
 * Hujjatlar.tsx — HUJJATLAR MARKAZI (eski GAS paneldagi «Ҳужжатлар»)
 *
 * Audit (2026-08-16): eski panelda 12 bo'lim bor edi, saytda 4 tasi
 * yo'q edi. Bu — ikkinchisi.
 *
 * NIMA UCHUN KERAK: obyekt bo'yicha rasmiy hujjatlar (yashirin ishlar
 * akti, prixod, viborka) alohida Google fayllarda yuritiladi va
 * ularga KIRISH YO'LI saytda umuman yo'q edi — Drive'dan qo'lda
 * qidirish kerak bo'lardi.
 *
 * M-29 esa material hisoboti: obyekt + oy bo'yicha smetadagi normalar
 * va haqiqiy sarf solishtiriladi. `apiM29Yarat` GAS da BOR edi, lekin
 * uni ishga tushiradigan tugma hech qayerda yo'q edi.
 */
import { useState, useMemo, useEffect } from 'react';
import { FileText, ExternalLink, Play, Calendar, FolderOpen, Search } from 'lucide-react';
import { Sahifa } from '../../umumiy/ui/Sahifa';
import { toast } from '../../umumiy/ui/Toast';
import { useHujjatlar, useM29Yarat, useObyektlar, useHolat,
         useAktlar, usePrixod, useViborka } from '../../api/hooks';
import { FmtN } from '../../lib/format';

export default function Hujjatlar() {
  const hujjatlar = useHujjatlar();
  const obyektlar = useObyektlar();
  const m29 = useM29Yarat();

  const [obyekt, setObyekt] = useState('');
  const [oyNom, setOyNom] = useState('');
  const [natija, setNatija] = useState<{ url?: string; nom?: string } | null>(null);

  /* ⚡ 2026-08-16: hujjat ichini saytdan ko'rish uchun */
  const [tab, setTab] = useState<'akt' | 'prixod' | 'viborka'>('akt');
  const [qidiruv, setQidiruv] = useState('');
  /* ⚡ 2026-08-16 (audit H9): qidiruv HAR HARFDA serverga so'rov
   * yuborardi — «beton» yozsangiz 5 ta GAS chaqiruvi. GAS so'rovlarni
   * foydalanuvchi bo'yicha NAVBATGA qo'yadi, shuning uchun oxirgi
   * (kerakli) so'rov eng oxirida bajarilardi va natija kech kelardi.
   * Endi yozish to'xtagach 400 ms kutib bir marta yuboriladi. */
  const [qidiruvKech, setQidiruvKech] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQidiruvKech(qidiruv), 400);
    return () => clearTimeout(t);
  }, [qidiruv]);
  const aktlar  = useAktlar(100, tab === 'akt' ? qidiruvKech : '');
  const prixod  = usePrixod(100, tab === 'prixod' ? qidiruvKech : '');
  const viborka = useViborka(100, tab === 'viborka' ? qidiruvKech : '');
  const joriySoro = tab === 'akt' ? aktlar : tab === 'prixod' ? prixod : viborka;
  const joriyQatorSoni =
    tab === 'akt' ? (aktlar.data?.rows?.length ?? 0)
    : tab === 'prixod' ? (prixod.data?.rows?.length ?? 0)
    : (viborka.data?.rows?.length ?? 0);

  /* Tanlangan obyektning oylari — M-29 uchun qaysi oy mavjudligini
   * bilish kerak (erkin matn xato oy ochib yuborardi) */
  const lrv = useHolat(obyekt, false, '', !!obyekt);
  const oylar = useMemo(() => (lrv.data?.oylar ?? []) as string[], [lrv.data?.oylar]);

  const obNomlari = useMemo(
    () => Array.from(new Set((obyektlar.data ?? []).map((o) => o.obyekt))),
    [obyektlar.data]);

  const m29Yarat = () => {
    if (!obyekt || !oyNom) { toast('Obyekt va oyni tanlang', 'warn'); return; }
    setNatija(null);
    m29.mutate({ obyekt, oyNom }, {
      onSuccess: (r) => {
        if (r.ok && r.url) {
          setNatija({ url: r.url, nom: r.nom });
          toast('M-29 hujjati yaratildi', 'ok', undefined, 8000);
        } else {
          toast(r.xabar || 'M-29 yaratilmadi', 'danger', undefined, 9000);
        }
      },
      onError: (e: Error) => toast(e.message, 'danger', undefined, 9000),
    });
  };

  return (
    <Sahifa
      sarlavha="Hujjatlar"
      tavsif="Rasmiy hujjatlar — aktlar, prixod, viborka va M-29 material hisoboti"
    >
      <div className="space-y-4 max-w-5xl">
        {/* ⚡⚡⚡ 2026-08-16 HUJJAT ICHI — SAYTDAN KO'RISH.
            Avval bu sahifa faqat fayl HAVOLASINI berardi. Aslida GAS da
            to'liq o'qish API lari bor edi (apiAktlarOl / apiPrixodOl /
            apiViborkaOl) va eski panelda ular ishlatilardi — saytda esa
            hujjat ichini ko'rish uchun Google jadvalni ochish kerak edi. */}
        <div className="lux-karta p-0 overflow-hidden border-white/5">
          <div className="flex items-center gap-1 px-3 pt-3 border-b border-white/5">
            {(['akt', 'prixod', 'viborka'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2.5 text-[13px] font-bold rounded-t-xl transition-all
                  ${tab === t
                    ? 'bg-sky-500/10 text-sky-400 border-b-2 border-sky-400 -mb-px shadow-[inset_0_-2px_4px_rgba(56,189,248,0.2)]'
                    : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}>
                {t === 'akt' ? '📋 Aktlar' : t === 'prixod' ? '📦 Prixod' : '📑 Viborka'}
              </button>
            ))}
            <div className="flex-1" />
            <div className="relative pb-2">
              <Search size={13} className="absolute left-3 top-[11px] text-zinc-500" />
              <input value={qidiruv} onChange={(e) => setQidiruv(e.target.value)}
                placeholder="Qidirish…"
                className="pl-9 pr-3 py-2 rounded-xl bg-[#0a0f1a]/80 backdrop-blur-md border border-white/10 text-[12px] text-white outline-none focus:border-sky-400 focus:bg-[#0f172a]/90 focus:shadow-[inset_0_2px_15px_rgba(0,0,0,0.8),_0_0_20px_rgba(56,189,248,0.2)] transition-all w-56 placeholder:text-zinc-600" />
            </div>
          </div>

          <div className="p-3 max-h-[420px] overflow-auto scrollbar-thin">
            {joriySoro.isLoading && <div className="skel h-24 rounded" />}
            {joriySoro.isError && (
              <p className="text-[12px] text-danger">
                O'qilmadi: {(joriySoro.error as Error)?.message}
              </p>
            )}
            {joriySoro.data && 'xabar' in joriySoro.data && joriySoro.data.xabar && (
              <p className="text-[12px] text-warn">{String(joriySoro.data.xabar)}</p>
            )}

            {tab === 'akt' && !!aktlar.data?.rows?.length && (
              <table className="w-full text-[12px]">
                <thead className="text-text-mute text-[11px] sticky top-0 bg-[var(--surface)]">
                  <tr className="text-left">
                    <th className="py-1.5 pr-2">№</th>
                    <th className="py-1.5 pr-2">Ish</th>
                    <th className="py-1.5 pr-2">Obyekt</th>
                    <th className="py-1.5 pr-2">Holat</th>
                    <th className="py-1.5 pr-2">Sana</th>
                    <th className="py-1.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {aktlar.data.rows.map((r) => (
                    <tr key={`${r.id}-${r.row}`} className="border-t border-border/60 hover:bg-white/[.03]">
                      <td className="py-1.5 pr-2 font-mono text-text-dim">{r.num}</td>
                      <td className="py-1.5 pr-2 text-text max-w-[280px]">{r.work}</td>
                      <td className="py-1.5 pr-2 text-text-dim">{r.obj}</td>
                      <td className="py-1.5 pr-2">
                        <span className="px-1.5 py-0.5 rounded bg-white/5 text-text-dim text-[11px]">
                          {r.status || '—'}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 text-text-mute whitespace-nowrap">{r.start}</td>
                      <td className="py-1.5">
                        {(r.url || r.pdf) && (
                          <a href={r.url || r.pdf} target="_blank" rel="noreferrer"
                            className="text-accent hover:underline">
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'prixod' && !!prixod.data?.rows?.length && (
              <table className="w-full text-[12px]">
                <thead className="text-text-mute text-[11px] sticky top-0 bg-[var(--surface)]">
                  <tr className="text-left">
                    <th className="py-1.5 pr-2">Material</th>
                    <th className="py-1.5 pr-2">Razdel</th>
                    <th className="py-1.5 pr-2 text-right">Hajm</th>
                    <th className="py-1.5 pr-2">Birlik</th>
                    <th className="py-1.5 pr-2">Sana</th>
                    <th className="py-1.5">Yetkazuvchi</th>
                  </tr>
                </thead>
                <tbody>
                  {prixod.data.rows.map((r) => (
                    <tr key={r.row} className="border-t border-border/60 hover:bg-white/[.03]">
                      <td className="py-1.5 pr-2 text-text max-w-[300px]">{r.nom}</td>
                      <td className="py-1.5 pr-2 text-text-dim">{r.razdel}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums text-emerald-400">{r.hajm}</td>
                      <td className="py-1.5 pr-2 text-text-mute">{r.birlik}</td>
                      <td className="py-1.5 pr-2 text-text-mute whitespace-nowrap">{r.sana}</td>
                      <td className="py-1.5 text-text-dim">{r.postavshik}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'viborka' && !!viborka.data?.rows?.length && (
              <table className="w-full text-[12px]">
                <thead className="text-text-mute text-[11px] sticky top-0 bg-[var(--surface)]">
                  <tr className="text-left">
                    <th className="py-1.5 pr-2">Material</th>
                    <th className="py-1.5 pr-2 text-right">Plan</th>
                    <th className="py-1.5 pr-2 text-right">Qabul</th>
                    <th className="py-1.5 pr-2 text-right">Qoldiq</th>
                    <th className="py-1.5 pr-2 text-right">Summa</th>
                    <th className="py-1.5">Holat</th>
                  </tr>
                </thead>
                <tbody>
                  {viborka.data.rows.map((r) => (
                    <tr key={r.row} className="border-t border-border/60 hover:bg-white/[.03]">
                      <td className="py-1.5 pr-2 text-text max-w-[260px]">{r.nom}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums text-text-dim">{r.plan}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums text-emerald-400">{r.qabul}</td>
                      <td className={`py-1.5 pr-2 text-right tabular-nums ${
                        r.qoldiq < 0 ? 'text-rose-400' : 'text-orange-400'}`}>{r.qoldiq}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums text-text">
                        <FmtN val={r.summa} />
                      </td>
                      <td className="py-1.5 text-text-dim">{r.holat}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {!joriySoro.isLoading && !joriyQatorSoni && !joriySoro.isError && (
              <p className="text-[12px] text-text-mute italic py-6 text-center">
                Yozuv topilmadi
              </p>
            )}
          </div>

          {!!joriyQatorSoni && (
            <div className="px-3 py-2 border-t border-border text-[11px] text-text-mute">
              {joriyQatorSoni} ta ko'rsatildi
              {tab === 'viborka' && viborka.data?.jamiSumma
                ? <> · jami <b className="text-text"><FmtN val={viborka.data.jamiSumma} /></b> so'm</>
                : null}
            </div>
          )}
        </div>

        {/* ── Mavjud hujjat fayllari ─────────────────────────────── */}
        <div className="lux-karta p-4 border-white/5">
          <h3 className="text-[15px] font-bold text-white mb-1 flex items-center gap-2">
            <FolderOpen size={17} className="text-sky-400 drop-shadow-[0_0_4px_rgba(56,189,248,0.5)]" />
            Hujjat fayllari
          </h3>
          <p className="text-[12px] text-text-mute mb-3">
            Har bir tur alohida Google jadvalda yuritiladi. Avval bu fayllarni
            Drive'dan qo'lda qidirish kerak edi.
          </p>

          {hujjatlar.isLoading && <div className="skel h-16 rounded" />}
          {hujjatlar.isError && (
            <p className="text-[12px] text-danger">
              Ro'yxat o'qilmadi: {(hujjatlar.error as Error)?.message}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(hujjatlar.data ?? []).map((h) => (
                <a key={h.nom} href={h.url || undefined}
                  target="_blank" rel="noreferrer"
                  className={`rounded-xl border p-4 transition-all flex flex-col gap-2 relative overflow-hidden group
                    ${h.url
                      ? 'border-white/10 bg-black/40 hover:bg-white/5 hover:border-sky-400/40 hover:shadow-[0_0_15px_rgba(56,189,248,0.1)]'
                      : 'border-white/5 bg-black/20 opacity-50 pointer-events-none'}`}>
                  <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="text-[24px] leading-none text-sky-400 drop-shadow-[0_0_3px_rgba(56,189,248,0.5)] relative z-10">{h.icon}</span>
                  <span className="text-[13px] font-bold text-white leading-tight relative z-10">{h.nom}</span>
                  {h.url
                    ? <ExternalLink size={14} className="text-zinc-500 mt-auto ml-auto group-hover:text-sky-400 transition-colors relative z-10" />
                    : <span className="text-[10px] text-red-400 mt-auto bg-red-500/10 px-2 py-0.5 rounded w-max">Ulanmagan</span>}
                </a>
              ))}
            </div>
          </div>

        {/* ── M-29 ──────────────────────────────────────────────── */}
        <div className="lux-karta p-4 border-white/5">
          <h3 className="text-[15px] font-bold text-white mb-1 flex items-center gap-2">
            <FileText size={17} className="text-sky-400 drop-shadow-[0_0_4px_rgba(56,189,248,0.5)]" />
            M-29 — material hisoboti
          </h3>
          <p className="text-[12px] text-zinc-400 mb-4">
            Tanlangan oy uchun smetadagi <b className="text-sky-400">normativ sarf</b> va <b className="text-indigo-400">haqiqiy sarf</b>
            {' '}solishtiriladi. Natija yangi Google jadval sifatida yaratiladi.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">Obyekt</label>
              <select value={obyekt}
                onChange={(e) => { setObyekt(e.target.value); setOyNom(''); setNatija(null); }}
                className="w-full h-10 px-4 rounded-xl bg-[#0a0f1a]/80 backdrop-blur-md border border-white/10 text-[13px] text-white focus:outline-none focus:border-sky-400 focus:bg-[#0f172a]/90 focus:shadow-[inset_0_2px_15px_rgba(0,0,0,0.8),_0_0_20px_rgba(56,189,248,0.2)] transition-all cursor-pointer appearance-none">
                <option value="" className="bg-[#060914]">— tanlang —</option>
                {obNomlari.map((o) => <option key={o} value={o} className="bg-[#060914] py-1">{o}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                <Calendar size={12} className="text-sky-400" /> Qaysi oy uchun
              </label>
              {/* 2026-08-16: oldin erkin matn (input text) edi.
                  Erkin matnda bitta harf farqi bo'sh hisobot berardi. */}
              <select value={oyNom} onChange={(e) => { setOyNom(e.target.value); setNatija(null); }}
                disabled={!obyekt || lrv.isLoading}
                className="w-full h-10 px-4 rounded-xl bg-[#0a0f1a]/80 backdrop-blur-md border border-white/10 text-[13px] text-white focus:outline-none focus:border-sky-400 focus:bg-[#0f172a]/90 focus:shadow-[inset_0_2px_15px_rgba(0,0,0,0.8),_0_0_20px_rgba(56,189,248,0.2)] transition-all cursor-pointer disabled:opacity-50 disabled:bg-black/20 appearance-none">
                <option value="" className="bg-[#060914]">
                  {!obyekt ? '— avval obyekt —'
                    : lrv.isLoading ? 'yuklanmoqda...'
                    : (oylar.length === 0 ? 'oylar topilmadi' : '— oyni tanlang —')}
                </option>
                {oylar.map(oy => <option key={oy} value={oy} className="bg-[#060914] py-1">{oy}</option>)}
              </select>
            </div>
          </div>

          <button onClick={m29Yarat} disabled={m29.isPending || !obyekt || !oyNom}
            className="mt-5 lux-btn lux-btn-primary h-9 px-5 text-[13px] gap-2 w-full sm:w-auto">
            <Play size={14} />
            {m29.isPending ? 'Yaratilmoqda…' : 'M-29 yaratish'}
          </button>

          {natija?.url && (
            <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_15px_rgba(52,211,153,0.1)] flex items-center gap-3">
              <FileText size={18} className="text-emerald-400 flex-shrink-0 drop-shadow-[0_0_4px_rgba(52,211,153,0.5)]" />
              <span className="flex-1 text-[13px] font-bold text-emerald-300">
                {natija.nom || 'M-29 hisoboti muvaffaqiyatli tayyorlandi'}
              </span>
              <a href={natija.url} target="_blank" rel="noreferrer"
                className="lux-btn lux-btn-ghost h-8 px-3 text-[12px] !text-emerald-300 hover:!bg-emerald-500/20 flex items-center gap-1.5 border border-emerald-500/30">
                Ochish <ExternalLink size={12} />
              </a>
            </div>
          )}
        </div>
      </div>
    </Sahifa>
  );
}
