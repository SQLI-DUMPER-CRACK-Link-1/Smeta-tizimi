/**
 * f2-ish-bogla.ts — ISHNI RESURSLARI BILAN BIRGA BOG'LASH
 * ═══════════════════════════════════════════════════════════════════
 *
 * NIMA UCHUN BOR (egasi: "har bir ish turi resurslari bilan birga
 * bog'lanishi kerak"): avtomatik moslashtirish (f2-match-engine) T1
 * dagidek ierarxik ishlaydi — ish topilsa, uning resurslari AYNAN o'sha
 * ishning bolalari ichidan qidiriladi. Lekin QO'LDA tuzatish faqat
 * barg-bargdan edi: operator bitta ishni to'g'rilamoqchi bo'lsa, uning
 * 8 ta resursini bittalab sudrashga majbur bo'lardi.
 *
 * Bu funksiya o'sha ierarxik qoidani qo'lda tuzatishga ham beradi.
 *
 * ⚠️ ENG MUHIM QOIDA (T1 35_F2Moslash.js dagi izoh bilan bir xil):
 * «Bolalar FAQAT shu ish ichida qidiriladi. Global qidiruv generic
 * kodlar uchun tasodifiy qatorni tanlab, PULNI BOSHQA ISHGA YOZARDI.»
 * Shuning uchun nomzodlar to'plami — faqat tanlangan smeta ishining
 * bolalari, boshqa hech qayerdan emas.
 *
 * ⚠️ IKKINCHI QOIDA: hech qachon TAXMIN qilinmaydi. Nomzod bittadan
 * ko'p bo'lsa yoki umuman topilmasa — qator bog'lanmay qoladi va
 * operatorga sanab ko'rsatiladi. Noto'g'ri bog'langan qator = pul
 * boshqa ish ostiga yozilishi.
 */
import { kodKanon, normBir, normKod, normNom, type AktNode, type LrvNode } from './f2-match-engine';

const RESURS_TURLARI = new Set(['rs', 'mat', 'ob']);

export type IshBoglashNatija = {
  /** Yangi moslik xaritasi (kirish o'zgartirilmaydi). */
  mapping: Map<string, number>;
  /** Nechta resurs bog'landi. */
  bogland: number;
  /** Nechtasi bog'lanmay qoldi (aniq nomzod topilmadi yoki bir nechta). */
  qoldi: number;
  /** Bog'lanmay qolganlarning uid'lari — operatorga ko'rsatish uchun. */
  qoldiUidlar: string[];
};

function resursBolalar<T extends { type?: string }>(list: T[] | undefined): T[] {
  return (list || []).filter((c) => RESURS_TURLARI.has(String(c.type)));
}

/**
 * Akt ishining resurslarini smeta ishining resurslariga bog'laydi.
 *
 * Moslashtirish tartibi T1 bilan bir xil: aniq kod → kanonik kod →
 * nom+birlik. Har bosqichda nomzod AYNAN BITTA bo'lishi shart.
 *
 * @param fIsh  akt (F2 fayl) tomonidagi ish tuguni
 * @param sIsh  smeta (kanonik LRV) tomonidagi ish tuguni
 * @param mapping  joriy moslik xaritasi (akt uid → kanonik qator id)
 */
export function ishResurslariniBogla(
  fIsh: AktNode, sIsh: LrvNode, mapping: Map<string, number>,
): IshBoglashNatija {
  const yangi = new Map(mapping);
  /* Allaqachon band qilingan kanonik qatorlar — bitta smeta qatoriga
     ikkita akt qatorini bog'lab qo'ymaslik uchun. */
  const band = new Set<number>(yangi.values());
  const smetaResurslar = resursBolalar(sIsh.children);

  let bogland = 0;
  const qoldiUidlar: string[] = [];

  for (const fRs of resursBolalar(fIsh.children)) {
    if (yangi.has(fRs.uid)) continue; // avval bog'langan — tegmaymiz
    const bosh = smetaResurslar.filter((c) => !band.has(c.row));

    let topildi: LrvNode | undefined;

    const fk = normKod(fRs.kod);
    if (fk) {
      const nomzod = bosh.filter((c) => normKod(c.kod) === fk);
      if (nomzod.length === 1) topildi = nomzod[0];
    }
    if (!topildi) {
      const kan = kodKanon(fRs.kod);
      if (kan) {
        const nomzod = bosh.filter((c) => kodKanon(c.kod) === kan);
        if (nomzod.length === 1) topildi = nomzod[0];
      }
    }
    if (!topildi) {
      const nb = normNom(fRs.nom) + '||' + normBir(fRs.bir);
      const nomzod = bosh.filter((c) => normNom(c.nom) + '||' + normBir(c.birlik) === nb);
      if (nomzod.length === 1) topildi = nomzod[0];
    }

    if (topildi) {
      yangi.set(fRs.uid, topildi.row);
      band.add(topildi.row);
      bogland++;
    } else {
      qoldiUidlar.push(fRs.uid);
    }
  }

  return { mapping: yangi, bogland, qoldi: qoldiUidlar.length, qoldiUidlar };
}

/** Tugun «ish» (resurslari bor) ekanini aniqlaydi — bo'lim (rz) emas. */
export function ishMi(n: { type?: string; children?: unknown[] }): boolean {
  return String(n.type) !== 'rz' && Array.isArray(n.children) && n.children.length > 0;
}
