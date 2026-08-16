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

import type { HolatJami } from './types';

/**
 * Obyekt holati (smeta daraxti).
 *
 * ⚡⚡⚡ 2026-08-13 TEZLIK/TIMEOUT TUZATISHI (foydalanuvchi: «Amfiteatrda 2 ta
 * smeta kerak, lekin tizim 15 ta faylga kirib chiqib time limitga uraveradi»).
 * SABAB: UI'da LOKALKA tanlagich bor edi, lekin bu hook uni HISOBGA OLMASDI —
 * har doim `apiHolatOl(obyekt)` chaqirilib, ota obyektning BARCHA sub-smetalari
 * skanerlanardi (GAS 6 daqiqa limitiga urilardi).
 * GAS'da bitta lokalkani o'qiydigan `apiHolatOlLokalka(parent, sub)` ALLAQACHON
 * mavjud edi — endi lokalka tanlangan bo'lsa SHU chaqiriladi (1 fayl ≈ 15x tez).
 *
 * @param lokalka bo'sh bo'lsa — barcha sub-smetalar (eski xatti-harakat)
 */
export function useHolat(
  obyekt: string,
  forceRefresh: boolean = false,
  lokalka: string | string[] = '',
  /** ⚡ 2026-08-13: `false` bo'lsa so'rov YUBORILMAYDI. Ko'p smetali obyektda
   *  «barchasini o'qish» ni tasodifan ishga tushirmaslik uchun (pastga qara). */
  yoqilgan: boolean = true,
) {
  // Bir nechta smeta tanlangan bo'lishi mumkin (F2 bir necha smetaga tegishli)
  const rq = Array.isArray(lokalka) ? lokalka.filter(Boolean) : (lokalka ? [lokalka] : []);
  const kalit = rq.length ? rq.slice().sort().join('|') : 'barchasi';
  type Javob = { tree: TreeNode[], lokalkalar: string[], jami?: HolatJami, oylar?: string[] };
  return useQuery({
    queryKey: ['holat', obyekt, forceRefresh, kalit],
    queryFn: () => {
      if (rq.length === 1) return gas<Javob>('apiHolatOlLokalka', obyekt, rq[0], forceRefresh);
      if (rq.length > 1)   return gas<Javob>('apiHolatOlLokalkalar', obyekt, rq, forceRefresh);
      return gas<Javob>('apiHolatOl', obyekt, forceRefresh);
    },
    staleTime: Infinity, // Extremely heavy, don't refetch unless forced
    enabled: !!obyekt && yoqilgan,
    /* ⚡⚡⚡ 2026-08-13 «Failed to fetch» TUZATILDI. Jonli o'lchov: Amfiteatr
     * (26 smeta) uchun apiHolatOl yolg'iz 10s / 4.45 MB, LEKIN sahifa boshqa
     * chaqiruvlarni ham bir vaqtda yuboradi va GAS ularni NAVBATGA qo'yadi —
     * o'sha so'rov 47.6s ga cho'zildi va brauzer ulanishni tashladi
     * («Failed to fetch» — bu HTTP xato emas, ulanish uzilishi).
     * Endi: og'ir so'rov uchun bosqichma-bosqich kutish bilan 3 marta
     * qayta urinadi (global retry:1 bu yerda yetarli emas edi). */
    retry: 3,
    retryDelay: (urinish) => Math.min(4000 * 2 ** urinish, 30000),
  });
}

/**
 * «Bu F2 qaysi smeta(lar)dan kelgan?» — BITTALAB probe.
 * ⚡ 2026-08-13: bir yil oldingi F2 qaysi smetaga tegishli ekani oldindan
 * bilinmaydi. Bu yengil probe har chaqiruvda BITTA smetani tekshiradi
 * (to'liq daraxt qurmasdan) va aktning nechta foiz kaliti qoplanganini
 * qaytaradi. Hammasini bitta chaqiruvda tekshirish Cloudflare 100s
 * limitiga urgani uchun ataylab bittalab qilingan.
 */
export type LokalkaTaklif = {
  lokalka: string; ball: number; rzMos: number; kodMos: number;
  rzJami: number; kodJami: number; qoplama: number; xato?: string;
};

