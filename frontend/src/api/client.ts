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

    let j: any = null;
    let raw = '';

    if (typeof (r as any).text === 'function') {
      raw = await r.text();
      if (raw) {
        try {
          j = JSON.parse(raw);
        } catch {
          j = null;
        }
      }
    } else if (typeof (r as any).json === 'function') {
      try {
        j = await r.json();
      } catch {
        j = null;
      }
    }

    if (!r.ok) {
      const msg =
        j?.error ||
        j?.message ||
        (typeof raw === 'string' && raw.trim() ? raw.trim().slice(0, 300) : '') ||
        `Server xatosi: ${r.status}`;
      throw new Error(msg);
    }

    if (!j) {
      throw new Error('GAS javobi JSON emas');
    }
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
