# Tizim_02 — tashqi AI agent connectori

Bu connector Cloudflare Worker, boshqa backend yoki istalgan AI agentiga
Tizim_02 ma'lumotini bir xil, xavfsiz kontrakt orqali beradi. Agentga
Supabase kaliti, provider kaliti yoki foydalanuvchi cookie-si berilmaydi.

## Oqim

```
Agent → GET /api/agent/manifest → tool va schema
Agent → POST /api/agent/call (HMAC) → tenant-scoped, read-only dalil
Agent → o'z modeli / Cloudflare AI Gateway → foydalanuvchiga javob
```

Connector modelga bog'liq emas. Modelni tashqi agent tanlaydi; Tizim_02
faqat tekshirilgan tizim dalilini qaytaradi. Modeldan kelgan har qanday
yozuvchi amal keyinchalik alohida `draft → user approval → named RPC`
kontrakti orqali qo'shiladi.

## Ishga tushirish

Cloudflare Pages Production va Preview secrets ichiga `T2_AGENT_KEYS_JSON`
qo'ying. Bu qiymat hech qachon frontendga yoki gitga kirmaydi.

```json
{
  "agents": [
    {
      "id": "cloudflare-analyst",
      "secret": "kamida-24-belgilik-faqat-agent-biladigan-sir",
      "tools": ["t2.company_overview.v1", "t2.object_context.v1"],
      "kompaniya_ids": [7],
      "obyekt_ids": [101, 102]
    }
  ]
}
```

`kompaniya_ids` va `obyekt_ids` bo'sh bo'lsa agent hech qanday ma'lumot
ola olmaydi. Hozir obyekt doirasi ataylab aniq ID lar bilan belgilanadi:
bu `object_id` orqali boshqa tenant ma'lumotini o'qish xavfini yopadi.

Agentni o'chirish yoki kalitini aylantirish uchun shu entry-ni olib tashlang
yoki yangi `id` bilan yangi secret qo'shing va Pages’ni qayta deploy qiling.

## Discovery

```http
GET https://YOUR-DOMAIN/api/agent/manifest
```

Manifest maxfiy ma'lumot bermaydi. U mavjud tool nomi, input JSON schema va
imzolash formatini qaytaradi.

## Imzolangan tool chaqiruvi

```json
{
  "version": "t2-agent-tools/v1",
  "request_id": "cf-job-20260828-0001",
  "tool": "t2.object_context.v1",
  "arguments": { "obyekt_id": 101 }
}
```

Majburiy headerlar:

```
Content-Type: application/json
X-T2-Agent-Id: cloudflare-analyst
X-T2-Timestamp: 1787910000000
X-T2-Signature: hex(HMAC-SHA256(secret, payload))
```

`payload` qat'iy quyidagicha, har qator orasida `\n` bo'ladi:

```
t2-agent-tools/v1
cloudflare-analyst
1787910000000
POST
/api/agent/call
sha256_hex(aynan yuboriladigan JSON body)
```

Timestamp besh daqiqadan eski yoki kelajakdagi bo'lsa so'rov rad qilinadi.
Connector faqat o'qiydi, shuning uchun bir xil so'rovni qaytarish moliyaviy
amal yaratmaydi.

## Hozirgi tool lar

| Tool | Natija | Ruxsat |
|---|---|---|
| `t2.company_overview.v1` | Kompaniyadagi obyektlarning smeta, FAKT, F2 holati | `kompaniya_ids` |
| `t2.object_context.v1` | Bitta obyektning dalilli konteksti va ogohlantirishlari | `obyekt_ids` |

Narx topilmagan qatorlar `NULL`/`toliq:false` va ogohlantirish sifatida
qaytadi; agent ularni 0 ga aylantirmasligi kerak.

## Cloudflare Worker dan chaqirish

```ts
async function hex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map(x => x.toString(16).padStart(2, '0')).join('');
}

async function t2Tool(env: Env, tool: string, args: Record<string, unknown>) {
  const body = JSON.stringify({ version: 't2-agent-tools/v1', request_id: crypto.randomUUID(), tool, arguments: args });
  const timestamp = String(Date.now());
  const bodyHash = await hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body)));
  const payload = ['t2-agent-tools/v1', env.T2_AGENT_ID, timestamp, 'POST', '/api/agent/call', bodyHash].join('\n');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.T2_AGENT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)));
  const response = await fetch(env.T2_API_URL + '/api/agent/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-T2-Agent-Id': env.T2_AGENT_ID, 'X-T2-Timestamp': timestamp, 'X-T2-Signature': signature },
    body,
  });
  if (!response.ok) throw new Error('Tizim_02 tool rad etildi: ' + response.status);
  return response.json();
}
```

Tashqi agent o'z AI providerini Cloudflare AI Gateway orqali boshqarsa,
u yerda cost, rate-limit, fallback va observability markazlashadi. Tizim_02
connectori esa providerga bog'lanmaydi va dalil chegarasini ushlab turadi.