export function useF2LokalkaTaklif() {
  return useMutation({
    mutationFn: ({ obyekt, kalitlar, indeks }: {
      obyekt: string; kalitlar: { rz: string[]; kod: string[] }; indeks: number;
    }) => gas<{
      ok: boolean; kop: boolean; jami: number; indeks?: number;
      natija?: LokalkaTaklif; xabar?: string;
    }>('apiF2LokalkaTaklif', obyekt, kalitlar, indeks),
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
            if (edit) {
              if (edit.fakt !== undefined) {
                node.fakt = edit.fakt;
              }
              if (edit.oylar) {
                if (!node.oylar) node.oylar = {};
                for (const oy of Object.keys(edit.oylar)) {
                  node.oylar[oy] = {
                    ...(node.oylar[oy] || { obyom: 0, narx: node.narx || 0 }),
                    obyom: edit.oylar[oy]
                  };
                }
              }
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
    }
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
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => gas<any>('apiShartnomaSaqla', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shartnomalar'] });
      qc.invalidateQueries({ queryKey: ['shartnomaDash'] });
      qc.invalidateQueries({ queryKey: ['buxDash'] });
      qc.invalidateQueries({ queryKey: ['bossData'] });
    },
  });
}


/**
 * Fakturalarni FON rejimida sinxronlash.
 * ⚡ 2026-08-13 TUZATILDI: avval mavjud bo'lmagan `apiStartBackgroundSync`
 * chaqirilardi — «Функция мавжуд эмас» qaytib, tugma hech narsa qilmasdi.
 * Haqiqiy funksiya: `apiFakturaSinxAsosiy` (89c_FakturaSync.js) — u bir
 * porsiyani bajarib, qolgani bo'lsa o'zi `apiFakturaSinxDavom` triggerini
 * qo'yadi (GAS 6 daqiqa limitiga urilmaslik uchun).
 */
export function useFakturaSinxFonda() {
  return useMutation({
    mutationFn: () => gas<any>('apiFakturaSinxAsosiy')
  });
}

export function useShartnomaOchir() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (no: string) => gas<any>('apiShartnomaOchir', no),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shartnomalar'] });
      qc.invalidateQueries({ queryKey: ['shartnomaDash'] });
      qc.invalidateQueries({ queryKey: ['buxDash'] });
      qc.invalidateQueries({ queryKey: ['bossData'] });
    },
  });
}

export function useShartnomaBogSaqla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ obyekt, tanlov, soni }: { obyekt: string, tanlov: string, soni: number }) => 
      gas<any>('apiShartnomaBogSaqla', obyekt, tanlov, soni),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shartnomaDash'] });
      qc.invalidateQueries({ queryKey: ['bossData'] });
    },
  });
}

export function useQoshIshSaqla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => gas<any>('apiQoshIshSaqla', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shartnomaDash'] });
      qc.invalidateQueries({ queryKey: ['buxDash'] });
      qc.invalidateQueries({ queryKey: ['bossData'] });
    },
  });
}

export function useQoshIshOchir() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (row: number) => gas<any>('apiQoshIshOchir', row),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shartnomaDash'] });
      qc.invalidateQueries({ queryKey: ['buxDash'] });
      qc.invalidateQueries({ queryKey: ['bossData'] });
    },
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
      qc.invalidateQueries({ queryKey: ['shartnomaDash'] });
      qc.invalidateQueries({ queryKey: ['buxDash'] });
      qc.invalidateQueries({ queryKey: ['bossData'] });
    },
  });
}

export function useTolovOchir() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (row: number) => gas<any>('apiTolovOchir', row),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tolovlar'] });
      qc.invalidateQueries({ queryKey: ['shartnomaDash'] });
      qc.invalidateQueries({ queryKey: ['buxDash'] });
      qc.invalidateQueries({ queryKey: ['bossData'] });
    },
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
  katalogNomi?: string;
  birligi: string;
  miqdori: number;
  narxi: number;
  jamiNdsSiz: number;
  ndsSummasi: number;
  jamiNdsBilan: number;
  kategoriya?: string;
  aksizSummasi?: number;
  ndsStavkasi?: number;
  yetkazibBeruvchiHisobRaqam?: string;
  yetkazibBerishKompaniyasi?: string;
  isDuplicate?: boolean;
  faylUrl?: string;
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

export function useFakturaAiParse() {
  return useMutation({
    mutationFn: (payload: { base64: string; mimeType: string; nomi: string }) => 
      gas<{ ok: boolean; items?: FakturaItem[]; supplier?: string; xabar?: string }>('apiFakturaAiParse', payload)
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
/** F2 yozish natijasi (yangi tez yo'l) */
export type F2YozNatija = {
  ok: boolean; quruq?: boolean; xabar?: string;
  smetalar?: number; yozilgan?: number; radEtilgan?: number;
  radRoyxat?: { row: number; kutilgan?: string; topilgan?: string; sabab?: string }[];
};

/* ⚡⚡⚡ 2026-08-14 TEZ YO'LGA O'TKAZILDI (37_F2TezYoz.js).
 * Eski `apiF2QollaNavbatga` fon navbatiga qo'yardi va 97 qator uchun ham
 * 6 daqiqa limitiga urilib O'LIM SIKLIGA tushardi. Yangi yo'l 97 qatorni
 * 2.7 soniyada yozadi (jonli o'lchov) — navbat KERAK EMAS, javob darhol.
 * Qator surilgan bo'lsa nom/kod tekshiruvi ushlaydi va YOZMAYDI. */
export function useF2Yoz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ obyekt, oyNom, edits, dopps, aktJami }: {
      obyekt: string; oyNom: string; edits: F2Moslik[]; dopps: unknown[]; aktJami: number;
    }) => gas<F2YozNatija>('apiF2YozTez2', obyekt, oyNom, edits, dopps, aktJami),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['f2job'] });
      qc.invalidateQueries({ queryKey: ['holat'] });
    },
  });
}

