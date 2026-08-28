/**
 * t2-ai.ts — AI UCHUN KONTEKST (Postgres'da hisoblangan)
 * ═══════════════════════════════════════════════════════════════════
 *
 * ⚡ 2026-08-28 (Claude). Foydalanuvchi maqsadi: «hamma hisob kitoblar
 * o'sha yerda bo'lsa juda tez va aniq bo'lar edi. ai integratsiyasi ham
 * tez va kuchli bo'ladi shu orqali».
 *
 * TIZIM_01 DAGI YO'L (66b_AI_SqlEngine.js): AI eski `holat` jadvalidan
 * minglab qatorni TORTIB OLIB, jamlashni JavaScript'da qilardi
 * (`_aiAggQatorlar`, `_aiAggJami`). Sekin, va yaxlitlash har chaqiruvda
 * biroz boshqacha chiqishi mumkin edi.
 *
 * BU YERDA: hamma jamlash SQL'da, BITTA chaqiruvda. AI tayyor raqamni
 * oladi va uni faqat gapga aylantiradi.
 *
 * ⚠️ AI RAQAM TO'QIMASLIGI UCHUN javobda doim:
 *   • `smeta.toliq` — narx topilmagan qator bo'lsa `false`
 *   • `ogohlantirish[]` — AI javobida ULARNI AYTISHI shart
 *   • bo'sh qiymat `null` bo'lib qaytadi, 0 emas
 * Ya'ni «jami 865 mln» degan raqam yonida «lekin 194 qatorda narx yo'q»
 * ham turadi — modelga to'qish uchun joy qolmaydi.
 */

export type AiOgohlantirish = {
  tur: 'narx_yoq' | 'f2_faktdan_oshdi' | 'kozgu_eskirgan';
  matn: string;
  soni?: number;
};

export type AiKontekst = {
  ok: boolean;
  xabar?: string;
  obyekt: { id: number; nom: string; kompaniya: string; loyiha: string | null };
  smeta: {
    jami: number | null;
    resurs_qatori: number;
    narxsiz_qator: number;
    /** `false` bo'lsa JAMI ustida moliyaviy qaror qabul qilinmaydi. */
    toliq: boolean;
  };
  kategoriya: Record<string, { summa: number | null; qator: number }>;
  bajarish: {
    fakt_summa: number; f2_summa: number; f2_mumkin_summa: number;
    /** Smeta 0 bo'lsa `null` — yolg'on «0%» ko'rsatilmaydi. */
    fakt_foiz: number | null; f2_foiz: number | null;
  };
  eng_qimmat: Array<{
    nom: string; birlik: string | null; kat: string | null;
    hajm: number | null; narx: number | null; summa: number | null;
  }>;
  narxsiz_royxat: Array<{ nom: string; birlik: string | null; hajm: number | null }>;
  kozgu: { holat: string | null; oxirgi_yozish: string | null };
  ogohlantirish: AiOgohlantirish[];
  izoh: string;
};

export type AiUmumiy = {
  ok: boolean;
  obyektlar: Array<{
    id: number; nom: string;
    smeta: number | null; narxsiz: number; toliq: boolean;
    fakt: number; f2: number;
  }>;
  izoh: string;
};

type Javob<T> = { ok: boolean; natija?: T; error?: string; ms?: number };

async function soro<T>(tana: Record<string, unknown>): Promise<Javob<T>> {
  try {
    const r = await fetch('/api/sb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tana),
    });
    return await r.json();
  } catch (e: any) {
    return { ok: false, error: 'Tarmoq: ' + (e?.message || String(e)) };
  }
}

/** Bitta obyekt bo'yicha AI ga kerak bo'lgan HAMMA narsa — bitta chaqiruv. */
export function sbAiKontekst(obyektId: number) {
  return soro<AiKontekst>({ soro: 'ai_kontekst', obyekt_id: obyektId });
}

/** Barcha obyektlar qisqacha. `kompaniyaId` berilmasa — hammasi. */
export function sbAiUmumiy(kompaniyaId?: number) {
  return soro<AiUmumiy>({ soro: 'ai_umumiy', kompaniya_id: kompaniyaId ?? null });
}

