import { kalit, son, toliqUstunlar, xom } from './matn';
import { sarlavhaBlokiniTop } from './ustun';
import type { KirishVaraq, Manzil } from './turlar';

/**
 * Svod (ABC4 `*_CB_DET2_*` "Сводный расчет по статьям затрат") — obyekt →
 * lokal smetalar ro'yxati. STR LRV da obyekt darajasi yo'q; u faqat shu yerda.
 *
 *   ИСКУССТВЕННАЯ ОЗЕРА                                  ← obyekt (faqat A)
 *   01-01 | 13.08.2026 | КОНСТРУКТИВНАЯ ЧАСТЬ-ОЗЕРА | 27663.16   ← lokal + чел-ч
 *   ИТОГО | 34126.28
 */
export interface SvodSmeta {
  obyekt: string;
  obyektManzil: Manzil;
  raqam: string;          // "01-01", asl matn
  nom: string;            // asl matn
  chelSoat: number | null;
  manzil: Manzil;
}

export function svodniOqi(fayl: string, varaq: KirishVaraq): SvodSmeta[] {
  const rows = varaq.rows;
  const blok = sarlavhaBlokiniTop(rows);
  if (!blok) return [];
  const s = blok.sarlavhalar;
  const nomU = s.findIndex((h) => /НАИМЕНОВАНИЕ ОБЪЕКТОВ И СМЕТ/.test(h));
  const trudU = s.findIndex((h) => /ЗАТРАТЫ ТРУДА/.test(h));
  if (nomU < 0) return [];
  const raqamU = 0;
  const chiq: SvodSmeta[] = [];
  let obyekt: { xom: string; manzil: Manzil } | null = null;
  for (let r = blok.malumotBoshi; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const toliq = toliqUstunlar(row);
    if (!toliq.length) continue;
    const birinchi = xom(row[toliq[0]]);
    if (/^(ИТОГО|ВСЕГО)/.test(kalit(birinchi)) || /^(ИТОГО|ВСЕГО)/.test(kalit(row[nomU]))) continue;
    const nom = xom(row[nomU]);
    if (toliq.length === 1 && toliq[0] < nomU) {
      obyekt = { xom: birinchi, manzil: { fayl, varaq: varaq.nom, qator: r + 1, ustun: toliq[0] + 1 } };
      continue;
    }
    if (!obyekt || !nom) continue;
    chiq.push({
      obyekt: obyekt.xom, obyektManzil: obyekt.manzil,
      raqam: xom(row[raqamU]), nom,
      chelSoat: trudU >= 0 ? son(row[trudU]) : null,
      manzil: { fayl, varaq: varaq.nom, qator: r + 1, ustun: nomU + 1 },
    });
  }
  return chiq;
}
