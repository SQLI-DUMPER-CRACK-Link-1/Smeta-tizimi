async function importKey(secret: string) {
  return await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function imzola(rol: string, secret: string): Promise<string> {
  const key = await importKey(secret);
  const data = new TextEncoder().encode(rol);
  const signature = await crypto.subtle.sign('HMAC', key, data);
  const sigHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `${rol}.${sigHex}`;
}

export async function tekshir(cookie: string | null, secret: string): Promise<{ rol: 'admin' | 'boss' } | null> {
  if (!cookie) return null;
  const match = cookie.match(/sess=([^;]+)/);
  if (!match) return null;
  
  const token = match[1];
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  
  const [rol, sigHex] = parts;
  if (rol !== 'admin' && rol !== 'boss') return null;

  const key = await importKey(secret);
  const data = new TextEncoder().encode(rol);
  
  const signature = await crypto.subtle.sign('HMAC', key, data);
  const expectedSigHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  if (sigHex !== expectedSigHex) return null;
  return { rol: rol as 'admin' | 'boss' };
}
