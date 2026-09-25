import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { T2Qator, T2QatorHolat } from '../../api/supabase';

const yarat = vi.fn(async () => ({ ozgarishId: 99 }));
const tasdiq = vi.fn(async () => ({ ok: true }));
vi.mock('../../api/t2-document-control', () => ({
  ostatkaIstisnoYarat: (...a: unknown[]) => (yarat as (...x: unknown[]) => unknown)(...a),
  ozgarishTasdiqla: (...a: unknown[]) => (tasdiq as (...x: unknown[]) => unknown)(...a),
  ozgarishQaytar: vi.fn(),
  ozgarishRoyxatOl: vi.fn(async () => ({ ok: true, ozgarishlar: [] })),
}));
vi.mock('../../api/supabase', () => ({ yangiOperationId: () => 'op-1' }));

import { OstatkaIstisnoPanel } from './OstatkaIstisnoPanel';

const q = (id: number, ota_id: number | null, tur: string, hajm: number, extra: Partial<T2Qator> = {}) => ({
  id, ota_id, tur, hajm, kod: 'К' + id, nom: 'Работа ' + id, birlik: 'м3', narx: 100, norma: null, ...extra,
} as unknown as T2Qator);
const h = (qator_id: number, fakt_hajm: number) => ({ qator_id, fakt_hajm } as unknown as T2QatorHolat);

describe('OstatkaIstisnoPanel', () => {
  it('ish (bl) tanlanadi: yangi hajm = fakt; normasiz resurs ham kiradi; sabab majburiy', async () => {
    const yangila = vi.fn(async () => []);
    render(<OstatkaIstisnoPanel obyektId={7} yangila={yangila} onSmetaOzgardi={() => undefined} royxat={[]}
      qatorlar={[q(1, null, 'bl', 10, { nom: 'КЛАДКА СТЕН' }), q(2, 1, 'rs', 20, { norma: 2 }), q(3, 1, 'mat', 5)]}
      holatlar={[h(1, 4), h(3, 1)]} />);
    fireEvent.change(screen.getByLabelText('Ishni qidirish'), { target: { value: 'кладка' } });
    fireEvent.click(screen.getByRole('button', { name: /КЛАДКА СТЕН/ }));
    const tugma = screen.getByRole('button', { name: 'Qoralama yaratish' });
    expect((tugma as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Sabab'), { target: { value: 'исключено заказчиком' } });
    fireEvent.click(tugma);
    await waitFor(() => expect(yarat).toHaveBeenCalledTimes(1));
    expect(yarat).toHaveBeenCalledWith({ obyektId: 7, qatorlar: [{ qatorId: 1, yangiHajm: 4 }, { qatorId: 3, yangiHajm: 1 }], sabab: 'исключено заказчиком', asos: null, operationId: 'op-1' });
    expect(yangila).toHaveBeenCalled();
  });

  it('qoralamani tasdiqlash — versiya bilan, keyin smeta qayta yuklanadi', async () => {
    const onSmeta = vi.fn();
    render(<OstatkaIstisnoPanel obyektId={7} yangila={async () => []} onSmetaOzgardi={onSmeta} qatorlar={[q(1, null, 'bl', 10)]} holatlar={[]}
      royxat={[{ id: 5, raqam: 'ИЗМ-1', tur: 'olib_tashlash', holat: 'qoralama', sabab: 'x', versiya: 3, qatorlar: [{ qator_id: 1, amal: 'olib_tashlash', eski_hajm: 10 }] }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tasdiqlash' }));
    await waitFor(() => expect(onSmeta).toHaveBeenCalled());
    expect(tasdiq).toHaveBeenCalledWith({ ozgarishId: 5, versiya: 3, operationId: 'op-1' });
  });
});
