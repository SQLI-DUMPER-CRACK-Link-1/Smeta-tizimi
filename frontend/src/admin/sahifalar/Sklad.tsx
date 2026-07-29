import { useMemo, useState } from 'react';
import { useSkladQoldiq } from '../../api/hooks';
import { Sahifa, Holatlar, Jadval, Nishon, KpiKarta, Qidiruv, type Ustun } from '../../umumiy/ui/Sahifa';
import { FmtN } from '../../lib/format';
import type { SkladMaterial } from '../../api/types';

export function Sklad() {
  const soragan = useSkladQoldiq();
  const [q, setQ] = useState('');
  const [faqatKam, setFaqatKam] = useState(false);

  const hammasi = soragan.data?.materiallar ?? [];

  const satrlar = useMemo(() => {
    const s = q.trim().toUpperCase();
    return hammasi.filter((m) => {
      if (s && !m.nom.toUpperCase().includes(s)) return false;
      if (faqatKam && m.qoldiq > 0) return false;
      return true;
    });
  }, [hammasi, q, faqatKam]);

  const stat = useMemo(
    () => ({
      turlari: hammasi.length,
      tugagan: hammasi.filter((m) => m.qoldiq <= 0).length,
      manfiy: hammasi.filter((m) => m.qoldiq < 0).length,
    }),
    [hammasi],
  );

  const ustunlar: Ustun<SkladMaterial>[] = [
    {
      kalit: 'nom',
      nom: 'Material',
      chiz: (m) => <span className="text-text truncate block" title={m.nom}>{m.nom}</span>,
    },
    { kalit: 'birlik', nom: 'Birlik', en: '90px', chiz: (m) => <span className="text-text-dim">{m.birlik || '—'}</span> },
    { kalit: 'kirim', nom: 'Kirim', raqam: true, en: '130px', chiz: (m) => <span className="text-text-dim"><FmtN val={m.kirim} /></span> },
    { kalit: 'chiqim', nom: 'Chiqim', raqam: true, en: '130px', chiz: (m) => <span className="text-text-dim"><FmtN val={m.chiqim} /></span> },
    {
      kalit: 'qoldiq',
      nom: 'Qoldiq',
      raqam: true,
      en: '140px',
      chiz: (m) => (
        <span className={m.qoldiq < 0 ? 'text-danger font-medium' : m.qoldiq === 0 ? 'text-warn' : 'text-text font-medium'}>
          <FmtN val={m.qoldiq} />
        </span>
      ),
    },
    {
      kalit: 'holat',
      nom: 'Holat',
      en: '120px',
      chiz: (m) =>
        m.qoldiq < 0 ? (
          <Nishon matn="Manfiy" tur="danger" />
        ) : m.qoldiq === 0 ? (
          <Nishon matn="Tugagan" tur="warn" />
        ) : (
          <Nishon matn="Bor" tur="ok" />
        ),
    },
  ];

  return (
    <Sahifa
      sarlavha="Sklad"
      tavsif="Kirim va chiqim bo'yicha hisoblangan joriy qoldiq"
      yangilangan={soragan.dataUpdatedAt}
      onYangila={() => soragan.refetch()}
      yangilanmoqda={soragan.isFetching}
      amallar={
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-text-dim cursor-pointer select-none">
            <input
              type="checkbox"
              checked={faqatKam}
              onChange={(e) => setFaqatKam(e.target.checked)}
              className="accent-[var(--accent)] cursor-pointer"
            />
            Faqat tugaganlar
          </label>
          <Qidiruv qiymat={q} ozgardi={setQ} placeholder="Material nomi…" />
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <KpiKarta nom="Material turlari" qiymat={stat.turlari} />
        <KpiKarta nom="Tugagan" qiymat={stat.tugagan} ost="qoldiq 0 yoki past" />
        <KpiKarta nom="Manfiy qoldiq" qiymat={stat.manfiy} ost={stat.manfiy ? 'tekshirish kerak' : 'muammo yo‘q'} />
      </div>

      <Holatlar
        soragan={soragan}
        bosh={{ matn: 'Sklad bo‘sh', izoh: 'Kirim (Приход) va chiqim (Расход) varaqlarida yozuv topilmadi.' }}
      >
        {() =>
          satrlar.length === 0 ? (
            <div className="karta py-12 text-center text-text-dim text-sm">Filtrga mos material topilmadi</div>
          ) : (
            <Jadval ustunlar={ustunlar} satrlar={satrlar} kalit={(m, i) => `${m.nom}|${m.birlik}|${i}`} />
          )
        }
      </Holatlar>
    </Sahifa>
  );
}

export default Sklad;
