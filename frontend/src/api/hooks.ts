import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gas } from './client';
import { navbatgaQoshish } from '../_shared/navbat';
import { yangiUid } from '../_shared/idempotent';
import type {
  BossData, TreeNode, PapkaObyekt, Edit, BlQosh, RsQosh,
  Shartnoma, SkladQoldiq, ApiLogYozuv, Tolov,
  AktNode, F2Moslik, F2MoslashNatija, F2JobHolat, NarxlarJavob, DarajaQator,
} from './types';

export function useObyektlar() {
  return useQuery({
    queryKey: ['obyektlar'],
    queryFn: () => gas<PapkaObyekt[]>('apiPapkaSkan'),
    staleTime: 10 * 60 * 1000, // 10 minutes cache as requested
  });
}

export function useBossData() {
  return useQuery({
    queryKey: ['bossData'],
    queryFn: () => gas<BossData>('apiBossData'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useHolat(obyekt: string, forceRefresh: boolean = false) {
  return useQuery({
    queryKey: ['holat', obyekt, forceRefresh],
    queryFn: () => gas<{ tree: TreeNode[], lokalkalar: string[] }>('apiHolatOl', obyekt, forceRefresh),
    staleTime: Infinity, // Extremely heavy, don't refetch unless forced
    enabled: !!obyekt,
  });
}

// Phase 2: Locking hooks
export function useLockStatus(obyekt: string) {
  return useQuery({
    queryKey: ['lock', obyekt],
    queryFn: () => gas<{ status: string, user?: string }>('apiLockOl', obyekt),
    enabled: !!obyekt,
  });
}

export function useLockAcquire() {
  return useMutation({
    mutationFn: ({ obyekt, reason }: { obyekt: string, reason: string }) => gas('apiLockBos', obyekt, reason),
  });
}

export function useLockRelease() {
  return useMutation({
    mutationFn: ({ obyekt, reason }: { obyekt: string, reason: string }) => gas('apiLockOch', obyekt, reason),
  });
}

// Phase 2: Edit mutations
export function useHolatSaqla(obyekt: string) {
  const qc = useQueryClient();
  
  return useMutation({
    mutationFn: async (edits: Edit[]) => {
      // Navbatga qo'shamiz (Faza 3 offline qatlam)
      const oldingi = qc.getQueryData<{ tree: TreeNode[], lokalkalar: string[] }>(['holat', obyekt, false]);
      
      const orqaga = edits.map(e => {
        let eskiFakt: number | undefined;
        const qidir = (nodes: TreeNode[]) => {
          for (const n of nodes) {
            if (n.varaq === e.varaq && n.row === e.row) {
              eskiFakt = n.fakt;
              return;
            }
            if (n.children) qidir(n.children);
          }
        };
        if (oldingi?.tree) qidir(oldingi.tree);
        return { ...e, fakt: eskiFakt }; 
      });

      const f2Uid = edits[0]?.varaq || 'saqlash'; 
      await navbatgaQoshish('apiHolatSaqla', [obyekt, edits], f2Uid + Date.now(), orqaga);
      return { jami: edits.length, qatorlar: edits.length };
    },
    onMutate: async (edits) => {
      await qc.cancelQueries({ queryKey: ['holat', obyekt] });
      const oldingi = qc.getQueryData<{ tree: TreeNode[], lokalkalar: string[] }>(['holat', obyekt, false]);
      
      // Optimistik UI
      if (oldingi && oldingi.tree) {
        const newTree = JSON.parse(JSON.stringify(oldingi.tree));
        
        const updateTree = (nodes: TreeNode[]) => {
          for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const edit = edits.find(e => e.varaq === node.varaq && e.row === node.row);
            if (edit && edit.fakt !== undefined) {
              node.fakt = edit.fakt;
            }
            if (node.children) {
              updateTree(node.children);
            }
          }
        };
        
        updateTree(newTree);
        qc.setQueryData(['holat', obyekt, false], { ...oldingi, tree: newTree });
      }
      
      return { oldingi };
    },
    onError: (_xato, _v, ctx) => {
      qc.setQueryData(['holat', obyekt, false], ctx?.oldingi);
    },
    onSettled: () => {
      // Invalidate but don't block the UI, it will happen in background
      qc.invalidateQueries({ queryKey: ['holat', obyekt] });
    },
  });
}

export function useBlQosh() {
  return useMutation({
    mutationFn: (params: BlQosh) => {
      const payload = { ...params, f2Uid: params.f2Uid || yangiUid() };
      return gas<number>('apiBlQosh', payload);
    }
  });
}

export function useRsQosh() {
  return useMutation({
    mutationFn: (params: RsQosh) => {
      const payload = { ...params, f2Uid: params.f2Uid || yangiUid() };
      return gas<number>('apiRsQosh', payload);
    }
  });
}

export function useOyQosh() {
  return useMutation({
    mutationFn: ({ obyekt, oyNom }: { obyekt: string, oyNom: string }) => gas<string>('apiOyQosh', obyekt, oyNom)
  });
}

// Panel.html dan import qilingan funksiyalar (Shartnomalar, To'lovlar, Qo'shimcha ishlar)

/* ⚠️ Kalit `shartnomaDash` — avval `shartnomalar` edi, ya'ni `useShartnomalar`
 * bilan BIR XIL kalitda ikki xil ma'lumot saqlanardi (kesh to'qnashuvi:
 * qaysi biri oxirgi yozsa, ikkinchisi uning ma'lumotini o'qirdi). */
export function useShartnomaDashboard() {
  return useQuery({
    queryKey: ['shartnomaDash'],
    queryFn: () => gas<any>('apiShartnomaDashboard'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useShartnomaSaqla() {
  return useMutation({
    mutationFn: (data: any) => gas<any>('apiShartnomaSaqla', data)
  });
}

export function useShartnomaOchir() {
  return useMutation({
    mutationFn: (no: string) => gas<any>('apiShartnomaOchir', no)
  });
}

export function useShartnomaBogSaqla() {
  return useMutation({
    mutationFn: ({ obyekt, tanlov, soni }: { obyekt: string, tanlov: string, soni: number }) => 
      gas<any>('apiShartnomaBogSaqla', obyekt, tanlov, soni)
  });
}

export function useQoshIshSaqla() {
  return useMutation({
    mutationFn: (data: any) => gas<any>('apiQoshIshSaqla', data)
  });
}

export function useQoshIshOchir() {
  return useMutation({
    mutationFn: (row: number) => gas<any>('apiQoshIshOchir', row)
  });
}

export function useTolovOl() {
  return useQuery({
    queryKey: ['tolovlar'],
    queryFn: () => gas<any>('apiTolovOl'),
  });
}

/* ⚠️ GAS'da `apiTolovSaqla` YO'Q — funksiya nomi `apiTolovYoz`.
 * Avvalgi nom bilan chaqirilsa server «функция мавжуд эмас» qaytarardi. */
export function useTolovSaqla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => gas<any>('apiTolovYoz', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tolovlar'] });
      qc.invalidateQueries({ queryKey: ['shartnomalar'] });
    },
  });
}

export function useTolovOchir() {
  return useMutation({
    mutationFn: (row: number) => gas<any>('apiTolovOchir', row)
  });
}

/* ============ Shartnoma / Sklad / Monitoring ============ */

export function useShartnomalar() {
  return useQuery({
    queryKey: ['shartnomalar'],
    queryFn: () => gas<Shartnoma[]>('apiShartnomaOl'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSkladQoldiq() {
  return useQuery({
    queryKey: ['skladQoldiq'],
    queryFn: () => gas<SkladQoldiq>('apiSkladQoldiq'),
    staleTime: 2 * 60 * 1000,
  });
}

export function useApiLog() {
  return useQuery({
    queryKey: ['apiLog'],
    queryFn: () => gas<ApiLogYozuv[]>('apiWebApiLog'),
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });
}

export function useTolovlar() {
  return useQuery({
    queryKey: ['tolovlar'],
    queryFn: () => gas<Tolov[]>('apiTolovOl'),
    staleTime: 60 * 1000,
  });
}

/** Obyekt → shartnoma № bog'lanishi (apiShartnomaBogOl) */
export function useShartnomaBog() {
  return useQuery({
    queryKey: ['shartnomaBog'],
    queryFn: () => gas<Record<string, string>>('apiShartnomaBogOl'),
    staleTime: 5 * 60 * 1000,
  });
}

/** Skladga kirim (prixod) yoki chiqim (rasxod) yozish — 86_Sklad.js */
export function useSkladYoz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ data, operatsiya }: {
      data: {
        nomi: string; birligi: string; obyomi: number;
        turi?: string; sanasi?: string;
        postavshik?: string; qabul_qiluvchi?: string;
        qabul_turi?: 'prarab' | 'subpudrat' | 'blok';
      };
      operatsiya: 'prixod' | 'rasxod';
    }) => gas<{ ok: boolean; xabar?: string; error?: string }>('apiSkladgaYozish', data, operatsiya),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['skladQoldiq'] }); },
  });
}