/** Eski yozish usuli (navbat bilan, eski xatti-harakatlar saqlanadi) */
export function useF2YozEski() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ obyekt, oyNom, edits, dopps, aktJami }: {
      obyekt: string; oyNom: string; edits: F2Moslik[]; dopps: unknown[]; aktJami: number;
    }) => gas<{ ok: boolean; fon?: boolean; xabar?: string }>('apiF2QollaNavbatga', obyekt, oyNom, edits, dopps, aktJami),
    /* ⚡⚡⚡ 2026-08-16: `holat` (smeta daraxti) BU YERDA YANGILANMAYDI.
     * Sabab: bu `onSuccess` ish NAVBATGA QO'YILGANDA ishlaydi (~1 soniya),
     * ish esa hali BOSHLANMAGAN. O'sha payt daraxtni qayta o'qish ESKI
     * qator raqamlarini keltiradi; keyin fon ishi razdel/qator qo'shib
     * hammasini suradi va frontend eskisini tutib qoladi — obyomlar
     * 1 qator NOTO'G'RI joyga tushadi (foydalanuvchi shikoyati:
     * «bitta rz qo'shdim, shundan keyin obyomlar bir qator tepaga surildi»).
     * Daraxt endi ish TUGAGANDA yangilanadi (F2Import.tsx dagi effekt). */
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['f2job'] });
    },
  });
}

/** QURUQ SINOV — hech narsa yozmaydi, faqat nechta qator mos kelishini aytadi.
 *  Yozishdan OLDIN chaqiriladi: qator surilgan bo'lsa darhol ko'rinadi. */
export function useF2YozSinov() {
  return useMutation({
    mutationFn: ({ obyekt, oyNom, edits, dopps, aktJami }: {
      obyekt: string; oyNom: string; edits: F2Moslik[]; dopps: unknown[]; aktJami: number;
    }) => gas<F2YozNatija>('apiF2YozTezSinov2', obyekt, oyNom, edits, dopps, aktJami),
  });
}

/** F2 oyni tozalash (o'chirish) */
export function useF2OyOchirish() {
  return useMutation({
    mutationFn: ({ obyekt, oyNom }: { obyekt: string; oyNom: string }) =>
      gas<{ ok: boolean; tozalandi?: boolean; xabar?: string }>('apiF2OyOchirish', obyekt, oyNom),
  });
}

/* ⚡⚡⚡ 2026-08-15 F2 NAZORAT QATLAMI (38_F2Nazorat.js + 39_F2Reestr.js).
 * Foydalanuvchi: «manga aniqlik kerak... 171 mlrd kiritsam 171 mlrd
 * smetada turishi kerak». Bu hooklar aynan shu solishtiruvni ochadi. */

export type F2ReestrYozuv = {
  f2Id: string; obyekt: string; oy: string; faylNom: string;
  sana: string; kim: string;
  hujjatJami: number | null; yozilganJami: number; farq: number | null;
  qatorJami: number; qatorYozildi: number;
  holat: string; varaqlar: string; izoh: string;
};

/** F2 REESTR — kafolat daftari. obyekt bo'sh = BARCHA obyektlar. */
export function useF2Reestr(obyekt?: string, enabled = true) {
  return useQuery({
    queryKey: ['f2reestr', obyekt || '*'],
    queryFn: () => gas<{
      ok: boolean; yozuvlar: F2ReestrYozuv[]; soni: number;
      jamiHujjat: number; jamiYozilgan: number; farq: number;
      hujjatJamiKiritilmagan: number; ishonchli: boolean; xabar?: string;
    }>('apiF2ReestrOl', obyekt || ''),
    enabled,
    staleTime: 60_000,
  });
}

