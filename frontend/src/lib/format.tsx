

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

// React komponent formatida (Nafosat qatlami uchun)
export function FmtN({ val, cl = '' }: { val?: number | null, cl?: string }) {
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
