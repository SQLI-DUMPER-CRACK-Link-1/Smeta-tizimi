/**
 * ShaxsiySmeta.tsx — SHAXSIY SMETA (eski GAS paneldagi «📝 Шахсий смета»)
 *
 * Audit (2026-08-16): eski panelning 12 bo'limidan 4 tasi saytda yo'q
 * edi. Bu — to'rtinchisi va oxirgisi.
 *
 * NIMA UCHUN KERAK: rasmiy loyiha smetasiga bog'liq bo'lmagan kichik
 * ish uchun tez smeta tuzish. Ish turlari bazasidan (`apiIshTurQidir`)
 * qidirib topiladi, hajm kiritiladi, natija yangi Google jadval
 * sifatida chiqadi.
 *
 * `apiShaxsiySmetalar` / `apiShaxsiySmetaYarat` / `apiIshTurQidir`
 * GAS da BOR edi — sayt ularni chaqirmasdi.
 */
import { useState, useMemo } from 'react';
import { NotebookPen, Search, Plus, Trash2, ExternalLink, FileSpreadsheet } from 'lucide-react';
import { Sahifa } from '../../umumiy/ui/Sahifa';
import { toast } from '../../umumiy/ui/Toast';
import { FmtN } from '../../lib/format';
import { useShaxsiySmetalar, useIshTurQidir, useShaxsiySmetaYarat } from '../../api/hooks';

type Qator = { kod: string; nom: string; birlik: string; narx: number; hajm: number };

