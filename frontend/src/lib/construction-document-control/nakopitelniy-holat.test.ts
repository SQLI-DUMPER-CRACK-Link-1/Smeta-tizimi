import {describe,expect,it}from'vitest'; import {NAKOPITELNIY_CHEGARA_FOIZ,nakopitelniyHolat}from'.';
describe('nakopitelniyHolat (TPL-07 holat ustuni)',()=>{
 it('OVER_CERTIFICATION ogohlantirishi bo\'lsa har doim ortiqcha, chegara foizidan qat\'i nazar',()=>{
  expect(nakopitelniyHolat({warnings:['OVER_CERTIFICATION'],remainingQuantity:-5,approvedEntitlementQuantity:100})).toBe('ortiqcha');
  expect(nakopitelniyHolat({warnings:['OVER_CERTIFICATION'],remainingQuantity:50,approvedEntitlementQuantity:100})).toBe('ortiqcha');
 });
 it('qolgan miqdor entitlement\'ning chegara foizidan kam yoki teng bo\'lsa chegara',()=>{
  const chegaraQoldiq=100*NAKOPITELNIY_CHEGARA_FOIZ;
  expect(nakopitelniyHolat({warnings:[],remainingQuantity:chegaraQoldiq,approvedEntitlementQuantity:100})).toBe('chegara');
  expect(nakopitelniyHolat({warnings:[],remainingQuantity:1,approvedEntitlementQuantity:100})).toBe('chegara');
 });
 it('qolgan miqdor chegaradan ko\'p bo\'lsa normal',()=>{
  expect(nakopitelniyHolat({warnings:[],remainingQuantity:50,approvedEntitlementQuantity:100})).toBe('normal');
 });
 it('boshqa ogohlantirishlar (masalan PRICE_VARIANCE) holatga ta\'sir qilmaydi',()=>{
  expect(nakopitelniyHolat({warnings:['PRICE_VARIANCE','MISSING_PRICE_SOURCE'],remainingQuantity:50,approvedEntitlementQuantity:100})).toBe('normal');
 });
 it('entitlement 0 yoki manfiy bo\'lsa (nol bazaviy hajm) bo\'lishga urinmaydi, normal qaytaradi',()=>{
  expect(nakopitelniyHolat({warnings:[],remainingQuantity:0,approvedEntitlementQuantity:0})).toBe('normal');
 });
 it('bazaviy qiymat noma\'lum bo\'lsa holatni aniq emas deb ko\'rsatadi',()=>{
  expect(nakopitelniyHolat({warnings:['MISSING_BASELINE_PRICE'],remainingQuantity:null,approvedEntitlementQuantity:null})).toBe('aniq_emas');
 });
});