/** LRV_PLUS dan haqiqiy oy summalari — taxmin emas, qog'ozdagi raqam */
export function useF2Nazorat(obyekt: string, enabled = true) {
  return useQuery({
    queryKey: ['f2nazorat', obyekt],
    queryFn: () => gas<{
      ok: boolean; jamiSumma: number; varaqSoni: number;
      oylar: Array<{
        nom: string; summa: number; obyom: number; qatorlar: number;
        pulliQatlamlar: string[]; ikkiBaravarXavfi?: boolean;
        varaqlar: Array<{ sub: string; varaq: string; summa: number; qatorlar: number }>;
      }>;
      ogohlantirish: string[]; vaqt: string; xabar?: string;
    }>('apiF2Nazorat', obyekt),
    enabled: enabled && !!obyekt,
    staleTime: 60_000,
  });
}

/** «bl mi rs mi» — ikki baravar sanash tekshiruvi (ma'lumotdan aniqlanadi) */
export function useF2QatlamTahlil(obyekt: string, enabled = true) {
  return useQuery({
    queryKey: ['f2qatlam', obyekt],
    queryFn: () => gas<{
      ok: boolean;
      oylar: Array<{ nom: string; asos: string; jamiTogri: number | null; izoh: string;
                     blOzi: number; rsBola: number; rsYetim: number;
                     guruhTakror: number; guruhAjrim: number }>;
      jamiTogri: number | null; takrorBor: boolean; aralashBor: boolean;
      ishonchli: boolean; xulosa: string; vaqt: string; xabar?: string;
    }>('apiF2QatlamTahlil', obyekt),
    enabled: enabled && !!obyekt,
    staleTime: 120_000,
  });
}

/** ПРЯМЫЕ ЗАТРАТЫ — qatorlab yig'iladi (ЧЕЛ+МАШ+МАТ+ОБ+М/К+КАБ), bl qatorlarsiz */
export function useF2PriamoyZatrat(obyekt: string, oyNom: string, enabled = true) {
  return useQuery({
    queryKey: ['f2pz', obyekt, oyNom],
    queryFn: () => gas<{
      ok: boolean; priamoyZatrat: number;
      kategoriyalar: Record<string, number>;
      qatorlar: number; blOtkazildi: number; izoh: string; xabar?: string;
    }>('apiF2PriamoyZatrat', obyekt, oyNom),
    enabled: enabled && !!obyekt && !!oyNom,
    staleTime: 60_000,
  });
}

/** Yo'qolgan pulni O'ZI topadi — foydalanuvchi raqam solishtirmaydi */
export function useF2Bosliqlar(obyekt: string, oyNom: string, hujjatJami?: number | null, enabled = true) {
  return useQuery({
    queryKey: ['f2bosliq', obyekt, oyNom, hujjatJami ?? null],
    queryFn: () => gas<{
      ok: boolean; qatorSoni: number; yozilganJami: number;
      hujjatJami: number | null; yetishmayotgan: number | null;
      hajmBorPulYoq: { soni: number; agarNarxlansaPul: number; qatorlar: Array<Record<string, unknown>> };
      summaNomuvofiq: { soni: number; farqPul: number; qatorlar: Array<Record<string, unknown>> };
      hajmYoqPulBor: { soni: number; pul: number; qatorlar: Array<Record<string, unknown>> };
      izohlanadi: number; xulosa: string; xabar?: string;
    }>('apiF2Bosliqlar', obyekt, oyNom, hujjatJami ?? ''),
    enabled: enabled && !!obyekt && !!oyNom,
    staleTime: 30_000,
  });
}

/** ⚡ 2026-08-15: smetadagi `f2uid` izohlaridan bog'lanishlarni tiklash.
 *  Yozuvchi har qatorga f2uid qo'yadi — ya'ni bog'lash ishi VARAQNING
 *  O'ZIDA saqlangan. Brauzer yopilsa ham qayta bog'lash SHART EMAS. */
export function useF2BoglanishTikla() {
  return useMutation({
    mutationFn: ({ obyekt, oyNom }: { obyekt: string; oyNom: string }) =>
      gas<{ ok: boolean; qatorlar: Array<{
        sub: string; varaq: string; row: number; uid: string;
        kod: string; nom: string; hajm: number; narx: number; summa: number;
      }>; soni: number; uidSoni: number; xabar?: string }>(
        'apiF2OyTafsilot', obyekt, oyNom),
  });
}

/** Yozishdan oldingi tekshiruv — QAROR SERVERDA (38_F2Nazorat.js).
 *  Frontend biznes mantiq yozmaydi, faqat shu javobni ko'rsatadi. */
export function useF2YozishgaRuxsat() {
  return useMutation({
    mutationFn: ({ obyekt, oyNom, uidlar }: { obyekt: string; oyNom: string; uidlar: string[] }) =>
      gas<{ ok: boolean; holat: string; ogohlantirish: boolean; tozalashTavsiya: boolean;
            borQator: number; borSumma: number; ozQator: number; begonaQator: number;
            xabar: string }>('apiF2YozishgaRuxsat', obyekt, oyNom, uidlar),
  });
}

