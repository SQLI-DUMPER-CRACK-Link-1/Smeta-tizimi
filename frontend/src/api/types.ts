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
  varaq?: string;
  row?: number;
  oylar?: Record<string, number>;
  children: TreeNode[];
};

export type PapkaObyekt = {
  obyekt: string;
  folderId: string;
  lokId: string;
  lokName: string;
  svodId: string;
  svodName: string;
  format: string;
  lokSheets: string[];
  svodSheets: string[];
};

export type BossObyekt = {
  nom: string;
  isGroup?: boolean;
  subItems?: BossObyekt[];
  smeta: number; smetaToza: number; fakt: number; f2: number;
  qoldiq: number; progress: number; f2pct: number; leaf: number;
};

export type BossJami = {
  smeta: number; smetaToza: number; fakt: number; f2: number;
  qoldiq: number; progress: number; f2pct: number; leaf: number;
  chel: number; mash: number; mat: number; ob: number;
  mk: number; kab: number; sub: number;
  tolangan: number; debitor: number; avans: number;
};

export interface BossData {
  objects: BossObyekt[];
  jami: BossJami;
  oylar: unknown[];
  sana: string;
}

export type Edit = {
  varaq: string;
  row: number;
  fakt?: number;
  oylar?: Record<string, number>;
};

export type BlQosh = {
  obyekt: string;
  varaq: string;
  afterRow: number;
  nom: string;
  kod?: string;
  birlik?: string;
  hajm: number;
  tur?: 'bl' | 'mat' | 'ob';
  zamena?: boolean;
  droppedOnRow?: number;
  f?: number;
};

export type RsQosh = {
  obyekt: string;
  varaq: string;
  blRow: number;
  nom: string;
  kod?: string;
  birlik?: string;
  narx?: number;
  norm?: number;
  kat?: string;
  f?: number;
};
