import { describe, expect, it } from 'vitest';
import type { NakopitelniyQator } from '../api/t2-nakopitelniy';
import { nakopitelniyJamilar, nakopitelniyVedomostHujjat, HujjatToliqEmasXato, NDS_SUKUT_FOIZ } from './nakopitelniy-vedomost-export';
import { yaxlit2 as yaxlit } from './hujjat-yozuvchi';
import { f2AktHujjat } from './f2-akt-tn-export';
import { hujjatTekshir, imzoRollariBormi } from './hujjat-yozuvchi';
import { namunaSaqla } from './hujjat-yozuvchi/test-yordam';

let seq = 0;
function q(p: Partial<NakopitelniyQator> & { tur: NakopitelniyQator['tur'] }): NakopitelniyQator {
  seq++;
  return {
    qator_id: seq, tartib: seq, kod: null, nom: null, birlik: null, kat: null, qoshimcha: false, zamena: false,
    smeta_hajm: null, smeta_narx: null, smeta_summa: null, fakt_hajm: 0, fakt_summa: 0,
    oldingi_hajm: 0, oldingi_summa: 0, joriy_hajm: 0, joriy_summa: 0, joriy_qoralama_summa: 0,
    jami_hajm: 0, jami_summa: 0, f2_mumkin_hajm: 0, qoldiq_hajm: 0, qoldiq_summa: 0,
    jami_baseline_summa: 0, jami_actual_summa: null, narx_variance_summa: 0, bajarilish_foiz: null, ...p,
  };
}

// bl va rz qatorlarining o'z summasi (t2_qator.summa) — bolalar takrori; hujjat ularni qo'shmaydi.
const ROWS: NakopitelniyQator[] = [
  q({ tur: 'rz', nom: 'РАЗДЕЛ 1. ЗЕМЛЯНЫЕ РАБОТЫ', smeta_summa: 1_600_000 }),
  q({ tur: 'bl', kod: 'Е01-01', nom: 'РАЗРАБОТКА ГРУНТА', birlik: 'м3', smeta_hajm: 100, smeta_summa: 1_600_000, fakt_hajm: 60, oldingi_hajm: 30, joriy_hajm: 20 }),
  q({ tur: 'rs', kat: 'ЧЕЛ', kod: '1-100', nom: 'ЗАТРАТЫ ТРУДА РАБОЧИХ', birlik: 'чел.-ч', smeta_hajm: 200, smeta_narx: 5000, smeta_summa: 1_000_000, fakt_hajm: 120, oldingi_hajm: 60, oldingi_summa: 300_000, joriy_hajm: 40, joriy_summa: 200_000.5 }),
  q({ tur: 'mat', kat: 'МАТ', kod: 'С101', nom: 'ПЕСОК', birlik: 'м3', smeta_hajm: 50, smeta_narx: 12_000, smeta_summa: 600_000, fakt_hajm: 20, oldingi_hajm: 10, oldingi_summa: 120_000, joriy_hajm: 15, joriy_summa: 180_000 }),
  q({ tur: 'rz', nom: 'РАЗДЕЛ 2. БЕТОННЫЕ РАБОТЫ' }),
  q({ tur: 'bl', kod: 'Е06-01', nom: 'БЕТОНИРОВАНИЕ', birlik: 'м3', smeta_hajm: 10, oldingi_hajm: 0, joriy_hajm: 5 }),
  q({ tur: 'mat', kat: 'МАТ', kod: 'С401', nom: 'БЕТОН В25', birlik: 'м3', smeta_hajm: 10.2, smeta_narx: 900_000, smeta_summa: 9_180_000, fakt_hajm: 5, joriy_hajm: 5.1, joriy_summa: 4_590_000 }),
];

