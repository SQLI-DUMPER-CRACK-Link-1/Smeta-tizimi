import { describe, expect, it } from 'vitest';
import { hujjatKorinishi } from './korinish';
import { ostatkaHujjatModeli, ostatkaHujjatXlsx } from '../ostatka-export';
import type { T2Qator, T2QatorHolat } from '../../api/supabase';

const q = (id: number, ota_id: number | null, tur: string, hajm: number | null, extra: Partial<T2Qator> = {}) => ({
  id, obyekt_id: 1, obyekt: 'X', kompaniya_id: 1, ota_id, daraja: 0, tartib: id, tur, kod: 'К' + id, nom: 'Позиция ' + id,
  birlik: 'м3', hajm, narx: 1000, summa: null, kat: 'МАТ', narx_usul: null, qoshimcha: false, zamena: false,
  d1: null, d2: null, d3: null, xom_qator: id, yangilandi: null, manba_id: null, versiya: 1, raqam: null, norma: null, ...extra,
} as T2Qator);
const h = (qator_id: number, fakt_hajm: number) => ({ qator_id, fakt_hajm } as unknown as T2QatorHolat);

describe('hujjatKorinishi — saytda hujjatdagiday', () => {
  it('sarlavha, raqamlash, bo‘lim, jami qatorlari; yashirin ustunlar ko‘rinmaydi; sonlar ru-RU', () => {
    const m = ostatkaHujjatModeli([q(1, null, 'rz', null, { nom: 'РАЗДЕЛ 1. ЗЕМЛЯНЫЕ РАБОТЫ' }), q(2, 1, 'bl', 10, { nom: 'ЗАСЫПКА' }), q(3, 2, 'mat', 20, { nom: 'ПЕСОК', narx: 1234.5 })], [h(2, 4), h(3, 8)]);
    const { bytes } = ostatkaHujjatXlsx(m, { obyektNomi: 'Объект', sana: '2026-09-25' });
    const [v] = hujjatKorinishi(bytes);
    expect(v.nom).toBe('Остаток работ');
    expect(v.raqamQatori).not.toBeNull();
    // Yashirin J (Н) va L (Кат.) ustunlari yo'q.
    expect(v.ustunlar.map((u) => u.c)).not.toContain(9);
    expect(v.ustunlar.map((u) => u.c)).not.toContain(11);
    const matn = v.qatorlar.flatMap((r) => r.kataklar.map((k) => k.matn));
    expect(matn).toContain('ВЕДОМОСТЬ ОСТАТКА РАБОТ');
    expect(v.qatorlar.find((r) => r.kataklar.some((k) => k.matn === 'РАЗДЕЛ 1. ЗЕМЛЯНЫЕ РАБОТЫ'))?.turi).toBe('bolim');
    expect(v.qatorlar.find((r) => r.kataklar.some((k) => k.matn === 'ВСЕГО ОСТАТОК РАБОТ ПО ОБЪЕКТУ'))?.turi).toBe('jami');
    const pesok = v.qatorlar.find((r) => r.kataklar.some((k) => k.matn === 'ПЕСОК'))!;
    expect(pesok.kataklar.some((k) => k.matn.replace(/\s/g, '') === '14814,00')).toBe(true);
    // Sarlavha birlashmasi — butun eni bo'ylab.
    const title = v.qatorlar.find((r) => r.kataklar.some((k) => k.matn === 'ВЕДОМОСТЬ ОСТАТКА РАБОТ'))!;
    expect(title.kataklar[0].span).toBe(v.ustunlar.length);
  });
});