/* ============ Ф2 ИМПОРТ ============ */

export function useF2Lokalkalar(obyekt: string) {
  return useQuery({
    queryKey: ['f2lok', obyekt],
    queryFn: () => gas<{ ok: boolean; parent: string; kop: boolean; lokalkalar: string[] }>('apiF2LokalkaRoyxat', obyekt),
    enabled: !!obyekt,
    staleTime: 5 * 60 * 1000,
  });
}

/** Kompyuterdan fayl yuklash — base64 bo'lib GAS'ga boradi */
export function useF2FaylYukla() {
  return useMutation({
    mutationFn: ({ obyekt, base64, mimeType, filename, oyNom }: {
      obyekt: string; base64: string; mimeType: string; filename: string; oyNom: string;
    }) => gas<{ ok: boolean; fileId?: string; name?: string; xabar?: string }>(
      'apiF2FaylYukla', obyekt, base64, mimeType, filename, oyNom),
  });
}

/** Yuklangan faylni daraxt qilib o'qish */
export function useF2FaylOqi() {
  return useMutation({
    mutationFn: ({ fileId, varaq }: { fileId: string; varaq?: string }) =>
      gas<{ ok: boolean; tree?: AktNode[]; xabar?: string }>('apiF2FaylOqi', fileId, varaq || ''),
  });
}

