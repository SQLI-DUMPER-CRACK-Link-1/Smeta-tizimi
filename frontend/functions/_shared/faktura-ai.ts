/** Faktura/OCR uchun domain schema va fail-closed validator. */

export type FakturaAiItem = {
  fakturaRaqami: string;
  postavshik: string;
  kelganSana: string;
  shartnomaRaqami: string;
  shartnomaSanasi?: string;
  postavshikInn?: string;
  postavshikManzil?: string;
  sotibOluvchiInn?: string;
  sotibOluvchiManzil?: string;
  nomi: string;
  birligi: string;
  miqdori: number;
  narxi: number;
  jamiNdsSiz: number;
  ndsSummasi: number;
  jamiNdsBilan: number;
  aksizSummasi?: number;
  ndsStavkasi?: number;
};

export type FakturaAiResult = {
  ok: boolean;
  items?: FakturaAiItem[];
  supplier?: string;
  warnings?: string[];
  xabar?: string;
};

/* OpenAI Structured Outputs uchun ham, Gemini JSON mode uchun ham bitta
   canonical schema. `null` — noma'lum qiymat; 0 o'rnini bosmaydi. */
export const FAKTURA_AI_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    supplier: { type: ['string', 'null'] },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          fakturaRaqami: { type: ['string', 'null'] },
          postavshik: { type: ['string', 'null'] },
          kelganSana: { type: ['string', 'null'] },
          shartnomaRaqami: { type: ['string', 'null'] },
          shartnomaSanasi: { type: ['string', 'null'] },
          postavshikInn: { type: ['string', 'null'] },
          postavshikManzil: { type: ['string', 'null'] },
          sotibOluvchiInn: { type: ['string', 'null'] },
          sotibOluvchiManzil: { type: ['string', 'null'] },
          nomi: { type: ['string', 'null'] },
          birligi: { type: ['string', 'null'] },
          miqdori: { type: ['number', 'null'] },
          narxi: { type: ['number', 'null'] },
          jamiNdsSiz: { type: ['number', 'null'] },
          ndsSummasi: { type: ['number', 'null'] },
          jamiNdsBilan: { type: ['number', 'null'] },
          aksizSummasi: { type: ['number', 'null'] },
          ndsStavkasi: { type: ['number', 'null'] },
        },
        required: [
          'fakturaRaqami', 'postavshik', 'kelganSana', 'shartnomaRaqami',
          'shartnomaSanasi', 'postavshikInn', 'postavshikManzil',
          'sotibOluvchiInn', 'sotibOluvchiManzil', 'nomi', 'birligi',
          'miqdori', 'narxi', 'jamiNdsSiz', 'ndsSummasi', 'jamiNdsBilan',
          'aksizSummasi', 'ndsStavkasi',
        ],
      },
    },
  },
  required: ['supplier', 'items'],
};

type Obj = Record<string, unknown>;

function objectOf(value: unknown): Obj {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Obj : {};
}

function first(value: Obj, ...keys: string[]): unknown {
  for (const key of keys) if (value[key] !== undefined) return value[key];
  return null;
}

function stringValue(value: unknown): string | null {
  if (value == null) return null;
  const result = String(value).trim();
  return result ? result.slice(0, 500) : null;
}

function numberValue(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let valueText = String(value).replace(/\u00a0/g, ' ').replace(/\s/g, '').trim();
  if (!valueText) return null;
  const comma = valueText.lastIndexOf(',');
  const dot = valueText.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    const decimalAt = Math.max(comma, dot);
    const integer = valueText.slice(0, decimalAt).replace(/[.,]/g, '');
    valueText = integer + '.' + valueText.slice(decimalAt + 1).replace(/[.,]/g, '');
  } else if (comma >= 0) {
    valueText = valueText.replace(/,/g, '.');
  }
  const result = Number(valueText);
  return Number.isFinite(result) ? result : null;
}

function dateValue(value: unknown): string | null {
  const result = stringValue(value);
  if (!result) return null;
  return /^(?:\d{4}-\d{2}-\d{2}|\d{2}[./-]\d{2}[./-]\d{4})$/.test(result) ? result : null;
}

function almostEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= Math.max(1, Math.abs(right) * 0.0001);
}