export type F2OyQator = {
  sub: string; varaq: string; row: number;
  marker: string; kod: string; nom: string; birlik: string;
  smetaHajm: number; smetaNarx: number;
  hajm: number; narx: number; summa: number;
  uid: string; nomuvofiq: boolean;
};

/** Oyning HAR BIR yozilgan qatori — manzili, qiymatlari, qaysi F2 dan kelgani */
export function useF2OyTafsilot(obyekt: string, oyNom: string, enabled = true) {
  return useQuery({
    queryKey: ['f2oytafsilot', obyekt, oyNom],
    queryFn: () => gas<{
      ok: boolean; qatorlar: F2OyQator[]; soni: number; jamiSumma: number;
      uidSoni: number; nomuvofiqSoni: number; vaqt: string; xabar?: string;
    }>('apiF2OyTafsilot', obyekt, oyNom),
    enabled: enabled && !!obyekt && !!oyNom,
    staleTime: 30_000,
  });
}

/** Nuqtali tahrir — faqat ko'rsatilgan qatorlar, butun oy qayta yozilmaydi */
export function useF2QatorTahrir() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ obyekt, oyNom, ozgarishlar }: {
      obyekt: string; oyNom: string;
      ozgarishlar: Array<{ sub: string; varaq: string; row: number;
                           hajm?: number; narx?: number; summa?: number; ochir?: boolean }>;
    }) => gas<{ ok: boolean; yozildi: number; ochirildi: number;
                xatolar: string[]; xabar?: string }>(
      'apiF2QatorTahrir', obyekt, oyNom, ozgarishlar),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['f2oytafsilot'] });
      qc.invalidateQueries({ queryKey: ['f2reestr'] });
      qc.invalidateQueries({ queryKey: ['f2nazorat'] });
      qc.invalidateQueries({ queryKey: ['lrv'] });
    },
  });
}

/** Bitta F2 ni f2uid bo'yicha bekor qilish — qo'shnisiga tegmaydi */
export function useF2Undo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ obyekt, oyNom, uid }: { obyekt: string; oyNom: string; uid: string }) =>
      gas<{ ok: boolean; tozalandi?: number; summa?: number; muhr?: boolean; xabar?: string }>(
        'apiF2Undo', obyekt, oyNom, uid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['f2oytafsilot'] });
      qc.invalidateQueries({ queryKey: ['f2reestr'] });
      qc.invalidateQueries({ queryKey: ['holat'] });
    },
  });
}

/** Oyni muhrlash / muhrni ochish */
export function useF2Muhr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ obyekt, oyNom, och }: { obyekt: string; oyNom: string; och?: boolean }) =>
      gas<{ ok: boolean; muhrlangan?: boolean; xabar?: string }>('apiF2Muhr', obyekt, oyNom, !!och),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['f2muhr'] }),
  });
}

export function useF2MuhrHolat(obyekt: string, oyNom: string, enabled = true) {
  return useQuery({
    queryKey: ['f2muhr', obyekt, oyNom],
    queryFn: () => gas<{ ok: boolean; muhrlangan: boolean;
      malumot: { sana: string; kim: string; jami: number } | null }>('apiF2MuhrHolat', obyekt, oyNom),
    enabled: enabled && !!obyekt && !!oyNom,
    staleTime: 60_000,
  });
}

/** Reestrsiz davrdan qolgan oylarni daftarga tushirish */
export function useF2ReestrTikla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ obyekt }: { obyekt: string }) =>
      gas<{ ok: boolean; qoshildi: number; yangilandi: number;
            eslatma?: string; xabar?: string }>('apiF2ReestrTikla', obyekt),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['f2reestr'] }); },
  });
}

/** Eski yozuvga hujjat jamini qo'lda kiritish (farq hisobi ishonchli bo'lishi uchun) */
export function useF2ReestrHujjatJami() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ f2Id, summa }: { f2Id: string; summa: number }) =>
      gas<{ ok: boolean; farq?: number; holat?: string; xabar?: string }>(
        'apiF2ReestrHujjatJami', f2Id, summa),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['f2reestr'] }); },
  });
}

/** Eski kiritilgan F2 arxiv faylini Drive dan qidirish */
/**
 * Arxivdagi oy faylini topish (tahrirlash uchun).
 * `nomzodlar` — aniq mos kelmasa, oyi mos keladigan ehtimoliy fayllar
 * (2026-08-13: oy nomi lotin/kiril/raqamli shakllarda solishtiriladi).
 */
export function useF2EskiFaylOqi() {
  return useMutation({
    mutationFn: ({ obyekt, oyNom }: { obyekt: string; oyNom: string }) =>
      gas<{
        ok: boolean; fileId?: string; faylNomi?: string; xabar?: string;
        nomzodlar?: { id: string; nom: string }[];
      }>('apiF2EskiFaylOqi', obyekt, oyNom),
  });
}