/** ⭐ Avto-moslashtirish — dvigatel GAS'da (35_F2Moslash.js), saytda TAKRORLANMAYDI */
export function useF2AvtoMoslash() {
  return useMutation({
    mutationFn: ({ aktTree, obyekt, lokalka }: { aktTree: AktNode[]; obyekt: string; lokalka?: string }) =>
      gas<F2MoslashNatija>('apiF2AvtoMoslash', aktTree, obyekt, { lokalka: lokalka || '' }),
  });
}

/** Fon rejimida yozish — kompyuter o'chsa ham davom etadi */
export function useF2Yoz() {
  return useMutation({
    mutationFn: ({ obyekt, oyNom, edits, dopps, aktJami }: {
      obyekt: string; oyNom: string; edits: F2Moslik[]; dopps: unknown[]; aktJami: number;
    }) => gas<{ ok: boolean; fon?: boolean; xabar?: string }>(
      'apiF2QollaNavbatga', obyekt, oyNom, edits, dopps, aktJami),
  });
}

/** Yozuv holati — 3 soniyada bir so'raladi, tugagach to'xtaydi */
export function useF2JobHolat(faol: boolean) {
  return useQuery({
    queryKey: ['f2job'],
    queryFn: () => gas<F2JobHolat>('apiF2JobHolat'),
    enabled: faol,
    refetchInterval: (q) => {
      const s = q.state.data?.job?.status;
      return s && s !== 'tugadi' && s !== 'xato' ? 3000 : false;
    },
  });
}

/** Drive'dagi obyekt papkasidagi tayyor Ф2 fayllar */
export function useF2Fayllar(obyekt: string) {
  return useQuery({
    queryKey: ['f2fayllar', obyekt],
    queryFn: () => gas<{ ok: boolean; fayllar: { id: string; name: string; url?: string }[]; xabar?: string }>(
      'apiF2FayllarOl', obyekt),
    enabled: !!obyekt,
    staleTime: 2 * 60 * 1000,
  });
}

/* ============ NARXLAR MARKAZI ============ */

export function useNarxlar(filter = 'ALL') {
  return useQuery({
    queryKey: ['narxlar', filter],
    queryFn: () => gas<NarxlarJavob>('apiNarxlarOl', filter),
    staleTime: 3 * 60 * 1000,
  });
}

/** Qo'lda belgilangan narxni saqlash — u boshqa barcha manbalardan ustun */
export function useNarxBelgilangan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ nom, birlik, belgilangan }: { nom: string; birlik: string; belgilangan: number | '' }) =>
      gas<any>('apiNarxBelgilanganSaqla', nom, birlik, belgilangan),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['narxlar'] }),
  });
}

/** Kategoriya o'zgartirish (ЧЕЛ/МАШ birlikdan avtomat — qolganlari qo'lda) */
export function useNarxKat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ nom, birlik, yangiKat }: { nom: string; birlik: string; yangiKat: string }) =>
      gas<any>('apiNarxKatSaqla', nom, birlik, yangiKat),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['narxlar'] }),
  });
}

/* ============ IERARXIYA (Д1–Д3 tasnifi) ============ */

/** Bitta obyektning barcha razdellari — tasniflanmaganlar ham */
export function useDarajalar(obyekt: string) {
  return useQuery({
    queryKey: ['darajalar', obyekt],
    queryFn: () => gas<DarajaQator[]>('apiDarajalarOl', obyekt),
    enabled: !!obyekt,
    staleTime: 60 * 1000,
  });
}

/** Barcha obyektlar bo'yicha TASNIFLANGAN qatorlar — takliflar uchun manba */
export function useDarajalarBarcha() {
  return useQuery({
    queryKey: ['darajalarBarcha'],
    queryFn: () => gas<{ obyekt: string; rzNom: string; d1: string; d2: string; d3: string }[]>('apiDarajalarBarchaOl'),
    staleTime: 10 * 60 * 1000,
  });
}

/** Saqlash — LRV_PLUS ga ham avtomat yoziladi */
export function useDarajalarSaqla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: (DarajaQator & { obyekt: string })[]) => gas<string>('apiDarajalarSaqla', rows),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['darajalar'] });
      qc.invalidateQueries({ queryKey: ['darajalarBarcha'] });
    },
  });
}

/** РАЗДЕЛЛАР reestrini obyekt smetalaridan qayta yig'ish */
export function useRazdelYasat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (obyekt: string) => gas<{ ok: boolean; xabar: string }>('apiRazdelShYasat', obyekt),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['darajalar'] }),
  });
}
