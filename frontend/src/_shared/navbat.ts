import { get, update } from 'idb-keyval';
import { gas } from '../api/client';

// Navbatdagi buyruq tuzilishi
export interface NavbatBuyrugi {
  id: string; // f2Uid yoki shunga o'xshash
  fn: string;
  args: any[];
  vaqt: number;
  holat: 'kutmoqda' | 'xato';
  xatoXabar?: string;
  orqaga?: any; // Undo uchun
}

const NAVBAT_KEY = 'smeta_offline_navbat';

export async function navbatgaQoshish(fn: string, args: any[], uid: string, orqaga?: any): Promise<void> {
  const buyruq: NavbatBuyrugi = {
    id: uid,
    fn,
    args,
    vaqt: Date.now(),
    holat: 'kutmoqda',
    orqaga
  };

  await update(NAVBAT_KEY, (val) => {
    const arr = (val as NavbatBuyrugi[]) || [];
    arr.push(buyruq);
    return arr;
  });

  // Darhol navbatni sinab ko'ramiz (agar internet bo'lsa)
  setTimeout(() => navbatniBajarish(), 100);
}

export async function navbatniOlish(): Promise<NavbatBuyrugi[]> {
  const arr = await get<NavbatBuyrugi[]>(NAVBAT_KEY);
  return arr || [];
}

let isProcessing = false;

export async function navbatniBajarish(): Promise<void> {
  if (isProcessing) return;
  if (!navigator.onLine) return; // Internet yo'q bo'lsa to'xtatamiz

  try {
    isProcessing = true;
    const navbat = await navbatniOlish();
    if (navbat.length === 0) return;

    const toRemove = new Set<string>();
    let ozgardi = false;

    for (let i = 0; i < navbat.length; i++) {
      const b = navbat[i];
      if (b.holat === 'xato' && Date.now() - b.vaqt < 60000) {
        // Agar xato bo'lgan bo'lsa, 1 minutgacha qayta urinmaymiz
        continue; 
      }

      try {
        await gas(b.fn, ...b.args);
        toRemove.add(b.id);
        ozgardi = true;
      } catch (err: any) {
        b.holat = 'xato';
        b.xatoXabar = err.message;
        b.vaqt = Date.now(); // oxirgi urinish vaqti
        ozgardi = true;
        break; // Tarmoq xatosi bo'lishi mumkin, qolganlarini to'xtatamiz
      }
    }

    if (ozgardi) {
      await update(NAVBAT_KEY, (val) => {
        let arr = (val as NavbatBuyrugi[]) || [];
        return arr.filter(b => !toRemove.has(b.id)).map(b => {
           const mem = navbat.find(m => m.id === b.id);
           return mem ? { ...b, holat: mem.holat, xatoXabar: mem.xatoXabar, vaqt: mem.vaqt } : b;
        });
      });
    }
  } finally {
    isProcessing = false;
  }
}

// Tarmoq tiklanganda navbatni ishga tushirish
window.addEventListener('online', () => navbatniBajarish());
