import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gas } from './client';
import { navbatgaQoshish } from '../_shared/navbat';
import { yangiUid } from '../_shared/idempotent';
import type {
  BossData, TreeNode, PapkaObyekt, Edit, BlQosh, RsQosh,
  Shartnoma, SkladQoldiq, ApiLogYozuv, Tolov,
  AktNode, F2Moslik, F2MoslashNatija, F2JobHolat, NarxlarJavob, DarajaQator, F2UstunConfig, F2Varaq,
  BuxDashboard, Xarajat,
  KadrlarDashboard, Ishchi, TabelKuni,
  TexnikaDashboard, Texnika, TexnikaType, TexnikaHolat,
  TaminotDashboard, ZayavkaStatus, Postavshik,
  SifatDashboard, MuhimlikDarajasi, NuqsonStatus,
  NavbatHolat, NavbatBoshlash,
  TizimSozlama, NakrutkaKoef, Stavka,
} from './types';

/* ============ DVIGATEL: OBYEKTNI ISHLASH (НАВБАТ) ============
 * ⚠️ Barcha obyektni skan qiluvchi ish SINXRON emas — GAS 6 daqiqa limitiga
 * urilmasligi uchun navbat (trigger) orqali fonda bajariladi. UI faqat
 * navbat holatini so'rab turadi. (50_Navbat.js)                            */

export function useNavbatHolat(faol: boolean) {
  return useQuery({
    queryKey: ['navbatHolat'],
    queryFn: () => gas<NavbatHolat>('apiNavbatHolat'),
    refetchInterval: faol ? 4000 : false,
    staleTime: 0,
  });
}

export function useObyektIshla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ obyekt, tezkor }: { obyekt: string; tezkor?: boolean }) =>
      gas<NavbatBoshlash>(tezkor ? 'apiObyektTezkorFonIshla' : 'apiObyektFonIshla', obyekt),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['navbatHolat'] }),
  });
}

export function useBarchaIshla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tezkor }: { tezkor?: boolean } = {}) =>
      gas<NavbatBoshlash>(tezkor ? 'apiBarchaTezkorIshla' : 'apiBarchaFonIshla'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['navbatHolat'] }),
  });
}

export function useNavbatToxtat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => gas<{ ok: boolean; xabar: string }>('apiNavbatToxtat'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['navbatHolat'] }),
  });
}

export function useObyektlar() {
  return useQuery({
    queryKey: ['obyektlar'],
    queryFn: () => gas<PapkaObyekt[]>('apiPapkaSkan'),
    staleTime: 10 * 60 * 1000, // 10 minutes cache as requested
  });
}

/**
 * ⚠️ 2026-07-30 TUZATILDI: bu yerda avval `select` ichida Math.random()
 * bilan SOXTA ERP raqamlari (ishchilar, texnikalar, zayavkalar, nuqsonlar)
 * HAQIQIY moliyaviy dashboard ma'lumotiga ARALASHTIRILGAN edi. Bu ikki jihatdan
 * xavfli edi:
 *   1) Sonlar HAR YANGILANISHDA o'zgarardi — real ma'lumot o'zgarmasa ham,
 *      rahbar "faol zayavkalar 7 dan 9 ga oshdi" deb o'ylashi mumkin edi;
 *   2) Haqiqiy `apiBossData()` javobiga tegishli bo'lmagan soxta maydonlar
 *      GAS'dan kelganidek ko'rinardi — bu tizimning "hech qachon soxta
 *      ma'lumot ko'rsatilmasin" qoidasini buzadi.
 * GAS'da bu ma'lumotlar uchun ZAXIRA (Kadrlar/Texnika/Taminot/Sifat) HALI
 * YARATILMAGAN — shuning uchun `select` olib tashlandi, server javobi
 * o'zgarishsiz qaytariladi. ERP sahifalari o'z holatini `useKadrlarData()`
 * va sh.k. orqali ALOHIDA so'raydi (ular hozircha DEMO deb belgilangan).
 */
