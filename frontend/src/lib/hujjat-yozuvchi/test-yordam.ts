/**
 * Faqat testlar uchun: `HUJJAT_NAMUNA_DIR` berilsa, test yasagan hujjat
 * namunasini diskka yozadi — keyin `scripts/hujjat-lo-tekshir.mjs` uni
 * LibreOffice da qayta hisoblab, PDF ga chiqarib tekshiradi.
 * Ilova kodi bu faylni import qilmaydi.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function namunaSaqla(nom: string, bytes: Uint8Array): void {
  const dir = process.env.HUJJAT_NAMUNA_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, nom), bytes);
}
