import { useMemo } from 'react';
import { useApiLog } from '../../api/hooks';
import { Sahifa, Holatlar, Jadval, Nishon, KpiKarta, type Ustun } from '../../umumiy/ui/Sahifa';
import type { ApiLogYozuv } from '../../api/types';

/** 10 soniyadan sekin chaqiruv — diqqat talab qiladi (14 §9.2). */
const SEKIN_MS = 10_000;

export function Monitoring() {
  const soragan = useApiLog();
  const yozuvlar = soragan.data ?? [];

  const stat = useMemo(() => {
    const n = yozuvlar.length;
    const xato = yozuvlar.filter((y) => y.h !== 'OK').length;
    const sekin = yozuvlar.filter((y) => (y.ms || 0) > SEKIN_MS).length;
    const oqMs = yozuvlar.filter((y) => y.h === 'OK').map((y) => y.ms || 0);
    const ortacha = oqMs.length ? Math.round(oqMs.reduce((a, b) => a + b, 0) / oqMs.length) : 0;
    return { n, xato, sekin, ortacha };
  }, [yozuvlar]);

  const ustunlar: Ustun<ApiLogYozuv>[] = [
    {
      kalit: 't',
      nom: 'Vaqt',
      en: '160px',
      chiz: (y) => {
        const d = new Date(y.t);
        const ok = !isNaN(d.getTime());
        return (
          <span className="text-text-dim tabular-nums">
            {ok ? d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : y.t}
          </span>
        );
      },
    },
    { kalit: 'fn', nom: 'Funksiya', chiz: (y) => <span className="text-text font-mono text-[12px]">{y.fn}</span> },
    {
      kalit: 'h',
      nom: 'Holat',
      en: '140px',
      chiz: (y) =>
        y.h === 'OK' ? <Nishon matn="OK" tur="ok" />
        : y.h === 'XATO' ? <Nishon matn="Xato" tur="danger" />
        : <Nishon matn={y.h} tur="warn" />,
    },
    {
      kalit: 'ms',
      nom: 'Davomiylik',
      raqam: true,
      en: '130px',
      chiz: (y) => {
        const ms = y.ms || 0;
        const rang = ms > SEKIN_MS ? 'text-warn font-medium' : 'text-text-dim';
        return <span className={rang}>{ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`}</span>;
      },
    },
  ];

  return (
    <Sahifa
      sarlavha="Monitoring"
      tavsif="Saytdan GAS'ga qilingan oxirgi 50 ta chaqiruv"
      yangilangan={soragan.dataUpdatedAt}
      onYangila={() => soragan.refetch()}
      yangilanmoqda={soragan.isFetching}
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <KpiKarta nom="Chaqiruvlar" qiymat={stat.n} />
        <KpiKarta nom="Xatolar" qiymat={stat.xato} ost={stat.xato ? 'tekshirish kerak' : 'muammo yo‘q'} />
        <KpiKarta nom="Sekin (>10s)" qiymat={stat.sekin} />
        <KpiKarta nom="O'rtacha" qiymat={stat.ortacha >= 1000 ? `${(stat.ortacha / 1000).toFixed(1)} s` : `${stat.ortacha} ms`} ost="muvaffaqiyatlilar bo'yicha" />
      </div>

      <Holatlar
        soragan={soragan}
        bosh={{ matn: 'Log bo‘sh', izoh: 'Hali chaqiruv qayd etilmagan yoki kesh muddati tugagan (6 soat).' }}
      >
        {() => <Jadval ustunlar={ustunlar} satrlar={yozuvlar} kalit={(y, i) => `${y.t}|${i}`} />}
      </Holatlar>
    </Sahifa>
  );
}

export default Monitoring;
