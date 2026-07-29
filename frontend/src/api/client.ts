import { toast } from '../umumiy/ui/Toast';

export let xatolarSoni = 0;
export let degradatsiyaDarajasi = 0;
const MAX_XATO = 3;

export async function gas<T>(fn: string, ...args: unknown[]): Promise<T> {
  try {
    const r = await fetch('/api/gas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fn, args }),
    });
    
    if (!r.ok && r.status >= 500) {
      throw new Error(`Server xatosi: ${r.status}`);
    }

    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'GAS xato');
    
    if (degradatsiyaDarajasi > 0) {
      toast('Aloqa tiklandi. Tizim to\'liq ishlamoqda.', 'ok');
    }
    xatolarSoni = 0;
    degradatsiyaDarajasi = 0;
    
    return j.data as T;
  } catch (err: any) {
    xatolarSoni++;
    if (xatolarSoni === MAX_XATO) {
       degradatsiyaDarajasi = 2;
       toast('Tarmoq/server xatosi. Tizim qisman (faqat o\'qish) rejimiga o\'tdi.', 'danger');
    }
    throw err;
  }
}
