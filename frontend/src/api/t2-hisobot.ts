export async function t2BossTahlilOl(kompaniya_id: number) {
  return fetch('/api/sb', {
    method: 'POST',
    body: JSON.stringify({ jadval: 'v_boss_data', filtr: 'kompaniya_id.eq.' + kompaniya_id })
  }).then(r => r.json());
}

export async function sbBossInitOl(kompaniya_id: number) {
  return fetch('/api/sb', {
    method: 'POST',
    body: JSON.stringify({ jadval: 'v_boss_init', filtr: 'kompaniya_id.eq.' + kompaniya_id })
  }).then(r => r.json());
}

export async function sbBossDataOl(kompaniya_id: number) {
  return fetch('/api/sb', {
    method: 'POST',
    body: JSON.stringify({ jadval: 'v_boss_data', filtr: 'kompaniya_id.eq.' + kompaniya_id })
  }).then(r => r.json());
}
