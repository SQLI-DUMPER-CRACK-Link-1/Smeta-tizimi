import { yozAmali } from './supabase';

export function sbKirishTekshir(kalit: string) {
  return yozAmali({
    amal: 'kirish_amal',
    harakat: 'tekshir',
    kalit: kalit
  });
}
