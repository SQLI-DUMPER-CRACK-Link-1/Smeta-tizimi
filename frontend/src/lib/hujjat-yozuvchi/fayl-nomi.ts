/**
 * hujjat-yozuvchi/fayl-nomi.ts — ma'noli fayl nomi (H8):
 * `<Obyekt>_<Hujjat>_<davr>.xlsx`.
 */

/** Fayl tizimida taqiqlangan belgilar va ortiqcha bo'shliqlar olib tashlanadi. */
export function faylQismi(value: string | null | undefined, uzunlik = 80): string {
  return [...String(value ?? '')].map((ch) => (ch.charCodeAt(0) < 32 ? '_' : ch)).join('').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().slice(0, uzunlik).trim();
}

export type HujjatFaylNomiKirish = {
  obyekt?: string | null;
  /** Hujjat nomi rus tilida, masalan "ОСТАТОК_РАБОТ", "АКТ_Ф2". */
  hujjat: string;
  /** Davr/sana: "2026-09", "2026-09-25". Bo'sh bo'lsa qo'shilmaydi. */
  davr?: string | null;
  kengaytma?: 'xlsx' | 'xlsm' | 'pdf' | 'zip';
};

/** `<Obyekt>_<Hujjat>_<davr>.xlsx`. Obyekt bo'sh bo'lsa — faqat hujjat nomi. */
export function hujjatFaylNomi(k: HujjatFaylNomiKirish): string {
  const qismlar = [faylQismi(k.obyekt), faylQismi(k.hujjat, 60), faylQismi(k.davr, 30)].filter(Boolean);
  return `${qismlar.join('_') || 'ДОКУМЕНТ'}.${k.kengaytma ?? 'xlsx'}`;
}

/** Bugungi sana `YYYY-MM-DD` (mahalliy vaqt). */
export function bugunSana(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
