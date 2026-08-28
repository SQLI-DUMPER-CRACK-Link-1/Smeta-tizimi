import { sbOqi } from './supabase';

/* ⚡ 2026-08-28 (foydalanuvchi ko'rsatmasi): "20 dan ortiq obyektda
 * bitta markaziy sklad bor va har obyektda kichik qabul qiluvchi
 * sklad bor, lekin umumiy obyektlardagi ostatkalar ko'rsatila olishi
 * kerak, snabjeniya ham shunga qarab ishlay oladi."
 *
 * `t2_sklad_mustaqil`/`t2_sklad_bog` (M:N, bitta sklad ko'p obyektga)
 * allaqachon bor edi, lekin ularni HAQIQIY qoldiq bilan (t2_sklad_qoldiq
 * — har obyektning o'z fizik ombori) BOG'LAYDIGAN joy yo'q edi. Bu
 * modul aynan shu ko'prik: markaziy sklad TANLANSA, unga bog'langan
 * BARCHA obyektning material bo'yicha qoldig'i BIRLASHTIRILGAN holda
 * (ham jami, ham obyekt-obyekt taqsimot) ko'rinadi. */
export type SkladKonsolidatsiya = {
  sklad_id: number; kompaniya_id: number; sklad_nomi: string;
  material_nomi: string; birligi: string; jami_qoldiq: number;
  obyektlar_boyicha: { obyekt_id: number; obyekt_nom: string; qoldiq: number }[];
};

export function sbSkladKonsolidatsiyaOl(skladId: number) {
  return sbOqi<SkladKonsolidatsiya>({
    jadval: 't2_sklad_konsolidatsiya',
    filtr: 'sklad_id=eq.' + skladId,
    tartib: 'material_nomi.asc',
    limit: 1000,
  });
}
