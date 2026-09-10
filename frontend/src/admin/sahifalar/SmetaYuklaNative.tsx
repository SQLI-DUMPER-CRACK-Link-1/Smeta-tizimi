import { useEffect, useRef, useState } from 'react';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { sbT2DaraxtOl, sbT2ObyektlarOlKomp, sbT2ResursKategoriyaBelgila, yangiOperationId, type T2Obyekt, type T2Qator, type T2ResursKategoriya } from '../../api/supabase';
import { useKompaniya } from '../../umumiy/kontekst/KompaniyaKontekst';
import { usePTOWorkspace } from '../../umumiy/kontekst/PTOWorkspaceContext';
import { readXlsx, f2FaylOqiCore, f2UstunAniqla, type XlsxWorkbook, type F2ColumnConfig, type SheetGrid } from '../../lib/f2-import-parse';
import { smetaDaraxtniYoy, bolaklarga } from '../../lib/smeta-flatten';
import type { AktNode } from '../../lib/f2-match-engine';
import { smetaQaytaImportDiff, type SmetaReimportDiff, type SmetaReimportLine } from '../../lib/smeta-reimport-diff';

/**
 * T2-FINAL-CLEAN-CUTOVER P0.2: native Smeta XLSX -> canonical Supabase, off
 * Google Drive/Sheets/GAS entirely (see `functions/api/smeta-yukla.ts` and
 * `supabase/migrations/20261010120000_t2_smeta_import_bulk_v1.sql`).
 *
 * Deliberately a ONE-SHOT first-import path, not the F2 flow's resumable-job
 * model: the target RPC refuses outright (SMETA_ALREADY_EXISTS) the instant
 * the object has any existing t2_qator row, so there is no "in-progress,
 * partially-written smeta" state to resume — either it's empty and this
 * writes it once, or it already has a smeta and this is refused untouched.
 */
const MAX_FILE_BYTES = 50 * 1024 * 1024;

/** Bitta so'rovda yuboriladigan qatorlar soni. 4000 qator ~ 800 KB JSON --
 *  Pages Function uchun ham, Postgres uchun ham arzon (o'lchandi: bitta
 *  bo'lak ~70 ms). Serverdagi qattiq chegara 10 000. */
const BOLAK_HAJMI = 4000;

type SmetaYuklaJavob = {
  ok: boolean; code?: string; xato?: string; xabar?: string;
  qator_soni?: number; sessiya_id?: number; takror?: boolean;
  bolak?: number; jami?: number; obyekt_id?: number;
};

/** `/api/smeta-yukla` ga bitta so'rov. Tarmoq uzilishi ham `ok:false`
 *  bo'lib qaytadi -- chaqiruvchi hamma joyda bir xil ishlashi uchun. */
async function smetaSorov(yuk: Record<string, unknown>): Promise<SmetaYuklaJavob> {
  try {
    const r = await fetch('/api/smeta-yukla', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(yuk),
    });
    const j = await r.json().catch(() => null) as SmetaYuklaJavob | null;
    if (!j) return { ok: false, code: 'BAD_RESPONSE', xato: 'Server javobi o‘qilmadi.' };
    return j;
  } catch {
    return { ok: false, code: 'NETWORK', xato: 'Tarmoq uzildi. Qayta urinib ko‘ring.' };
  }
}

/**
 * T2-PTO-OWNER-CRITICAL-CLOSURE: a real Smeta is normally TWO documents --
 * LRV (lokal resurs vedomosti / lokal smeta: ish/hajm ierarxiyasi, ko'pincha
 * narxsiz) and RES (resursniy vedomost: kod/nom/birlik bo'yicha resurs narx
 * indeksi). Bitta faylda hajm VA narx bo'lmasa, LRV o'zi narxsiz import
 * qilinadi -- bu quyidagi yordamchilar RES faylini o'qib, uning narxlarini
 * nom+birlik bo'yicha LRV daraxtining rs/mat/ob bargiga ulaydi (kod, bo'lsa,
 * FAQAT qo'shimcha aniqlashtirish sifatida). LRV faylida allaqachon narx
 * bo'lgan qatorlar ustidan YOZILMAYDI -- RES faqat YETISHMAGAN narxni
 * to'ldiradi.
 *
 * ⚠️ 2026-09-09 (haqiqiy falokat, egasining "Karting2" obyektida
 * tasdiqlangan): avval bu yerda `kod` BIRINCHI USTUVOR sifatida ishlatilardi
 * (nom+birlik faqat kod topilmasa). Egasining haqiqiy Drive faylida
 * (Karting_LRV_PLUS) `kod` UMUMAN NOYOB EMAS -- masalan `kod='С'` 388 xil,
 * bir-biriga aloqasi yo'q material qatorida (220 xil haqiqiy narx bilan)
 * takrorlanadi; bu T1 dagi odatiy, meros qolgan konventsiya, xato emas.
 * Natijada bitta tasodifiy narx (birinchi indekslangani) o'sha `kod`ga ega
 * BARCHA boshqa materiallarga yopishtirilib chiqdi -- masalan
 * «САМОСВЕРЛЯЮЩИЙ ШУРУП 250 ММ» (haqiqiy narx 450) ga butunlay boshqa
 * resursning («АРМАТУРА... 12 ММ») narxi (8 295 844) yozilib, bitta qator
 * summasi 581+ mlrd, butun obyekt esa ~980 mlrd so'mga shishib ketdi.
 * Endi `nom+birlik` MAJBURIY asosiy kalit (xuddi `res-narxlash.ts`dagi
 * xavfsiz, tasdiqlangan mantiq kabi); `kod` mavjud bo'lsa ham, faqat
 * `nom+birlik` allaqachon topilgan holatni ANIQLASHTIRISH uchun ishlatiladi
 * -- hech qachon yolg'iz/mustaqil qidiruv kaliti sifatida emas.
 */
export type ResNarxYozuv = {
  kod?: string; nom?: string; birlik?: string; narx: number;
  /** RES faylining BO'LIM sarlavhasidan aniqlangan kategoriya (quyiga qarang). */
  kat?: T2ResursKategoriya;
};
export type ResNarxIndeks = {
  byNomBir: Map<string, number>; byKodNomBir: Map<string, number>;
  katByNomBir: Map<string, T2ResursKategoriya>; katByKodNomBir: Map<string, T2ResursKategoriya>;
  /** Faqat NOM kaliti -- "RES da bor, lekin BIRLIGI boshqa" holatini
   *  "RES da umuman yo'q" dan ajratish uchun (narxsizlik sababi). */
  nomlar: Set<string>;
};

/** Nega bu qatorga narx qo'yilmadi -- foydalanuvchiga aynan shu ko'rsatiladi. */
export type NarxsizSabab = 'res_yuklanmagan' | 'nomsiz' | 'birlik_mos_emas' | 'res_da_yoq';

export type NarxsizQator = {
  uid?: string; kod?: string; nom?: string; bir?: string; hajm?: number;
  sabab: NarxsizSabab;
};

export const NARXSIZ_SABAB_MATN: Record<NarxsizSabab, string> = {
  res_yuklanmagan: 'RES fayli ulanmagan — narx manbai yo‘q',
  nomsiz: 'Qator nomi bo‘sh — nom bo‘yicha moslash imkonsiz',
  birlik_mos_emas: 'RES da shu nom BOR, lekin BIRLIGI boshqa',
  res_da_yoq: 'RES ro‘yxatida bunday nom topilmadi',
};

export type ImportQadam = { kalit: string; nom: string; holat: 'ishlamoqda' | 'tayyor' | 'xato'; tafsilot?: string };

