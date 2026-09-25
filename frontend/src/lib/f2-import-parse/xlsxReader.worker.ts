/**
 * Web Worker: Excel faylni asosiy oqimdan tashqarida o'qiydi (P5, SMETA_ANATOMIYA_V1 §10).
 * 27 000 qatorli smetada unzip + XML tahlili sahifani qotirmasin.
 * Natija — oddiy ma'lumot (varaqlar), `sheet()` funksiyasi asosiy oqimda tiklanadi.
 */
import { readXlsx } from './xlsxReader';

type Kirish = { id: number; bytes: ArrayBuffer };

self.onmessage = async (e: MessageEvent<Kirish>) => {
  const { id, bytes } = e.data;
  try {
    const wb = await readXlsx(bytes);
    (self as unknown as Worker).postMessage({ id, ok: true, sheets: wb.sheets });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
