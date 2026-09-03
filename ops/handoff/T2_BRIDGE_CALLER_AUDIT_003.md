# T2-BRIDGE-CALLER-AUDIT-003

**Rol:** Chief Integrator / Backend (Claude)
**Sana:** 2026-09-03
**Metodologiya:** har topilma — TAXMIN emas, aniq fayl+qator sitatasi
bilan. Hech narsa "ehtimol shundaydir" deb yozilmagan.

---

## QISM A — `t2_akt_yarat` narx-fallback: barcha chaqiruvchilar

### A1. GAS (`Smeta tizimi/T2_F2Import.js:464-486`) — XAVFSIZ

```js
var qator = {qator_id: q.qator_id, hajm: q.hajm};
if(q.narx != null){
  qator.narx = q.narx;
}else{
  /* NARX O'ZIDAN TO'QILMAYDI. `t2_akt_yarat` odatda narx berilmasa
     SMETA narxini oladi ... `narx_yoq` shu fallbackni o'chiradi */
  qator.narx_yoq = true;
  narxsiz++;
}
yuk.push(qator);
...
var akt = _t2Rpc('t2_akt_yarat', { p_obyekt_id: ..., p_qatorlar: yuk, ... });
```

Bu — Supabase'ni TO'G'RIDAN-TO'G'RI chaqiradi (`_t2Rpc`, `sb-yoz.ts`
gateway'idan O'TMAYDI). **Xatti-harakat TO'G'RI**: narx yo'q bo'lsa
`narx_yoq=true` aniq yuboriladi, funksiya `null` qaytaradi (smeta
narxiga qaytmaydi). Bu — GAS tarafida (tashqi F2 hujjat import qilish,
Tizim_01) tuzatilgan yagona xavfsiz yo'l.

### A2. `frontend/src/test02/TestF2Import.tsx:1339-1389` — XAVFLI

```tsx
map.set(smetaId, {
  qator_id: smetaId,
  hajm: h,
  narx: n.narx > 0 ? n.narx : undefined   // <-- narx=0/yo'q bo'lsa undefined
});
...
const r = await sbT2AktYarat({ obyektId, tur, oy, qatorlar: rows, ... });
```