/** Yozuv holati — 3 soniyada bir so'raladi, tugagach to'xtaydi */
/** Qotib qolgan yozish ishini tozalash — trigger + kesh + holat o'chadi. */
export function useF2JobTozala() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => gas<{ ok: boolean; ochirilganTrigger?: number; xabar?: string }>('apiF2JobTozala'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['f2job'] }); },
  });
}

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
    // yangiFileId — fayl Excel bo'lsa GAS uni avtomatik Google Sheets'ga
    // konvert qiladi va YANGI faylning ID'sini qaytaradi. UI fid'ni shu
    // ID'ga almashtirishi SHART (keyingi o'qishlar native fayldan bo'lsin).
    // faqatQiymat — .xlsx FAQAT keshlangan qiymatlar bilan o'qildi (formula
    // ko'chirilmadi) → #REF!/#VALUE! bo'lishi mumkin emas. 2026-08-13.
    queryFn: () => gas<{
      ok: boolean; varaqlar?: F2Varaq[]; nom?: string; xabar?: string;
      yangiFileId?: string; faqatQiymat?: boolean;
      aslFormulaKatak?: number; aslXatoKatak?: number;
    }>('apiF2Varaqlar', fileId),
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

/* ⚠️ 2026-08-13: `useSkladOchir` OLIB TASHLANDI.
 * U mavjud bo'lmagan `apiSkladOchir` GAS funksiyasini chaqirardi va hech
 * qayerda (birorta sahifada) ishlatilmagan — ya'ni o'lik kod edi.
 * Ombor qatorini O'CHIRISH — qaytarilmas amal; kerak bo'lsa avval GAS'da
 * `apiSkladOchir` ni ehtiyotkorlik bilan (Приход/Расход tarixini saqlab)
 * yozib, so'ng shu hook qaytariladi. Taxminan yozib qo'yilmaydi. */

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
      if (r.status === 401 || r.status === 403) throw new Error("Sessiya yo'q");
      if (!r.ok) throw new Error('Server xatosi: ' + r.status);
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

/* ══════════════════════════════════════════════════════════════════
 * FAYL BOG'LASH (2026-08-16) — eski GAS paneldagi «Файл боғлаш» tabi.
 *
 * Foydalanuvchi: «hali ham eski paneldagi ko'plab funksiyalar yo'qda».
 * Audit natijasi: eski panelda 12 bo'lim bor edi, saytda 4 tasi yo'q.
 * Bu — eng muhimi: usiz YANGI OBYEKTNI umuman sozlab bo'lmaydi
 * (qaysi fayl smeta, qaysi fayl svodka, qaysi varaqlar, ustunlar).
 * GAS API lari BOR edi, faqat sayt ularni chaqirmasdi.
 * ══════════════════════════════════════════════════════════════════ */

/** Faylning varaq nomlari — bog'lash sozlamasida tanlash uchun */
export function useSheetlar(fileId: string) {
  return useQuery({
    queryKey: ['sheetlar', fileId],
    queryFn: () => gas<string[]>('apiSheetlarOl', fileId),
    enabled: !!fileId,
    staleTime: 10 * 60 * 1000,
  });
}

export type BoglashYozuv = {
  obyekt: string;
  lokId?: string; lokName?: string;
  svodId?: string; svodName?: string;
  format?: string;
  lokSheets?: string[]; svodSheets?: string[];
  svodCols?: { nom?: number; bir?: number; narx?: number; blok?: number; qty?: number; summa?: number };
  narxTayyor?: boolean;
};

/** Bog'lash sozlamalarini saqlash. DIQQAT: server BUTUN varaqni qayta
 *  yozadi — shuning uchun BARCHA obyektlar ro'yxati yuboriladi. */
export function useBoglashSaqla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pairs: BoglashYozuv[]) => gas<unknown>('apiBoglashSaqla', pairs),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['obyektlar'] });
      qc.invalidateQueries({ queryKey: ['holat'] });
    },
  });
}

/** Svodka ustunlarini saqlash — papkadagi BARCHA lokalkaga tarqaladi */
export function useSvodUstunSaqla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ obyekt, svodCols }: { obyekt: string; svodCols: Record<string, number> }) =>
      gas<unknown>('apiSvodUstunSaqla', obyekt, svodCols),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['obyektlar'] }),
  });
}

/** Obyekt fayllarini tekshirish — nima yetishmayotganini aytadi */
export function useObyektTekshir() {
  return useMutation({
    mutationFn: ({ obyekt }: { obyekt: string }) =>
      gas<{ ok: boolean; xabar?: string; muammolar?: string[] }>('apiObyektFayllarniTekshir', obyekt),
  });
}

