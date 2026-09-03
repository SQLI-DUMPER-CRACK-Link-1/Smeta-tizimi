/**
 * f2-exact-payload.ts — T2-LRV-CLOSURE-006 Section 3 (DB-independent).
 * ═══════════════════════════════════════════════════════════════════
 *
 * `TestF2Import.tsx`ning `yozish()` funksiyasi ichida yashiringan
 * aggregatsiya/ambiguity mantig'i shu yerga PURE funksiya sifatida
 * chiqarildi — bazasiz (DB-independent) haqiqiy vitest bilan tekshirish
 * uchun (`f2-exact-payload.test.ts`). Mantiq BAYT-BAYTIGA bir xil
 * saqlangan, faqat komponent tanasidan ajratilgan.
 *
 * F2 EXACT SOURCE LAW (T2-LRV-EXACT-F2-INTEGRATION-003): F2 faylning
 * o'z SUMMA ustuni (`n.summa`) — YAGONA haqiqiy manba. `certified_amount`
 * HECH QACHON `hajm * narx` dan hosil qilinmaydi. Narxi bor-yu fayldan
 * summasi yo'q qator — NOANIQ (`NEEDS_REVIEW`), yozish TO'XTATILADI —
 * soxta summa to'qilmaydi.
 */

export type F2ExactManbaTugun = {
  uid: string;
  hajm: number;
  /** null/undefined/<=0 — narx yo'q (price_intentionally_absent bo'lishi mumkin) */
  narx: number | null | undefined;
  /** F2 faylning o'z SUMMA ustunidan (hajm*narx dan EMAS) */
  summa: number | null | undefined;
};

export type F2ExactQator = {
  qator_id: number;
  hajm: number;
  narx?: number;
  summa: number;
  /** F2 faylda haqiqatan SUMMA yozilganmi (0 ham "bor" bo'lishi mumkin — shuning uchun alohida flag) */
  summaBor: boolean;
};

/**
 * Bir xil `qator_id`ga bog'langan bir nechta F2 qatorini (masalan bir
 * necha oy/varaq bo'lagi bitta smeta qatoriga tushsa) BITTA yozuvga
 * yig'adi: hajm/summa QO'SHILADI, narx birinchi topilgan qiymatdan
 * olinadi (F2 da bir xil qator uchun narx odatda bitta bo'ladi).
 */
export function f2AggregatsiyaQator(
  nodes: F2ExactManbaTugun[],
  getSmetaId: (uid: string) => number | null | undefined,
): F2ExactQator[] {
  const map = new Map<number, F2ExactQator>();
  nodes.forEach((n) => {
    const smetaId = getSmetaId(n.uid);
    if (!smetaId) return;
    const h = Number(n.hajm) || 0;
    const s = Number(n.summa) || 0;
    const existing = map.get(smetaId);
    if (existing) {
      existing.hajm += h;
      existing.summa += s;
      if (s) existing.summaBor = true;
    } else {
      map.set(smetaId, {
        qator_id: smetaId,
        hajm: h,
        narx: n.narx != null && n.narx > 0 ? n.narx : undefined,
        summa: s,
        summaBor: !!s,
      });
    }
  });
  return Array.from(map.values());
}

export type F2ExactPayloadQatori = {
  qatorId: number;
  certifiedQuantity: number;
  certifiedUnitPrice?: number;
  certifiedAmount?: number;
  priceIntentionallyAbsent: boolean;
};

export type F2ExactPayloadNatija =
  | { ok: true; qatorlar: F2ExactPayloadQatori[] }
  /** Narxi bor-yu F2 faylning o'z summasi yo'q qatorlar bor — qty*narx TO'QILMAYDI, foydalanuvchi ko'rib chiqishi kerak. */
  | { ok: false; sabab: 'NEEDS_REVIEW'; noaniqSoni: number; noaniqQatorIdlar: number[] };

/**
 * Aggregatsiyalangan qatorlardan `t2_akt_yarat_v2` uchun aniq (exact)
 * to'lov payload'ini quradi. Ambiguous qator topilsa — RAD ETADI (bo'sh
 * payload yozmaydi), chaqiruvchi buni ko'rsatishi kerak.
 */
export function f2ExactPayloadQur(rows: F2ExactQator[]): F2ExactPayloadNatija {
  const noaniq = rows.filter((r) => r.narx != null && !r.summaBor);
  if (noaniq.length > 0) {
    return {
      ok: false,
      sabab: 'NEEDS_REVIEW',
      noaniqSoni: noaniq.length,
      noaniqQatorIdlar: noaniq.map((r) => r.qator_id),
    };
  }
  return {
    ok: true,
    qatorlar: rows.map((row) => ({
      qatorId: row.qator_id,
      certifiedQuantity: row.hajm,
      certifiedUnitPrice: row.narx,
      certifiedAmount: row.summaBor ? row.summa : undefined,
      priceIntentionallyAbsent: row.narx == null,
    })),
  };
}