describe('Накопительная ведомость — hujjat standarti', () => {
  it('jamilar faqat barglardan (bl/rz summasi ikki marta sanalmaydi)', () => {
    const j = nakopitelniyJamilar(ROWS);
    expect(j).toEqual({ smeta: 10_780_000, oldingi: 420_000, joriy: 4_970_000.5, jami: 5_390_000.5, qoldiq: 5_389_999.5 });
  });

  it('H2–H9: rasmiy shakl, formulalar $ siz, kesh bor, imzo, chop, fayl nomi', () => {
    const { bytes, faylNomi, jamilar } = nakopitelniyVedomostHujjat(ROWS, { obyektNom: 'Сунъий кўл', davr: '2026-09-01', imzo: { zakazchik: 'Дирекция' } });
    namunaSaqla('nakopitelniy.xlsx', bytes);
    expect(faylNomi).toBe('Сунъий кўл_НАКОПИТЕЛЬНАЯ_ВЕДОМОСТЬ_2026-09.xlsx');
    // Obyekt nomi — saytdagi egasining matni (o'zbekcha bo'lishi mumkin, H9 istisno).
    const t = hujjatTekshir(bytes, { ruxsat: [/^Сунъий кўл$/] });
    expect(t.taqiqlangan).toEqual([]);
    expect(t.dollarFormulalar).toEqual([]);
    expect(t.keshsizFormulalar).toEqual([]);
    expect(t.fullCalcOnLoad).toBe(true);
    const v = t.varaqlar[0];
    expect(v.a4 && v.bittaEnli && v.yonalish === 'landscape').toBe(true);
    expect(v.printArea).toMatch(/!\$A\$1:\$S\$\d+$/);
    expect(v.printTitles).toBeTruthy();
    expect(imzoRollariBormi(t, ['ЗАКАЗЧИК', 'ПОДРЯДЧИК', 'СОСТАВИЛ']).yoq).toEqual([]);
    expect(t.matnlar).toEqual(expect.arrayContaining(['НАКОПИТЕЛЬНАЯ ВЕДОМОСТЬ ВЫПОЛНЕННЫХ РАБОТ', 'за отчетный период: сентябрь 2026 г. (учтены только утвержденные акты формы № 2)', 'ВСЕГО ПО ОБЪЕКТУ', 'ИТОГО ПО РАЗДЕЛУ: РАЗДЕЛ 1. ЗЕМЛЯНЫЕ РАБОТЫ']));
    // UI == Excel: ВСЕГО "с начала строительства" keshi = jamilar.jami.
    const vsego = v.kataklar.filter((k) => k.f?.includes('SUMIF(U') && Number(k.v) === jamilar.jami);
    expect(vsego.length).toBeGreaterThan(0);
  });

  it('H7: smeta summasi noma‘lum — остаток va ВСЕГО smeta bo‘sh, ro‘yxatda', () => {
    const rows = ROWS.map((r) => (r.nom === 'ПЕСОК' ? { ...r, smeta_summa: null } : r));
    const { bytes, jamilar } = nakopitelniyVedomostHujjat(rows, { obyektNom: 'Объект', davr: '2026-09' });
    expect(jamilar.smeta).toBeNull();
    expect(jamilar.qoldiq).toBeNull();
    const t = hujjatTekshir(bytes);
    // ПЕСОК: smeta noma'lum + qabul qilingan > fakt; БЕТОН: qabul qilingan > fakt.
    // + nakrutka foizlari berilmagan (4-band)
    expect(t.matnlar.some((s) => s.startsWith('ПОЗИЦИИ, ТРЕБУЮЩИЕ ВНИМАНИЯ (4)'))).toBe(true);
    expect(t.matnlar.some((s) => s.includes('нет объема или стоимости по смете'))).toBe(true);
    expect(t.taqiqlangan).toEqual([]);
  });

  it('ikki narx: to‘g‘ri xarajat va к оплате (Kf × summa), nakrutka podvali kaskadi, НДС ichida', () => {
    expect(NDS_SUKUT_FOIZ).toBe(12);
    // Amfiteatr (kompaniya 1) foizlari.
    const nakrutka = { ТРАНСПОРТ_МАТЕРИАЛ: 5, СКЛАДСКИЕ_МАТЕРИАЛ: 2, СКЛАДСКИЕ_МК: 0.75, ТРАНСПОРТ_КАБЕЛЬ: 1.5, ПРОЧИЕ_ПОДРЯДЧИК: 18, ТРАНСПОРТ_ОБОРУД: 2, ЗАГОТ_СКЛАД_ОБОРУД: 1.2, СТРАХОВАНИЕ: 0.32, РИСК: 0, НДС: 12 };
    const smetaNakrutka = { pryamye: 43_596_859_620.62, itogo4: 50_556_791_619.97, nds: 6_066_814_994.4, nds_foiz: 12, vsego: 56_623_606_614.37 };
    const r = nakopitelniyVedomostHujjat(ROWS, { obyektNom: 'Объект', davr: '2026-09', ndsFoiz: 12, nakrutka, smetaNakrutka });
    namunaSaqla('nakopitelniy_nds.xlsx', r.bytes);
    const t = hujjatTekshir(r.bytes);
    expect(t.taqiqlangan).toEqual([]);
    expect(t.dollarFormulalar).toEqual([]);
    expect(t.keshsizFormulalar).toEqual([]);
    expect(t.matnlar).toEqual(expect.arrayContaining(['К ОПЛАТЕ (с накладными расходами и НДС)', 'ВСЕГО К ОПЛАТЕ (с накладными расходами и НДС)', 'ПРЯМЫЕ ЗАТРАТЫ — ВСЕГО', 'ИТОГО-4 (без НДС)']));
    // Kaskad (за период, L): ЧЕЛ 200 000,50; МАТ 180 000 + 4 590 000.
    const L = r.kaskad!.L;
    expect(L.pryamye).toBe(4_970_000.5);
    expect(L.vsego).toBeGreaterThan(L.pryamye);
    // Qator к оплате yig'indisi podval ВСЕГО bilan teng (faqat yaxlitlash farqi).
    expect(Math.abs((r.kOplata.davr ?? 0) - L.vsego)).toBeLessThan(0.05);
    expect(Math.abs((r.kOplata.jami ?? 0) - r.kaskad!.N.vsego)).toBeLessThan(0.05);
    const k = t.varaqlar[0].kataklar;
    // Qator formulasi: ROUND(L×Kf) — Kf katagi foiz kataklaridan formula.
    expect(k.some((c) => /^ROUND\(L\d+\*F\d+,2\)$/.test(c.f ?? ''))).toBe(true);
    expect(k.some((c) => /^\(1\+F\d+\/100\)\*\(1\+F\d+\/100\+F\d+\/100\)\*\(1\+F\d+\/100\)$/.test(c.f ?? ''))).toBe(true);
    expect(k.some((c) => /^SUMIF\(T\d+:T\d+,"МАТ",L\d+:L\d+\)$/.test(c.f ?? ''))).toBe(true);
  });

  it('nakrutka foizlari berilmasa — 0 %, к оплате = прямые + НДС, hujjatda aytiladi', () => {
    const r = nakopitelniyVedomostHujjat(ROWS, { obyektNom: 'Объект', davr: '2026-09', ndsFoiz: 12 });
    const t = hujjatTekshir(r.bytes);
    expect(r.kaskad!.L.vsego).toBe(yaxlit(4_970_000.5 * 1.12));
    expect(t.matnlar.some((m) => m.includes('Проценты накладных и прочих расходов') && m.includes('не заданы'))).toBe(true);
  });

  it('qirqilgan ro‘yxatdan hujjat yasalmaydi (chala hujjat — rasmiy emas)', () => {
    expect(() => nakopitelniyVedomostHujjat(ROWS, { obyektNom: 'X', davr: '2026-09', truncated: true })).toThrow(HujjatToliqEmasXato);
    expect(() => f2AktHujjat(ROWS, { obyektNom: 'X', davr: '2026-09', truncated: true })).toThrow(HujjatToliqEmasXato);
  });
});