/** Client-side tolerant numeric parse (comma-decimal, thousands spaces) -- server-side t2_son mirrors this. */
function son(v: unknown): number | undefined {
  if (v == null) return undefined;
  const raw = String(v).replace(/[\s ]/g, '').replace(',', '.');
  if (raw === '') return undefined;
  const m = /[+-]?[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?/.exec(raw);
  if (!m) return undefined;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * RES faylidagi BO'LIM SARLAVHASINI kategoriyaga o'giradi.
 *
 * NIMA UCHUN SHART: МАТ va ОБ ni birlikdan (m3, sht, kompl, m2...) ajratib
 * BO'LMAYDI -- egasining haqiqiy fayllarida «РЕКЛАМНЫЙ БАННЕР, М2» ham,
 * «КОНЦЕВАЯ КАБЕЛЬНАЯ МУФТА, КОМПЛ» ham ОБОРУДОВАНИЕ bo'limida turadi,
 * «КИРПИЧ, ШТ» esa МАТЕРИАЛЬНЫЕ РЕСУРСЫ da. Ya'ni birlik hech narsa
 * demaydi -- yagona ishonchli manba bo'lim sarlavhasi.
 *
 * Drive'dagi RES fayllari (Karting, Navoiy KL-10 kV va b.) o'rganildi --
 * tuzilma hamma joyda bir xil:
 *     ТРУДОВЫЕ РЕСУРСЫ                    -> ЧЕЛ
 *     СТРОИТЕЛЬНЫЕ МАШИНЫ И МЕХАНИЗМЫ     -> МАШ
 *     МАТЕРИАЛЬНЫЕ РЕСУРСЫ                -> МАТ
 *     КОНСТРУКЦИИ ЗАВОДСКОГО ИЗГОТОВЛЕНИЯ -> М/К (kabel bo'lsa КАБ)
 *     ОБОРУДОВАНИЕ                        -> ОБ
 * va har biri «ИТОГО ...» qatori bilan yopiladi.
 *
 * T1 (10_Engine.js) ham aynan shu naqshdan foydalanardi, lekin sozlama
 * varag'idagi ANIQ iboralar bilan ('СТРОИТЕЛЬНЫЕ МАТЕРИАЛЫ') -- ular
 * haqiqiy sarlavha 'МАТЕРИАЛЬНЫЕ РЕСУРСЫ' ga mos kelmaydi. Shuning uchun
 * bu yerda ANIQ ibora emas, O'ZAK bo'yicha tekshiriladi.
 *
 * @returns kategoriya, yoki 'YAKUN' (ИТОГО/ЖАМИ -- bo'lim tugadi), yoki
 *          null (bu sarlavha emas).
 */
const RES_BOLIM_NAQSH: ReadonlyArray<readonly [RegExp, T2ResursKategoriya]> = [
  [/^ТРУДОВЫЕ\s+РЕСУРСЫ$/, 'ЧЕЛ'],
  [/^ЗАТРАТЫ\s+ТРУДА(\s+(РАБОЧИХ|РАБОЧИХ-СТРОИТЕЛЕЙ|СТРОИТЕЛЕЙ))?$/, 'ЧЕЛ'],
  [/^ЗАТРАТЫ\s+ТРУДА\s+МАШИНИСТОВ$/, 'МАШ'],
  [/^(СТРОИТЕЛЬНЫЕ\s+)?МАШИНЫ(\s+И\s+МЕХАНИЗМЫ)?$/, 'МАШ'],
  [/^МЕХАНИЗМЫ$/, 'МАШ'],
  [/^МАТЕРИАЛЬНЫЕ\s+РЕСУРСЫ$/, 'МАТ'],
  [/^(СТРОИТЕЛЬНЫЕ\s+)?МАТЕРИАЛЫ$/, 'МАТ'],
  [/^КАБЕЛЬ(НАЯ\s+ПРОДУКЦИЯ|НЫЕ\s+ИЗДЕЛИЯ)?$/, 'КАБ'],
  [/^ПРОВОДА?\s+И\s+КАБЕЛИ$/, 'КАБ'],
  [/^КОНСТРУКЦИИ\s+ЗАВОДСКОГО\s+ИЗГОТОВЛЕНИЯ$/, 'М/К'],
  [/^(МЕТАЛЛО)?КОНСТРУКЦИИ$/, 'М/К'],
  [/^ОБОРУДОВАНИЕ$/, 'ОБ'],
];

/**
 * Sarlavha matnini solishtirish uchun normallashtiradi: boshidagi raqam/
 * rim raqami tartiblash ("III.", "2)"), oxiridagi ikki nuqta va ortiqcha
 * bo'shliqlar olib tashlanadi.
 */
function resSarlavhaNormal(nom: string): string {
  return String(nom || '')
    .toUpperCase().replace(/Ё/g, 'Е')
    .replace(/^[\s№IVX0-9.)-]+/, '')
    .replace(/[\s:.;]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resBolimKategoriya(nom: string): T2ResursKategoriya | 'YAKUN' | null {
  const s = resSarlavhaNormal(nom);
  if (!s) return null;
  if (s.includes('ИТОГО') || s.includes('ЖАМИ') || s.includes('ВСЕГО')) return 'YAKUN';
  /* Owner (2026-09-10): 23 ta resurs (БЕТОН, ПЕСОК, РАСТВОР, ЩЕБЕНЬ, ПРОВОД …)
   * noto'g'ri М/К bo'lib chiqdi. Sabab: bu yerda `includes('КОНСТРУКЦИИ')`
   * ishlatilardi, RES faylida esa «КОНСТРУКЦИИ СТАЛЬНЫЕ ПО ПРОЕКТУ»,
   * «АРМАТУРА ДЛЯ МОНОЛИТНЫХ ЖЕЛЕЗОБЕТОННЫХ КОНСТРУКЦИЙ …» kabi RESURS
   * nomlari bor. Narxi bo'sh bo'lgan shunday qator sarlavha deb o'qilib,
   * undan keyingi BUTUN material oqimi М/К ga o'tib ketardi (М/К nakrutka
   * foizi МАТ'nikidan boshqa -- ya'ni bu pulga ta'sir qiladi).
   * Endi sarlavha TO'LIQ moslik bo'yicha aniqlanadi: uzun resurs nomi
   * hech qachon sarlavhaga aylanmaydi. */
  for (const [naqsh, kat] of RES_BOLIM_NAQSH) if (naqsh.test(s)) return kat;
  return null;
}

/**
 * RES varag'ini {kod,nom,birlik,narx,kat} tekis ro'yxatiga o'giradi.
 *
 * Ierarxiya yo'q, lekin BO'LIM sarlavhalari bor va ular yagona joy bo'lib,
 * МАТ/ОБ/КАБ/М-К farqi shu yerdan olinadi (resBolimKategoriya ga qarang).
 *
 * ⚠️ Sarlavha faqat NARXSIZ qatorda bo'ladi -- bu shart MAJBURIY. Aks
 * holda «ЗАТРАТЫ ТРУДА РАБОЧИХ-СТРОИТЕЛЕЙ» degan RESURS «ЗАТРАТЫ ТРУДА»
 * sarlavhasi deb o'qilib, narxi yo'qolardi (T1 10_Engine.js da aynan shu
 * xato bir marta bo'lgan va o'sha yerda izohlab qo'yilgan).
 */
export function resSatrlariniOl(rows: SheetGrid, cols: F2ColumnConfig): ResNarxYozuv[] {
  const out: ResNarxYozuv[] = [];
  let joriyKat: T2ResursKategoriya | undefined;
  for (const row of rows) {
    const kod = cols.kod >= 0 ? String(row[cols.kod] ?? '').trim() : '';
    const nom = cols.nom >= 0 ? String(row[cols.nom] ?? '').trim() : '';
    const bir = cols.bir >= 0 ? String(row[cols.bir] ?? '').trim() : '';
    const narx = cols.narx >= 0 ? son(row[cols.narx]) : undefined;
    if (!nom && !kod) continue;
    if (/^\d+$/.test(nom) && /^\d+$/.test(bir)) continue; // ustun-raqamlash qatori
    if (narx == null || narx <= 0) {
      /* Narxsiz matnli qator -- bo'lim sarlavhasi bo'lishi mumkin. Lekin
         HAQIQIY sarlavha faqat sarlavha matnidan iborat: kodi ham,
         birligi ham bo'lmaydi. Kodi/birligi bor qator -- bu narxi
         to'ldirilmagan RESURS (masalan «КОНСТРУКЦИИ СТАЛЬНЫЕ ПО ПРОЕКТУ, Т»),
         uni sarlavha deb o'qish butun keyingi oqim kategoriyasini buzardi. */
      if (kod || bir) continue;
      const b = resBolimKategoriya(nom);
      if (b === 'YAKUN') joriyKat = undefined;
      else if (b) joriyKat = b;
      continue;
    }
    out.push({
      kod: kod || undefined, nom: nom || undefined, birlik: bir || undefined, narx,
      kat: resursMkKabAniqla(nom, bir, joriyKat),
    });
  }
  return out;
}

/** Server t2_kat_birlik bilan bir xil mantiq (birlik matnida ЧЕЛ/МАШ),
 *  faqat mijoz tomonda ko'rib chiqish uchun taxmin -- yakuniy kategoriya
 *  hamisha serverda (registr + t2_kat_birlik) hisoblanadi. ОБ/КАБ/М/К hech
 *  qachon shu taxmindan chiqmaydi -- T1 GAS ham buni faqat registr orqali
 *  hal qilardi (10_Engine.js), shuning uchun МАТ (standart) qatorlar
 *  ko'rib chiqish uchun ko'rsatiladi. */
/* Tayyor konstruksiya nomi KONSTRUKSIYANING O'ZI bilan boshlanadi. Nomi
   «АРМАТУРА ДЛЯ … КОНСТРУКЦИЙ» yoki «ПРОКАТ ДЛЯ АРМИРОВАНИЯ Ж/Б
   КОНСТРУКЦИЙ» bo'lganlar konstruksiya UCHUN xomashyo -- ular МАТ. */
const MK_NOM = /^(МЕТАЛЛО)?КОНСТРУКЦ|^ОТДЕЛЬНЫЕ\s+КОНСТРУКТИВНЫЕ|^КОНСТРУКТИВНЫЕ\s+ЭЛЕМЕНТ/;
/** Tayyor konstruksiya OG'IRLIKDA o'lchanadi (кг/т) -- shtukada emas. */
const MK_BIRLIK = /^(КГ|Т|ТН|ТОННА?)$/;
/** «ПРОВОЛОКА» BU YERGA TUSHMAYDI (ПРОВОЛ ≠ ПРОВОД) -- u bog'lash simi, МАТ. */
const KAB_NOM = /^(КАБЕЛ|ПРОВОД)/;

/**
 * Owner (2026-09-10): «mk ni aniqlash ancha og'ir masala … haqiqiy mk bu
 * TAYYOR KONSTRUKSIYA, kg yoki tonnada belgilanadigan narsa. kabel provod
 * ham shunaqa — shu oilaga kiruvchi, metr yoki km da berilgan narsalar.»
 *
 * Bo'lim sarlavhasi bu ikkisini AYTA OLMAYDI: egasining haqiqiy RES
 * faylida (Karting) alohida «КОНСТРУКЦИИ ЗАВОДСКОГО ИЗГОТОВЛЕНИЯ» bo'limi
 * umuman YO'Q — tayyor konstruksiyalar ham, kabellar ham «МАТЕРИАЛЬНЫЕ
 * РЕСУРСЫ» ichida turadi. Shuning uchun М/К va КАБ qator darajasida,
 * nom + birlik JUFTLIGI bo'yicha aniqlanadi.
 *
 * Qoida ATAYLAB TOR: ikkala shart mos kelmasa qator bo'lim kategoriyasida
 * (odatda МАТ) qoladi. Sabab — egasining ogohlantirishi: «sani mantiqing
 * bo'yicha armatura balo battar hamma prokatlar mk ga kirib ketadi».
 * Kabel/provod nomi esa o'z-o'zidan aniq, shuning uchun unga birlik sharti
 * qo'yilmaydi (egasining faylida «ПРОВОДА … МЕДНЫЕ» tonnada ham keladi).
 * Shubhali qolgan qatorlarni foydalanuvchi import oldidagi ro'yxatda
 * tuzatadi va tanlov registrda eslab qolinadi.
 */
export function resursMkKabAniqla(
  nom: string, birlik: string, bolimKat?: T2ResursKategoriya,
): T2ResursKategoriya | undefined {
  const n = String(nom || '').toUpperCase().replace(/Ё/g, 'Е').trim();
  const b = String(birlik || '').toUpperCase().replace(/Ё/g, 'Е').replace(/[.\s]/g, '').trim();
  if (!n) return bolimKat;
  if (KAB_NOM.test(n)) return 'КАБ';
  if (MK_NOM.test(n) && MK_BIRLIK.test(b)) return 'М/К';
  return bolimKat;
}

export function katTaxmini(nom: string, birlik: string): 'ЧЕЛ' | 'МАШ' | 'МАТ' {
  const b = birlik.toUpperCase();
  if (nom.toUpperCase().includes('ТРУДА МАШИНИСТОВ')) return 'МАШ';
  if (b.includes('ЧЕЛ')) return 'ЧЕЛ';
  if (b.includes('МАШ')) return 'МАШ';
  return 'МАТ';
}

export type VaraqTegi = 'lrv' | 'res' | 'etibor_bermaslik';

/**
 * Owner: "smeta lrv res... nomni farqi yo'q tizim o'zi aniqlashga harakat
 * qilishi kerak hujjatni ko'rib ... bitta hujjat ichida ham lrv ham res
 * sahifalari ham bo'lishi mumkin". Varaq nomiga qaraganda YOMON heuristika
 * -- odamlar varaqni istalgan narsa deb ataydi ("Sheet1", "Лист2" va h.k.).
 * Buning o'rniga MAZMUNGA qaraladi:
 *   RES (tekis narx katalogi): deyarli har bir qatorda narx bor, lekin
 *     hajm deyarli YO'Q (loyihaga bog'liq emas -- umumiy narxnoma).
 *   LRV (ish/hajm ierarxiyasi): hajm ustuni bor va ko'p qatorda
 *     to'ldirilgan (narx bo'lsin-bo'lmasin -- LRV ko'pincha narxsiz keladi).
 * Ikkalasi ham yo'q yoki juda kam ma'lumot -- "nomalum" (foydalanuvchi
 * qo'lda belgilaydi, hech narsa taxmin qilib yozilmaydi).
 */
export function varaqTuriTaxmin(rows: SheetGrid): 'lrv' | 'res' | 'nomalum' {
  const cols = f2UstunAniqla(rows);
  if (cols.nom < 0) return 'nomalum';
  let jami = 0, narxli = 0, hajmli = 0;
  for (const row of rows) {
    const nom = String(row[cols.nom] ?? '').trim();
    if (!nom) continue;
    jami++;
    const narx = cols.narx >= 0 ? son(row[cols.narx]) : undefined;
    const hajm = cols.obyom >= 0 ? son(row[cols.obyom]) : undefined;
    if (narx != null && narx > 0) narxli++;
    if (hajm != null) hajmli++;
  }
  if (jami < 3) return 'nomalum';
  const narxNisbat = narxli / jami;
  const hajmNisbat = hajmli / jami;
  if (hajmNisbat > 0.3) return 'lrv';
  if (narxNisbat > 0.6) return 'res';
  return 'nomalum';
}

/**
 * Moslashtirish kaliti.
 *
 * ⚠️ 2026-09-08: avval bu yerda faqat `.toUpperCase()` bor edi. Ikki
 * MUSTAQIL hujjat (LRV va RES) bir xil resursni bir xil harflar bilan
 * yozishiga tayanish real Excel fayllarida ishlamaydi: qo'shimcha bo'sh
 * joy, nuqta («ЧЕЛ.-Ч» vs «ЧЕЛ-Ч»), tirnoq belgisi, «м³» vs «м3»,
 * «Ё» vs «Е» -- har biri mos kelmaslikka olib keladi.
 *
 * Bazada shu muammo uchun allaqachon `t2_resurs_nom_kalit` /
 * `t2_resurs_birlik_kalit` bor (registr + `Ё→Е` + `³→3` + faqat harf/raqam).
 * Bu -- o'sha g'oyaning klient nusxasi: kalit ikkala tomonda ham bir xil
 * hosil qilinadi, shuning uchun moslashtirish o'z-o'ziga izchil.
 */
export function resKalit(v?: string | null): string {
  return String(v ?? '').toUpperCase()
    .replace(/Ё/g, 'Е').replace(/³/g, '3').replace(/²/g, '2')
    .replace(/[^0-9A-ZА-Я]/g, '');
}

export function resNarxIndeksiQur(rows: ResNarxYozuv[]): ResNarxIndeks {
  const byNomBir = new Map<string, number>();
  const byKodNomBir = new Map<string, number>();
  const katByNomBir = new Map<string, T2ResursKategoriya>();
  const katByKodNomBir = new Map<string, T2ResursKategoriya>();
  const nomlar = new Set<string>();
  for (const r of rows) {
    const nk = resKalit(r.nom);
    if (!nk) continue; // `kod` yolg'iz hech narsani aniqlamaydi -- yuqoridagi izohga q.
    nomlar.add(nk);
    const nb = nk + '|' + resKalit(r.birlik);
    if (!byNomBir.has(nb)) byNomBir.set(nb, r.narx);
    if (r.kat && !katByNomBir.has(nb)) katByNomBir.set(nb, r.kat);
    const kk = resKalit(r.kod);
    if (kk) {
      const kb = kk + '|' + nb;
      if (!byKodNomBir.has(kb)) byKodNomBir.set(kb, r.narx);
      if (r.kat && !katByKodNomBir.has(kb)) katByKodNomBir.set(kb, r.kat);
    }
  }
  return { byNomBir, byKodNomBir, katByNomBir, katByKodNomBir, nomlar };
}

/**
 * LRV daraxtiga RES narxlarini qo'llaydi. Faqat narxi YO'Q rs/mat/ob
 * barglariga tegadi -- LRV o'z haqiqiy narxini yozgan bo'lsa ustidan
 * YOZILMAYDI.
 *
 * ⚠️ 2026-09-08 (haqiqiy nosozlik, bazada tasdiqlangan): shart avval
 * `if (n.narx != null) return n;` edi. Lekin narxsiz LRV faylida narx
 * ustuni bo'sh emas, `0` bo'lib keladi (bo'sh katak 0 ga aylanadi) --
 * ya'ni `0 != null` bo'lgani uchun HAR BIR resurs «allaqachon narxlangan»
 * deb hisoblanib, sanoqqa ham tushmasdan tashlab ketilardi. Natijada
 * ekranda «0 ta mos, 0 ta narxsiz qoldi» chiqardi (ikkala hisoblagich
 * ham nol -- chunki sikl ularga umuman yetib bormasdi), smeta esa
 * butunlay narxsiz (`narx = 0`) import bo'lardi. Obyekt 26 («Fast Food
 * 1etaj») aynan shu holatda: 1262 ta resursning HAMMASIDA narx = 0.
 * Endi 0 ham «narx yo'q» deb hisoblanadi.
 */
export function narxlarniDaraxtgaQoll(
  tree: AktNode[], idx: ResNarxIndeks,
): { tree: AktNode[]; mosSoni: number; mosEmasSoni: number; narxsizlar: NarxsizQator[] } {
  let mosSoni = 0, mosEmasSoni = 0;
  /* Owner (2026-09-10): "yuklanish tugaganidan keyin narxlanmagan rs mat ob
     kabi har bir qatorlarni bildirishi va SABABINI keltirib bera olishi
     kerak". Avval faqat SON chiqardi ("N ta narxsiz qoldi") -- qaysi qator
     va nega ekani noma'lum edi. */
  const narxsizlar: NarxsizQator[] = [];
  const resBosh = idx.nomlar.size === 0;
  const belgila = (n: AktNode, sabab: NarxsizSabab) => {
    mosEmasSoni++;
    narxsizlar.push({ uid: n.uid, kod: n.kod, nom: n.nom, bir: n.bir, hajm: n.hajm, sabab });
  };
  function walk(n: AktNode): AktNode {
    if (n.children && n.children.length) return { ...n, children: n.children.map(walk) };
    if (n.type !== 'rs' && n.type !== 'mat' && n.type !== 'ob') return n;
    if (n.narx != null && n.narx !== 0) return n;
    const nk = resKalit(n.nom);
    if (!nk) { belgila(n, 'nomsiz'); return n; }
    const nb = nk + '|' + resKalit(n.bir);
    let narx: number | undefined;
    const kk = resKalit(n.kod);
    if (kk) narx = idx.byKodNomBir.get(kk + '|' + nb);
    if (narx == null) narx = idx.byNomBir.get(nb);
    if (narx == null) {
      belgila(n, resBosh ? 'res_yuklanmagan' : idx.nomlar.has(nk) ? 'birlik_mos_emas' : 'res_da_yoq');
      return n;
    }
    mosSoni++;
    const summa = n.hajm != null ? Math.round(n.hajm * narx * 100) / 100 : undefined;
    return { ...n, narx, summa };
  }
  return { tree: tree.map(walk), mosSoni, mosEmasSoni, narxsizlar };
}

/** Import jarayonining haqiqiy vaqtdagi qadam ro'yxati -- foydalanuvchi:
 *  "qanaqadir jarayon bo'layotganini bilib bo'lmaydi ... to'lib boruvchi
 *  ... animatsiya va loglar bilan ko'rsatib tursa". Progress-bar HAQIQIY
 *  tugagan qadamlar ulushi (simulyatsiya emas); har qadam o'z natijasi
 *  (tafsilot) bilan qatorlab ko'rsatiladi. */
export function ImportQadamlarPaneli({ qadamlar }: { qadamlar: ImportQadam[] }) {
  const tayyor = qadamlar.filter(q => q.holat === 'tayyor').length;
  const foiz = qadamlar.length ? Math.round((tayyor / qadamlar.length) * 100) : 0;
  return (
    <div className="karta p-3 space-y-2" role="status" aria-live="polite">
      <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <div className="h-full bg-accent transition-[width] duration-300 ease-out" style={{ width: Math.max(foiz, 6) + '%' }} />
      </div>
      <ul className="space-y-1 text-[12.5px]">
        {qadamlar.map(q => (
          <li key={q.kalit} className="flex items-center gap-2">
            {q.holat === 'ishlamoqda' && <Loader2 size={13} className="animate-spin text-accent flex-shrink-0" />}
            {q.holat === 'tayyor' && <CheckCircle2 size={13} className="text-ok flex-shrink-0" />}
            {q.holat === 'xato' && <XCircle size={13} className="text-danger flex-shrink-0" />}
            <span className={q.holat === 'xato' ? 'text-danger' : 'text-text'}>{q.nom}</span>
            {q.tafsilot && <span className="text-text-mute">— {q.tafsilot}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Sessiya({ companyId, fixedObjectId, onImportlandi }: { companyId: number; fixedObjectId?: number; onImportlandi?: () => void }) {
  const workspace = usePTOWorkspace();
  const [objects, setObjects] = useState<T2Obyekt[]>([]);
  const [objectId, setObjectId] = useState(fixedObjectId ? String(fixedObjectId) : '');
  const [book, setBook] = useState<XlsxWorkbook | null>(null);
  const [sheetName, setSheetName] = useState('');
  const [cols, setCols] = useState<F2ColumnConfig | null>(null);
  const [preview, setPreview] = useState<Array<{ r: number; cells: string[] }>>([]);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ qator_soni: number } | null>(null);
  const [resBook, setResBook] = useState<XlsxWorkbook | null>(null);
  const [resSheetName, setResSheetName] = useState('');
  const [resCols, setResCols] = useState<F2ColumnConfig | null>(null);
  const [resBusy, setResBusy] = useState(false);
  const [resError, setResError] = useState('');
  const [resIndex, setResIndex] = useState<ResNarxIndeks | null>(null);
  const [resIndexSize, setResIndexSize] = useState(0);
  const [katKorib, setKatKorib] = useState<Array<{ nom: string; birlik: string; tanlangan: T2ResursKategoriya }>>([]);
  const [katSaqlanmoqda, setKatSaqlanmoqda] = useState(false);
  const [narxsizlar, setNarxsizlar] = useState<NarxsizQator[]>([]);

  /** Owner: "qanaqadir jarayon bo'layotganini bilib bo'lmaydi" -- import
   *  bosqichlari haqiqiy vaqtda, har bir qadam nima qilayotgani va
   *  natijasi bilan ko'rsatiladi (simulyatsiya emas -- har bir yozuv
   *  aynan shu qadam tugagach yoziladi). */
  const [importQadamlari, setImportQadamlari] = useState<ImportQadam[]>([]);
  const [reimportDiff, setReimportDiff] = useState<SmetaReimportDiff | null>(null);
  /** Owner: bitta faylda ham LRV, ham RES varaqlari bo'lishi mumkin --
   *  har bir varaq turi mazmuniga qarab avtomatik taxmin qilinadi
   *  (varaqTuriTaxmin), foydalanuvchi shu yerda tasdiqlaydi/tuzatadi. */
  const [varaqTeglari, setVaraqTeglari] = useState<Record<string, VaraqTegi>>({});
  /** RES deb belgilangan har bir ICHKI varaq uchun avtomatik aniqlangan
   *  ustunlar -- f2UstunAniqla standart holatda ЕNKБ shakli (ikki qatorli
   *  sarlavha)ni kutadi, oddiy tekis kod/nom/narx jadvalida ustunlar
   *  noto'g'ri chiqishi mumkin, shuning uchun foydalanuvchi shu yerda ham
   *  tuzata oladi (alohida RES fayl bilan bir xil naqsh). */
  const [inFileResCols, setInFileResCols] = useState<Record<string, F2ColumnConfig>>({});
  const rawFile = useRef<File | null>(null);
  const sourceDocumentId = useRef<number | undefined>(undefined);
  const sourceOperationId = useRef('');
  const importOperationId = useRef('');
  const generation = useRef(0);

  useEffect(() => {
    let active = true;
    void sbT2ObyektlarOlKomp(companyId).then(r => {
      if (!active) return;
      setObjects(r.ok ? (r.qatorlar || []) as T2Obyekt[] : []);
    });
    return () => { active = false; };
  }, [companyId]);

  useEffect(() => {
    if (fixedObjectId) setObjectId(String(fixedObjectId));
  }, [fixedObjectId]);

  useEffect(() => {
    if (fixedObjectId && objects.some((row) => row.id === fixedObjectId) && workspace.scope.objectId !== fixedObjectId) {
      workspace.setObjectId(fixedObjectId);
      return;
    }
    if (workspace.scope.objectId != null && objects.some((row) => row.id === workspace.scope.objectId)) {
      setObjectId(String(workspace.scope.objectId));
    }
  }, [fixedObjectId, objects, workspace, workspace.scope.objectId, workspace.setObjectId]);

  function reset() {
    generation.current++; setError(''); setResult(null); setCols(null); setPreview([]);
    setResBook(null); setResCols(null); setResIndex(null); setResIndexSize(0); setResError('');
    setVaraqTeglari({}); setInFileResCols({}); setReimportDiff(null);
  }


  /** Foydalanuvchi bir varaqni qo'lda LRV yoki RES deb belgilaydi (yoki
   *  e'tiborsiz qoldiradi). LRV -- radio kabi, faqat BITTASI bo'lishi
   *  mumkin (aynan shu varaqdan daraxt quriladi); RES -- checkbox kabi,
   *  bir nechtasi bo'lishi mumkin (barchasining narxlari birlashtiriladi). */
  function varaqTegBelgila(workbook: XlsxWorkbook, name: string, teg: VaraqTegi) {
    setVaraqTeglari(prev => {
      const next = { ...prev, [name]: teg };
      if (teg === 'lrv') {
        for (const k of Object.keys(next)) if (k !== name && next[k] === 'lrv') next[k] = 'etibor_bermaslik';
      }
      return next;
    });
    setResIndex(null); setResIndexSize(0);
    if (teg === 'lrv') chooseSheet(workbook, name);
    if (teg === 'res') {
      setInFileResCols(prev => {
        if (prev[name]) return prev; // avval belgilangan tuzatish saqlanadi
        const sheet = workbook.sheet(name);
        return sheet ? { ...prev, [name]: f2UstunAniqla(sheet.rows) } : prev;
      });
    }
  }

  function chooseSheet(workbook: XlsxWorkbook, name: string) {
    setSheetName(name);
    const sheet = workbook.sheet(name);
    if (!sheet) { setCols(null); setPreview([]); return; }
    const detected = f2FaylOqiCore(sheet.rows);
    if ('cols' in detected) { setCols(detected.cols); setPreview(detected.preview); }
    else { setCols(null); setPreview([]); }
  }

  async function reimportPreview(workbook: XlsxWorkbook, name: string, token: number) {
    const sheet = workbook.sheet(name);
    if (!sheet) throw new Error('Qayta import varag‘i topilmadi.');
    const built = f2FaylOqiCore(sheet.rows);
    if (!('tree' in built) || !built.tree.length) throw new Error('Qayta import daraxti bo‘sh chiqdi.');
    const current = await sbT2DaraxtOl(Number(objectId));
    if (!current.ok) throw new Error('Mavjud smeta qatorlari o‘qilmadi. Diff tuzilmadi.');
    if (generation.current !== token) return;
    const before: SmetaReimportLine[] = ((current.qatorlar || []) as T2Qator[]).map((row) => ({
      canonicalId: row.id, sourceKey: null, kod: row.kod ?? null, nom: row.nom ?? null,
      birlik: row.birlik ?? null, hajm: row.hajm ?? null, norma: row.norma ?? null, narx: row.narx ?? null,
    }));
    const after: SmetaReimportLine[] = smetaDaraxtniYoy(built.tree).map((row) => ({
      canonicalId: null, sourceKey: null, kod: row.kod, nom: row.nom, birlik: row.birlik,
      hajm: row.hajm, norma: row.norma, narx: row.narx,
    }));
    setReimportDiff(smetaQaytaImportDiff(before, after));
    setPhase('Qayta import diff tayyor — yozish bloklangan');
  }

  async function upload(file: File) {
    reset(); setBook(null); setBusy(true); setPhase('Fayl o‘qilmoqda');
    rawFile.current = file; sourceDocumentId.current = undefined;
    sourceOperationId.current = yangiOperationId(); importOperationId.current = yangiOperationId();
    const token = generation.current;
    try {
      if (file.size > MAX_FILE_BYTES) throw new Error(`Fayl ${MAX_FILE_BYTES / 1024 / 1024} MB dan katta.`);
      const workbook = await readXlsx(await file.arrayBuffer());
      if (generation.current !== token) return;
      setBook(workbook);

      // Har bir varaq mazmuniga qarab LRV/RES/e'tiborsiz deb taxmin
      // qilinadi -- birinchi LRV-ga o'xshagan varaq daraxt qurish uchun
      // tanlanadi, qolgan LRV-ga o'xshaganlari (bo'lsa) ehtiyot uchun
      // e'tiborsiz qoldiriladi (foydalanuvchi qo'lda qayta belgilay oladi).
      const teglar: Record<string, VaraqTegi> = {};
      const resUstunlari: Record<string, F2ColumnConfig> = {};
      let lrvTanlandi = '';
      for (const s of workbook.sheets) {
        const sheet = workbook.sheet(s.name);
        const taxmin = sheet ? varaqTuriTaxmin(sheet.rows) : 'nomalum';
        teglar[s.name] = taxmin === 'nomalum' ? 'etibor_bermaslik' : taxmin;
        if (taxmin === 'res' && sheet) resUstunlari[s.name] = f2UstunAniqla(sheet.rows);
      }
      for (const s of workbook.sheets) {
        if (teglar[s.name] !== 'lrv') continue;
        if (!lrvTanlandi) lrvTanlandi = s.name; else teglar[s.name] = 'etibor_bermaslik';
      }
      if (!lrvTanlandi) { lrvTanlandi = workbook.sheets[0]?.name || ''; teglar[lrvTanlandi] = 'lrv'; }
      setVaraqTeglari(teglar); setInFileResCols(resUstunlari);

      chooseSheet(workbook, lrvTanlandi); setPhase('Varaq va ustunlarni tekshiring');
      if ((objects.find((row) => row.id === Number(objectId))?.qator_soni ?? 0) > 0) {
        await reimportPreview(workbook, lrvTanlandi, token);
      }
    } catch { if (generation.current === token) setError('Fayl o‘qilmadi. XLSX faylni tekshiring.'); }
    finally { setBusy(false); }
  }

  async function sourceniR2gaYukla(file: File, objId: number): Promise<number> {
    if (sourceDocumentId.current != null) return sourceDocumentId.current;
    try {
      const buf = await file.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', buf);
      const sha256 = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
      const loyihaId = objects.find(o => o.id === objId)?.loyiha_id ?? null;
      const fd = new FormData();
      fd.append('fayl', file); fd.append('kompaniya_id', String(companyId));
      if (loyihaId != null) fd.append('loyiha_id', String(loyihaId));
      fd.append('obyekt_id', String(objId)); fd.append('turi', 'smeta');
      fd.append('operation_id', sourceOperationId.current || (sourceOperationId.current = yangiOperationId()));
      fd.append('sha256', sha256); fd.append('size', String(file.size));
      const r = await fetch('/api/hujjat-yukla', { method: 'POST', body: fd });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j: any = await r.json().catch(() => null);
      const documentId = j && j.ok ? Number(j.document_id) : NaN;
      if (!r.ok || !Number.isSafeInteger(documentId) || documentId <= 0) {
        throw new Error('Manba fayli kanonik R2 saqlashga qabul qilinmadi.');
      }
      sourceDocumentId.current = documentId;
      return documentId;
    } catch (e) {
      if (e instanceof Error && e.message === 'Manba fayli kanonik R2 saqlashga qabul qilinmadi.') throw e;
      throw new Error('Manba fayli kanonik R2 ga yuklanmadi. Import to‘xtatildi.');
    }
  }

  /** RES (resursniy vedomost) faylini o'qib, kod/nom/birlik/narx ustunlarini
   *  taxminan aniqlaydi -- LRV o'zi uchun ishlatilgan aynan shu detektor
   *  (f2UstunAniqla), lekin RES odatda tekis narx katalogi -- foydalanuvchi
   *  ustunlarni tasdiqlashi/tuzatishi kerak (LRV'dagi bilan bir xil naqsh). */
  async function uploadRes(file: File) {
    setResError(''); setResIndex(null); setResIndexSize(0); setResBusy(true);
    try {
      const workbook = await readXlsx(await file.arrayBuffer());
      setResBook(workbook);
      const name = workbook.sheets[0]?.name || '';
      setResSheetName(name);
      const sheet = workbook.sheet(name);
      setResCols(sheet ? f2UstunAniqla(sheet.rows) : null);
    } catch { setResError('RES fayli o‘qilmadi. XLSX faylni tekshiring.'); }
    finally { setResBusy(false); }
  }
  function chooseResSheet(workbook: XlsxWorkbook, name: string) {
    setResSheetName(name); setResIndex(null); setResIndexSize(0);
    const sheet = workbook.sheet(name);
    setResCols(sheet ? f2UstunAniqla(sheet.rows) : null);
  }
  /** Narx satrlarini BARCHA manbalardan yig'adi: (1) asosiy faylda RES deb
   *  belgilangan varaq(lar) -- ustunlar avtomatik aniqlanadi, (2) alohida
   *  yuklangan RES fayli (bor bo'lsa, ustunlari foydalanuvchi tuzatgan
   *  holda). Ikkalasi ham bo'lishi, faqat bittasi bo'lishi yoki hech biri
   *  bo'lmasligi mumkin -- owner: "bitta hujjat ichida ham lrv ham res
   *  sahifalari ham bo'lishi mumkin". */
  function resSatrlariBarchaManbadan(): ResNarxYozuv[] {
    const out: ResNarxYozuv[] = [];
    if (book) {
      for (const s of book.sheets) {
        if (varaqTeglari[s.name] !== 'res') continue;
        const sheet = book.sheet(s.name);
        if (!sheet) continue;
        out.push(...resSatrlariniOl(sheet.rows, inFileResCols[s.name] || f2UstunAniqla(sheet.rows)));
      }
    }
    if (resBook && resCols) {
      const sheet = resBook.sheet(resSheetName);
      if (sheet) out.push(...resSatrlariniOl(sheet.rows, resCols));
    }
    return out;
  }

  /**
   * RES narxlarini indekslaydi VA kategoriya registriga yoziladigan
   * nomzodlarni tayyorlaydi.
   *
   * Kategoriya endi RES faylining BO'LIM sarlavhasidan aniqlanadi
   * (resBolimKategoriya) -- ya'ni ОБ/КАБ/М-К endi «taxmin qilib
   * bo'lmaydigan» narsa emas. Registrga faqat serverning o'z zaxira
   * mantiqidan (t2_kat_birlik ~ katTaxmini) FARQ QILADIGAN qatorlar
   * yoziladi: server МАТ deb hisoblaydigan, aslida esa ОБ/КАБ/М-К
   * bo'lganlari. Boshqalarini yozish ortiqcha -- server o'zi to'g'ri
   * topadi.
   */
  function resNarxlarniUlash() {
    const satrlar = resSatrlariBarchaManbadan();
    if (!satrlar.length) return;
    setResIndex(resNarxIndeksiQur(satrlar));
    setResIndexSize(satrlar.length);
    const korilgan = new Set<string>();
    const kandidatlar: Array<{ nom: string; birlik: string; tanlangan: T2ResursKategoriya }> = [];
    for (const s of satrlar) {
      if (!s.nom || !s.birlik) continue;
      const serverTaxmini = katTaxmini(s.nom, s.birlik);
      const haqiqiy = s.kat ?? serverTaxmini;
      if (haqiqiy === serverTaxmini) continue; // server o'zi to'g'ri topadi
      const key = resKalit(s.nom) + '|' + resKalit(s.birlik);
      if (korilgan.has(key)) continue;
      korilgan.add(key);
      kandidatlar.push({ nom: s.nom, birlik: s.birlik, tanlangan: haqiqiy });
    }
    setKatKorib(kandidatlar);
  }

  /** Ro'yxatdagi kategoriyalarni registrga yozadi -- best-effort,
   *  muvaffaqiyatsizlik importni to'xtatmaydi.
   *
   *  ⚠️ Avval bu yerda `!== 'МАТ'` filtri bor edi. Endi ro'yxatning O'ZI
   *  faqat serverning zaxira mantiqidan farq qiladigan qatorlardan iborat
   *  (resNarxlarniUlash ga qarang), va ular orasida МАТ ham bo'lishi
   *  mumkin: masalan birligi «МАШ.-Ч» bo'lgani uchun server МАШ deydi,
   *  RES bo'limi esa МАТЕРИАЛЬНЫЕ РЕСУРСЫ. Shuning uchun filtr olib
   *  tashlandi -- aks holda aynan shunday tuzatishlar yo'qolardi. */
  async function katlarniSaqla() {
    if (!katKorib.length) return;
    setKatSaqlanmoqda(true);
    try {
      await Promise.all(katKorib.map(k =>
        sbT2ResursKategoriyaBelgila({ kompaniyaId: companyId, nom: k.nom, birlik: k.birlik, kategoriya: k.tanlangan }).catch(() => null)));
    } finally { setKatSaqlanmoqda(false); }
  }

  async function importQil() {
    if (!book || !cols || !objectId) return;
    setError(''); setResult(null); const token = generation.current; setBusy(true); setPhase('Import qilinmoqda');
    setImportQadamlari([]);
    const jonli = () => generation.current === token;
    /** Yangi qadam boshlanganini ko'rsatadi -- ro'yxatga qo'shiladi, holati "ishlamoqda". */
    const qadam = (nom: string) => { if (jonli()) setImportQadamlari(prev => [...prev, { kalit: String(prev.length), nom, holat: 'ishlamoqda' }]); };
    /** Hozir ishlayotgan qadamning tafsilotini yangilaydi (uni yakunlamasdan)
     *  -- bo'laklar yuborilayotganda «7/13 bo'lak» kabi jonli hisob uchun. */
    const tafsilotYangila = (tafsilot: string) => {
      if (!jonli()) return;
      setImportQadamlari(prev => {
        if (!prev.length) return prev;
        const c = prev.slice();
        c[c.length - 1] = { ...c[c.length - 1], tafsilot };
        return c;
      });
    };
    /** Oxirgi (hozir ishlayotgan) qadamni yakunlaydi -- muvaffaqiyat yoki xato, tafsilot bilan. */
    const yakunla = (holat: 'tayyor' | 'xato', tafsilot?: string) => {
      if (!jonli()) return;
      setImportQadamlari(prev => {
        if (!prev.length) return prev;
        const c = prev.slice();
        c[c.length - 1] = { ...c[c.length - 1], holat, tafsilot };
        return c;
      });
    };
    try {
      // Kategoriya tuzatishlar (agar bo'lsa) importdan OLDIN registrga
      // yoziladi -- shu import ham ulardan darhol foydalanishi uchun.
      if (katKorib.length) {
        qadam('Resurs kategoriyalari saqlanmoqda');
        await katlarniSaqla();
        yakunla('tayyor', katKorib.length + ' ta resurs turi registrga yozildi');
      }

      qadam('Fayl tuzilishi (bo‘lim/ish/resurs) qurilmoqda');
      const sheet = book.sheet(sheetName)!;
      const built = f2FaylOqiCore(sheet.rows, cols);
      if (!('tree' in built) || !built.tree.length) {
        yakunla('xato', 'daraxt bo‘sh chiqdi');
        throw new Error('Ustunlarni tekshiring — daraxt bo‘sh chiqdi.');
      }
      yakunla('tayyor', built.tree.length + ' ta bo‘lim topildi');

      // RES fayli ulangan bo'lsa: narxi YO'Q rs/mat/ob barglariga kod/nom+birlik
      // bo'yicha narx qo'llanadi. LRV faylida allaqachon narx bo'lgan qatorlar
      // ustidan YOZILMAYDI (narxlarniDaraxtgaQoll'ning o'zi shuni ta'minlaydi).
      let importTree = built.tree;
      if (resIndex) {
        qadam('RES narxlari LRV daraxtiga ulanmoqda');
        const qollangan = narxlarniDaraxtgaQoll(built.tree, resIndex);
        importTree = qollangan.tree;
        setNarxsizlar(qollangan.narxsizlar);
        yakunla('tayyor', qollangan.mosSoni + ' ta mos, ' + qollangan.mosEmasSoni + ' ta narxsiz qoldi');
      }

      if (!rawFile.current) throw new Error('Smeta manba fayli topilmadi. XLSX faylni qayta tanlang.');
      qadam('Manba fayl R2 saqlashga yuklanmoqda');
      const sourceDocumentId = await sourceniR2gaYukla(rawFile.current, Number(objectId));
      if (!jonli()) return;
      yakunla('tayyor', 'hujjat №' + sourceDocumentId);

      /* ══ BO'LAKLI IMPORT (T2-SMETA-IMPORT-50K-003) ══════════════════
         50 000 qatorli smeta bitta so'rovga sig'maydi (~10 MB JSON, va
         Pages Function izolyati 128 MB xotira bilan cheklangan). Shuning
         uchun daraxt SHU YERDA yoyiladi va bo'laklab yuboriladi: har
         so'rov kichik va tez, oxirida bitta «yakunla» hammasini birdan
         bazaga yozadi. Ota-bola aloqasi bo'lak chegarasidan o'tsa ham
         buziladigan joyi yo'q -- bog'lash yakunlashda, to'liq to'plam
         ustida bajariladi. */
      const flatRows = smetaDaraxtniYoy(importTree);
      const opId = importOperationId.current || (importOperationId.current = yangiOperationId());

      qadam('Import sessiyasi ochilmoqda');
      const bosh = await smetaSorov({
        amal: 'import_boshla', kompaniyaId: companyId, obyektId: Number(objectId),
        operationId: opId, sourceDocumentId,
      });
      if (!jonli()) return;
      if (!bosh.ok) {
        if (bosh.code === 'SMETA_ALREADY_EXISTS') {
          yakunla('xato', 'smeta allaqachon mavjud');
          throw new Error('Bu obyektda smeta allaqachon mavjud — ustidan yozilmaydi (xavfsizlik uchun).');
        }
        yakunla('xato', bosh.xato || bosh.code || 'noma’lum xato');
        throw new Error('Import boshlanmadi (' + (bosh.code || 'xato') + ')' + (bosh.xato ? ': ' + bosh.xato : '') + '.');
      }
      /* Allaqachon yakunlangan sessiya (masalan tarmoq uzilib, javob
         yetib kelmagan holat) -- ikkinchi smeta yaratilmaydi. */
      if (bosh.qator_soni != null && bosh.sessiya_id == null) {
        yakunla('tayyor', bosh.qator_soni + ' qator (avval yozilgan)');
        setResult({ qator_soni: bosh.qator_soni }); setPhase('Tayyor');
        onImportlandi?.();
        return;
      }
      const sessiyaId = Number(bosh.sessiya_id);
      yakunla('tayyor', 'sessiya №' + sessiyaId);

      const bolaklar = bolaklarga(flatRows, BOLAK_HAJMI);
      qadam(`Qatorlar yuborilmoqda (${flatRows.length} ta, ${bolaklar.length} bo‘lak)`);
      for (let i = 0; i < bolaklar.length; i++) {
        const b = await smetaSorov({
          amal: 'import_bolak', kompaniyaId: companyId, sessiyaId, bolak: i, qatorlar: bolaklar[i],
        });
        if (!jonli()) return;
        if (!b.ok) {
          yakunla('xato', `${i + 1}-bo‘lak: ` + (b.xato || b.code || 'noma’lum xato'));
          throw new Error('Bo‘lak yuborilmadi (' + (b.code || 'xato') + ').');
        }
        tafsilotYangila(`${i + 1}/${bolaklar.length} bo‘lak — ${b.jami ?? 0} qator qabul qilindi`);
      }
      yakunla('tayyor', `${bolaklar.length} bo‘lak, ${flatRows.length} qator qabul qilindi`);

      qadam('Kanonik bazaga yozilmoqda');
      const j = await smetaSorov({ amal: 'import_yakunla', kompaniyaId: companyId, sessiyaId });
      if (!jonli()) return;
      if (!j.ok) {
        if (j.code === 'SMETA_ALREADY_EXISTS') {
          yakunla('xato', 'smeta allaqachon mavjud');
          throw new Error('Bu obyektda smeta allaqachon mavjud — ustidan yozilmaydi (xavfsizlik uchun).');
        }
        yakunla('xato', j.xato || j.code || 'noma’lum xato');
        throw new Error('Import bajarilmadi (' + (j.code || 'xato') + ')' + (j.xato ? ': ' + j.xato : '') + '.');
      }
      yakunla('tayyor', (j.qator_soni || 0) + ' qator yozildi');
      setResult({ qator_soni: j.qator_soni || 0 }); setPhase('Tayyor');
      setObjects(prev => prev.map(o => o.id === Number(objectId) ? { ...o, qator_soni: j.qator_soni ?? o.qator_soni } : o));
      // Bu sahifa ko'pincha boshqa "asosiy" sahifa (masalan HolatNative)
      // ichida kichik panel sifatida ochiladi -- import muvaffaqiyatli
      // bo'lgach o'sha tashqi sahifa o'z daraxtini/summasini avtomatik
      // qayta yuklashi kerak, aks holda foydalanuvchi qo'lda "restart"
      // qilishga majbur bo'ladi (owner: shuni topib berdi).
      onImportlandi?.();
    } catch (e) {
      if (jonli()) {
        // Agar biror qadam "ishlamoqda" holatida to'xtab qolgan bo'lsa
        // (masalan kutilmagan istisno, yuqoridagi yakunla() chaqirilmagan
        // joyda) -- uni ham "xato" deb yakunlaymiz, osilib qolmasin.
        setImportQadamlari(prev => {
          if (!prev.length || prev[prev.length - 1].holat !== 'ishlamoqda') return prev;
          const c = prev.slice(); c[c.length - 1] = { ...c[c.length - 1], holat: 'xato' }; return c;
        });
        setError(e instanceof Error ? e.message : 'Import bajarilmadi.');
      }
    }
    finally { setBusy(false); }
  }

  const selectedObject = objects.find(o => o.id === Number(objectId));
  const alreadyHasSmeta = !!selectedObject?.qator_soni;

  return (
    <div className="space-y-3 p-1">
      {!fixedObjectId && <label className="block text-sm">Obyekt
        <select aria-label="Obyekt" className="ml-2 border rounded px-2 py-1"
          value={objectId} onChange={e => {
            setObjectId(e.target.value); workspace.setObjectId(e.target.value ? Number(e.target.value) : null); reset(); rawFile.current = null;
            sourceDocumentId.current = undefined; sourceOperationId.current = ''; importOperationId.current = '';
          }}>
          <option value="">Tanlang</option>
          {objects.map(o => <option key={o.id} value={o.id}>{o.nom}{o.qator_soni ? ` (${o.qator_soni} qator bor)` : ' (bo‘sh)'}</option>)}
        </select>
      </label>}
      {objectId && alreadyHasSmeta && (
        <div className="space-y-2">
          <p role="alert" className="text-warn text-sm">Bu obyektda allaqachon {selectedObject?.qator_soni} qatorlik smeta bor. Eski qatorlar o‘zgarmaydi; yangi fayl faqat non-destructive diff preview sifatida tekshiriladi.</p>
          <label className="block text-sm">Smeta yangi revisioni (preview)
            <input aria-label="Smeta revision fayli" type="file" accept=".xlsx,.xlsm,.xls" className="ml-2"
              onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
          </label>
          {reimportDiff && <section className="karta space-y-2 p-3 text-[13px]" aria-label="Smeta qayta import diff">
            <p className="font-semibold">Diff tayyor — hech qanday yozish bajarilmadi</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <span>O‘zgarmagan: <b>{reimportDiff.same.length}</b></span>
              <span>Qo‘shilgan: <b>{reimportDiff.added.length}</b></span>
              <span>Yo‘qolgan: <b className={reimportDiff.removed.length ? 'text-danger' : ''}>{reimportDiff.removed.length}</b></span>
              <span>Tarix candidate: <b>{reimportDiff.history.length}</b></span>
            </div>
            {reimportDiff.history.length > 0 && <ul className="list-disc space-y-1 pl-5 text-text-dim">
              {reimportDiff.history.slice(0, 8).map((row) => <li key={`${row.kind}:${row.identity}`}>{row.kind}: {row.reason}</li>)}
            </ul>}
            {reimportDiff.history.length > 8 && <p className="text-text-mute">Yana {reimportDiff.history.length - 8} ta candidate mavjud — operator review va yangi revision RPC talab qilinadi.</p>}
          </section>}
        </div>
      )}
      {objectId && !alreadyHasSmeta && (
        <label className="block text-sm">Smeta fayli (XLSX)
          <input aria-label="Smeta fayli" type="file" accept=".xlsx,.xlsm,.xls" className="ml-2"
          onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
        </label>
      )}
      {busy && importQadamlari.length === 0 && <p role="status">{phase}…</p>}
      {importQadamlari.length > 0 && <ImportQadamlarPaneli qadamlar={importQadamlari} />}
      {error && <p role="alert" className="text-danger">{error}</p>}
      {book && cols && !result && (
        <>
          {book.sheets.length > 1 && (
            <div className="karta p-3 space-y-1.5">
              <p className="text-[12px] font-semibold text-text">
                Varaqlar — har biri LRV yoki RES sifatida taxmin qilindi, kerak bo‘lsa tuzating
              </p>
              <p className="text-[11px] text-text-mute">
                Bitta faylda ham LRV (ish/hajm ierarxiyasi), ham RES (narx katalogi) varaqlari bo‘lishi mumkin.
                Aynan BITTA varaq LRV bo‘ladi (undan daraxt quriladi); RES belgilangan varaq(lar)ning narxlari
                birlashtirib qo‘llanadi.
              </p>
              <table className="w-full text-[12.5px]">
                <thead><tr className="text-text-mute text-left"><th className="font-normal pb-1">Varaq</th><th className="font-normal pb-1">LRV</th><th className="font-normal pb-1">RES</th></tr></thead>
                <tbody>
                  {book.sheets.map(s => (
                    <tr key={s.name} className="border-t border-border/40">
                      <td className="py-1 pr-2">{s.name}</td>
                      <td className="py-1 pr-2">
                        <input type="radio" name="lrv-varaq" aria-label={`${s.name} — LRV`}
                          checked={varaqTeglari[s.name] === 'lrv'}
                          onChange={() => varaqTegBelgila(book, s.name, 'lrv')} />
                      </td>
                      <td className="py-1">
                        <input type="checkbox" aria-label={`${s.name} — RES`}
                          checked={varaqTeglari[s.name] === 'res'}
                          onChange={e => varaqTegBelgila(book, s.name, e.target.checked ? 'res' : 'etibor_bermaslik')} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {book.sheets.filter(s => varaqTeglari[s.name] === 'res').map(s => {
                const c = inFileResCols[s.name];
                if (!c) return null;
                return (
                  <fieldset key={s.name} className="flex flex-wrap gap-3 items-end pt-1 border-t border-border/40">
                    <legend className="text-[11px] text-text-mute">«{s.name}» RES ustunlari (1 dan boshlab)</legend>
                    {(['kod', 'nom', 'bir', 'narx'] as const).map(k => (
                      <label key={k} className="text-[12px]">{k}
                        <input className="w-16 border rounded px-1 ml-1" type="number" min="1"
                          value={c[k] + 1}
                          onChange={e => { setResIndex(null); setResIndexSize(0); setInFileResCols(prev => ({ ...prev, [s.name]: { ...c, [k]: Number(e.target.value) - 1 } })); }} />
                      </label>
                    ))}
                  </fieldset>
                );
              })}
            </div>
          )}
          <div className="karta p-3 text-[12px] overflow-auto max-h-64">
            <table className="w-full">
              <tbody>
                {preview.slice(0, 12).map(row => (
                  <tr key={row.r} className="border-t border-border/60">
                    <td className="text-text-mute pr-2">{row.r}</td>
                    {row.cells.map((c, ci) => <td key={ci} className="px-1">{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="karta p-3 space-y-2">
            <p className="text-[12px] font-semibold text-text">
              Resurs vedomosti (RES) — narxlarni ulash (ixtiyoriy)
            </p>
            <p className="text-[11px] text-text-mute">
              Real smeta odatda 2 hujjat: LRV (ish/hajm — yuqorida) va RES (kod/nom/birlik bo‘yicha resurs narxlari).
              Agar RES yuqoridagi bir varaqqa BELGILANGAN bo‘lsa, alohida fayl shart emas — shu yerdagi tugma
              bilan ulang. Alohida RES fayli bo‘lsa, shu yerga ham yuklashingiz mumkin (ikkalasi ham birlashtiriladi).
              LRV faylida allaqachon narxi bor qatorlar ustidan yozilmaydi.
            </p>
            <label className="block text-sm">Alohida RES fayli (XLSX, ixtiyoriy)
              <input aria-label="RES fayli" type="file" accept=".xlsx,.xlsm,.xls" className="ml-2"
                onChange={e => { const f = e.target.files?.[0]; if (f) void uploadRes(f); }} />
            </label>
            {resBusy && <p role="status" className="text-[12px]">RES fayli o‘qilmoqda…</p>}
            {resError && <p role="alert" className="text-danger text-[12px]">{resError}</p>}
            {resBook && resCols && (
              <>
                {/* Owner (2026-09-10): "res ni yuklash vaqtida listlarini xuddi
                    lrv day boshlang'ich ko'rsata olishi kerak edi. hozir shu
                    yerda listni ko'rmay tavakkal belgilanayapdi" -- avval bu
                    yerda faqat varaq NOMLARI bo'lgan tanlov (select) turardi:
                    qaysi varaqda nima borligi ko'rinmasdi. Endi asosiy fayl
                    varaqlari kabi jadval: nomi, qator soni va tizim taxmini. */}
                <div className="karta p-2 space-y-1.5" data-testid="res-varaq-royxat">
                  <p className="text-[12px] font-semibold text-text">
                    RES faylining varaqlari — qaysi biridan narx o‘qilishini tanlang
                  </p>
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr className="text-text-mute text-left text-[11px]">
                        <th className="font-normal pb-1">Tanlash</th>
                        <th className="font-normal pb-1">Varaq</th>
                        <th className="font-normal pb-1">Qator</th>
                        <th className="font-normal pb-1">Tizim taxmini</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resBook.sheets.map(s => {
                        const taxmin = varaqTuriTaxmin(s.rows);
                        return (
                          <tr key={s.name} className="border-t border-border/40">
                            <td className="py-1 pr-2">
                              <input type="radio" name="res-varaq" aria-label={`${s.name} — RES varag‘i`}
                                checked={resSheetName === s.name}
                                onChange={() => chooseResSheet(resBook, s.name)} />
                            </td>
                            <td className="py-1 pr-2">{s.name}</td>
                            <td className="py-1 pr-2 text-text-mute">{s.rows.length}</td>
                            <td className="py-1">
                              {taxmin === 'res' ? <span className="text-success">RES (narx katalogi)</span>
                                : taxmin === 'lrv' ? <span className="text-warn">LRV (ish/hajm) — narx katalogi emas</span>
                                : <span className="text-text-mute">aniqlanmadi</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <fieldset className="flex flex-wrap gap-3 items-end">
                  <legend className="text-[11px] text-text-mute">Alohida RES fayl ustunlari (1 dan boshlab)</legend>
                  {(['kod', 'nom', 'bir', 'narx'] as const).map(k => (
                    <label key={k} className="text-[12px]">{k}
                      <input className="w-16 border rounded px-1 ml-1" type="number" min="1"
                        value={resCols[k] + 1}
                        onChange={e => { setResIndex(null); setResIndexSize(0); setResCols({ ...resCols, [k]: Number(e.target.value) - 1 }); }} />
                    </label>
                  ))}
                </fieldset>
              </>
            )}
            {(book?.sheets.some(s => varaqTeglari[s.name] === 'res') || (resBook && resCols)) && (
              <button type="button" className="tugma" onClick={resNarxlarniUlash}>Narxlarni ulash</button>
            )}
            {resIndex && (
              <p className="text-[12px] text-success">
                {resIndexSize} ta resurs narxi o‘qildi ({resIndex.byNomBir.size} ta nom+birlik bo‘yicha, shundan {resIndex.byKodNomBir.size} tasi kod bilan aniqlashtirilgan).
                Import bosilganda mos keluvchi narxsiz qatorlarga qo‘llanadi.
              </p>
            )}
            {katKorib.length > 0 && (
              <div className="karta p-2 space-y-1.5 border-amber-500/30">
                <p className="text-[11px] text-text-mute">
                  <b>{katKorib.length} ta</b> resursning turi aniqlandi. МАТ va ОБ farqi RES faylining
                  bo‘lim sarlavhasidan olinadi ({'«'}ОБОРУДОВАНИЕ{'»'}, {'«'}МАТЕРИАЛЬНЫЕ РЕСУРСЫ{'»'} …) —
                  buni birlikdan (шт, м2, компл) topib bo‘lmaydi. <b>М/К</b> esa alohida qoida bilan:
                  nomi tayyor konstruksiyani bildirsa <b>va</b> birligi og‘irlikda (кг/т) bo‘lsa —
                  shuning uchun armatura va prokat М/К ga tushmaydi, ular xomashyo. <b>КАБ</b> —
                  kabel/provod oilasi, nomi bo‘yicha. Noto‘g‘ri bo‘lsa shu yerda tuzating; belgilangan
                  tur registrga yozilib, keyingi importlarda ham eslab qolinadi.
                </p>
                <p className="text-[11px] text-text-mute">
                  {(['ЧЕЛ', 'МАШ', 'МАТ', 'ОБ', 'КАБ', 'М/К'] as const)
                    .map(k => ({ k, n: katKorib.filter(x => x.tanlangan === k).length }))
                    .filter(x => x.n > 0)
                    .map(x => `${x.k}: ${x.n}`).join(' · ')}
                </p>
                <div className="overflow-auto max-h-48 text-[12px]">
                  <table className="w-full">
                    <tbody>
                      {katKorib.slice(0, 300).map((k, i) => (
                        <tr key={k.nom + '|' + k.birlik} className="border-t border-border/40">
                          <td className="py-0.5 pr-2">{k.nom} <span className="text-text-mute">({k.birlik})</span></td>
                          <td className="py-0.5 text-right">
                            <select className="border rounded px-1 py-0.5" value={k.tanlangan}
                              aria-label={`${k.nom} kategoriyasi`}
                              onChange={e => setKatKorib(prev => prev.map((p, pi) => pi === i ? { ...p, tanlangan: e.target.value as T2ResursKategoriya } : p))}>
                              <option value="ЧЕЛ">ЧЕЛ</option>
                              <option value="МАШ">МАШ</option>
                              <option value="МАТ">МАТ</option>
                              <option value="ОБ">ОБ</option>
                              <option value="КАБ">КАБ</option>
                              <option value="М/К">М/К</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {katKorib.length > 300 && (
                  <p className="text-[11px] text-text-mute">
                    …va yana {katKorib.length - 300} ta (hammasi saqlanadi, ro‘yxatda faqat birinchi 300 tasi ko‘rsatilgan).
                  </p>
                )}
                {katSaqlanmoqda && <p role="status" className="text-[11px]">Kategoriyalar saqlanmoqda…</p>}
              </div>
            )}

            {/* Owner (2026-09-10): "narxlanmagan rs mat ob kabi har bir
                qatorlarni bildirishi va sababini keltirib bera olishi kerak" --
                avval faqat "N ta narxsiz qoldi" degan SON chiqardi. */}
            {narxsizlar.length > 0 && (
              <div className="karta p-2 space-y-1.5 border-danger/40" data-testid="narxsiz-royxat">
                <p className="text-[12px]">
                  <b className="text-danger">{narxsizlar.length} ta qator narxsiz qoldi.</b>{' '}
                  Bu qatorlar smetaga <b>narxsiz</b> yozildi — obyekt jami summasi shu qadar to‘liq emas.
                </p>
                <p className="text-[11px] text-text-mute">
                  {(Object.keys(NARXSIZ_SABAB_MATN) as NarxsizSabab[])
                    .map(s => ({ s, n: narxsizlar.filter(x => x.sabab === s).length }))
                    .filter(x => x.n > 0)
                    .map(x => `${NARXSIZ_SABAB_MATN[x.s]}: ${x.n} ta`)
                    .join(' · ')}
                </p>
                <div className="overflow-auto max-h-48 text-[12px]">
                  <table className="w-full">
                    <thead>
                      <tr className="text-text-mute text-[11px]">
                        <th className="text-left py-0.5 pr-2">Kod</th>
                        <th className="text-left py-0.5 pr-2">Nom</th>
                        <th className="text-left py-0.5 pr-2">Birlik</th>
                        <th className="text-left py-0.5">Nega narxsiz</th>
                      </tr>
                    </thead>
                    <tbody>
                      {narxsizlar.slice(0, 300).map((r, i) => (
                        <tr key={(r.uid || '') + i} className="border-t border-border/40">
                          <td className="py-0.5 pr-2 text-text-mute">{r.kod || '—'}</td>
                          <td className="py-0.5 pr-2">{r.nom || '(nomsiz)'}</td>
                          <td className="py-0.5 pr-2 text-text-mute">{r.bir || '—'}</td>
                          <td className="py-0.5">{NARXSIZ_SABAB_MATN[r.sabab]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {narxsizlar.length > 300 && (
                  <p className="text-[11px] text-text-mute">
                    …va yana {narxsizlar.length - 300} ta (ro‘yxatda birinchi 300 tasi ko‘rsatilgan).
                  </p>
                )}
              </div>
            )}
          </div>
          <button type="button" className="tugma tugma-asosiy" disabled={busy} onClick={() => void importQil()}>
            Ushbu ustunlar bilan import qilish
          </button>
        </>
      )}
      {result && (
        <p role="status" className="text-success">Tayyor: {result.qator_soni} qator canonical Supabase’ga yozildi.</p>
      )}
    </div>
  );
}

export default function SmetaYuklaNative({ obyektId, onImportlandi }: { obyektId?: number; onImportlandi?: () => void } = {}) {
  const { joriy, yuklanmoqda } = useKompaniya();
  if (yuklanmoqda) return <p>Kompaniya yuklanmoqda…</p>;
  if (!joriy?.id) return <p>Kompaniyani tanlang.</p>;
  return <Sessiya key={`${joriy.id}:${obyektId ?? 'all'}`} companyId={joriy.id} fixedObjectId={obyektId} onImportlandi={onImportlandi} />;
}
