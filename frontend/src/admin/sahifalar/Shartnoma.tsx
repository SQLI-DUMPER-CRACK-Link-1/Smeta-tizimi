import { useMemo, useState } from 'react';
import { useShartnomalar } from '../../api/hooks';
import { Sahifa, Holatlar, Jadval, Nishon, KpiKarta, Qidiruv, type Ustun } from '../../umumiy/ui/Sahifa';
import { FmtN } from '../../lib/format';
import type { Shartnoma as ShartnomaTur } from '../../api/types';

export function Shartnoma() {
  const soragan = useShartnomalar();
  const [q, setQ] = useState('');

  const satrlar = useMemo(() => {
    const hammasi = soragan.data ?? [];
    const s = q.trim().toUpperCase();
    if (!s) return hammasi;
    return hammasi.filter(
      (x) =>
        x.no.toUpperCase().includes(s) ||
        x.nomi.toUpperCase().includes(s) ||
        x.taraf.toUpperCase().includes(s),
    );
  }, [soragan.data, q]);

  const jami = useMemo(() => {
    const h = soragan.data ?? [];
    return {
      soni: h.length,
      summa: h.reduce((a, x) => a + (x.jami || 0), 0),
      faol: h.filter((x) => (x.holat || '').toUpperCase().startsWith('ФАОЛ')).length,
    };
  }, [soragan.data]);

  const ustunlar: Ustun<ShartnomaTur>[] = [
    { kalit: 'no', nom: '№', en: '110px', chiz: (r) => <span className="font-medium text-text">{r.no}</span> },
    {
      kalit: 'nomi',
      nom: 'Nomi',
      chiz: (r) => (
        <div className="min-w-0">
          <div className="text-text truncate" title={r.nomi}>{r.nomi || '—'}</div>
          {r.izoh && <div className="text-[11px] text-text-mute truncate" title={r.izoh}>{r.izoh}</div>}
        </div>
      ),
    },
    { kalit: 'taraf', nom: 'Taraf', en: '220px', chiz: (r) => <span className="text-text-dim truncate block" title={r.taraf}>{r.taraf || '—'}</span> },
    { kalit: 'summa', nom: 'Summa', raqam: true, en: '150px', chiz: (r) => <FmtN val={r.summa} /> },
    { kalit: 'nds', nom: 'NDS', raqam: true, en: '130px', chiz: (r) => <FmtN val={r.nds} /> },
    { kalit: 'jami', nom: 'Jami', raqam: true, en: '160px', chiz: (r) => <span className="text-text font-medium"><FmtN val={r.jami} /></span> },
    {
      kalit: 'holat',
      nom: 'Holat',
      en: '110px',
      chiz: (r) => {
        const h = (r.holat || '').toUpperCase();
        const tur = h.startsWith('ФАОЛ') ? 'ok' : h.startsWith('ЯКУН') ? 'neytral' : 'warn';
        return <Nishon matn={r.holat || '—'} tur={tur} />;
      },
    },
  ];

  return (
    <Sahifa
      sarlavha="Shartnomalar"
      tavsif="Podryadchilar va yetkazib beruvchilar bilan tuzilgan shartnomalar"
      yangilangan={soragan.dataUpdatedAt}
      onYangila={() => soragan.refetch()}
      yangilanmoqda={soragan.isFetching}
      amallar={<Qidiruv qiymat={q} ozgardi={setQ} placeholder="№, nomi yoki taraf…" />}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <KpiKarta nom="Shartnomalar" qiymat={jami.soni} ost={`${jami.faol} ta faol`} />
        <KpiKarta nom="Umumiy summa" qiymat={<FmtN val={jami.summa} />} ost="so'm (NDS bilan)" />
        <KpiKarta nom="Ko'rsatilmoqda" qiymat={satrlar.length} ost={q ? 'qidiruv bo\'yicha' : 'hammasi'} />
      </div>

      <Holatlar
        soragan={soragan}
        bosh={{ matn: 'Shartnoma topilmadi', izoh: 'Shartnomalar Google Sheets’dagi «Шартномалар» varag‘idan o‘qiladi.' }}
      >
        {() =>
          satrlar.length === 0 ? (
            <div className="karta py-12 text-center text-text-dim text-sm">
              «{q}» bo'yicha hech narsa topilmadi
            </div>
          ) : (
            <Jadval ustunlar={ustunlar} satrlar={satrlar} kalit={(r, i) => r.no || String(i)} />
          )
        }
      </Holatlar>
    </Sahifa>
  );
}

export default Shartnoma;
