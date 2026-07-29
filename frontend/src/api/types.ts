export type TreeNode = {
  type: 'rz' | 'bl' | 'rs' | 'mat' | 'ob';
  nom: string;
  varaq: string;
  row: number;
  kat?: string;
  kod?: string;
  birlik?: string;
  smetaHajm: number;   // HAJM
  smeta: number;       // PUL
  narx: number;
  fakt: number;
  qoldiq: number;
  f2ol: number;
  f2mum: number;
  stFakt?: number; stF2?: number; stOst?: number;
  oylar?: Record<string, number>;
  isQosh?: boolean;
  isZamena?: boolean;
  d1?: string; d2?: string; d3?: string;
  children?: TreeNode[];
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
  f2Uid?: string;
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
  f2Uid?: string;
};

/* ---------- Shartnoma (80_Shartnoma.js → apiShartnomaOl) ---------- */
export type Shartnoma = {
  no: string;
  nomi: string;
  taraf: string;
  summa: number;
  nds: number;
  jami: number;
  holat: string;
  izoh: string;
  chelCh: number;
};

/* ---------- Sklad (86_Sklad.js → apiSkladQoldiq) ---------- */
export type SkladMaterial = {
  nom: string;
  birlik: string;
  kirim: number;
  chiqim: number;
  qoldiq: number;
};

export type SkladQoldiq = {
  ok: boolean;
  materiallar: SkladMaterial[];
  jami: number;
  xabar?: string;
};

/* ---------- Monitoring (79_WebAPI.js → apiWebApiLog) ---------- */
export type ApiLogYozuv = {
  t: string;    // ISO vaqt
  fn: string;   // funksiya nomi
  h: string;    // 'OK' | 'XATO' | 'AUTH_FAIL' | 'RUXSAT_YOQ'
  ms: number;
};
