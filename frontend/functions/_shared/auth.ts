export type Rol = 'superadmin' | 'admin' | 'boss' | 'rahbar' | 'bugalter' | 'pto' | 'prorab';

export type Sess = { 
  rol: Rol; 
  email?: string; 
  exp: number; 
  jti: string;
};

async function importKey(secret: string) {
  return await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function hmacHex(body: string, secret: string) {
  const key = await importKey(secret);
  const data = new TextEncoder().encode(body);
  const signature = await crypto.subtle.sign('HMAC', key, data);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * ⚠️ XAVFSIZLIK: ZAXIRA KALIT OLIB TASHLANDI.
 *
 * Avval kalit yo'q bo'lsa kodda yozilgan `Boshlangich_Maxfiy_Kalit_123`
 * ishlatilardi. Repozitoriy OCHIQ — ya'ni bu kalit hammaga ma'lum va
 * uni bilgan har kim sessiya cookie'sini o'zi imzolab, admin bo'lib
 * kirishi mumkin edi.
 *
 * «Kalit yo'q → jim ishlayveradi» eng yomon variant: teshik ochiq
 * turadi va hech kim sezmaydi. Endi kalit bo'lmasa tizim ISHLAMAYDI
 * va sababini aniq aytadi.
 *
 * Kalitni Cloudflare Pages → Settings → Environment variables da
 * `SESSIYA_KALIT` nomi bilan o'rnatish kerak.
 */
export const KALIT_XABAR =
  'Server sozlanmagan: SESSIYA_KALIT yo\'q (yoki 16 belgidan qisqa). ' +
  'Cloudflare Pages → Settings → Environment variables → SESSIYA_KALIT ' +
  'ga 32+ belgili tasodifiy satr qo\'ying va qayta deploy qiling. ' +
  'Zaxira kalit ataylab olib tashlangan: repozitoriy ochiq va u kalit ' +
  'bilan har kim sessiya cookie\'sini soxtalashtira olardi.';

/** Kalit yaroqlimi — TASHLAMAYDI, holat qaytaradi. */
export function kalitBormi(secret: string | undefined | null): boolean {
  return String(secret || '').trim().length >= 16;
}

/**
 * Kalit nega qabul qilinmayotganini AYTADI — kalitning o'zini oshkor
 * qilmasdan.
 *
 * Kerak bo'ldi, chunki «o'rnatdim, baribir ishlamadi» holatida taxmin
 * qilishdan boshqa yo'l qolmadi. Sabablari bir nechta bo'lishi mumkin:
 *   • Cloudflare Pages'da Production va Preview uchun o'zgaruvchilar
 *     ALOHIDA — biriga qo'yilib, ikkinchisiga qo'yilmagan bo'lishi mumkin
 *   • o'zgaruvchi qo'yilgach QAYTA DEPLOY qilinmagan
 *   • nomida bo'shliq/xato yoki qiymati qisqa
 * Bularni ajratish uchun o'lchov kerak, taxmin emas.
 */
export function kalitTashxis(env: Record<string, unknown>): {
  bor: boolean; uzunlik: number; oq_joy: boolean; mavjud_nomlar: string[];
} {
  const xom = env?.SESSIYA_KALIT;
  const s = typeof xom === 'string' ? xom : '';
  return {
    bor: kalitBormi(s),
    uzunlik: s.length,                       // qiymat EMAS, faqat uzunlik
    oq_joy: s !== s.trim(),
    /* Qaysi o'zgaruvchilar umuman ko'rinayotgani — nom xatosini ochadi */
    mavjud_nomlar: Object.keys(env || {}).filter((k) => !/KEY|KALIT|SECRET|TOKEN/i.test(k))
      .concat(Object.keys(env || {}).filter((k) => /KEY|KALIT|SECRET|TOKEN/i.test(k))
        .map((k) => k + '(qiymat yashirin)')),
  };
}

/**
 * ⚠️ Bu TASHLAYDI. Chaqiruvchi avval `kalitBormi()` bilan tekshirib,
 * foydalanuvchiga TUSHUNARLI xabar qaytarishi kerak — aks holda
 * brauzerda quruq «Server xatosi: 500» chiqadi va sababi bilinmaydi.
 * Aynan shunday bo'ldi: kalit o'rnatilmagan edi va hech kim kira olmadi,
 * lekin ekranda nima qilish kerakligi yozilmadi.
 */
export function kalitTekshir(secret: string | undefined | null): string {
  const k = String(secret || '').trim();
  if (k.length >= 16) return k;
  throw new Error(KALIT_XABAR);
}

export async function imzola(s: Omit<Sess, 'exp' | 'jti'>, secret: string): Promise<string> {
  secret = kalitTekshir(secret);
  const payload: Sess = {
    ...s,
    exp: Date.now() + 12 * 3600_000, // 12 soat
    jti: crypto.randomUUID(),
  };
  const body = btoa(JSON.stringify(payload)).replace(/=+$/, '');
  const sig = await hmacHex(body, secret);
  return `${body}.${sig}`;
}

export async function tekshir(cookie: string | null, secret: string): Promise<Sess | null> {
  /* Kalit yo'q bo'lsa HECH KIM kira olmaydi — zaxira kalit bilan
     «ishlab turgandek» ko'rinishdan ko'ra to'xtagani xavfsizroq. */
  secret = kalitTekshir(secret);
  const t = cookie?.match(/sess=([^;]+)/)?.[1];
  if (!t) return null;
  const parts = t.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  
  if (!body || !sig) return null;

  const kutilgan = await hmacHex(body, secret);
  if (!teng(sig, kutilgan)) return null;

  let s: Sess;
  try { 
    s = JSON.parse(atob(body)); 
  } catch { 
    return null; 
  }
  
  if (!s.exp || Date.now() > s.exp) return null; // MUDDAT tekshiruvi
  return s;
}

/** Vaqt-barqaror solishtirish — sirni uzunlik bo'yicha topib bo'lmasin */
function teng(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
