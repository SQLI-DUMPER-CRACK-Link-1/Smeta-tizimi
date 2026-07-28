export async function gas<T>(fn: string, ...args: unknown[]): Promise<T> {
  const r = await fetch('/api/gas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fn, args }),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'GAS xato');
  return j.data as T;
}
