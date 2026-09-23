import { describe, expect, it } from 'vitest';
import { IerarxiyaQuruvchi, sarlavhaYoli, sarlavhaniTahlilQil } from './ierarxiya';
import type { Sarlavha } from './turlar';

const M = { fayl: 'f', varaq: 'LRV', qator: 1 };

/** Qadamlar: 'S:<matn>' sarlavha, 'I' ish. Har sarlavha uchun lookahead avtomatik. */
function qur(qadamlar: string[]): { yol: (xom: string) => string[]; s: Sarlavha[] } {
  const iq = new IerarxiyaQuruvchi();
  qadamlar.forEach((q, i) => {
    if (q === 'I') { iq.ishKeldi(); return; }
    const keyingi = qadamlar[i + 1];
    iq.sarlavha(q.slice(2), { ...M, qator: i + 1 }, keyingi != null && keyingi !== 'I');
  });
  const s = iq.sarlavhalar;
  return {
    s,
    yol: (xom) => {
      const t = [...s].reverse().find((x) => x.xom === xom);
      if (!t) throw new Error(`sarlavha yo'q: ${xom}`);
      return sarlavhaYoli(s, t.id).map((x) => x.xom);
    },
  };
}

describe('sarlavha shakli', () => {
  it('kalit so\'z, raqam, harf, oddiy — matn o\'zgarmaydi', () => {
    expect(sarlavhaniTahlilQil('РАЗДЕЛ: СМЕТА № 01-01 НА КОНСТРУКТИВНАЯ ЧАСТЬ-ОЗЕРА')).toMatchObject({ tur: 'kalit', sarlavhaTuri: 'lokal' });
    expect(sarlavhaniTahlilQil('РАЗДЕЛ 1: ВНУТРЕННЯЯ ОТДЕЛКА')).toMatchObject({ sarlavhaTuri: 'razdel', belgi: 'РАЗДЕЛ 1' });
    expect(sarlavhaniTahlilQil('РАЗДЕЛ: КОЛОННА (ЛИСТ.-16)')).toMatchObject({ sarlavhaTuri: 'razdel', belgi: 'РАЗДЕЛ' });
    expect(sarlavhaniTahlilQil('3.2.УСТРОЙСТВО ОСТРОВКОВ')).toMatchObject({ tur: 'raqam', segs: [3, 2] });
    expect(sarlavhaniTahlilQil('В).УСТАНОВКА Ж/Б БЛОКОВ')).toMatchObject({ tur: 'harf', segs: [3] });
    expect(sarlavhaniTahlilQil('КМ-1')).toMatchObject({ tur: 'oddiy' });
  });
});

