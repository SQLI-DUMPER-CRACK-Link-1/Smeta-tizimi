/**
 * t2-boss.ts — BOSS PANEL P0 canonical client.
 * Reads /api/boss-dashboard -> Supabase RPC t2_boss_dashboard_v1.
 * NO /api/gas, NO Drive, NO Sheets. Bounded single call.
 */
import { useQuery } from '@tanstack/react-query';

export type BossSignal = {
  id: number; severity: string | null; signal_type: string | null; title: string | null;
  entity_type: string | null; entity_id: number | null; detected_at: string | null; due_at: string | null;
};
export type BossLoyiha = {
  loyiha_id: number; nom: string; holat: string | null; hudud: string | null;
  byudjet: number | null; obyekt_soni: number; smeta_jami: number;
};
export type BossDashboard = {
  ok: true;
  generated_at: string;
  kompaniya: { kompaniya_id: number; nom: string; rol: string; obyekt_soni: number; loyiha_soni: number };
  loyihalar: BossLoyiha[];
  moliya: { jami_tolangan: number; jami_debitor: number; jami_xarajat: number; sof_natija: number; ulangan: boolean };
  f2: { jami: number; soni: number; tasdiqlangan: number; qoralama: number; oxirgi_oy: string | null };
  shartnoma: { soni: number; jami_summa: number; faol: number };
  signal: { ochiq_soni: number; kritik_soni: number; royxat: BossSignal[] };
  storage: { ulangan: boolean; izoh?: string; hujjat_soni?: number; canonical_stored?: number; drive_replica_failed?: number };
  ulanmagan_modullar: string[];
};

export async function bossDashboardOl(kompaniyaId: number): Promise<BossDashboard> {
  const r = await fetch('/api/boss-dashboard?kompaniya_id=' + Number(kompaniyaId));
  const j = await r.json();
  if (!r.ok || !j || j.ok !== true) {
    const err: any = new Error((j && (j.xato || j.code)) || ('HTTP ' + r.status));
    err.code = (j && j.code) || ('HTTP_' + r.status);
    throw err;
  }
  return j as BossDashboard;
}

export function useBossDashboard(kompaniyaId: number | null | undefined) {
  return useQuery({
    queryKey: ['bossDashboard', kompaniyaId],
    queryFn: () => bossDashboardOl(Number(kompaniyaId)),
    enabled: !!kompaniyaId,
    staleTime: 60 * 1000,
    retry: (n, e: any) => e?.code !== 'AUTH_REQUIRED' && e?.code !== 'COMPANY_NOT_FOUND' && n < 2,
  });
}