describe('АКТ Ф-2 — hujjat standarti', () => {
  it('НДС stavkasi bilan: ВСЕГО, НДС, ВСЕГО С НДС formulalari va keshi', () => {
    const r = f2AktHujjat(ROWS, { obyektNom: 'Сунъий кўл', davr: '2026-09-01', ndsFoiz: 12, shartnoma: '№ 15/2026 от 01.02.2026', sana: '2026-09-30' });
    namunaSaqla('f2_akt_nds.xlsx', r.bytes);
    expect(r.jamiSumma).toBe(4_970_000.5);
    expect(r.ndsSumma).toBe(596_400.06);
    expect(r.jamiNds).toBeCloseTo(5_566_400.56, 6);
    expect(r.faylNomi).toBe('Сунъий кўл_АКТ_Ф-2_2026-09.xlsx');
    const t = hujjatTekshir(r.bytes, { ruxsat: [/^Сунъий кўл$/] });
    expect(t.taqiqlangan).toEqual([]);
    expect(t.dollarFormulalar).toEqual([]);
    expect(t.keshsizFormulalar).toEqual([]);
    expect(imzoRollariBormi(t, ['ЗАКАЗЧИК', 'ПОДРЯДЧИК', 'ТЕХНАДЗОР']).yoq).toEqual([]);
    expect(t.matnlar).toEqual(expect.arrayContaining(['АКТ ПРИЕМКИ ВЫПОЛНЕННЫХ РАБОТ (ФОРМА № 2)', 'НДС 12%', 'ВСЕГО ПО АКТУ С НДС', '№ 15/2026 от 01.02.2026', '30.09.2026']));
    const v = t.varaqlar[0];
    expect(v.a4 && v.bittaEnli && v.yonalish === 'portrait').toBe(true);
    expect(v.kataklar.some((k) => k.f?.startsWith('ROUND(H') && Number(k.v) === 596_400.06)).toBe(true);
  });

  it('НДС stavkasi ko‘rsatilmagan: НДС va ВСЕГО С НДС bo‘sh, ogohlantirish hujjatda', () => {
    const r = f2AktHujjat(ROWS, { obyektNom: 'Объект', davr: '2026-09' });
    namunaSaqla('f2_akt_ndssiz.xlsx', r.bytes);
    expect(r.ndsSumma).toBeNull();
    const t = hujjatTekshir(r.bytes);
    expect(t.matnlar).toContain('НДС (ставка не указана)');
    expect(t.matnlar.some((s) => s.includes('ставка НДС не указана'))).toBe(true);
    expect(t.taqiqlangan).toEqual([]);
  });
});