export default function ShaxsiySmeta() {
  const royxat = useShaxsiySmetalar();
  const qidir = useIshTurQidir();
  const yarat = useShaxsiySmetaYarat();

  const [nom, setNom] = useState('');
  const [soz, setSoz] = useState('');
  const [topilgan, setTopilgan] = useState<Array<{ kod: string; nom: string; birlik: string; narx?: number }>>([]);
  const [ishlar, setIshlar] = useState<Qator[]>([]);

  const jami = useMemo(
    () => ishlar.reduce((a, i) => a + (Number(i.narx) || 0) * (Number(i.hajm) || 0), 0),
    [ishlar]);

  const qidirish = () => {
    if (!soz.trim()) return;
    qidir.mutate({ soz: soz.trim() }, {
      onSuccess: (r) => {
        setTopilgan(r || []);
        if (!r?.length) toast('Hech narsa topilmadi', 'warn');
      },
      onError: (e: Error) => toast(e.message, 'danger'),
    });
  };

  const qoshish = (x: { kod: string; nom: string; birlik: string; narx?: number }) => {
    if (ishlar.some((i) => i.kod === x.kod)) { toast('Bu ish allaqachon qo\'shilgan', 'warn'); return; }
    setIshlar((p) => [...p, {
      kod: x.kod, nom: x.nom, birlik: x.birlik, narx: Number(x.narx) || 0, hajm: 1,
    }]);
  };

  const yaratish = () => {
    if (!nom.trim()) { toast('Smeta nomini kiriting', 'warn'); return; }
    if (!ishlar.length) { toast('Kamida bitta ish qo\'shing', 'warn'); return; }
    yarat.mutate({ config: { nom: nom.trim() }, ishlar }, {
      onSuccess: (r) => {
        if (r.ok && r.url) {
          toast('Smeta yaratildi', 'ok', undefined, 8000);
          setIshlar([]); setNom('');
          window.open(r.url, '_blank');
        } else {
          toast(r.xabar || 'Yaratilmadi', 'danger', undefined, 9000);
        }
      },
      onError: (e: Error) => toast(e.message, 'danger', undefined, 9000),
    });
  };

  return (
    <Sahifa
      sarlavha="Shaxsiy smeta"
      tavsif="Loyihaga bog'liq bo'lmagan kichik ish uchun tez smeta tuzish"
    >
      <div className="flex gap-4 h-full min-h-0">
        {/* ── CHAP: ish turi qidirish ─────────────────────────────── */}
        <div className="w-[340px] flex-shrink-0 flex flex-col gap-2 min-h-0">
          <div className="karta p-3">
            <label className="text-[12px] font-medium text-text block mb-1.5">
              Ish turini qidirish
            </label>
            <div className="flex gap-2">
              <input value={soz} onChange={(e) => setSoz(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') qidirish(); }}
                placeholder="masalan: бетон, кирпич…"
                className="flex-1 bg-[var(--surface-2)] border border-border rounded
                           px-2 py-1.5 text-[12px] text-text outline-none focus:border-accent/50" />
              <button onClick={qidirish} disabled={qidir.isPending}
                className="px-2.5 rounded bg-accent/15 text-accent hover:bg-accent/25
                           transition-colors disabled:opacity-50">
                <Search size={14} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin space-y-1 min-h-0">
            {qidir.isPending && <div className="skel h-12 rounded" />}
            {topilgan.map((x) => (
              <button key={x.kod} onClick={() => qoshish(x)}
                className="w-full text-left p-2 rounded-lg border border-border
                           bg-[var(--surface-2)]/40 hover:bg-white/5 hover:border-accent/40
                           transition-colors group">
                <div className="flex items-start gap-2">
                  <span className="flex-1 text-[12px] text-text leading-tight">{x.nom}</span>
                  <Plus size={13} className="text-accent flex-shrink-0 opacity-0
                                             group-hover:opacity-100 transition-opacity mt-0.5" />
                </div>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-text-mute">
                  <span className="font-mono">{x.kod}</span>
                  {x.birlik && <span>· {x.birlik}</span>}
                  {!!x.narx && <span className="text-emerald-400">· <FmtN val={x.narx} /></span>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── O'NG: tuzilayotgan smeta + mavjudlar ────────────────── */}
        <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0 space-y-4 pr-1">
          <div className="karta p-4">
            <h3 className="text-[15px] font-semibold text-text mb-3 flex items-center gap-2">
              <NotebookPen size={17} className="text-accent" />
              Yangi smeta
            </h3>

            <input value={nom} onChange={(e) => setNom(e.target.value)}
              placeholder="Smeta nomi (masalan: Ofis ta'mirlash)"
              className="w-full bg-[var(--surface-2)] border border-border rounded
                         px-3 py-2 text-[13px] text-text outline-none focus:border-accent/50 mb-3" />

            {!ishlar.length ? (
              <p className="text-[12px] text-text-mute italic py-6 text-center">
                Chapdan ish turlarini qidirib qo'shing
              </p>
            ) : (
              <div className="space-y-1.5">
                {ishlar.map((i, idx) => (
                  <div key={i.kod}
                    className="flex items-center gap-2 p-2 rounded-lg bg-[var(--surface-2)]/40
                               border border-border">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-text leading-tight">{i.nom}</p>
                      <p className="text-[10px] text-text-mute font-mono">{i.kod} · {i.birlik}</p>
                    </div>
                    <input type="number" step="any" value={i.hajm}
                      onChange={(e) => setIshlar((p) => p.map((x, j) =>
                        j === idx ? { ...x, hajm: Number(e.target.value) || 0 } : x))}
                      className="w-20 bg-[var(--surface-3)] border border-border rounded
                                 px-2 py-1 text-[12px] text-text text-right outline-none
                                 focus:border-accent/50" />
                    <span className="w-28 text-right text-[12px] text-emerald-400 tabular-nums">
                      <FmtN val={(Number(i.narx) || 0) * (Number(i.hajm) || 0)} />
                    </span>
                    <button onClick={() => setIshlar((p) => p.filter((_, j) => j !== idx))}
                      className="text-text-mute hover:text-danger p-1 rounded hover:bg-white/10
                                 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}

                <div className="flex items-center justify-between pt-2 mt-2 border-t border-border">
                  <span className="text-[13px] font-medium text-text">
                    Jami ({ishlar.length} ta ish):
                  </span>
                  <span className="text-[15px] font-semibold text-emerald-400 tabular-nums">
                    <FmtN val={jami} /> so'm
                  </span>
                </div>

                <button onClick={yaratish} disabled={yarat.isPending}
                  className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5
                             rounded-lg bg-accent text-white text-[13px] font-medium
                             hover:bg-accent/90 transition-colors disabled:opacity-40">
                  <FileSpreadsheet size={15} />
                  {yarat.isPending ? 'Yaratilmoqda…' : 'Google jadval sifatida yaratish'}
                </button>
              </div>
            )}
          </div>

          {/* Avval yaratilganlar */}
          <div className="karta p-4">
            <h3 className="text-[14px] font-semibold text-text mb-2">Yaratilgan smetalar</h3>
            {royxat.isLoading && <div className="skel h-12 rounded" />}
            {!royxat.isLoading && !royxat.data?.length && (
              <p className="text-[12px] text-text-mute italic">Hali yaratilmagan</p>
            )}
            <div className="space-y-1">
              {(royxat.data ?? []).map((s) => (
                <a key={s.id} href={s.url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 p-2 rounded-lg border border-border
                             bg-[var(--surface-2)]/40 hover:bg-white/5 transition-colors">
                  <FileSpreadsheet size={14} className="text-accent flex-shrink-0" />
                  <span className="flex-1 text-[12px] text-text truncate">{s.nom}</span>
                  <span className="text-[10px] text-text-mute">
                    {s.sana ? new Date(s.sana).toLocaleDateString('ru-RU') : ''}
                  </span>
                  <ExternalLink size={12} className="text-text-mute flex-shrink-0" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Sahifa>
  );
}
