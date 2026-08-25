  if (!nom || nom.length < 2) return { ok: true, qatorlar: [] };
  // A simple ilike filter over the view
  const filtr = 'nomi.ilike.%' + nom + '%';
  const res = await fetch('/api/sb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jadval: 'v_sklad_nomlar', filtr, limit })
  });
  return await res.json();
}

// --- FAKTURA (EHF / Didox) ---

export interface T2Faktura {
  id?: number;
  kompaniya_id: number;
  raqam: string;
  sana: string;
  kontragent: string;
  inn: string;
  summa: number;
  pdf_url?: string;
  holat: 'yangi' | 'tasdiqlangan' | 'bekor_qilingan';
  items?: any[];
}

export async function sbFakturalarOl(kompaniya_id: number): Promise<{ok: boolean, qatorlar?: T2Faktura[], error?: string}> {
  const res = await fetch('/api/sb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jadval: 't2_faktura', filtr: 'kompaniya_id.eq.' + kompaniya_id })
  });
  return await res.json();
}

export function sbFakturaYoz(item: T2Faktura) {
  return yozAmali({
    amal: 'faktura_yoz',
    ...item
  });
}

export async function sbFakturaFaylYoz(file: File, faktura_id: number): Promise<{ok: boolean, url?: string, error?: string}> {
  // Supabase Storage orqali R2 ga yuklash (shablon)
  const ext = file.name.split('.').pop();
  const path = 'fakturalar/' + faktura_id + '_' + Date.now() + '.' + ext;
  
  // Haqiqiy loyihada supabase.storage.from('hujjatlar').upload(path, file)
  // Mock qilib turamiz, chunki @supabase/supabase-js o'rnatilmagan yoki import qilinmagan bo'lishi mumkin
  return { ok: true, url: 'https://r2.milliy-os.uz/' + path };
}

// --- SPRAVOCHNIK (Ish turlari va Shaxsiy smetalar) ---

export interface T2IshTuri {
  id?: number;
  kompaniya_id: number;
  kod: string;
  nomi: string;
  birligi: string;
  norma: number;
  narx: number;
  kategoriya: string;
}

export async function sbIshTurlariOl(kompaniya_id: number): Promise<{ok: boolean, qatorlar?: T2IshTuri[], error?: string}> {
  const res = await fetch('/api/sb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jadval: 't2_ish_turi', filtr: 'kompaniya_id.eq.' + kompaniya_id })
  });
  return await res.json();
}

export function sbIshTuriYoz(item: T2IshTuri) {
  return yozAmali({
    amal: 'ish_turi_yoz',
    ...item
  });
}

export async function sbShaxsiySmetalarOl(kompaniya_id: number) {
  // Shaxsiy smetalar t2_ish_turi ning o'ziga xos to'plami yoki alohida jadval
  const res = await fetch('/api/sb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jadval: 't2_shaxsiy_smeta', filtr: 'kompaniya_id.eq.' + kompaniya_id })
  });
  return await res.json();
}

export function sbShaxsiySmetaYarat(kompaniya_id: number, nom: string, qatorlar: any[]) {
  return yozAmali({
    amal: 'shaxsiy_smeta_yarat',
    kompaniya_id,
    nom,
    qatorlar
  });
}
