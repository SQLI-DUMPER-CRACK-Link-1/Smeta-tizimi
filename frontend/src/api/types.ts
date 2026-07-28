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
  id: string;
  nom: string;
  url: string; // Spreadsheet URL
  subObyektlar?: ObyektInfo[];
};

export type DashboardKpi = {
  smetaJami: number;
  fakt: number;
  f2Olingan: number;
  qoldiq: number;
};

export type ObyektStats = {
  nom: string;
  smeta: number;
  fakt: number;
  foiz: number;
  holat: 'ok' | 'warn' | 'danger';
};

// Based on apiBossData response
export type BossData = {
  kpi: DashboardKpi;
  obyektlar: ObyektStats[];
};
