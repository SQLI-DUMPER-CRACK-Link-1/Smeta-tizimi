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
import { useState, useMemo } from 'react';
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
  const aktlar  = useAktlar(100, tab === 'akt' ? qidiruv : '');
  const prixod  = usePrixod(100, tab === 'prixod' ? qidiruv : '');
  const viborka = useViborka(100, tab === 'viborka' ? qidiruv : '');
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
        <div className="karta p-0 overflow-hidden">
          <div className="flex items-center gap-1 px-3 pt-3 border-b border-border">
            {(['akt', 'prixod', 'viborka'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-2 text-[13px] font-medium rounded-t-lg transition-colors
                  ${tab === t
                    ? 'bg-[var(--surface-2)] text-accent border-b-2 border-accent -mb-px'
                    : 'text-text-mute hover:text-text'}`}>
                {t === 'akt' ? '📋 Aktlar' : t === 'prixod' ? '📦 Prixod' : '📐 Viborka'}
              </button>
            ))}
            <div className="flex-1" />
            <div className="relative pb-2">
              <Search size={13} className="absolute left-2 top-[9px] text-text-mute" />
              <input value={qidiruv} onChange={(e) => setQidiruv(e.target.value)}
                placeholder="Qidirish…"
                className="pl-7 pr-2 py-1.5 rounded bg-[var(--surface-2)] border border-border
                           text-[12px] text-text outline-none focus:border-accent/50 w-48" />
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
        <div className="karta p-4">
          <h3 className="text-[15px] font-semibold text-text mb-1 flex items-center gap-2">
            <FolderOpen size={17} className="text-accent" />
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
              <a key={h.tur}
                href={h.url || undefined}
                target="_blank" rel="noreferrer"
                className={`rounded-lg border p-3 transition-colors flex flex-col gap-1.5
                  ${h.url
                    ? 'border-border bg-[var(--surface-2)]/40 hover:bg-white/5 hover:border-accent/40'
                    : 'border-border/50 bg-[var(--surface-2)]/20 opacity-60 pointer-events-none'}`}>
                <span className="text-[20px] leading-none">{h.icon}</span>
                <span className="text-[13px] font-medium text-text leading-tight">{h.nom}</span>
                {h.url
                  ? <span className="text-[11px] text-accent flex items-center gap-1">
                      Ochish <ExternalLink size={11} />
                    </span>
                  : <span className="text-[11px] text-text-mute">Fayl hali yaratilmagan</span>}
              </a>
            ))}
          </div>
        </div>

        {/* ── M-29 ──────────────────────────────────────────────── */}
        <div className="karta p-4">
          <h3 className="text-[15px] font-semibold text-text mb-1 flex items-center gap-2">
            <FileText size={17} className="text-accent" />
            M-29 — material hisoboti
          </h3>
          <p className="text-[12px] text-text-mute mb-3">
            Tanlangan oy uchun smetadagi <b>normativ sarf</b> va <b>haqiqiy sarf</b>
            {' '}solishtiriladi. Natija yangi Google jadval sifatida yaratiladi.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] font-medium text-text block mb-1.5">Obyekt</label>
              <select value={obyekt}
                onChange={(e) => { setObyekt(e.target.value); setOyNom(''); setNatija(null); }}
                className="w-full bg-[var(--surface-2)] border border-border rounded
                           px-2 py-1.5 text-[12px] text-text">
                <option value="">— tanlang —</option>
                {obNomlari.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[12px] font-medium text-text block mb-1.5 flex items-center gap-1.5">
                <Calendar size={13} /> Oy
              </label>
              {/* ⚡ Oy ERKIN MATN emas — mavjudlaridan tanlanadi.
                  Erkin matnda bitta harf farqi bo'sh hisobot berardi. */}
              <select value={oyNom} onChange={(e) => { setOyNom(e.target.value); setNatija(null); }}
                disabled={!obyekt || lrv.isLoading}
                className="w-full bg-[var(--surface-2)] border border-border rounded
                           px-2 py-1.5 text-[12px] text-text disabled:opacity-50">
                <option value="">
                  {!obyekt ? '— avval obyekt —'
                    : lrv.isLoading ? 'oylar o\'qilmoqda…'
                    : oylar.length ? '— tanlang —' : 'bu obyektda F2 oyi yo\'q'}
                </option>
                {oylar.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>

          <button onClick={m29Yarat} disabled={m29.isPending || !obyekt || !oyNom}
            className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white
                       text-[13px] font-medium hover:bg-accent/90 transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed">
            <Play size={14} />
            {m29.isPending ? 'Yaratilmoqda…' : 'M-29 yaratish'}
          </button>

          {natija?.url && (
            <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30
                            flex items-center gap-3">
              <FileText size={16} className="text-emerald-400 flex-shrink-0" />
              <span className="flex-1 text-[12px] text-emerald-200">
                {natija.nom || 'M-29 tayyor'}
              </span>
              <a href={natija.url} target="_blank" rel="noreferrer"
                className="text-[12px] px-3 py-1.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30
                           text-emerald-300 transition-colors flex items-center gap-1.5">
                Ochish <ExternalLink size={12} />
              </a>
            </div>
          )}
        </div>
      </div>
    </Sahifa>
  );
}
