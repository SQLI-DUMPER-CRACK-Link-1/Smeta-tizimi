export type TreeNode = {
  uid: string;
  tip: 'rz' | 'bl' | 'rs' | 'mat' | 'ob';
  nom: string;
  kod: string;
  birlik: string;
  smeta: number;
  fakt: number;
  narx: number;
  summa?: number;
  qoldiq: number;
  f2ol: number;
  f2mum: number;
  qavat1?: string;
  qavat2?: string;
  qavat3?: string;
  zamena?: boolean;
  qoshimcha?: boolean;
  children: TreeNode[];
};

export type ObyektInfo = {
  nom: string;
  isGroup?: boolean;
  smeta: number;
  fakt: number;
  f2: number;
  qoldiq: number;
  progress: number;
  f2pct: number;
  subItems?: ObyektInfo[];
};

export interface BossData {
  objects: ObyektInfo[];
  jami: {
    smeta: number;
    fakt: number;
    f2: number;
    qoldiq: number;
    progress: number;
    f2pct: number;
  };
  oylar: any[];
  sana: string;
}
