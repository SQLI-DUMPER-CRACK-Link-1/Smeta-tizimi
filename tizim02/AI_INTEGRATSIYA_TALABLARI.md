# TIZIM_02 — AI integratsiya talablar reestri

Bu hujjat Tizim_02 dagi AI ishlarini bitta kontraktga yig‘adi. Tizim_01
dagi GAS AI modullari (`00_AI_Gateway.js`, Titan/Jarvis, Telegram va
Vision) ishlab turgan ko‘prik sifatida saqlanadi; Tizim_02 esa Cloudflare
darvozasida alohida, tekshiriladigan AI qatlamini quradi.

## Qat’iy arxitektura

```text
User request
  -> authenticated Cloudflare AI gateway
  -> named domain operation / read tool
  -> Supabase verified evidence or uploaded document
  -> schema + domain validation
  -> preview / approval
  -> controlled RPC (only when explicitly approved)
```

- AI hech qachon generic SQL, generic DELETE yoki to‘g‘ridan-to‘g‘ri
  moliyaviy yozuv huquqiga ega emas.
- Narx, hajm yoki summa noaniq bo‘lsa `null`/rad etish qaytariladi; `0`
  bilan to‘ldirilmaydi.
- O‘qish natijasi dalilga bog‘lanadi: obyekt, kompaniya, manba va
  yangilanish holati ko‘rsatiladi.
- Yozish oqimi doim draft → foydalanuvchi tasdig‘i → nomlangan RPC;
  `operation_id`, tenant, rol va versiya tekshiruvi RPC qatlamida qoladi.

## Talablar holati

| Yo‘nalish | Holat | Keyingi mezon |
|---|---|---|
| Provider gateway: Gemini, Groq, OpenAI, Anthropic | Boshlangan | secret rotation, quota/cost telemetry, smoke-test |
| Retry, timeout va provider fallback | Tayyor vertical slice | provider bo‘yicha SLA va rate-limit o‘lchovi |
| Faktura/OCR JSON kontrakti | Boshlangan | real, ruxsatli EHF/PDF to‘plamida acceptance test |
| Fail-closed rekvizit va summa validatsiyasi | Tayyor | UI’da warning/preview holatini ko‘rsatish |
| Grounded data Q&A | Mavjud poydevor | `ai_kontekst` dalilini orchestratorga ulash |
| Material semantic alias | DB/UI poydevori mavjud | retrieval tool va confidence policy |
| Akt/Fakt/F2 draft agent | GAS’da ishlaydi | T2 controlled write bilan preview contract |
| Quruvchi AI / SHNQ-QMQ RAG | Rejada | hujjat manbasi, litsenziya va pgvector ingestion |
| Vision: chizma, foto, AOSR | Qisman | hujjat storage → extraction → evidence link |
| Telegram text/voice | GAS ko‘prigi mavjud | T2 webhook auth, queue va approval state machine |
| AI audit/cost log | Yetishmaydi | tenant-scoped request/source log migratsiyasi |

## 1-bosqichda qurilgan vertical slice

`frontend/functions/_shared/ai.ts` markaziy Cloudflare gateway bo‘lib,
provider endpointlarini bir xil kontraktga keltiradi. `ai-parse` endpointi:

1. sessiyani tekshiradi;
2. faqat ruxsat etilgan PDF/image MIME turlarini qabul qiladi;
3. 8 MB fayl va 30 000 belgilik matn chegarasini qo‘llaydi;
4. structured JSON so‘raydi;
5. rekvizitlar, sonlar va satr summalarini tekshiradi;
6. xato bo‘lsa `422` bilan moliyaviy yozuvni to‘xtatadi.

Faktura sahifasi endi shu `/api/ai-parse` Tizim_02 endpointidan foydalanadi.
GAS’dagi eski `apiFakturaAiParse` o‘chirilmaydi — parallel ishlayotgan
Tizim_01 buzilmasligi uchun fallback/legacy yo‘l sifatida qoladi.

## Keyingi vertikal slice’lar

1. `ai_kontekst` va `ai_umumiy` read RPC javoblarini authenticated
   orchestratorga ulash; modelga butun database yuborilmasin.
2. `ai_query_log` / `ai_source_log` uchun tenant-scoped migratsiya va
   controlled read endpoint (SQL/RPC qarori Claude domenida).
3. Akt/Fakt/F2 uchun bitta draft envelope: `evidence[]`, `warnings[]`,
   `confidence`, `requires_approval`, `operation_id`.
4. Hujjat RAG ingestion: original fayl → text extraction → chunk →
   embedding → source/page citation. SHNQ/QMQ manbasi tasdiqlanmasdan
   normativ javob ishlab chiqarilmaydi.
5. Telegram webhook’ni auth + queue + ikki bosqichli tasdiqlash bilan
   Tizim_02 controlled action’lariga bog‘lash.

## Production checklist

- [ ] Cloudflare’da provider kalitlari secret sifatida saqlangan.
- [ ] Har provider uchun timeout, retry, quota va xarajat metrikasi bor.
- [ ] Promptga butun baza yoki maxfiy kalit kiritilmaydi.
- [ ] OCR natijasi foydalanuvchi preview’siz yozilmaydi.
- [ ] Real hujjatlarda noaniq qatorlar, dublikatlar va arifmetik drift
      alohida acceptance test bilan tekshirilgan.
- [ ] RLS/RBAC, tenant membership va role policy barcha AI read/write
      oqimlarida server tomonda tekshiriladi.
