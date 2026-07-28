export function formatSum(num: number | undefined | null): string {
  if (num == null) return '0';
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatPercent(num: number | undefined | null): string {
  if (num == null) return '0%';
  return num.toFixed(1) + '%';
}