/**
 * Kontekstni AI ga beriladigan MATNGA o'giradi.
 *
 * Ataylab alohida funksiya: model'ga yuboriladigan matn BIR JOYDA
 * yig'ilsin. Aks holda har sahifa o'z formatini yasab, ogohlantirishni
 * tushirib qoldirishi mumkin — va shunda model to'liq bo'lmagan raqamni
 * ishonch bilan aytib yuboradi.
 */
export function aiKontekstMatni(k: AiKontekst): string {
  if (!k?.ok) return 'Ma\'lumot olinmadi: ' + (k?.xabar || 'noma\'lum sabab');

  const pul = (n: number | null | undefined) =>
    n == null ? 'noma\'lum' : Math.round(n).toLocaleString('ru-RU') + ' so\'m';

  const qatorlar: string[] = [
    `OBYEKT: ${k.obyekt.nom} (${k.obyekt.kompaniya}` +
      (k.obyekt.loyiha ? `, loyiha: ${k.obyekt.loyiha}` : '') + ')',
    `SMETA JAMI: ${pul(k.smeta.jami)}` +
      (k.smeta.toliq ? ' — to\'liq' : ` — ⚠️ TO'LIQ EMAS (${k.smeta.narxsiz_qator} qatorda narx yo'q)`),
    `Resurs qatori: ${k.smeta.resurs_qatori}`,
  ];

  const kat = Object.entries(k.kategoriya || {});
  if (kat.length) {
    qatorlar.push('KATEGORIYA: ' + kat
      .map(([nom, v]) => `${nom} ${pul(v.summa)} (${v.qator} qator)`).join(', '));
  }

  qatorlar.push(
    `BAJARILGAN (ФАКТ): ${pul(k.bajarish.fakt_summa)}` +
      (k.bajarish.fakt_foiz != null ? ` (${k.bajarish.fakt_foiz}%)` : ''),
    `Ф2 YOZILGAN: ${pul(k.bajarish.f2_summa)}` +
      (k.bajarish.f2_foiz != null ? ` (${k.bajarish.f2_foiz}%)` : ''),
    `Ф2 GA OLISH MUMKIN: ${pul(k.bajarish.f2_mumkin_summa)}`);

  if (k.ogohlantirish?.length) {
    qatorlar.push('', '⚠️ OGOHLANTIRISHLAR (javobda albatta ayting):');
    k.ogohlantirish.forEach(o => qatorlar.push('  • ' + o.matn));
  }

  return qatorlar.join('\n');
}

/**
 * TIZIM_02 native AI — faktura/OCR parse.
 *
 * Eski GAS `apiFakturaAiParse` saqlanib qoladi, lekin Tizim_02 UI uchun
 * chaqiruv Cloudflare darvozasidan o'tadi: sessiya, provider kalitlari,
 * retry/timeout va fail-closed domain validator bir joyda ishlaydi.
 */
export type T2AiFakturaItem = {
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

export type T2AiFakturaParse = {
  ok: boolean;
  items?: T2AiFakturaItem[];
  supplier?: string;
  warnings?: string[];
  xabar?: string;
  provider?: string;
  model?: string;
  ms?: number;
};

export async function t2AiFakturaParse(payload: {
  base64: string;
  mimeType: string;
  nomi: string;
}): Promise<T2AiFakturaParse> {
  const t0 = performance.now();
  try {
    const response = await fetch('/api/ai-parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const raw = await response.text();
    let result: T2AiFakturaParse;
    try {
      result = JSON.parse(raw) as T2AiFakturaParse;
    } catch {
      return { ok: false, xabar: 'AI serveri JSON qaytarmadi', ms: Math.round(performance.now() - t0) };
    }
    return { ...result, ms: Math.round(performance.now() - t0) };
  } catch (error: any) {
    return {
      ok: false,
      xabar: 'AI tarmoq xatosi: ' + (error?.message || String(error)),
      ms: Math.round(performance.now() - t0),
    };
  }
}
