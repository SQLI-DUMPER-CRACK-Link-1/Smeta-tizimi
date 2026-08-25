import { yozAmali } from './supabase';

export function sbTaklifYubor(email: string, rol: string) {
  return yozAmali({
    amal: 'taklif_yubor',
    email: email,
    rol: rol
  });
}

export function sbTaklifQabul(taklifId: number, kalit: string) {
  return yozAmali({
    amal: 'taklif_qabul',
    taklif_id: taklifId,
    kalit: kalit
  });
}
