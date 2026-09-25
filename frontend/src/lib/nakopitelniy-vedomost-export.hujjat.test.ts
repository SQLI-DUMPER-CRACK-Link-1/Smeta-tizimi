import { describe, expect, it } from 'vitest';
import type { NakopitelniyQator } from '../api/t2-nakopitelniy';
import { nakopitelniyJamilar, nakopitelniyVedomostHujjat, HujjatToliqEmasXato } from './nakopitelniy-vedomost-export';
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
  q({ tur: 'rs', kod: '1-100', nom: 'ЗАТРАТЫ ТРУДА РАБОЧИХ', birlik: 'чел.-ч', smeta_hajm: 200, smeta_narx: 5000, smeta_summa: 1_000_000, fakt_hajm: 120, oldingi_hajm: 60, oldingi_summa: 300_000, joriy_hajm: 40, joriy_summa: 200_000.5 }),
  q({ tur: 'mat', kod: 'С101', nom: 'ПЕСОК', birlik: 'м3', smeta_hajm: 50, smeta_narx: 12_000, smeta_summa: 600_000, fakt_hajm: 20, oldingi_hajm: 10, oldingi_summa: 120_000, joriy_hajm: 15, joriy_summa: 180_000 }),
  q({ tur: 'rz', nom: 'РАЗДЕЛ 2. БЕТОННЫЕ РАБОТЫ' }),
  q({ tur: 'bl', kod: 'Е06-01', nom: 'БЕТОНИРОВАНИЕ', birlik: 'м3', smeta_hajm: 10, oldingi_hajm: 0, joriy_hajm: 5 }),
  q({ tur: 'mat', kod: 'С401', nom: 'БЕТОН В25', birlik: 'м3', smeta_hajm: 10.2, smeta_narx: 900_000, smeta_summa: 9_180_000, fakt_hajm: 5, joriy_hajm: 5.1, joriy_summa: 4_590_000 }),
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
    expect(v.printArea).toMatch(/!\$A\$1:\$Q\$\d+$/);
    expect(v.printTitles).toBeTruthy();
    expect(imzoRollariBormi(t, ['ЗАКАЗЧИК', 'ПОДРЯДЧИК', 'СОСТАВИЛ']).yoq).toEqual([]);
    expect(t.matnlar).toEqual(expect.arrayContaining(['НАКОПИТЕЛЬНАЯ ВЕДОМОСТЬ ВЫПОЛНЕННЫХ РАБОТ', 'за отчетный период: сентябрь 2026 г. (учтены только утвержденные акты формы № 2)', 'ВСЕГО ПО ОБЪЕКТУ', 'ИТОГО ПО РАЗДЕЛУ: РАЗДЕЛ 1. ЗЕМЛЯНЫЕ РАБОТЫ']));
    // UI == Excel: ВСЕГО "с начала строительства" keshi = jamilar.jami.
    const vsego = v.kataklar.filter((k) => k.f?.startsWith('SUM(') && Number(k.v) === jamilar.jami);
    expect(vsego.length).toBeGreaterThan(0);
  });

  it('H7: smeta summasi noma‘lum — остаток va ВСЕГО smeta bo‘sh, ro‘yxatda', () => {
    const rows = ROWS.map((r) => (r.nom === 'ПЕСОК' ? { ...r, smeta_summa: null } : r));
    const { bytes, jamilar } = nakopitelniyVedomostHujjat(rows, { obyektNom: 'Объект', davr: '2026-09' });
    expect(jamilar.smeta).toBeNull();
    expect(jamilar.qoldiq).toBeNull();
    const t = hujjatTekshir(bytes);
    // ПЕСОК: smeta noma'lum + qabul qilingan > fakt; БЕТОН: qabul qilingan > fakt.
    expect(t.matnlar.some((s) => s.startsWith('ПОЗИЦИИ, ТРЕБУЮЩИЕ ВНИМАНИЯ (3)'))).toBe(true);
    expect(t.matnlar.some((s) => s.includes('нет объема или стоимости по смете'))).toBe(true);
    expect(t.taqiqlangan).toEqual([]);
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
