# T2 PTO — ko'p varaqli LRV/RES importi

## Maqsad

Bitta XLSX ichidagi bir nechta LRV uchastkasini va ichki/tashqi RES
varaqlarini bitta, lekin aralashmaydigan import oqimida ishlatish.

## Kiritilgan qoida

- Asosiy smeta faylida bir nechta `LRV` varag'i tanlanishi mumkin.
- Bir nechta LRV tanlansa, har Excel varag'i o'zining haqiqiy nomi bilan
  yuqori `RZ` ildiz bo'ladi. Shunday qilib `1-uchastka` va `2-uchastka`
  qatorlari bir import sessiyasida atomik yoziladi, biroq ierarxiyada
  aralashmaydi.
- Har varaqdagi `f2_0`, `f2_1` kabi lokal identifikatorlar varaq bo'yicha
  namespace qilinadi; ota-bola aloqalari va katta bo'lakli import buzilmaydi.
- Asosiy fayl ichidagi RES varaqlari ham, alohida RES faylidagi bir nechta
  tanlangan varaqlar ham bitta narx indeksiga yig'iladi.
- Import RES indeksini aynan import vaqtida qayta quradi. Operatorning
  oldindan `Narxlarni tekshirib ulash` tugmasini bosgani endi shart emas.
- Narxning konservativ qonuni o'zgarmadi: mavjud LRV narxi ustidan yozilmaydi,
  kod yolg'iz moslashtirish kaliti emas, nom+birlik asosiy kalit bo'lib qoladi.

## Chegara

Bu o'zgarish bir **fayldagi alohida Excel varaqlari** uchun. Bitta varaqning
ichida LRV va RES satrlari aniq ajratgichsiz aralash kelgan holat avtomatik
parchalanmaydi: bunday taxmin narx yoki hajmni boshqa qatorga bog'lash xavfini
beradi. Unga manba shaklidagi aniq bo'lim chegarasi asosida alohida parser
qoidasi kerak.

## O'zgargan fayllar

- `frontend/src/admin/sahifalar/SmetaYuklaNative.tsx`
- `frontend/src/admin/sahifalar/SmetaYuklaNative.test.ts`

## Tekshiruv

- Fokuslangan import testi: 46/46 o'tdi.
- To'liq Vitest: 67 fayl, 471 test o'tdi.
- TypeScript va production build o'tdi.
- `npm run lint` xatosiz; mavjud umumiy ogohlantirishlar saqlangan.
- `npm run tekshir`, governance va `git diff --check` o'tdi.

## Ishga tushirishdan oldingi operator smoke

1. Bo'sh obyekt tanlang.
2. 4 uchastkali XLSX yuklang va barcha kerakli LRV varaqlarini belgilang.
3. Shu fayldagi RES varaqlarini belgilang; alohida RES fayli kerak emas.
4. Bir nechta tashqi RES varag'i bo'lsa, barchasini checkbox bilan belgilang.
5. Import bosilgach qadamlar panelida RES narxlari ulanganini, keyin daraxtda
   uchastka ildizlari alohida ekanini tekshiring.
