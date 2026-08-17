import { useMemo, useState, useEffect } from 'react';
import { useShartnomalar, useTolovlar, useShartnomaBog, useShartnomaSaqla, useTolovSaqla } from '../../api/hooks';
import {
  Sahifa, Holatlar, Jadval, Nishon, KpiKarta, Qidiruv, Yon, Juft,
  Maydon, Kiritma, Tanlov, Tugma, type Ustun,
} from '../../umumiy/ui/Sahifa';
import { FmtN } from '../../lib/format';
import { toast } from '../../umumiy/ui/Toast';
import { Plus, Save, Building2 } from 'lucide-react';
import type { Shartnoma as ShTur, Tolov } from '../../api/types';

const HOLATLAR = ['Фаол', 'Якунланган', 'Тўхтатилган'];

export function Shartnoma() {
  const soragan = useShartnomalar();
  const tolovlar = useTolovlar();
  const bog = useShartnomaBog();
  const saqla = useShartnomaSaqla();
  const tolovYoz = useTolovSaqla();

  const [q, setQ] = useState('');
  const [tanlangan, setTanlangan] = useState<ShTur | null>(null);
  const [shakl, setShakl] = useState<ShTur | null>(null);
  const [yangiTolov, setYangiTolov] = useState({ sana: '', summa: '', izoh: '', obyekt: '' });

  useEffect(() => { setShakl(tanlangan ? { ...tanlangan } : null); }, [tanlangan]);

  const satrlar = useMemo(() => {
    const h = soragan.data ?? [];
    const s = q.trim().toUpperCase();
    if (!s) return h;
    return h.filter((x) =>
      x.no.toUpperCase().includes(s) || x.nomi.toUpperCase().includes(s) || x.taraf.toUpperCase().includes(s));
  }, [soragan.data, q]);

  /** Har shartnoma bo'yicha to'langan summa */
  const tolanganMap = useMemo(() => {
    const m: Record<string, number> = {};
    (tolovlar.data ?? []).forEach((t) => { m[t.shNo] = (m[t.shNo] || 0) + (t.summa || 0); });
    return m;
  }, [tolovlar.data]);

  /** Shartnomaga bog'langan obyektlar */
  const obyektMap = useMemo(() => {
    const m: Record<string, string[]> = {};
    Object.entries(bog.data ?? {}).forEach(([ob, no]) => { (m[no] ||= []).push(ob); });
    return m;
  }, [bog.data]);

  const jami = useMemo(() => {
    const h = soragan.data ?? [];
    const summa = h.reduce((a, x) => a + (x.jami || 0), 0);
    const tolangan = Object.values(tolanganMap).reduce((a, b) => a + b, 0);
    return { soni: h.length, summa, tolangan, qoldiq: summa - tolangan };
  }, [soragan.data, tolanganMap]);

  const shTolovlari: Tolov[] = useMemo(
    () => (tolovlar.data ?? []).filter((t) => t.shNo === tanlangan?.no),
    [tolovlar.data, tanlangan],
  );

  async function shartnomaSaqla() {
    if (!shakl) return;
    try {
      await saqla.mutateAsync(shakl);
      toast(`${shakl.no} saqlandi`);
      soragan.refetch();
      setTanlangan(null);
    } catch (e: any) { toast(`Saqlanmadi: ${e.message}`); }
  }

  async function tolovQosh() {
    if (!tanlangan) return;
    const summa = Number(String(yangiTolov.summa).replace(/[^\d.-]/g, ''));
    if (!summa) { toast('Summa kiriting'); return; }
    try {
      await tolovYoz.mutateAsync({
        shNo: tanlangan.no,
        /* ⚡ 2026-08-16 (audit M): avval DOIM birinchi obyekt olinardi —
           shartnoma bir necha obyektga tegishli bo'lsa to'lov NOTO'G'RI
           obyektga yozilardi va obyekt bo'yicha hisob buzilardi.
           Endi foydalanuvchi tanlaydi (bitta bo'lsa o'zi qo'yiladi). */
        obyekt: yangiTolov.obyekt || (obyektMap[tanlangan.no] || [])[0] || '',
        summa,
        sana: yangiTolov.sana || undefined,
        tur: 'Тўлов',
        izoh: yangiTolov.izoh,
      });
      setYangiTolov({ sana: '', summa: '', izoh: '', obyekt: '' });
      toast("To'lov qo'shildi");
      tolovlar.refetch();
    } catch (e: any) { toast(`Qo'shilmadi: ${e.message}`); }
  }

  const ustunlar: Ustun<ShTur>[] = [
    { kalit: 'no', nom: '№', en: '110px', chiz: (r) => <span className="font-medium text-text">{r.no}</span> },
    {
      kalit: 'nomi', nom: 'Nomi',
      chiz: (r) => (
        <div className="min-w-0">
          <div className="text-text truncate" title={r.nomi}>{r.nomi || '—'}</div>
          <div className="text-[11px] text-text-mute truncate" title={r.taraf}>{r.taraf || '—'}</div>
        </div>
      ),
    },
    { kalit: 'jami', nom: 'Shartnoma summasi', raqam: true, en: '170px', chiz: (r) => <FmtN val={r.jami} /> },
    {
      kalit: 'tolangan', nom: "To'langan", raqam: true, en: '160px',
      chiz: (r) => <span className="text-ok"><FmtN val={tolanganMap[r.no] || 0} /></span>,
    },
    {
      kalit: 'qoldiq', nom: 'Qoldiq', raqam: true, en: '160px',
      chiz: (r) => {
        const qd = (r.jami || 0) - (tolanganMap[r.no] || 0);
        return <span className={qd > 0 ? 'text-warn' : 'text-text-dim'}><FmtN val={qd} /></span>;
      },
    },
    {
      kalit: 'ob', nom: 'Obyektlar', en: '110px',
      chiz: (r) => {
        const n = (obyektMap[r.no] || []).length;
        return <span className="text-text-dim tabular-nums">{n ? `${n} ta` : '—'}</span>;
      },
    },
    {
      kalit: 'holat', nom: 'Holat', en: '120px',
      chiz: (r) => {
        const h = (r.holat || '').toUpperCase();
        return <Nishon matn={r.holat || '—'} tur={h.startsWith('ФАОЛ') ? 'ok' : h.startsWith('ЯКУН') ? 'neytral' : 'warn'} />;
      },
    },
  ];

  return (
    <Sahifa
      sarlavha="Shartnomalar"
      tavsif="Qatorga bosing — batafsil, to'lovlar va tahrirlash ochiladi"
      yangilangan={soragan.dataUpdatedAt}
      onYangila={() => { soragan.refetch(); tolovlar.refetch(); }}
      yangilanmoqda={soragan.isFetching || tolovlar.isFetching}
      amallar={<Qidiruv qiymat={q} ozgardi={setQ} placeholder="№, nomi yoki taraf…" />}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <KpiKarta nom="Shartnomalar" qiymat={jami.soni} />
        <KpiKarta nom="Umumiy summa" qiymat={<FmtN val={jami.summa} />} ost="so'm (NDS bilan)" />
        <KpiKarta nom="To'langan" qiymat={<FmtN val={jami.tolangan} />} ost={jami.summa ? `${Math.round((jami.tolangan / jami.summa) * 100)}%` : undefined} />
        <KpiKarta nom="Qoldiq" qiymat={<FmtN val={jami.qoldiq} />} />
      </div>

      <Holatlar soragan={soragan} bosh={{ matn: 'Shartnoma topilmadi', izoh: 'Google Sheets’dagi «Шартномалар» varag‘i bo‘sh.' }}>
        {() =>
          satrlar.length === 0
            ? <div className="karta py-12 text-center text-text-dim text-sm">«{q}» bo'yicha topilmadi</div>
            : <Jadval ustunlar={ustunlar} satrlar={satrlar} kalit={(r, i) => r.no || String(i)} onSatrBos={setTanlangan} />
        }
      </Holatlar>

      {/* ---------- Batafsil panel ---------- */}
      <Yon
        ochiq={!!tanlangan}
        yop={() => setTanlangan(null)}
        sarlavha={tanlangan?.no ?? ''}
        tavsif={tanlangan?.nomi}
        past={
          <div className="flex gap-3 justify-end">
            <Tugma onBos={() => setTanlangan(null)}>Yopish</Tugma>
            <Tugma tur="primary" onBos={shartnomaSaqla} band={saqla.isPending} ikonka={<Save size={16} />}>
              Saqlash
            </Tugma>
          </div>
        }
      >
        {shakl && (
          <>
            {/* Moliyaviy xulosa */}
            <section className="karta p-4">
              <Juft nom="Shartnoma summasi" qiymat={<FmtN val={shakl.jami} />} />
              <Juft nom="To'langan" qiymat={<span className="text-ok"><FmtN val={tolanganMap[shakl.no] || 0} /></span>} />
              <Juft nom="Qoldiq" qiymat={<span className="text-warn"><FmtN val={(shakl.jami || 0) - (tolanganMap[shakl.no] || 0)} /></span>} />
            </section>

            {/* Bog'langan obyektlar */}
            <section>
              <h4 className="text-[11px] uppercase tracking-[0.04em] text-text-dim mb-2">Bog'langan obyektlar</h4>
              {(obyektMap[shakl.no] || []).length === 0 ? (
                <p className="text-sm text-text-mute">Bu shartnomaga obyekt bog'lanmagan.</p>
              ) : (
                <ul className="space-y-1">
                  {(obyektMap[shakl.no] || []).map((ob) => (
                    <li key={ob} className="flex items-center gap-2 text-sm text-text">
                      <Building2 size={14} className="text-accent flex-shrink-0" />
                      <span className="truncate" title={ob}>{ob}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Tahrirlash */}
            <section className="space-y-3">
              <h4 className="text-[11px] uppercase tracking-[0.04em] text-text-dim">Ma'lumotlar</h4>
              <Maydon nom="№"><Kiritma qiymat={shakl.no} ozgardi={() => {}} ozgarmas /></Maydon>
              <Maydon nom="Nomi"><Kiritma qiymat={shakl.nomi} ozgardi={(v) => setShakl({ ...shakl, nomi: v })} /></Maydon>
              <Maydon nom="Taraf"><Kiritma qiymat={shakl.taraf} ozgardi={(v) => setShakl({ ...shakl, taraf: v })} /></Maydon>
              <div className="grid grid-cols-2 gap-3">
                <Maydon nom="Summa"><Kiritma tur="number" qiymat={shakl.summa} ozgardi={(v) => { const sm = Number(v) || 0; setShakl({ ...shakl, summa: sm, jami: sm + (Number(shakl.nds) || 0) }); }} /></Maydon>
                <Maydon nom="NDS"><Kiritma tur="number" qiymat={shakl.nds} ozgardi={(v) => { const nd = Number(v) || 0; setShakl({ ...shakl, nds: nd, jami: (Number(shakl.summa) || 0) + nd }); }} /></Maydon>
              </div>
              {/* ⚡⚡⚡ 2026-08-16 (audit H15 — TASDIQLANDI): Summa yoki NDS
                  o'zgarganda JAMI qayta hisoblanmasdi — shartnoma ESKI jami
                  bilan saqlanardi va buxgalteriyaga NOTO'G'RI summa tushardi.
                  Endi ikkalasi ham Jami ni yangilaydi. Jami qo'lda ham
                  tuzatilishi mumkin (yaxlitlash farqi uchun). */}
              <Maydon nom="Jami" izoh="Summa + NDS (avtomatik, qo'lda ham tuzatsa bo'ladi)">
                <Kiritma tur="number" qiymat={shakl.jami} ozgardi={(v) => setShakl({ ...shakl, jami: Number(v) || 0 })} />
              </Maydon>
              <Maydon nom="Holat"><Tanlov qiymat={shakl.holat || HOLATLAR[0]} ozgardi={(v) => setShakl({ ...shakl, holat: v })} variantlar={HOLATLAR} /></Maydon>
              <Maydon nom="Izoh"><Kiritma qiymat={shakl.izoh} ozgardi={(v) => setShakl({ ...shakl, izoh: v })} /></Maydon>
            </section>

            {/* To'lovlar */}
            <section>
              <h4 className="text-[11px] uppercase tracking-[0.04em] text-text-dim mb-2">
                To'lovlar ({shTolovlari.length})
              </h4>
              {shTolovlari.length === 0 ? (
                <p className="text-sm text-text-mute mb-3">Hali to'lov qayd etilmagan.</p>
              ) : (
                <div className="karta divide-y divide-border mb-3">
                  {shTolovlari.map((t) => (
                    <div key={t.row} className="px-3 py-2 flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <div className="text-text tabular-nums">{t.sana}</div>
                        {t.izoh && <div className="text-[11px] text-text-mute truncate">{t.izoh}</div>}
                      </div>
                      <span className="text-ok tabular-nums flex-shrink-0"><FmtN val={t.summa} /></span>
                    </div>
                  ))}
                </div>
              )}

              <div className="karta p-3 space-y-3">
                <p className="text-[11px] uppercase tracking-[0.04em] text-text-dim">Yangi to'lov</p>
                <div className="grid grid-cols-2 gap-3">
                  {/* ⚡ 2026-08-16: shartnoma bir necha obyektga tegishli bo'lsa
                      to'lov qaysi biriga yozilishini TANLASH kerak */}
                  {((obyektMap[tanlangan?.no ?? ''] || []).length > 1) && (
                    <Maydon nom="Qaysi obyektga" izoh="Bu shartnoma bir necha obyektga tegishli">
                      <Tanlov
                        qiymat={yangiTolov.obyekt || (obyektMap[tanlangan?.no ?? ''] || [])[0] || ''}
                        ozgardi={(v) => setYangiTolov({ ...yangiTolov, obyekt: v })}
                        variantlar={obyektMap[tanlangan?.no ?? ''] || []} />
                    </Maydon>
                  )}
                  <Maydon nom="Sana"><Kiritma tur="date" qiymat={yangiTolov.sana} ozgardi={(v) => setYangiTolov({ ...yangiTolov, sana: v })} /></Maydon>
                  <Maydon nom="Summa"><Kiritma tur="number" qiymat={yangiTolov.summa} ozgardi={(v) => setYangiTolov({ ...yangiTolov, summa: v })} /></Maydon>
                </div>
                <Maydon nom="Izoh"><Kiritma qiymat={yangiTolov.izoh} ozgardi={(v) => setYangiTolov({ ...yangiTolov, izoh: v })} placeholder="ixtiyoriy" /></Maydon>
                <Tugma onBos={tolovQosh} band={tolovYoz.isPending} ikonka={<Plus size={16} />}>To'lov qo'shish</Tugma>
              </div>
            </section>
          </>
        )}
      </Yon>
    </Sahifa>
  );
}

export default Shartnoma;
