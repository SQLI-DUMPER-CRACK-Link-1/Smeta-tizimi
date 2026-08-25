export async function sbSkladNomTaklifOl(nom: string, limit = 5): Promise<{ok: boolean, qatorlar?: any[], error?: string}> {
  if (!nom || nom.length < 2) return { ok: true, qatorlar: [] };
  const filtr = 'nomi.ilike.%' + nom + '%';
  const res = await fetch('/api/sb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jadval: 'v_sklad_nomlar', filtr, limit })
  });
  return await res.json();
}
