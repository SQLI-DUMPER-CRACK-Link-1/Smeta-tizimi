

// Oddiy string format (CountUp va hokazolar uchun)
export function formatSum(num: number | undefined | null): string {
  if (num == null) return '0';
  const val = Math.round(num); // yoki .toFixed(2) kerakmi? Hujjatda kasr so'ralgan
  return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatPercent(num: number | undefined | null): string {
  if (num == null) return '0%';
  return num.toFixed(1) + '%';
}

/**
 * Qisqa pul formati — KPI kartalar uchun (06 §3.3).
 * 467 348 726 061 → «467.3 млрд». Jadvalda ISHLATILMAYDI: u yerda
 * buxgalterga aniq raqam kerak.
 */
export function pulQisqa(n?: number | null): string {
  if (n == null || !isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e12) return (n / 1e12).toFixed(2) + ' трлн';
  if (a >= 1e9) return (n / 1e9).toFixed(1) + ' млрд';
  if (a >= 1e6) return (n / 1e6).toFixed(1) + ' млн';
  if (a >= 1e3) return Math.round(n / 1e3) + ' минг';
  return String(Math.round(n));
}

// React komponent formatida (Nafosat qatlami uchun)
export function FmtN({ val, cl = '', qisqa = false }: { val?: number | null, cl?: string, qisqa?: boolean }) {
  if (qisqa) return <span className={`tabular-nums ${cl}`}>{pulQisqa(val)}</span>;
  if (val == null) return <span className={cl}>0</span>;

  const isNegative = val < 0;
  const absVal = Math.abs(val);
  
  // Butun va kasr qismga ajratish
  const parts = absVal.toFixed(2).split('.');
  const whole = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const fraction = parts[1] === '00' ? '' : `.${parts[1]}`;

  return (
    <span className={`inline-flex items-baseline ${isNegative ? 'text-danger' : cl}`}>
      {isNegative && <span className="mr-[1px] opacity-70">(</span>}
      <span>{whole}</span>
      {fraction && <span className="text-[0.85em] opacity-50">{fraction}</span>}
      {isNegative && <span className="ml-[1px] opacity-70">)</span>}
    </span>
  );
}
