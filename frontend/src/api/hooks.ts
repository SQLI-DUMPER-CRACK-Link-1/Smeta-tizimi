import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gas } from './client';
import { navbatgaQoshish } from '../_shared/navbat';
import { yangiUid } from '../_shared/idempotent';
import type {
  BossData, TreeNode, PapkaObyekt, Edit, BlQosh, RsQosh,
  Shartnoma, SkladQoldiq, ApiLogYozuv, Tolov,
  AktNode, F2Moslik, F2MoslashNatija, F2JobHolat, NarxlarJavob, DarajaQator, F2UstunConfig, F2Varaq, BuxDashboard, Xarajat,
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
    select: (data) => {
      if (!data || !data.jami) return data;
      // Inject dummy ERP data
      const jamiIshchilar = Math.max(12, Math.floor((data.jami.fakt || 0) / 10000000));
      const jamiTexnikalar = Math.max(3, Math.floor(jamiIshchilar / 4));
      const faolZayavkalar = Math.floor(Math.random() * 10) + 5;
      const halQilinmaganNuqsonlar = Math.floor(Math.random() * 3) + 1;
      
      const objects = data.objects.map(obj => ({
        ...obj,
        ishchilarSoni: Math.max(2, Math.floor((obj.fakt || 0) / 10000000)),
        texnikalarSoni: Math.max(1, Math.floor((obj.fakt || 0) / 40000000)),
        zayavkalarKutilmoqda: Math.floor(Math.random() * 5),
        nuqsonlar: Math.floor(Math.random() * 2),
        kechikishKunlari: Math.floor(Math.random() * 10) - 2, // Manfiy bo'lsa demak ilgarilamoqda
      }));

      return {
        ...data,
        jami: {
          ...data.jami,
          jamiIshchilar, jamiTexnikalar, faolZayavkalar, halQilinmaganNuqsonlar
        },
        objects
      };
    },
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
    staleTime: 2 * 60 * 1000,
  });
}

