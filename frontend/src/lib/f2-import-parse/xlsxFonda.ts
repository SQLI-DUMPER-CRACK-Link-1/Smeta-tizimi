/**
 * `readXlsxFonda` — Excelni Web Worker da o'qiydi; Worker bo'lmasa (test/jsdom,
 * eski brauzer) yoki Worker yiqilsa — asosiy oqimdagi `readXlsx` ga qaytadi
 * (natija bir xil, faqat tezlik farq qiladi). Barcha yuklash sahifalari shu
 * funksiyadan foydalanadi.
 */
import { readXlsx, type XlsxSheet, type XlsxWorkbook } from './xlsxReader';

let keyingiId = 1;

function kitob(sheets: XlsxSheet[]): XlsxWorkbook {
  return { sheets, sheet: (name: string) => sheets.find((s) => s.name === name) ?? null };
}

export async function readXlsxFonda(bytes: ArrayBuffer | Uint8Array): Promise<XlsxWorkbook> {
  if (typeof Worker === 'undefined' || typeof URL === 'undefined') return readXlsx(bytes);
  let worker: Worker;
  try {
    worker = new Worker(new URL('./xlsxReader.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return readXlsx(bytes);
  }
  // Nusxa uzatiladi (transfer): chaqiruvchining buferi o'zgarmay qoladi.
  const nusxa = bytes instanceof Uint8Array ? bytes.slice().buffer : bytes.slice(0);
  const id = keyingiId++;
  try {
    return await new Promise<XlsxWorkbook>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; sheets?: XlsxSheet[]; error?: string }>) => {
        if (e.data.id !== id) return;
        if (e.data.ok && e.data.sheets) resolve(kitob(e.data.sheets));
        else reject(new Error(e.data.error || 'XLSX_WORKER_XATO'));
      };
      worker.onerror = (e) => { e.preventDefault?.(); reject(new Error('XLSX_WORKER_YIQILDI')); };
      worker.postMessage({ id, bytes: nusxa }, [nusxa as ArrayBuffer]);
    });
  } catch (e) {
    // Faylning o'zi buzuq bo'lsa asosiy oqim ham xuddi shu xatoni beradi.
    if (e instanceof Error && e.message !== 'XLSX_WORKER_YIQILDI') throw e;
    return readXlsx(bytes);
  } finally {
    worker.terminate();
  }
}