describe('RZ yo\'li — real korpus naqshlari', () => {
  it('ketma-ket sarlavhalar hammasi saqlanadi (ОЗЕРА → КАНАЛ 1 → КЖ)', () => {
    const { yol } = qur(['S:ОЗЕРА', 'S:КАНАЛ 1', 'S:КЖ', 'I']);
    expect(yol('КЖ')).toEqual(['ОЗЕРА', 'КАНАЛ 1', 'КЖ']);
  });

  it('Смета ЭО: oddiy → РАЗДЕЛ → oddiy; keyingi РАЗДЕЛ oddiy otaga qaytadi', () => {
    const { yol } = qur(['S:КЛ-0,4КВТ, СВЕТАФОР УЧАСТОК №1', 'S:РАЗДЕЛ 1. КЛ-0,4 КВТ', 'S:ЗЕМЛЯННЫЕ РАБОТЫ', 'I', 'S:РАЗДЕЛ 2. ПРОКЛАДКА КАБЕЛЯ', 'I']);
    expect(yol('ЗЕМЛЯННЫЕ РАБОТЫ')).toEqual(['КЛ-0,4КВТ, СВЕТАФОР УЧАСТОК №1', 'РАЗДЕЛ 1. КЛ-0,4 КВТ', 'ЗЕМЛЯННЫЕ РАБОТЫ']);
    expect(yol('РАЗДЕЛ 2. ПРОКЛАДКА КАБЕЛЯ')).toEqual(['КЛ-0,4КВТ, СВЕТАФОР УЧАСТОК №1', 'РАЗДЕЛ 2. ПРОКЛАДКА КАБЕЛЯ']);
  });

  it('ABC4 STR: СМЕТА № > РАЗДЕЛ > blok; yangi СМЕТА hammasini yopadi', () => {
    const { yol } = qur([
      'S:РАЗДЕЛ: СМЕТА № 01-01 НА КОНСТРУКТИВНАЯ ЧАСТЬ-ОЗЕРА', 'S:РАЗДЕЛ: КОЛОННА (ЛИСТ.-16)', 'S:КМ-1', 'I', 'S:КМ-2', 'I',
      'S:РАЗДЕЛ: СМЕТА № 01-04 НА КОЛОДЦЕВ (ПРОФИЛЬ К1)', 'S:РАЗДЕЛ: КОЛОДЕЦ (ЛИСТ .-39)', 'S:ЗЕМЛЯНЫЕ РАБОТЫ', 'I',
    ]);
    expect(yol('КМ-2')).toEqual(['РАЗДЕЛ: СМЕТА № 01-01 НА КОНСТРУКТИВНАЯ ЧАСТЬ-ОЗЕРА', 'РАЗДЕЛ: КОЛОННА (ЛИСТ.-16)', 'КМ-2']);
    expect(yol('ЗЕМЛЯНЫЕ РАБОТЫ')).toEqual(['РАЗДЕЛ: СМЕТА № 01-04 НА КОЛОДЦЕВ (ПРОФИЛЬ К1)', 'РАЗДЕЛ: КОЛОДЕЦ (ЛИСТ .-39)', 'ЗЕМЛЯНЫЕ РАБОТЫ']);
  });

  it('Faravon: raqam chuqurligi, qayta raqamlash, yetim 5.2., oradagi raqam yo\'q', () => {
    const { yol, s } = qur([
      'S:1.ВОДОООТВОД', 'S:1.1.УСТАНОВКА ЛОТКОВ', 'I',
      'S:3.ДОРОЖНАЯ ОДЕЖДА .', 'I', 'S:3.2.УСТРОЙСТВО ОСТРОВКОВ', 'S:1.ДОРОЖНАЯ ОДЕЖДА.', 'I',
      'S:4.ПРИМЫКАНИЯ.', 'S:4.1.УСТРОЙСТВО ПРИМЫКАНИЙ', 'S:1.УСТРОЙСТВО ЗЕМРАБОТЫ.', 'I', 'S:2.УСТРОЙСТВО ДОРОЖНОЙ ОДЕЖДЫ.', 'I',
      'S:5.2.УСТРОЙСТВО МЕТАЛЛИЧЕСКОЙ ТРУБЫ', 'I',
      'S:6.ТРОТУАРЫ', 'S:6.1.ЗЕМЛЯНЫЕ РАБОТЫ.', 'I',
    ]);
    expect(yol('1.1.УСТАНОВКА ЛОТКОВ')).toEqual(['1.ВОДОООТВОД', '1.1.УСТАНОВКА ЛОТКОВ']);
    expect(yol('1.ДОРОЖНАЯ ОДЕЖДА.')).toEqual(['3.ДОРОЖНАЯ ОДЕЖДА .', '3.2.УСТРОЙСТВО ОСТРОВКОВ', '1.ДОРОЖНАЯ ОДЕЖДА.']);
    expect(yol('2.УСТРОЙСТВО ДОРОЖНОЙ ОДЕЖДЫ.')).toEqual(['4.ПРИМЫКАНИЯ.', '4.1.УСТРОЙСТВО ПРИМЫКАНИЙ', '2.УСТРОЙСТВО ДОРОЖНОЙ ОДЕЖДЫ.']);
    expect(yol('5.2.УСТРОЙСТВО МЕТАЛЛИЧЕСКОЙ ТРУБЫ')).toEqual(['5.2.УСТРОЙСТВО МЕТАЛЛИЧЕСКОЙ ТРУБЫ']);
    expect(s.find((x) => x.xom.startsWith('5.2.'))!.dalil[0].ishonch).toBe('past');
    expect(yol('6.1.ЗЕМЛЯНЫЕ РАБОТЫ.')).toEqual(['6.ТРОТУАРЫ', '6.1.ЗЕМЛЯНЫЕ РАБОТЫ.']);
    expect(s.find((x) => x.xom === '6.ТРОТУАРЫ')!.dalil[0].ishonch).toBe('yuqori');
  });

  it('MAF: guruh sarlavhalari zinapoya bo\'lmaydi', () => {
    const { yol } = qur([
      'S:МАФ', 'S:СПОРТИВНОЕ ОБОРУДОВАНИЕ', 'S:ФУНДАМЕНТ -1(АСО-11)', 'I',
      'S:УЛИЧНЫЕ СПОРТИВНЫЕ КОМПЛЕКСЫ', 'S:ФУНДАМЕНТ -1(АСО-12)', 'I', 'S:ФУНДАМЕНТ -1(АСО-14)', 'I',
      'S:УЛИЧНЫЙ ТРЕНАЖЕР', 'S:ФУНДАМЕНТ -2(АСО-15)', 'I',
    ]);
    expect(yol('ФУНДАМЕНТ -1(АСО-14)')).toEqual(['МАФ', 'УЛИЧНЫЕ СПОРТИВНЫЕ КОМПЛЕКСЫ', 'ФУНДАМЕНТ -1(АСО-14)']);
    expect(yol('ФУНДАМЕНТ -2(АСО-15)')).toEqual(['МАФ', 'УЛИЧНЫЙ ТРЕНАЖЕР', 'ФУНДАМЕНТ -2(АСО-15)']);
  });

  it('hech bir sarlavha tashlab yuborilmaydi va matn aynan saqlanadi', () => {
    const matnlar = ['1.ВОДОООТВОД', '  1.1.УСТАНОВКА  ', 'РАЗДЕЛ: Х', 'Ё-ёлка'];
    const { s } = qur(matnlar.map((m) => 'S:' + m));
    expect(s.map((x) => x.xom)).toEqual(matnlar);
  });
});
