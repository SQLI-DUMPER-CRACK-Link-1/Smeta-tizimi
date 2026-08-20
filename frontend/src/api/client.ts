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
        /* ⚠️ `xato` ham qaralishi SHART. Server endpointlari o'zbekcha
           `xato` maydonini qaytaradi; faqat `error` qaralgani uchun
           haqiqiy sabab tushib qolib, ekranda quruq «Server xatosi: 503»
           ko'rinardi — aynan shu sozlama muammosini topishni qiyinlashtirdi. */
        j?.xato ||
        j?.error ||
        j?.message ||
        (typeof raw === 'string' && raw.trim() ? raw.trim().slice(0, 300) : '') ||
        `Server xatosi: ${r.status}`;
      throw new Error(msg);
    }

    if (!j) {
      /* ⚡⚡⚡ 2026-08-15: avval shunchaki «GAS javobi JSON emas» deb tashlanardi
       * va HAQIQIY sabab YASHIRIN qolardi (foydalanuvchi: «asosiy debuglar
       * xato topish o'zimga qolib ketayapdi»). Javob tanasi odatda aynan
       * sababni aytadi: GAS timeout HTML sahifasi, Cloudflare 524, quota
       * xabari va h.k. Endi o'sha matn ko'rsatiladi. */
      const boshi = (raw || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      const ipucha =
        /timed? ?out|exceeded maximum execution/i.test(raw) ? 'GAS vaqt chegarasiga urildi (6 daqiqa)' :
        /524|gateway|cloudflare/i.test(raw)                 ? 'Cloudflare 100 soniya chegarasi' :
        /sign in|accounts\.google/i.test(raw)               ? 'GAS sessiyasi tugagan — qayta kiring' :
        '';
      throw new Error(
        (ipucha ? ipucha + ' — ' : 'GAS JSON qaytarmadi: ') +
        (boshi ? boshi.slice(0, 220) : `bo'sh javob (status ${r.status})`)
      );
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
