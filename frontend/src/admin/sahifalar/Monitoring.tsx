import { useMemo } from 'react';
import { useApiLog } from '../../api/hooks';
import { Sahifa, Holatlar, Jadval, Nishon, KpiKarta, type Ustun } from '../../umumiy/ui/Sahifa';
import type { ApiLogYozuv } from '../../api/types';

/** 10 soniyadan sekin chaqiruv — diqqat talab qiladi (14 §9.2). */
const SEKIN_MS = 10_000;

/**
 * API funksiya nomini odam tiliga o'giradi.
 * Foydalanuvchi `apiPapkaSkan` emas, «Obyektlar ro'yxati o'qildi» ni ko'rishi kerak.
 */
const AMAL: Record<string, string> = {
  apiPapkaSkan: "Obyektlar ro'yxati o'qildi",
  apiBossData: 'Umumiy hisobot yig‘ildi',
  apiBossObyekt: 'Obyekt hisoboti o‘qildi',
  apiHolatOl: 'Smeta daraxti o‘qildi',
  apiHolatOlLokalka: 'Lokalka smetasi o‘qildi',
  apiHolatSaqla: 'Smeta o‘zgarishlari saqlandi',
  apiBlQosh: 'Yangi ish qatori qo‘shildi',
  apiRsQosh: 'Yangi resurs qo‘shildi',
  apiOyQosh: 'Yangi oy ustuni yaratildi',
  apiShartnomaOl: 'Shartnomalar o‘qildi',
  apiShartnomaSaqla: 'Shartnoma saqlandi',
  apiShartnomaOchir: 'Shartnoma o‘chirildi',
  apiShartnomaDashboard: 'Shartnoma jamlanmasi',
  apiSkladQoldiq: 'Sklad qoldig‘i hisoblandi',
  apiSkladOl: 'Sklad ro‘yxati o‘qildi',
  apiTolovOl: 'To‘lovlar o‘qildi',
  apiF2FaylOqi: 'Ф2 fayli o‘qildi',
  apiF2AvtoMoslash: 'Ф2 avto-moslashtirish',
  apiF2QollaNavbatga: 'Ф2 yozuvi navbatga qo‘yildi',
  apiF2JobHolat: 'Ф2 yozuv holati so‘raldi',
  apiTitanAi: 'Jarvis AI savoliga javob',
  apiKirishTekshir: 'Tizimga kirish tekshirildi',
  apiWebApiSalom: 'Ulanish tekshiruvi',
  apiWebApiLog: 'Monitoring o‘qildi',
  apiXatoYoz: 'Xato qayd etildi',
  apiLockOl: 'Bandlik tekshirildi',
  apiLockBos: 'Obyekt band qilindi',
  apiLockOch: 'Obyekt bo‘shatildi',
};

function amalNomi(fn: string): string {
  return AMAL[fn] ?? fn.replace(/^api/, '').replace(/([A-Z])/g, ' $1').trim();
}

const HOLAT_NOMI: Record<string, string> = {
  OK: 'Bajarildi',
  XATO: 'Xato',
  AUTH_FAIL: 'Kirish rad etildi',
  RUXSAT_YOQ: 'Ruxsat yo‘q',
};

/**
 * EKG — kardiogramma uslubidagi jarayon chizig'i.
 * X = vaqt (chapda eng eskisi), Y = davomiylik (log shkala — 20 ms va 20 s
 * bitta grafikka sig'ishi uchun). Har nuqta hover'da tafsilot beradi.
 */
function Ekg({ yozuvlar }: { yozuvlar: ApiLogYozuv[] }) {
  const W = 1000, H = 120, P = 8;
  const nuqtalar = [...yozuvlar].reverse();          // chapda eskisi
  const maxMs = Math.max(1000, ...nuqtalar.map((y) => y.ms || 0));
  const lg = (ms: number) => Math.log10(Math.max(1, ms) + 1) / Math.log10(maxMs + 1);

  const dx = nuqtalar.length > 1 ? (W - P * 2) / (nuqtalar.length - 1) : 0;
  const xy = nuqtalar.map((y, i) => {
    const x = P + i * dx;
    const h = lg(y.ms || 0) * (H - P * 2);
    return { x, y: H - P - h, d: y };
  });

  /* Kardiogramma ko'rinishi: har nuqtaga tik ko'tarilib, tik tushadi */
  const yol = xy.map((p, i) => {
    const bazaY = H - P;
    const oldingi = i === 0 ? `M ${P} ${bazaY}` : '';
    return `${oldingi} L ${p.x - dx * 0.25} ${bazaY} L ${p.x} ${p.y} L ${p.x + dx * 0.25} ${bazaY}`;
  }).join(' ');

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[120px]" preserveAspectRatio="none">
        <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="var(--border)" strokeWidth="1" />
        <path d={yol} fill="none" stroke="var(--accent)" strokeWidth="1.5"
              strokeLinejoin="round" opacity="0.75" vectorEffect="non-scaling-stroke" />
        {xy.map((p, i) => {
          const xato = p.d.h !== 'OK';
          const sekin = (p.d.ms || 0) > SEKIN_MS;
          const rang = xato ? 'var(--danger)' : sekin ? 'var(--warn)' : 'var(--ok)';
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={xato || sekin ? 3.5 : 2.5} fill={rang}
                      vectorEffect="non-scaling-stroke" />
              <title>
                {`${amalNomi(p.d.fn)}\n${p.d.ms >= 1000 ? (p.d.ms / 1000).toFixed(1) + ' s' : p.d.ms + ' ms'}\n${HOLAT_NOMI[p.d.h] ?? p.d.h}\n${p.d.t}`}
              </title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

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
    {
      kalit: 'fn',
      nom: 'Nima bo‘ldi',
      chiz: (y) => (
        <div className="min-w-0">
          <div className="text-text truncate">{amalNomi(y.fn)}</div>
          <div className="text-[11px] text-text-mute font-mono truncate">{y.fn}</div>
        </div>
      ),
    },
    {
      kalit: 'h',
      nom: 'Natija',
      en: '150px',
      chiz: (y) =>
        y.h === 'OK' ? <Nishon matn={HOLAT_NOMI.OK} tur="ok" />
        : y.h === 'XATO' ? <Nishon matn={HOLAT_NOMI.XATO} tur="danger" />
        : <Nishon matn={HOLAT_NOMI[y.h] ?? y.h} tur="warn" />,
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
      tavsif="Tizimda oxirgi 50 ta amal — nima bo'ldi, qancha vaqt oldi, xato bormi"
      yangilangan={soragan.dataUpdatedAt}
      onYangila={() => soragan.refetch()}
      yangilanmoqda={soragan.isFetching}
    >
      {/* ⚡ EKG — vaqt bo'yicha jarayon. Har chaqiruv bitta cho'qqi:
          balandligi = davomiylik, rangi = natija. Sekinlari darhol ko'zga tashlanadi. */}
      {yozuvlar.length > 1 && (
        <div className="karta p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] uppercase tracking-[0.04em] text-text-dim">Jarayon (oxirgidan eskisiga)</span>
            <div className="flex items-center gap-3 text-[11px] text-text-mute">
              <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-ok inline-block" /> tez</span>
              <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-warn inline-block" /> sekin</span>
              <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-danger inline-block" /> xato</span>
            </div>
          </div>
          <Ekg yozuvlar={yozuvlar} />
        </div>
      )}

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
