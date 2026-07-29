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

export async function imzola(s: Omit<Sess, 'exp' | 'jti'>, secret: string): Promise<string> {
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
