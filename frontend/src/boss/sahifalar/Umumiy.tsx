import { useBossData } from '../../api/hooks';
import { FmtN, formatPercent } from '../../lib/format';
import { Sahifa, KpiKarta, Jadval, type Ustun, Nishon, Holatlar } from '../../umumiy/ui/Sahifa';
import type { BossData } from '../../api/types';
import { useNavigate } from 'react-router-dom';

export default function Umumiy() {
  const { data, isLoading, error, refetch, isFetching, dataUpdatedAt } = useBossData();
  const navigate = useNavigate();
  
  const soragan = { isLoading, error, data, refetch };

  const ustunlar: Ustun<NonNullable<BossData>['objects'][0]>[] = [
    { kalit: 'nom', nom: 'Obyekt Nomi', chiz: (s) => <span className="font-medium text-white">{s.nom}</span> },
    { kalit: 'smeta', nom: 'Smeta', raqam: true, chiz: (s) => <FmtN val={s.smeta} /> },
    { kalit: 'fakt', nom: 'Fakt', raqam: true, chiz: (s) => <FmtN val={s.fakt} /> },
    { kalit: 'f2', nom: 'F2', raqam: true, chiz: (s) => <FmtN val={s.f2} /> },
    { kalit: 'qoldiq', nom: 'Qoldiq', raqam: true, chiz: (s) => <FmtN val={s.qoldiq} /> },
    { 
      kalit: 'progress', 
      nom: 'Bajarilish %', 
      chiz: (s) => {
        const pct = s.progress || 0;
        return (
          <div className="flex items-center gap-3 justify-end w-full max-w-[120px] ml-auto">
            <span className="tabular-nums font-medium w-10 text-right">{formatPercent(pct)}</span>
            <div className="flex-1 h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ${pct > 90 ? 'bg-ok' : 'bg-accent'}`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
          </div>
        );
      }
    },
    {
      kalit: 'holat',
      nom: 'Holat',
      chiz: (s) => {
        const pct = s.progress || 0;
        if (pct > 90) return <Nishon matn="OK" tur="ok" />;
        if (pct > 50) return <Nishon matn="WARN" tur="warn" />;
        return <Nishon matn="XAVF" tur="danger" />;
      }
    }
  ];

  return (
    <Sahifa
      sarlavha="Asosiy Ko'rsatkichlar (Dashboard)"
      tavsif="Smeta, fakt va F2 bajarilish holati bo'yicha umumiy xulosa."
      yangilangan={dataUpdatedAt || null}
      onYangila={() => refetch()}
      yangilanmoqda={isFetching}
    >
      <Holatlar
        soragan={soragan}
        bosh={{ matn: 'Ma\'lumot yo\'q' }}
      >
        {(d) => (
          <div className="space-y-6 max-w-7xl mx-auto">
            {/* KPI Kartalar */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <KpiKarta 
                nom="Smeta Jami" 
                qiymat={<FmtN val={d.jami.smeta} qisqa />} 
                ost="So'm" 
              />
              <KpiKarta 
                nom="Fakt (Bajarilgan)" 
                qiymat={<FmtN val={d.jami.fakt} qisqa />} 
                ost={formatPercent(d.jami.progress)} 
              />
              <KpiKarta 
                nom="F2 Olingan" 
                qiymat={<FmtN val={d.jami.f2} qisqa />} 
                ost={formatPercent(d.jami.f2pct)} 
              />
              <KpiKarta 
                nom="Qoldiq" 
                qiymat={<FmtN val={d.jami.qoldiq} qisqa />} 
                ost="Bajarilmagan hajm" 
              />
            </div>

            {/* Obyektlar Jadvali */}
            <Jadval
              ustunlar={ustunlar}
              satrlar={d.objects || []}
              kalit={(s, i) => `${s.nom}-${i}`}
              onSatrBos={(s) => navigate('/boss/holat/' + s.nom)}
            />
          </div>
        )}
      </Holatlar>
    </Sahifa>
  );
}