export function useBossData() {
  return useQuery({
    queryKey: ['bossData'],
    queryFn: () => gas<BossData>('apiBossData'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useBossObyekt(obNom: string) {
  return useQuery({
    queryKey: ['bossObyekt', obNom],
    queryFn: () => gas<{ rzList: any[], oylar: any[] }>('apiBossObyekt', obNom),
    staleTime: 5 * 60 * 1000,
    enabled: !!obNom,
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

/* ============ FAKTURALAR (Fakturalar.js) ============ */
export type FakturaItem = {
  id?: string;
  fakturaRaqami: string;
  postavshik: string;
  kelganSana: string;
  shartnomaRaqami: string;
  shartnomaSanasi?: string;
  postavshikInn?: string;
  postavshikManzil?: string;
  sotibOluvchiInn?: string;
  sotibOluvchiManzil?: string;
  nomi: string;
  birligi: string;
  miqdori: number;
  narxi: number;
  jamiNdsSiz: number;
  ndsSummasi: number;
  jamiNdsBilan: number;
  kategoriya?: string;
  isDuplicate?: boolean;
};

export function useFakturalarOl() {
  return useQuery({
    queryKey: ['fakturalar'],
    queryFn: () => gas<{ ok: boolean; fakturalar?: FakturaItem[]; xabar?: string }>('apiFakturalarOl'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useFakturaFaylYoz() {
  return useMutation({
    mutationFn: (payload: { base64: string; nomi: string; postavshik: string }) => gas<{ ok: boolean; url?: string; xabar?: string }>('apiFakturaFaylYoz', payload),
  });
}

export function useFakturaYoz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fakturalar: FakturaItem[]) => gas<{ ok: boolean; soni?: number; xabar?: string }>('apiFakturaYoz', fakturalar),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fakturalar'] }),
  });
}

export function useFakturaOCR() {
  return useMutation({
    mutationFn: (payload: { base64: string; mimeType: string; nomi: string }) => 
      gas<{ ok: boolean; text?: string; xabar?: string }>('apiFakturaOCR', payload)
  });
}

export type FakturaFolderStatus = { count: number; url: string };
export type FakturaDriveHolatRes = {
  ok: boolean;
  yangi?: FakturaFolderStatus;
  arxiv?: FakturaFolderStatus;
  dublikat?: FakturaFolderStatus;
  xato?: FakturaFolderStatus;
  xabar?: string;
};

export function useFakturaDriveHolat() {
  return useQuery({
    queryKey: ['fakturaDriveHolat'],
    queryFn: () => gas<FakturaDriveHolatRes>('apiFakturaDriveHolat'),
    staleTime: 60 * 1000,
  });
}

export function useFakturaAvtoSinx() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => gas<{ ok: boolean; ishlanganFayllar?: number; yozilganQatorlar?: number; qolganFayllar?: number; xabar?: string }>('apiFakturaAvtoSinx'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fakturalar'] });
      qc.invalidateQueries({ queryKey: ['fakturaDriveHolat'] });
    }
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
    mutationFn: ({ aktTree, obyekt, lokalka, qatiy }: { aktTree: AktNode[]; obyekt: string; lokalka?: string; qatiy?: boolean }) =>
      gas<F2MoslashNatija>('apiF2AvtoMoslash', aktTree, obyekt, { lokalka: lokalka || '', qatiy }),
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

/** Fayldagi varaqlar ro'yxati (35_F2Moslash.js) */
export function useF2Varaqlar(fileId: string) {
  return useQuery({
    queryKey: ['f2varaqlar', fileId],
    queryFn: () => gas<{ ok: boolean; varaqlar?: F2Varaq[]; nom?: string; xabar?: string }>('apiF2Varaqlar', fileId),
    enabled: !!fileId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * ⚠️ apiF2FaylOqi IKKI BOSQICHLI:
 *   colConfig = null   → {mode:'config', cols:{...}, preview}  — ustunlarni tahlil qiladi
 *   colConfig = {...}  → {ok, tree}                            — daraxt quradi
 * Avval bir marta chaqirib `tree` kutilgani uchun «fayl o'qilmadi» chiqardi.
 */
export function useF2Ustunlar() {
  return useMutation({
    mutationFn: ({ fileId, varaq }: { fileId: string; varaq: string }) =>
      gas<F2UstunConfig>('apiF2FaylOqi', fileId, varaq, null),
  });
}

export function useF2Daraxt() {
  return useMutation({
    mutationFn: ({ fileId, varaq, colConfig }: {
      fileId: string; varaq: string;
      colConfig: { kod: number; nom: number; bir: number; norma: number; obyom: number; narx: number; sum: number };
    }) => gas<F2UstunConfig>('apiF2FaylOqi', fileId, varaq, colConfig),
  });
}

/* ============ BUXGALTERIYA ============ */

export function useBuxDashboard() {
  return useQuery({
    queryKey: ['buxDash'],
    queryFn: () => gas<BuxDashboard>('apiBuxDashboard'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useXarajatlar() {
  return useQuery({
    queryKey: ['xarajatlar'],
    queryFn: () => gas<Xarajat[]>('apiXarajatOl'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useXarajatYoz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: { sana?: string; toifa: string; summa: number; izoh?: string; row?: number }) =>
      gas<any>('apiXarajatYoz', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['xarajatlar'] });
      qc.invalidateQueries({ queryKey: ['buxDash'] });
    },
  });
}

export function useXarajatOchir() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (row: number) => gas<any>('apiXarajatOchir', row),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['xarajatlar'] });
      qc.invalidateQueries({ queryKey: ['buxDash'] });
    },
  });
}

export function useSkladOchir() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (qatorNo: number) => gas<string>('apiSkladOchir', qatorNo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['skladQoldiq'] });
    }
  });
}

/* ============ ERP KADRLAR VA TABEL (87_ErpModullar.js) ============ */
export function useKadrlarData(oy?: string) {
  return useQuery({
    queryKey: ['kadrlar', oy || 'joriy'],
    queryFn: () => gas<KadrlarDashboard>('apiKadrlarDashboard', oy),
    staleTime: 5 * 60 * 1000,
  });
}

export function useIshchiQosh() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: { ism: string; kasb?: string; stavka?: number; brigada?: string; obyekt?: string; telefon?: string }) =>
      gas<{ ok: boolean; id: string }>('apiIshchiQosh', d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kadrlar'] }),
  });
}

