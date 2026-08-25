import { yozAmali } from './supabase';

export function sbXatoYoz(xato: any) {
  return yozAmali({
    amal: 'xato_yoz',
    payload: xato
  });
}
