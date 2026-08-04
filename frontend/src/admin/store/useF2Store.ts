import { useSyncExternalStore } from 'react';
import type { AktNode, F2MoslashNatija, F2Moslik } from '../../api/types';

export interface F2State {
  obyekt: string;
  oyNom: string;
  lokalka: string;
  qadam: number;
  aktTree: AktNode[] | null;
  natija: F2MoslashNatija | null;
  yozishBoshlandi: boolean;
  fid: string;
  faylNomi: string;
  varaq: string;
  cfg: {kod:number;nom:number;bir:number;norma:number;obyom:number;narx:number;sum:number} | null;
  hover: string | null;
  filtr: 'hammasi' | 'boglanmagan' | 'boglangan';
  ochiqSignal: number;
  qolBekor: Set<string>;
  qolBog: Record<string, F2Moslik>;
  qolDop: Record<string, any>;
  dopModalUid: string | null;
  dropState: {aktKalit: string, smetaKalit: string, smetaRow: number, varaqNom: string} | null;
  smetaScrollTo: string | null;
}

const getInitialMonth = () => {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};

let state: F2State = {
  obyekt: '',
  oyNom: getInitialMonth(),
  lokalka: '',
  qadam: 0,
  aktTree: null,
  natija: null,
  yozishBoshlandi: false,
  fid: '',
  faylNomi: '',
  varaq: '',
  cfg: null,
  hover: null,
  filtr: 'hammasi',
  ochiqSignal: 0,
  qolBekor: new Set(),
  qolBog: {},
  qolDop: {},
  dopModalUid: null,
  dropState: null,
  smetaScrollTo: null,
};

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useF2Store() {
  const current = useSyncExternalStore(subscribe, () => state);
  
  const set = (partial: Partial<F2State> | ((prev: F2State) => Partial<F2State>)) => {
    const nextState = typeof partial === 'function' ? partial(state) : partial;
    state = { ...state, ...nextState };
    listeners.forEach(l => l());
  };
  
  return [current, set] as const;
}

export function resetF2Store() {
  state = {
    ...state,
    lokalka: '',
    qadam: 0,
    aktTree: null,
    natija: null,
    yozishBoshlandi: false,
    fid: '',
    faylNomi: '',
    varaq: '',
    cfg: null,
    hover: null,
    filtr: 'hammasi',
    ochiqSignal: 0,
    qolBekor: new Set(),
    qolBog: {},
    qolDop: {},
    dopModalUid: null,
    dropState: null,
    smetaScrollTo: null,
  };
  listeners.forEach(l => l());
}
