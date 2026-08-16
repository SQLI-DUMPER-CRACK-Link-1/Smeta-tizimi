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
import { FileText, ExternalLink, Play, Calendar, FolderOpen } from 'lucide-react';
import { Sahifa } from '../../umumiy/ui/Sahifa';
import { toast } from '../../umumiy/ui/Toast';
import { useHujjatlar, useM29Yarat, useObyektlar, useHolat } from '../../api/hooks';

export default function Hujjatlar() {
  const hujjatlar = useHujjatlar();
  const obyektlar = useObyektlar();
  const m29 = useM29Yarat();

  const [obyekt, setObyekt] = useState('');
  const [oyNom, setOyNom] = useState('');
  const [natija, setNatija] = useState<{ url?: string; nom?: string } | null>(null);

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
      <div className="space-y-4 max-w-4xl">
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