`n.narx > 0 ? n.narx : undefined` — F2 hujjatida narx 0 yoki
ko'rsatilmagan bo'lsa, `narx` maydoni JIM TASHLAB KETILADI.
**`narx_yoq` HECH QACHON yuborilmaydi** — bu fayl `narx_yoq`
degan maydonni umuman bilmaydi (grep: 0 ta o'xshash matn topildi).
Bu — Tizim_02'ning ASOSIY F2-import UI'si (`/admin/test/smeta` →
"Smeta va F2 Import", AdminShell menyusida ko'rinadi, reachable).

### A3. `frontend/src/test02/TestF2.tsx:100-113` — XAVFLI

```tsx
const qat = Object.entries(kiritilgan)
  .map(([id, v]) => ({ qator_id: Number(id), hajm: v }))   // narx UMUMAN yo'q
  .filter(...);
const r = await sbT2AktYarat({ obyektId, tur, oy, qatorlar: qat, ... });
```

`tur` — `'fakt'` HAM `'f2'` HAM bo'lishi mumkin, ikkalasi ham AYNAN
shu mapper orqali o'tadi. `narx` maydoni bu formada UMUMAN yo'q
(faqat hajm kiritish maydoni bor). F2 rejimida ham narx so'ralmaydi.

### A4. `frontend/functions/api/sb-yoz.ts:271-303` (gateway) — GAP

```ts
const qatorlar = so.qatorlar.map((q: any) => {
  const chiqish: Record<string, unknown> = { qator_id: Number(q.qator_id), hajm: q.hajm };
  if (q.narx != null && q.narx !== '') chiqish.narx = q.narx;
  if (q.izoh) chiqish.izoh = String(q.izoh).slice(0, 500);
  return chiqish;   // <-- narx_yoq, actual_narx, narx_manba, narx_izoh HECH QACHON o'tkazilmaydi
});
```

`t2_akt_yarat` DB funksiyasi `narx_yoq`/`actual_narx`/`narx_manba`/
`narx_manba_id`/`narx_izoh` maydonlarini QABUL QILADI (funksiya
tanasida `_kir` temp jadvalida bor), lekin bu gateway ularni
whitelist qilmagan — **hatto A2/A3 kelajakda `narx_yoq` yubora
boshlasa ham, bu gateway uni tashlab yuboradi.** Bu — ikkinchi,
mustaqil gap (birinchisi — frontend UI narx_yoq'ni bilmaydi; ikkinchisi
— hatto bilsa ham, gateway o'tkazmaydi).

### A5. DB funksiyasi (`public.t2_akt_yarat`) — fallback joyi

```sql
case when k.narx_yoq then null
     else coalesce(k.narx_kir, q.narx)   -- q.narx = SMETA narxi
end
```

### XULOSA — QISM A

| Chaqiruvchi | narx_yoq yuboradimi | Natija |
|---|---|---|
| GAS `T2_F2Import.js` (to'g'ridan-to'g'ri `_t2Rpc`) | ✅ HA, to'g'ri | Xavfsiz |
| `TestF2Import.tsx` (asosiy Tizim_02 F2 import) | ❌ YO'Q (bilmaydi) | **F2 narx yo'q holatda SMETA narxi jim yoziladi** |
| `TestF2.tsx` (qo'lda fakt/F2 kiritish) | ❌ YO'Q (bilmaydi) | **Har doim SMETA narxi jim yoziladi F2 uchun** |
| `sb-yoz.ts` gateway | ❌ STRIP qiladi | Hatto UI tuzatilsa ham, bu qatlam blokdaydi |

**F2_PRICE_FALLBACK: OPEN** — Bu taskda `t2_akt_yarat_v2` (fallbacksiz,
MISSING_CERTIFIED_PRICE bilan rad etadigan) yozildi, lekin frontend
(`TestF2Import.tsx`/`TestF2.tsx`) hali eski RPC'ni chaqiradi va
UI ularni v2'ga o'tkazish UX ishi talab qiladi (bu taskning
"backend/architecture" doirasidan tashqarida — keyingi bosqich).

---

## QISM B — Sheets↔Supabase bridge WRITER kodi (`Smeta tizimi/T2_Kozgu.js`)

### B1. Kozgu yozish + navbat yopish — `_t2KopriknavbatYop` (qator 690-702)

```js
function _t2KopriknavbatYop(obyektId){
  try{
    var c = _t2Cfg();
    UrlFetchApp.fetch(c.url + '/rest/v1/t2_ozgarish?obyekt_id=eq.' + obyektId +
                      '&kozguga_yozildi=is.false', {
      method: 'patch',
      headers: _t2Bosh(c, {'Prefer':'return=minimal'}),
      payload: JSON.stringify({kozguga_yozildi: true}),
      muteHttpExceptions: true
    });
  }catch(e){}
}
```

**Ikki real muammo, taxmin emas — kodning o'zida ko'rinadi:**

1. **`operation_id`/event korrelyatsiyasi YO'Q**: bu — BLANKET PATCH,
   obyekt uchun `kozguga_yozildi=false` bo'lgan BARCHA qatorlarni
   "endi yozildi" deb belgilaydi — qaysi ANIQ o'zgarishlar chindan ham
   varaqqa tushganini tekshirmasdan. Agar `apiT2VaraqYarat` (varaq
   chizish) va shu PATCH orasida (race condition) YANGI `t2_ozgarish`
   qatori paydo bo'lsa — u HECH QACHON varaqqa yozilmagan holda
   "yozildi" deb belgilanadi. **Bu — jim ma'lumot yo'qolishi (lost
   update), faqat "ortiqcha xususiyat yo'q" emas.**
2. **Xato JIMGINA yutiladi**: `catch(e){}` — bo'sh. `UrlFetchApp.fetch`
   xato qaytarsa (tarmoq, 5xx, auth) — HECH QANDAY log, retry yoki
   dead-letter yo'q. Navbat abadiy `kozguga_yozildi=false` holida
   qolaveradi, hech kim buni bilmaydi.

### B2. Echo suppression — vaqt oynasi, event-ID EMAS (qator 1049-1082)

```js
var T2_TIZIM_YOZDI = 'T2_TIZIM_YOZDI';
var T2_TIZIM_OYNA  = 60 * 1000;   // 60 soniya

function t2VaraqOnEdit(e){
  ...
  var belgi = p.getProperty(T2_TIZIM_YOZDI) || '';
  var bolak = belgi.split('|');
  if(bolak[0] === ssId && (Date.now() - Number(bolak[1] || 0)) < T2_TIZIM_OYNA) return;
  ...
}
```

Talab (Section 11): "origin/event ID bilan echo suppression". Haqiqiy
amalga oshirish — **60 soniyalik VAQT OYNASI**, event ID EMAS. Ikki
xavf: (a) agar tizim yozgandan 60s dan KO'P vaqt o'tib chizish
tugasa (katta obyekt — memory'da "Katta obyekt _NAT_ timeout" allaqachon
qayd etilgan muammo), keyingi haqiqiy onEdit tizim yozuvi deb
XATO tan olinmaydi va bekorga to'liq sinxron ishga tushadi; (b) agar
INSON tizim yozgandan keyin 60s ICHIDA tahrir qilsa, uning tahriri
"tizim echosi" deb XATO E'TIBORSIZ QOLDIRILADI — **haqiqiy inson
tahriri yo'qolishi mumkin**.

### B3. Fon-sinxron xato bo'lsa retry YO'Q (qator 1098-1130)

```js
function t2VaraqSinxFon(){
  ...
  try{
    ...
    var n = apiT2VaraqQaytar(ob[0].nom);
    Logger.log(...);
  }catch(e){ Logger.log('t2VaraqSinxFon: ' + e); }   // <-- shu yerda tugaydi, qayta urinish yo'q
}
```

Xato faqat `Logger.log`ga yoziladi (odam ko'rmasa, hech kim bilmaydi).
Keyingi urinish faqat YANGI `onEdit` bo'lgandagina ishga tushadi —
agar boshqa tahrir bo'lmasa, muvaffaqiyatsiz sinxron ABADIY osilib
qoladi.

### B4. `t2_kozgu` upsert — versiya/lock yo'q (qator 641-646)

```js
_t2Post('t2_kozgu', [{ obyekt_id: ob.id, fayl_id: ss.getId(), ... }], false, 'obyekt_id');
```

Optimistic lock/versiya tekshiruvisiz blind upsert (`obyekt_id`
bo'yicha conflict-resolve). Ikki parallel GAS ijrosi (masalan,
rejalashtirilgan trigger + qo'lda tugma) bir vaqtda yuguradigan bo'lsa,
oxirgisi g'olib chiqadi, yo'qotish sukut bilan.

### XULOSA — QISM B (gap jadvali, kod bilan tasdiqlangan)

| Talab | Kod dalili | Holat |
|---|---|---|
| `operation_id`/idempotency | Yo'q — blanket PATCH | **YO'Q, kod bilan tasdiqlangan** |
| `origin`/event_id echo suppression | 60s vaqt oynasi (`T2_TIZIM_OYNA`) | **Zaif surrogate, real emas** |
| `retry` | Yo'q — bitta urinish, xato = `Logger.log` va tugadi | **YO'Q** |
| `dead letter` | Yo'q | **YO'Q** |
| `base_version`/optimistic lock (`t2_kozgu`) | Yo'q — blind upsert | **YO'Q** |
| `sync cursor` | Yo'q — har safar "hammasi tayyor" deb yopiladi | **YO'Q** |
| `sheet_tab_id`/`sheet_row_mapping` | Faqat `fayl_id` (butun fayl), qator darajasida yo'q | **QISMAN** |

**BRIDGE: OPEN.** Bu taskda GAS yozuvchi kodi (`T2_Kozgu.js`)
O'ZGARTIRILMADI — Section 8'ning o'zi "yozuvchi kodni endi to'liq o'qi"
deb so'ragan, "tuzat" deb emas; xavfsiz tuzatish (operation_id qo'shish,
blanket-PATCH'ni ANIQ ID ro'yxatiga almashtirish, retry/dead-letter
qo'shish) — GAS Apps Script joylashtirish talab qiladi, bu esa
"GAS deploy YO'Q" production-freeze qoidasiga tegadi. Additive Supabase
tomon (`t2_lrv_sync_event`/`_conflict`, Bo'lim 7,
`T2_LRV_EXACT_F2_INTEGRATION_003.md`) SOURCE-ONLY yozildi — GAS kodini
undan foydalanishga o'tkazish KEYINGI, GAS-deploy talab qiladigan
bosqich.

---

## QISM C — GAS trigger chegarasi (operatsion, bug emas)

`_t2VaraqTirgakOrnat` (qator 1140-1158): Apps Script loyihasida 20
trigger chegarasi bor; 18 taga yetganda tizim YANGI avtomatik-sinx
trigger O'RNATMAYDI va buni ochiq aytadi ("Avtomatik sinxron
o'rnatilmadi — «Bazaga qaytarish» tugmasidan foydalaning"). Bu — bug
emas, balki **masshtablanish chegarasi**: ko'p-obyektli kompaniyalarda
(masalan, "32 gektar, 40 obyekt" — memory yozuvida) 18-obyektdan keyingi
obyektlar QO'LDA sinxronlanishi kerak bo'ladi. LRV Control implementatsiya
bosqichida hisobga olinishi kerak — bridge kontraktida (Bo'lim 8) allaqachon
"davomida GAS trigger emas, markazlashgan job/queue" g'oyasi bilan mos.