export function useIshchiTahrir() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: Partial<Ishchi> & { id: string }) => gas<{ ok: boolean }>('apiIshchiTahrir', d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kadrlar'] }),
  });
}

export function useIshchiOchir() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => gas<{ ok: boolean }>('apiIshchiOchir', id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kadrlar'] }),
  });
}

export function useTabelBelgila() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: { ishchiId: string; sana: string; holat: TabelKuni }) => gas<{ ok: boolean }>('apiTabelBelgila', d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kadrlar'] }),
  });
}

/* ============ ERP TEXNIKA VA GSM (87_ErpModullar.js) ============ */
export function useTexnikaData() {
  return useQuery({
    queryKey: ['texnika'],
    queryFn: () => gas<TexnikaDashboard>('apiTexnikaDashboard'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTexnikaQosh() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: { nom: string; davlatRaqami?: string; turi?: TexnikaType; holat?: TexnikaHolat; obyekt?: string; haydovchi?: string; soatlikNorma?: number; oldingiQoldiq?: number }) =>
      gas<{ ok: boolean; id: string }>('apiTexnikaQosh', d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['texnika'] }),
  });
}

export function useTexnikaTahrir() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: Partial<Texnika> & { id: string }) => gas<{ ok: boolean }>('apiTexnikaTahrir', d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['texnika'] }),
  });
}

export function useTexnikaTarixQosh() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: { texnikaId: string; sana?: string; kirimLitr?: number; chiqimLitr?: number; motochas?: number; izoh?: string }) =>
      gas<{ ok: boolean; id: string }>('apiTexnikaTarixQosh', d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['texnika'] }),
  });
}

/* ============ ERP TA'MINOT VA OMBOR (87_ErpModullar.js + real Sklad) ============ */
export function useTaminotData() {
  return useQuery({
    queryKey: ['taminot'],
    queryFn: () => gas<TaminotDashboard>('apiTaminotDashboard'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useZayavkaQosh() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: { sana?: string; obyekt?: string; prorab?: string; material: string; birlik?: string; miqdor?: number; status?: ZayavkaStatus; izoh?: string }) =>
      gas<{ ok: boolean; id: string }>('apiZayavkaQosh', d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['taminot'] }),
  });
}

export function useZayavkaHolatYangila() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ZayavkaStatus }) => gas<{ ok: boolean }>('apiZayavkaHolatYangila', id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['taminot'] }),
  });
}

export function usePostavshikQosh() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: { nom: string; telefon?: string; yetkazilganSumma?: number; qarzimiz?: number }) =>
      gas<{ ok: boolean; id: string }>('apiPostavshikQosh', d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['taminot'] }),
  });
}