/* ══════════════════════════════════════════════════════════════════
 * ESKI PANELDAN QOLGAN 3 BO'LIM (2026-08-16)
 * Ҳужжатлар · Шахсий смета · Supabase
 * GAS API lari BOR edi — sayt ularni chaqirmasdi.
 * ══════════════════════════════════════════════════════════════════ */

/* ── Ҳужжатлар (akt / prixod / viborka + M-29) ─────────────────── */
export type HujjatTuri = { tur: string; nom: string; url: string; icon: string };

export function useHujjatlar() {
  return useQuery({
    queryKey: ['hujjatlar'],
    queryFn: () => gas<HujjatTuri[]>('apiHujjatlarRoyxat'),
    staleTime: 10 * 60 * 1000,
  });
}

/** M-29 material hisoboti — obyekt + oy bo'yicha yangi hujjat yaratadi */
export function useM29Yarat() {
  return useMutation({
    mutationFn: ({ obyekt, oyNom }: { obyekt: string; oyNom: string }) =>
      gas<{ ok: boolean; url?: string; nom?: string; xabar?: string }>('apiM29Yarat', obyekt, oyNom),
  });
}

/* ── Шахсий смета ──────────────────────────────────────────────── */
export type ShaxsiySmeta = { id: string; nom: string; url: string; sana: string };

export function useShaxsiySmetalar() {
  return useQuery({
    queryKey: ['shaxsiySmetalar'],
    queryFn: () => gas<ShaxsiySmeta[]>('apiShaxsiySmetalar'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useIshTurQidir() {
  return useMutation({
    mutationFn: ({ soz, limit }: { soz: string; limit?: number }) =>
      gas<Array<{ kod: string; nom: string; birlik: string; narx?: number }>>(
        'apiIshTurQidir', soz, limit ?? 40),
  });
}

export function useShaxsiySmetaYarat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ config, ishlar }: { config: Record<string, unknown>; ishlar: unknown[] }) =>
      gas<{ ok: boolean; url?: string; nom?: string; xabar?: string }>(
        'apiShaxsiySmetaYarat', config, ishlar),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shaxsiySmetalar'] }),
  });
}

/* ── Supabase sozlamalari ──────────────────────────────────────── */
export function useSupabaseSozlama() {
  return useQuery({
    queryKey: ['supaSozlama'],
    queryFn: () => gas<{ url?: string; key?: string; ulangan?: boolean }>('apiSupabaseSozlamaOl'),
    staleTime: 60_000,
  });
}

export function useSupabaseSozlamaSaqla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ url, key }: { url: string; key: string }) =>
      gas<{ ok: boolean; xabar?: string }>('apiSupabaseSozlamaSaqla', url, key),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supaSozlama'] }),
  });
}

export function useSupabaseKursor() {
  return useQuery({
    queryKey: ['supaKursor'],
    queryFn: () => gas<Record<string, unknown>>('apiSupabaseSinxKursor'),
    staleTime: 30_000,
  });
}

export function useSupabaseReset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => gas<{ ok: boolean; xabar?: string }>('apiSupabaseSinxReset'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supaKursor'] }),
  });
}

/* ── Hujjat MA'LUMOTLARI (2026-08-16) ─────────────────────────────
 * Avval «Hujjatlar» sahifasi faqat fayl HAVOLASINI berardi.
 * Aslida GAS da to'liq o'qish API lari bor: akt reestri, prixod,
 * viborka nazorati. Ular saytda umuman ochilmasdi. */

export type AktQator = {
  id: string; num: string; work: string; obj: string;
  status: string; comm: string; start: string; end: string;
  progress: string; pdf: string; url: string; ref: string; row: number;
};

export function useAktlar(limit = 100, qidiruv = '') {
  return useQuery({
    queryKey: ['aktlar', limit, qidiruv],
    queryFn: () => gas<{ rows: AktQator[]; jami: number; statlar?: Record<string, number> }>(
      'apiAktlarOl', limit, qidiruv),
    staleTime: 60_000,
  });
}

export type PrixodQator = {
  nom: string; razdel: string; birlik: string; hajm: number;
  sana: string; postavshik: string; row: number;
};

export function usePrixod(limit = 100, qidiruv = '') {
  return useQuery({
    queryKey: ['prixod', limit, qidiruv],
    queryFn: () => gas<{ rows: PrixodQator[]; jami: number; url?: string }>(
      'apiPrixodOl', limit, qidiruv),
    staleTime: 60_000,
  });
}

export type ViborkaQator = {
  nom: string; birlik: string; plan: number; qabul: number;
  narx: number; summa: number; qoldiq: number; foiz: string;
  sana: string; postavshik: string; izoh: string;
  holat: string; zamena: string; row: number;
};

