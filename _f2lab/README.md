# F2 LAB — deploy'siz sinov stendi

**Maqsad:** F2 import / moslashtirish / LRV o'qish mantig'ini **haqiqiy ishlab chiqarish
kodi bilan**, lekin `clasp deploy` + qo'lda sinash halqasisiz tekshirish.
Bir o'zgarish → soniyalarda natija (avval: yozish → deploy → qo'lda sinash → xabar berish).

## Ishlatish

```bash
cd "C:/Users/PC/Documents/GAS/_f2lab"
node -e "const lab=require('./lab.js'); /* ... */"
```

### Nima qila oladi

| Funksiya | Nima qiladi |
|---|---|
| `lab.aktOqi(file, varaq?, cols?)` | **HAQIQIY** `apiF2FaylOqi` (30_Panel.js) ni SpreadsheetApp stub bilan ishga tushiradi — akt parse buglarini topadi |
| `lab.lrvTree(file, lokalka?)` | LRV_PLUS → `TREE_DATA` (apiHolatOl node shakli); `stat.rsTashlandi` = otasiz yo'qolgan resurslar |
| `lab.moslash(aktFile, lrvFile, opt)` | To'liq pipeline: **HAQIQIY** `f2AvtoMoslash` (Panel.html) DOM stub bilan → mappings/dopps/sabab/rzDiag |
| `lab.stat(tree)` | Daraxt statistikasi (rz/bl/rs/mat/ob + summalar) |
| `lab.xlsx.open(file)` | Tashqi paketsiz .xlsx o'quvchi (varaqlar, kataklar, merge) |

### Test ma'lumotlari (lokal, haqiqiy)

- `C:\Users\PC\Desktop\Для ф2\Amfiteatr-...\*_LRV_PLUS.xlsx` — 27 real LRV_PLUS
- `C:\Users\PC\Desktop\Для ф2\Amfiteatr-...\*.xls` — asl smetalar
- `C:\Users\PC\Desktop\Для ф2\Ой\<oy>\*.xlsx` — real F2 aktlar

### Muhim: OLTIN INVARIANT testi

Har qanday daraxt/parse o'zgarishidan keyin **ish qatorlari soni o'zgarmasligi** shart:

```
ESKI ish/resurs soni === YANGI ish/resurs soni  → xavfsiz
```

2026-07-18 da shu test 189 axlat-razdel filtrini tasdiqladi: 10483 = 10483 (yo'qotish yo'q).

## Nega bu papka "Smeta tizimi" ichida emas

`clasp push` faqat `Smeta tizimi/` ni yuboradi — bu papka Apps Script'ga **tushmaydi**,
shuning uchun stend kodi ishlab chiqarishga aralashmaydi.