export function useXarajatlar() {
  return useQuery({
    queryKey: ['xarajatlar'],
    queryFn: () => gas<Xarajat[]>('apiXarajatOl'),
    staleTime: 60 * 1000,
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

/* ============ ERP KADRLAR (MOCK DATA) ============ */
export function useKadrlarData() {
  return useQuery({
    queryKey: ['kadrlar'],
    queryFn: async () => {
      // Hozircha Google Sheets'da API yo'q, shuning uchun sun'iy kutish va mock ma'lumot qaytaramiz
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const bugun = new Date().toISOString().split('T')[0];
      
      const mockIshchilar = [
        { id: '1', ism: 'Azizov Bahrom', kasb: 'Prorab', stavka: 250000, brigada: 'Brigada-1', obyekt: 'Amfiteatr', status: 'faol' },
        { id: '2', ism: 'Karimov Rustam', kasb: 'Usta', stavka: 180000, brigada: 'Brigada-1', obyekt: 'Amfiteatr', status: 'faol' },
        { id: '3', ism: 'Nazarov Umid', kasb: 'Payvandchi', stavka: 200000, brigada: 'Brigada-2', obyekt: 'Suniy kol', status: 'faol' },
        { id: '4', ism: 'Toshmatov Ali', kasb: 'Yordamchi', stavka: 120000, brigada: 'Brigada-1', obyekt: 'Amfiteatr', status: 'faol' },
        { id: '5', ism: 'Eshmatov Vali', kasb: 'Santexnik', stavka: 170000, brigada: 'Brigada-3', obyekt: '10Kv liniya', status: 'faol' },
      ] as any[];

      // 1 dan 31 gacha kunlar uchun tabel matritsasi generatsiyasi
      const oydagiKunlarSoni = 31;
      const mockTabellar = mockIshchilar.map(ishchi => {
         const kunlar: any[] = [];
         let ishlaganKunlar = 0;
         for (let i = 1; i <= oydagiKunlarSoni; i++) {
            // Tasodifiy davomat: 80% kelgan, 10% kelmagan, 10% hali belgilanmagan
            const rand = Math.random();
            let holat = null;
            if (i < 15) { // O'tgan kunlar
               if (rand < 0.8) { holat = 'keldi'; ishlaganKunlar++; }
               else if (rand < 0.9) holat = 'kelmadi';
               else holat = 'kasal';
            }
            kunlar.push({ sana: i, holat });
         }
         return {
            ishchiId: ishchi.id,
            oy: '2026-07',
            kunlar,
            ishlaganKunlar,
            xisoblanganOylik: ishlaganKunlar * ishchi.stavka
         };
      });

      return {
        ishchilar: mockIshchilar,
        tabellar: mockTabellar,
        jamiFaolIshchilar: 5,
        bugungiDavomat: 80,
        oylikFond: mockTabellar.reduce((acc, t) => acc + t.xisoblanganOylik, 0),
        berilganAvanslar: 5500000,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

/* ============ ERP TEXNIKA VA GSM (MOCK DATA) ============ */
export function useTexnikaData() {
  return useQuery({
    queryKey: ['texnika'],
    queryFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const bugun = new Date().toISOString().split('T')[0];
      
      const mockTexnikalar = [
        { id: 't1', nom: 'HOWO Samosval', davlatRaqami: '01 A 123 AA', turi: 'Samosval', holat: 'Ishlayapti', obyekt: 'Amfiteatr', haydovchi: 'Toshmatov Ali', soatlikNorma: 0, 
          oldingiQoldiq: 100 },
        { id: 't2', nom: 'Hyundai Ekskavator', davlatRaqami: '01 B 456 BB', turi: 'Ekskavator', holat: 'Ishlayapti', obyekt: 'Amfiteatr', haydovchi: 'Valiyev Olim', soatlikNorma: 15,
          oldingiQoldiq: 120 },
        { id: 't3', nom: 'XCMG Avtokran 25t', davlatRaqami: '10 C 789 CC', turi: 'Kran', holat: 'Remontda', obyekt: 'Suniy kol', haydovchi: 'Karimov Rustam', soatlikNorma: 12,
          oldingiQoldiq: 40 },
        { id: 't4', nom: 'Shacman Buldozer', davlatRaqami: '11 D 111 DD', turi: 'Buldozer', holat: 'Ishlayapti', obyekt: '10Kv liniya', haydovchi: 'Nazarov Umid', soatlikNorma: 20,
          oldingiQoldiq: 50 },
        { id: 't5', nom: 'Isuzu Bortovoy', davlatRaqami: '01 E 222 EE', turi: 'Boshqa', holat: 'Kutishda', obyekt: 'Baza', haydovchi: 'Azizov Bobur', soatlikNorma: 0,
          oldingiQoldiq: 35 },
      ] as any[];

      const mockTarix = [
        { id: 'tr1', texnikaId: 't1', sana: bugun, kirimLitr: 200, chiqimLitr: 0, motochas: 0, izoh: 'Zapravka qilingan' },
        { id: 'tr2', texnikaId: 't2', sana: bugun, kirimLitr: 0, chiqimLitr: 0, motochas: 5, izoh: 'Kunduzgi smena' },
        { id: 'tr3', texnikaId: 't4', sana: bugun, kirimLitr: 300, chiqimLitr: 0, motochas: 8, izoh: 'Zapravka va To\'liq smena' },
      ] as any[];

      // Real hisob-kitob (O'g'rilik / Pere-rasxod nazorati uchun)
      const hisoblanganTexnikalar = mockTexnikalar.map(t => {
        let qoldiq = t.oldingiQoldiq;
        const oydagiHarakat = mockTarix.filter(tr => tr.texnikaId === t.id);
        
        oydagiHarakat.forEach(h => {
          if (h.kirimLitr) qoldiq += h.kirimLitr;
          if (h.motochas && t.soatlikNorma) {
             qoldiq -= (h.motochas * t.soatlikNorma);
          }
        });
        return { ...t, yoqilgiQoldiq: qoldiq };
      });

      return {
        texnikalar: hisoblanganTexnikalar,
        tarix: mockTarix,
        jamiTexnika: 5,
        faolTexnika: 3,
        remontda: 1,
        oylikYoqilgi: 4850,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

/* ============ ERP TAMINOT VA SKLAD (MOCK DATA) ============ */
export function useTaminotData() {
  return useQuery({
    queryKey: ['taminot'],
    queryFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const bugun = new Date().toISOString().split('T')[0];
      
      const mockZayavkalar = [
        { id: 'z1', sana: bugun, obyekt: 'Amfiteatr', prorab: 'Azizov Bahrom', material: 'Sement M400', birlik: 'tonna', miqdor: 15, status: 'Obyektdan so\'rov', izoh: 'Shoshilinch' },
        { id: 'z2', sana: bugun, obyekt: 'Suniy kol', prorab: 'Karimov Rustam', material: 'Armatura 12mm', birlik: 'tonna', miqdor: 5, status: 'Omborda tekshirilmoqda' },
        { id: 'z3', sana: bugun, obyekt: '10Kv liniya', prorab: 'Eshmatov Vali', material: 'Kabel SIP-4', birlik: 'metr', miqdor: 50, status: 'Ombordan berildi' },
        { id: 'z4', sana: bugun, obyekt: 'Amfiteatr', prorab: 'Azizov Bahrom', material: 'Qum', birlik: 'm3', miqdor: 30, status: 'Bozorda' },
      ] as any[];

      const mockMateriallar = [
        { id: 'm1', guruh: 'Asosiy', nom: 'Sement M400', birlik: 'tonna', obyekt: 'Markaziy Sklad', qoldiq: 4, minQoldiq: 10, smetaNarxi: 850000, faktNarxi: 870000 },
        { id: 'm2', guruh: 'Asosiy', nom: 'Armatura 12mm', birlik: 'tonna', obyekt: 'Markaziy Sklad', qoldiq: 1.5, minQoldiq: 2, smetaNarxi: 9500000, faktNarxi: 9400000 },
        { id: 'm3', guruh: 'Asosiy', nom: 'Beton M300', birlik: 'm3', obyekt: 'Suniy kol', qoldiq: 0, minQoldiq: 5, smetaNarxi: 550000, faktNarxi: 580000 },
        { id: 'm4', guruh: 'Yordamchi', nom: 'Qadoq mix', birlik: 'kg', obyekt: 'Markaziy Sklad', qoldiq: 45, minQoldiq: 10, smetaNarxi: 12000, faktNarxi: 12000 },
      ] as any[];

      const mockPostavshiklar = [
        { id: 'p1', nom: 'Bektemir Metall Invest', telefon: '+998901234567', yetkazilganSumma: 450000000, qarzimiz: 25000000 },
        { id: 'p2', nom: 'Ohangaron Sement', telefon: '+998909876543', yetkazilganSumma: 120000000, qarzimiz: 0 },
        { id: 'p3', nom: 'Stroy Mir (Bozor)', telefon: '+998991112233', yetkazilganSumma: 45000000, qarzimiz: 12000000 },
      ] as any[];

      // Mantiqiy hisob-kitoblar
      const yangiZayavkalarSoni = mockZayavkalar.filter(z => z.status === 'Obyektdan so\'rov' || z.status === 'Omborda tekshirilmoqda').length;
      const kritikMateriallarSoni = mockMateriallar.filter(m => m.qoldiq <= m.minQoldiq).length;
      const jamiQarzimiz = mockPostavshiklar.reduce((acc, p) => acc + p.qarzimiz, 0);
      const smetaNarxidanOshganlar = mockMateriallar.filter(m => m.faktNarxi > m.smetaNarxi).length;

      return {
        zayavkalar: mockZayavkalar,
        materiallar: mockMateriallar,
        postavshiklar: mockPostavshiklar,
        yangiZayavkalarSoni,
        kritikMateriallarSoni,
        jamiQarzimiz,
        smetaNarxidanOshganlar,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

/* ============ ERP SIFAT NAZORATI (TEXNADZOR) (MOCK DATA) ============ */
export function useSifatData() {
  return useQuery({
    queryKey: ['sifat'],
    queryFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 600));
      
      const bugun = new Date();
      const kecha = new Date(bugun); kecha.setDate(kecha.getDate() - 1);
      const utganHafta = new Date(bugun); utganHafta.setDate(utganHafta.getDate() - 5);
      
      const f = (d: Date) => d.toISOString().split('T')[0];
      
      const mockNuqsonlar = [
        { id: 'n1', obyekt: 'Amfiteatr', prorab: 'Azizov Bahrom', sana: f(utganHafta), muddat: f(kecha), tavsif: 'B1 ustunda beton markasi M200 dan past chiqdi (prochnost 15 MPa)', daraja: 'Kritik', status: 'Muddati o\'tgan', izoh: 'Buzib qayta quyish kerak' },
        { id: 'n2', obyekt: 'Suniy kol', prorab: 'Karimov Rustam', sana: f(kecha), muddat: f(new Date(bugun.getTime() + 86400000*2)), tavsif: 'Gidroizolyatsiya qatlamida yoriqlar bor', daraja: 'O\'rta', status: 'Jarayonda' },
        { id: 'n3', obyekt: '10Kv liniya', prorab: 'Eshmatov Vali', sana: f(bugun), muddat: f(new Date(bugun.getTime() + 86400000)), tavsif: 'Truba ulanish joyi yaxshi payvandlanmagan', daraja: 'Oddiy', status: 'Yangi' },
        { id: 'n4', obyekt: 'Amfiteatr', prorab: 'Azizov Bahrom', sana: f(utganHafta), muddat: f(bugun), tavsif: 'Armatura karkasi chizmadan 5sm chetga chiqqan', daraja: 'O\'rta', status: 'Tuzatildi' },
      ] as any[];

      const jamiNuqsonlar = mockNuqsonlar.length;
      const tuzatilganlar = mockNuqsonlar.filter(n => n.status === 'Tuzatildi').length;
      const muddatOtilgan = mockNuqsonlar.filter(n => n.status === 'Muddati o\'tgan').length;
      const kritik = mockNuqsonlar.filter(n => n.daraja === 'Kritik' && n.status !== 'Tuzatildi').length;

      return {
        nuqsonlar: mockNuqsonlar,
        jamiNuqsonlar,
        tuzatilganlar,
        muddatOtilgan,
        kritik
      };
    },
    staleTime: 5 * 60 * 1000,
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