export function useViborka(limit = 100, qidiruv = '') {
  return useQuery({
    queryKey: ['viborka', limit, qidiruv],
    queryFn: () => gas<{
      rows: ViborkaQator[]; jami: number; url?: string; xabar?: string;
      jamiPlan?: number; jamiQabul?: number; jamiSumma?: number;
    }>('apiViborkaOl', limit, qidiruv),
    staleTime: 60_000,
  });
}

/* ── Diagnostika (Monitoring sahifasi uchun) ──────────────────── */
export function useTolaDiagnostika() {
  return useMutation({
    mutationFn: () => gas<Record<string, unknown>>('apiTolaDiagnostika'),
  });
}

export function useObyektDiagnostika() {
  return useMutation({
    mutationFn: ({ obyekt }: { obyekt: string }) =>
      gas<Record<string, unknown>>('apiObyektDiagnostika', obyekt),
  });
}

export function useKeshHolat() {
  return useQuery({
    queryKey: ['keshHolat'],
    queryFn: () => gas<Record<string, unknown>>('apiKeshHolat'),
    staleTime: 30_000,
  });
}

export function useTriggerlar() {
  return useQuery({
    queryKey: ['triggerlar'],
    queryFn: () => gas<Array<{ fn?: string; tur?: string; [k: string]: unknown }>>('apiTriggerlarRoyxat'),
    staleTime: 60_000,
  });
}

/* ── ORALIQLAR (2026-08-16) — narxlash oraliqlari ─────────────────
 * Svodka faylida qaysi qatordan qaysi qatorgacha qaysi KATEGORIYA
 * (ЧЕЛ/МАШ/МАТ/ОБ) turishini belgilaydi. Narxlash dvigateli aynan
 * shundan foydalanadi — noto'g'ri bo'lsa resurs xato kategoriyaga
 * tushadi va narx ham xato bo'ladi.
 * GAS da 3 ta API bor edi, saytda umuman yo'q edi. */
export type Oraliq = { varaq: string; qator: number; kat: string; sarlavha: string };

export function useOraliqlar(obyekt: string) {
  return useQuery({
    queryKey: ['oraliqlar', obyekt],
    queryFn: () => gas<Oraliq[]>('apiOraliqlarOl', obyekt),
    enabled: !!obyekt,
    staleTime: 60_000,
  });
}

/** Svodkani skanlab oraliqlarni AVTOMATIK topadi (tasdiqlash kerak) */
export function useOraliqlarSkan() {
  return useMutation({
    mutationFn: ({ obyekt }: { obyekt: string }) =>
      gas<Oraliq[]>('apiOraliqlarSkan', obyekt),
  });
}

export function useOraliqlarSaqla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ obyekt, oraliqlar }: { obyekt: string; oraliqlar: Oraliq[] }) =>
      gas<unknown>('apiOraliqlarSaqla', obyekt, oraliqlar),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['oraliqlar', v.obyekt] });
      qc.invalidateQueries({ queryKey: ['holat'] });
    },
  });
}

/** Obyektning накрутка koeffitsienti */
export function useNakrutkaKoef(obyekt: string) {
  return useQuery({
    queryKey: ['nakrutkaKoef', obyekt],
    queryFn: () => gas<{ koef?: number; vsego?: number; smeta?: number }>('apiNakrutkaKoef', obyekt),
    enabled: !!obyekt,
    staleTime: 5 * 60 * 1000,
  });
}

/* ── TIZIM HOLATI (2026-08-16) — «muzlatish» kaliti ───────────────
 * Tizim muzlatilsa barcha avtomatik ish (triggerlar, navbat) to'xtaydi.
 * Katta o'zgarish/tuzatish paytida kerak — aks holda fon ishlari
 * yarim holatda ma'lumotni buzishi mumkin.
 * GAS da bor edi, saytda kalit yo'q edi. */
export function useTizimHolat() {
  return useQuery({
    queryKey: ['tizimHolat'],
    queryFn: () => gas<{ paused: boolean }>('apiTizimHolatOl'),
    staleTime: 30_000,
  });
}

export function useTizimHolatOzgartir() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ paused }: { paused: boolean }) =>
      gas<{ ok?: boolean; xabar?: string }>('apiTizimHolatOzgartir', paused),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tizimHolat'] }),
  });
}

/** Kategoriya aniqlash qoidalari (blok kalit so'zlari) */
export function useKategoriya() {
  return useQuery({
    queryKey: ['kategoriya'],
    queryFn: () => gas<Record<string, unknown>>('apiKategoriyaOl'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useKategoriyaSaqla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (o: Record<string, unknown>) => gas<unknown>('apiKategoriyaSaqla', o),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kategoriya'] }),
  });
}
