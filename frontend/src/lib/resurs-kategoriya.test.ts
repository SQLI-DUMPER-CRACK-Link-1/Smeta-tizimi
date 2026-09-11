import { describe, expect, it } from 'vitest';
import {
  BEZSKLAD_ISTISNO_IBORALARI,
  BEZSKLAD_KATEGORIYA,
  BEZSKLAD_TAYANCH_TOKENS,
  classifyResursKategoriya,
  isBezskladResurs,
  normalizeResursNomi,
} from './resurs-kategoriya';

describe('classifyResursKategoriya', () => {
  it.each(['ВОДА', 'SUV', 'БЕТОН', 'BETON', 'РАСТВОР', 'RASTVOR'])(
    'classifies the confirmed name %s as БЕЗСКЛАД',
    (name) => {
      expect(classifyResursKategoriya(name)).toBe('БЕЗСКЛАД');
    },
  );

  it.each(['  вода  ', 'бетон-м300', 'РАСТВОР / ЦЕМЕНТНЫЙ', 'suv, питьевая'])('finds a confirmed token in a normalized resource name: %s', (name) => {
    expect(classifyResursKategoriya(name)).toBe('БЕЗСКЛАД');
  });

  it.each(['ｂｅｔｏｎ', 'БЕТО́Н', '　suv　'])('normalizes compatible Unicode forms before matching: %s', (name) => {
    expect(classifyResursKategoriya(name)).toBe('БЕЗСКЛАД');
  });

  it.each([
    'ПЕСОК',
    'QUM',
    'ЩЕБЕНЬ',
    'SHEBEN',
    'КВАРЦ',
    'KVARS',
    'ВОДНЫЙ',
    'ВОДОПРОВОД',
    'BETONNY',
    'РАСТВОРНЫЙ',
  ])('leaves non-matching or storable names outside БЕЗСКЛАД: %s', (name) => {
    expect(classifyResursKategoriya(name)).toBeNull();
  });

  it.each([
    'РАСТВОР СУХАЯ СМЕСЬ',
    'БЕТОН БЛОК',
    'БЕТОН-БЛОК',
    'БЕТОН КОЛЬЦО',
    'BETON HALQA',
    'СУХАЯ СМЕСЬ RASTVOR',
    'RASTVOR/СУХАЯ-СМЕСЬ',
    'DRY MORTAR MIX RASTVOR',
    'RASTVOR QURUQ QORISHMA',
    'БЕТОН КОЛЬЦА',
    'БЕТОННЫЕ БЛОКИ',
    'BETON BLOK',
    'BETON PLITA',
    'СУХИЕ СМЕСИ RASTVOR',
    'РАСТВОР СУХОЙ',
    'СУХОЙ РАСТВОР',
    'СУХАЯ СТРОИТЕЛЬНАЯ СМЕСЬ RASTVOR',
    'DRY MORTAR RASTVOR',
    'DRY MIX RASTVOR',
    'RASTVOR QURUQ ARALASHMA',
    'QURUQ QURILISH ARALASHMASI RASTVOR',
    'БЕТОН ПЛИТА',
    'БЕТОН ТРУБА',
    'БЕТОН ЛОТОК',
    'БЕТОН БОРДЮР',
    'БЕТОН СТОЛБ',
    'BETON TRUBA',
    'BETON LOTOK',
    'BETON BORDYUR',
    'TEMIR BETON',
  ])('does not classify an explicitly storable product: %s', (name) => {
    expect(classifyResursKategoriya(name)).toBeNull();
  });

  it.each([null, undefined, '', ' \t\n'])('fails closed for an empty resource name: %s', (name) => {
    expect(classifyResursKategoriya(name)).toBeNull();
  });
});

describe('normalizeResursNomi', () => {
  it('canonicalizes Unicode compatibility forms, case, marks, and whitespace', () => {
    expect(normalizeResursNomi('  ｂｅｔｏ́ｎ\u00a0 М300  ')).toBe('BETON М300');
  });
});

describe('public БЕЗСКЛАД contract', () => {
  it('exposes the category value and boolean predicate for integrations', () => {
    expect(BEZSKLAD_KATEGORIYA).toBe('БЕЗСКЛАД');
    expect(isBezskladResurs('suv')).toBe(true);
    expect(isBezskladResurs('QUM')).toBe(false);
  });

  it('exposes the conservative allowlist and exclusion phrases', () => {
    expect(BEZSKLAD_TAYANCH_TOKENS).toEqual(['ВОДА', 'SUV', 'БЕТОН', 'BETON', 'РАСТВОР', 'RASTVOR']);
    expect(BEZSKLAD_ISTISNO_IBORALARI).toEqual(expect.arrayContaining([
      'БЕТОН БЛОК',
      'БЕТОН КОЛЬЦО',
      'БЕТОННЫЙ БЛОК',
      'БЕТОННОЕ КОЛЬЦО',
      'БЕТОННЫЕ КОЛЬЦА',
      'БЕТОННЫЕ ПЛИТЫ',
      'БЕТОННЫЕ ТРУБЫ',
      'БЕТОННЫЕ ИЗДЕЛИЯ',
      'СУХАЯ СМЕСЬ',
      'СУХОЙ РАСТВОР',
      'СУХАЯ СТРОИТЕЛЬНАЯ СМЕСЬ',
      'QURUQ QORISHMA',
    ]));
  });
});