export function usePostavshikTahrir() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: Partial<Postavshik> & { id: string }) => gas<{ ok: boolean }>('apiPostavshikTahrir', d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['taminot'] }),
  });
}

/* ============ ERP SIFAT NAZORATI / TEXNADZOR (87_ErpModullar.js) ============ */
export function useSifatData() {
  return useQuery({
    queryKey: ['sifat'],
    queryFn: () => gas<SifatDashboard>('apiSifatDashboard'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useNuqsonQosh() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: { obyekt?: string; prorab?: string; sana?: string; muddat?: string; tavsif: string; daraja?: MuhimlikDarajasi; status?: NuqsonStatus; izoh?: string }) =>
      gas<{ ok: boolean; id: string }>('apiNuqsonQosh', d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sifat'] }),
  });
}

export function useNuqsonHolatYangila() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: NuqsonStatus }) => gas<{ ok: boolean }>('apiNuqsonHolatYangila', id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sifat'] }),
  });
}

/* ============ Ф2 ТАЙЁРЛАШ (smetadan yangi hujjat) ============ */

export function useF2HujjatYarat() {
  return useMutation({
    mutationFn: ({ obyekt, oyNom, items }: {
      obyekt: string; oyNom: string;
      items: { rzNom: string; blNom: string; type: string; kod: string; nom: string; bir: string; hajm: number; narx: number }[];
    }) => gas<{ ok: boolean; url?: string; fileId?: string; name?: string; jami?: number; soni?: number }>(
      'apiF2TayyorHujjatYarat', obyekt, oyNom, items),
  });
}

export function useAiSmartF2() {
  return useMutation({
    mutationFn: ({ obyekt, text }: { obyekt: string; text: string }) => 
      gas<{ ok?: boolean; text?: string; sum?: number; qoldiqSum?: number; edits?: any[] }>(
        'apiAiSmartF2', obyekt, text
      ),
  });
}

/** Joriy sessiya — rol va yozish huquqi */
export function useSessiya() {
  return useQuery({
    queryKey: ['sessiya'],
    queryFn: async () => {
      const r = await fetch('/api/sessiya');
      if (!r.ok) throw new Error('Sessiya yo\'q');
      return r.json() as Promise<{ ok: boolean; rol: string; email: string; yozaOladi: boolean; tugaydi: number }>;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/* ============ SOZLAMALAR (30_Panel.js + 80_Shartnoma.js) ============ */

export function useTizimSozlama() {
  return useQuery({
    queryKey: ['tizimSozlama'],
    queryFn: () => gas<TizimSozlama>('apiSozlamaOl'),
    staleTime: 10 * 60 * 1000,
  });
}

export function useTizimSozlamaSaqla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: TizimSozlama) => gas<string>('apiSozlamaSaqla', d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tizimSozlama'] }),
  });
}

/** shNo bo'sh bo'lsa — umumiy (default) koeffitsientlar */
export function useNakrutka(shNo?: string) {
  return useQuery({
    queryKey: ['nakrutka', shNo || 'umumiy'],
    queryFn: () => gas<NakrutkaKoef[]>('apiNakrutkaOl', shNo || ''),
    staleTime: 5 * 60 * 1000,
  });
}

export function useNakrutkaSaqla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ items, shNo }: { items: NakrutkaKoef[]; shNo?: string }) =>
      gas<unknown>('apiNakrutkaSaqla', items, shNo || ''),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nakrutka'] }),
  });
}

export function useStavka(obyekt: string) {
  return useQuery({
    queryKey: ['stavka', obyekt],
    queryFn: () => gas<Stavka>('apiStavkaOl', obyekt),
    enabled: !!obyekt,
    staleTime: 5 * 60 * 1000,
  });
}

export function useStavkaSaqla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ obyekt, chel }: { obyekt: string; chel: number }) =>
      gas<{ ok: boolean; chel: number; xabar: string }>('apiStavkaSaqla', obyekt, chel),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stavka'] }),
  });
}

/** Tizim tashxisi — nima ishlamayotganini ko'rsatadi */
export function useTashxis(enabled: boolean) {
  return useQuery({
    queryKey: ['tashxis'],
    queryFn: () => gas<unknown>('apiTashxis'),
    enabled,
    staleTime: 60 * 1000,
  });
}
