import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { HujjatKorinish } from './HujjatKorinish';
import { ostatkaHujjatModeli, ostatkaHujjatXlsx } from '../../lib/ostatka-export';
import type { T2Qator, T2QatorHolat } from '../../api/supabase';

const q = (id: number, ota_id: number | null, tur: string, hajm: number | null, extra: Partial<T2Qator> = {}) => ({
  id, ota_id, tartib: id, tur, kod: 'К' + id, nom: 'Позиция ' + id, birlik: 'м3', hajm, narx: 1000, kat: 'МАТ', ...extra,
} as unknown as T2Qator);
const h = (qator_id: number, fakt_hajm: number) => ({ qator_id, fakt_hajm } as unknown as T2QatorHolat);

describe('HujjatKorinish', () => {
  const m = ostatkaHujjatModeli([q(1, null, 'rz', null, { nom: 'РАЗДЕЛ 1' }), q(2, 1, 'bl', 10, { nom: 'ЗАСЫПКА' }), q(3, 2, 'mat', 20, { nom: 'ПЕСОК' }), q(4, 2, 'mat', 5, { nom: 'ЩЕБЕНЬ' })], [h(2, 4), h(3, 8), h(4, 1)]);
  const { bytes } = ostatkaHujjatXlsx(m, { obyektNomi: 'Объект', sana: '2026-09-25' });

  it('hujjat nomi, titul, jadval va jamilar ko‘rinadi; qidiruv va "faqat jamilar" filtri', () => {
    const onClose = vi.fn();
    render(<HujjatKorinish bytes={bytes} faylNomi="Объект_ОСТАТОК.xlsx" onClose={onClose} />);
    expect(screen.getByText('ВЕДОМОСТЬ ОСТАТКА РАБОТ')).toBeTruthy();
    expect(screen.getByText('Объект:')).toBeTruthy();
    expect(screen.getByText('ПЕСОК')).toBeTruthy();
    expect(screen.getByText('ВСЕГО ОСТАТОК РАБОТ ПО ОБЪЕКТУ')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Hujjatdan qidirish'), { target: { value: 'щебень' } });
    expect(screen.queryByText('ПЕСОК')).toBeNull();
    expect(screen.getByText('ЩЕБЕНЬ')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Hujjatdan qidirish'), { target: { value: '' } });
    fireEvent.click(screen.getByLabelText(/faqat bo‘lim va jamilar/));
    expect(screen.queryByText('ПЕСОК')).toBeNull();
    expect(screen.getByText('ВСЕГО ОСТАТОК РАБОТ ПО ОБЪЕКТУ')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Yopish'));
    expect(onClose).toHaveBeenCalled();
  });
});