function canonicalItem(raw: unknown, header: Obj): FakturaAiItem | null {
  const value = objectOf(raw);
  const item: FakturaAiItem = {
    fakturaRaqami: stringValue(first(value, 'fakturaRaqami', 'raqam')) || stringValue(first(header, 'fakturaRaqami', 'raqam')) || '',
    postavshik: stringValue(first(value, 'postavshik', 'supplier')) || stringValue(first(header, 'postavshik', 'supplier')) || '',
    kelganSana: dateValue(first(value, 'kelganSana', 'sana')) || dateValue(first(header, 'kelganSana', 'sana')) || '',
    shartnomaRaqami: stringValue(first(value, 'shartnomaRaqami', 'shartnoma')) || '',
    shartnomaSanasi: dateValue(first(value, 'shartnomaSanasi')) || undefined,
    postavshikInn: stringValue(first(value, 'postavshikInn', 'inn')) || undefined,
    postavshikManzil: stringValue(first(value, 'postavshikManzil', 'manzil')) || undefined,
    sotibOluvchiInn: stringValue(first(value, 'sotibOluvchiInn', 'buyerInn')) || undefined,
    sotibOluvchiManzil: stringValue(first(value, 'sotibOluvchiManzil', 'buyerAddress')) || undefined,
    nomi: stringValue(first(value, 'nomi', 'name', 'mahsulot')) || '',
    birligi: stringValue(first(value, 'birligi', 'birlik', 'unit')) || '',
    miqdori: numberValue(first(value, 'miqdori', 'miqdor', 'quantity')) ?? Number.NaN,
    narxi: numberValue(first(value, 'narxi', 'narx', 'unitPrice')) ?? Number.NaN,
    jamiNdsSiz: numberValue(first(value, 'jamiNdsSiz', 'jami_nds_siz', 'subtotal')) ?? Number.NaN,
    ndsSummasi: numberValue(first(value, 'ndsSummasi', 'nds', 'vat')) ?? Number.NaN,
    jamiNdsBilan: numberValue(first(value, 'jamiNdsBilan', 'jami_nds_bilan', 'total')) ?? Number.NaN,
    aksizSummasi: numberValue(first(value, 'aksizSummasi', 'aksiz')) ?? undefined,
    ndsStavkasi: numberValue(first(value, 'ndsStavkasi', 'ndsStavka', 'vatRate')) ?? undefined,
  };

  const requiredText = [item.fakturaRaqami, item.postavshik, item.kelganSana, item.nomi, item.birligi];
  const requiredNumbers = [item.miqdori, item.narxi, item.jamiNdsSiz, item.ndsSummasi, item.jamiNdsBilan];
  if (requiredText.some((field) => !field) || requiredNumbers.some((field) => !Number.isFinite(field))) return null;

  const aksiz = Number.isFinite(item.aksizSummasi) ? item.aksizSummasi as number : 0;
  if (!almostEqual(item.miqdori * item.narxi + aksiz, item.jamiNdsSiz)) return null;
  if (!almostEqual(item.jamiNdsSiz + item.ndsSummasi, item.jamiNdsBilan)) return null;
  return item;
}

/**
 * Parse natijasini fail-closed normalizatsiya qiladi. Biror qatorning
 * narxi/hajmi/jami yoki hujjat rekviziti noaniq bo'lsa, butun parse rad etiladi:
 * frontend noto'g'ri qatorni moliyaviy yozuvga aylantira olmaydi.
 */
export function normalizeFakturaAiPayload(raw: unknown): FakturaAiResult {
  const root = objectOf(raw);
  const rawItems = Array.isArray(root.items) ? root.items : [];
  const supplier = stringValue(first(root, 'supplier', 'postavshik')) || '';
  const items = rawItems.map((value) => canonicalItem(value, root));
  const warnings: string[] = [];

  if (!rawItems.length) return { ok: false, warnings: ['Tovar qatorlari topilmadi'], xabar: 'Fakturadan tovar qatorlari topilmadi.' };
  if (items.some((item) => !item)) {
    return {
      ok: false,
      warnings: ['Kamida bitta qator rekvizitlari yoki summalari tekshiruvdan o\'tmadi'],
      xabar: 'Faktura qatorlaridan biri to\'liq yoki arifmetik jihatdan ishonchli emas. Hujjat yozilmadi.',
    };
  }

  const validItems = items as FakturaAiItem[];
  const invoiceNumbers = new Set(validItems.map((item) => item.fakturaRaqami));
  if (invoiceNumbers.size > 1) {
    return { ok: false, warnings: ['Bitta faylda bir nechta faktura raqami aniqlandi'], xabar: 'Bitta faylda bir nechta faktura aralashib ketgan. Har birini alohida yuklang.' };
  }
  return { ok: true, items: validItems, supplier: supplier || validItems[0].postavshik, warnings };
}
