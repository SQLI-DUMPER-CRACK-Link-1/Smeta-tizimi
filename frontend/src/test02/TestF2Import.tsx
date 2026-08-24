/**
 * TestF2Import.tsx — TIZIM_02: INTERAKTIV F2/AKT FAYLINI IMPORT QILISH
 * ═══════════════════════════════════════════════════════════════════
 *
 * Tizim_01 dagi eng mukammal interaktiv moslashtirish interfeysi endi
 * Tizim_02 uchun (Supabase / Postgres) moslab integratsiya qilindi.
 *
 * ── UCH QADAMLI OQIM ──
 *   1. Fayl yuklash va varaq tanlash.
 *   2. Moslashtirish (Interaktiv) — F2 daraxti chapda, Smeta o'ngda.
 *      Drag-and-drop orqali bog'lash, bekor qilish, qidirish va
 *      solishtiruv (Totals comparison).
 *   3. Smetaga yozish (sbT2AktYarat) — baza tranzaksiyasi va idempotentlik.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FileInput, Upload, FolderOpen, RefreshCw, CheckCircle, AlertTriangle,
  XCircle, Send, ExternalLink, Trash2, Search, CheckCircle2, AlertCircle,
  X, Save
} from 'lucide-react';
import { Sahifa } from '../umumiy/ui/Sahifa';
import { FmtN } from '../lib/format';
import { toast } from '../umumiy/ui/Toast';
import { gas } from '../api/client';
import { IkkiPanel } from '../umumiy/ui/IkkiPanel';
import { F2Daraxt } from '../umumiy/ui/F2Daraxt';
import type { DaraxtTugun } from '../umumiy/ui/F2Daraxt';
import {
  sbT2ObyektlarOlKomp,
  sbT2DaraxtOl,
  sbT2TreeQur,
  sbT2AktYarat,
  yangiOperationId,
  type T2Obyekt,
  type AktNatija
} from '../api/supabase';
import type { TreeNode } from '../api/types';
import { useKompaniya } from './KompaniyaTanlov';

type ManbaFayl = { fayl_id: string; nom: string; sana: string; oqiladi: boolean };

type MosQator = {
  n: number;
  uid?: string;
  /* ⚠️ «ikkilamchi» YO'Q. Tizim_01 dvigateli noaniqlikni o'zi hal
     qiladi: aniq nomzod bo'lmasa qator TOPILMADI bo'ladi va SABABI
     aytiladi. Taxmin qilinmaydi. */
  holat: 'moslandi' | 'topilmadi';
  nom: string;
  birlik: string;
  hajm: number;
  narx: number | null;
  qator_id: number | null;
  /** Dvigatel nega topa olmagani — odamga ko'rsatiladi */
  sabab?: string;
  nomzod_soni?: number;
};

/** `f2MoslashEngine` (35_F2Moslash.js) statistikasi — qaysi qoida ishladi */
type MosStat = {
  moslashti?: number; otkazib?: number;
  scopeHit?: number;   // razdel doirasida topildi
  fuzzyHit?: number;   // nomi taxminan mos keldi
  kanonHit?: number;   // kod kanonlashtirilib topildi
  birlikBlok?: number; // ⚠️ birlik farqli — 1000x xato oldi olindi
  zamenaShubha?: number;
  yetimUrindi?: number; yetimMos?: number;
  rzMos?: number; rzJami?: number;
  ms?: number;
};

type Moslash = {
  ok: boolean;
  xabar?: string;
  kirgan: number;
  moslandi: number;
  topilmadi: number;
  kafolat: boolean;
  qatorlar: MosQator[];
  stat?: MosStat;
  rzDiag?: { nom: string; ok: boolean }[];
  lrv?: { razdel: number; tugun: number };
};

type Ustunlar = Record<string, number>;

type KorishNatija = {
  ok: boolean;
  xabar?: string;
  fayl_qator?: number;
  moslash?: Moslash;
  tree?: any[];
  cols?: Ustunlar;
  avto?: boolean;
  usul?: string;
  hdrQator?: number;
  sozlash?: boolean;
  ms?: number;
  obyekt_id?: number;
  maxCol?: number;
};
const HARF = (i: number): string => {
  let s = '', n = i;
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
};

const USTUN_NOM: Array<[string, string]> = [
  ['kod', 'КОД'], ['nom', 'НОМ'], ['bir', 'БИРЛИК'], ['norma', 'НОРМА'],
  ['obyom', 'ҲАЖМ'], ['narx', 'НАРХ'], ['sum', 'СУММА'],
];

export default function TestF2Import() {
  const { joriy } = useKompaniya();
  const [obyektlar, setObyektlar] = useState<T2Obyekt[]>([]);
  const [obyekt, setObyekt] = useState('');

  // Step 1: Fayl va manba holati
  const [manba, setManba] = useState<ManbaFayl[]>([]);
  const [faylId, setFaylId] = useState('');
  const [varaqlar, setVaraqlar] = useState<string[]>([]);
  const [varaq, setVaraq] = useState('');
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [qolUstun, setQolUstun] = useState<Ustunlar>({});
  const [ustunOchiq, setUstunOchiq] = useState(false);


  // Hujjat sozlamalari
  const [tur, setTur] = useState<'f2' | 'fakt'>('f2');
  const [majburiy, setMajburiy] = useState(false);
  const [oy, setOy] = useState(() => new Date().toISOString().slice(0, 7));
  const [raqam, setRaqam] = useState('');

  // Qadamlar
  const [qadam, setQadam] = useState(0);

  // O'qilgan F2 va Smeta ma'lumotlari
  const [korish, setKorish] = useState<KorishNatija | null>(null);
  const [korilmoqda, setKorilmoqda] = useState(false);
  const [smetaTree, setSmetaTree] = useState<TreeNode[] | null>(null);
  const [smetaLoading, setSmetaLoading] = useState(false);

  const [qolBog, setQolBog] = useState<Record<string, number>>({});
  const [f2Qidiruv, setF2Qidiruv] = useState('');
  const [smetaQidiruv, setSmetaQidiruv] = useState('');
  const [filtr, setFiltr] = useState<'hammasi' | 'boglanmagan' | 'boglangan' | 'manfiy' | 'takliflar'>('hammasi');
  const [ochiqSignal, setOchiqSignal] = useState(0);

  // Saqlangan qoralama holati
  const [draftBor, setDraftBor] = useState(false);

  // Yozish natijasi
  const [yozilmoqda, setYozilmoqda] = useState(false);
  const [natija, setNatija] = useState<AktNatija | null>(null);
  const [opId, setOpId] = useState('');

  // Yangi qator (Dop/Zamena) modal holatlari
  const [qatorQoshModal, setQatorQoshModal] = useState(false);
  const [yangiSmeta, setYangiSmeta] = useState('');
  const [yangiTur, setYangiTur] = useState('rz');
  const [yangiQator, setYangiQator] = useState('');
  const [yangiKod, setYangiKod] = useState('');
  const [yangiNom, setYangiNom] = useState('');
  const [yangiBirlik, setYangiBirlik] = useState('');
  const [yangiHajm, setYangiHajm] = useState('');
  const [yangiNarx, setYangiNarx] = useState('');
  const [qatorLoading, setQatorLoading] = useState(false);
  const [yangiAktBoglashUid, setYangiAktBoglashUid] = useState<string | null>(null);

  // Tanlangan fayl nomini o'qish (scroll) holatlari
  const [takliflar, setTakliflar] = useState<Record<string, any[]>>({});
  const [autoMoslashZarur, setAutoMoslashZarur] = useState(false);
  const [smetaScrollTo, setSmetaScrollTo] = useState<string | null>(null);
  const [tanlanganSmetaVaraqlar, setTanlanganSmetaVaraqlar] = useState<string[]>([]);
  const [undoStack, setUndoStack] = useState<Array<Record<string, number>>>([]);

  // Obyektlarni yuklash
  useEffect(() => {
    sbT2ObyektlarOlKomp(joriy?.id).then((r) => {
      if (!r.ok) return;
      const o = (r.qatorlar as T2Obyekt[]) || [];
      setObyektlar(o);
      setObyekt((p) => p || (o[0]?.nom ?? ''));
    });
  }, [joriy?.id]);

  // Manba fayllarni yuklash
  const manbaYukla = useCallback(() => {
    gas<any>('apiT2ManbaFayllar')
      .then((r) => { if (r.ok) setManba(r.fayllar || []); })
      .catch(() => {});
  }, []);

  useEffect(() => { manbaYukla(); }, [manbaYukla]);

  // Keyboard Shortcuts moved below onAvtoMoslash definition

  // Fayl tanlanganda varaqlarini o'qish
  const faylTanla = async (id: string) => {
    setFaylId(id); setVaraq(''); setVaraqlar([]);
    setKorish(null); setNatija(null); setQadam(0);
    if (!id) return;
    try {
      const r = await gas<any>('apiT2F2Varaqlar', id);
      if (!r.ok) { toast(r.xabar || 'Varaqlar o\'qilmadi', 'danger', undefined, 9000); return; }
      setVaraqlar(r.varaqlar || []);
      if ((r.varaqlar || []).length === 1) setVaraq(r.varaqlar[0]);
    } catch (e: any) { toast(e?.message || 'Xato', 'danger'); }
  };

  // Kompyuterdan fayl yuklash
  const fayllarYukla = async (list: FileList | null) => {
    if (!list?.length) return;
    setYuklanmoqda(true);
    try {
      const f = list[0];
      const b64: string = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result).split(',')[1] || '');
        fr.onerror = () => rej(new Error('Faylni o\'qib bo\'lmadi'));
        fr.readAsDataURL(f);
      });
      const r = await gas<any>('apiT2FaylYukla', f.name, b64, f.type);
      if (!r.ok) { toast(r.xabar || 'Yuklanmadi', 'danger', undefined, 12000); return; }
      toast('Fayl yuklandi', 'ok');
      manbaYukla();
      await faylTanla(r.fayl_id);
    } catch (e: any) {
      toast(e?.message || 'Xato', 'danger', undefined, 9000);
    } finally { setYuklanmoqda(false); }
  };

  // F2 Excel faylini o'qib auto-moslashni boshlash (Baza moslash RPC orqali)
  const kor = async (qoldan?: boolean) => {
    if (!obyekt || !faylId) { toast('Obyekt va fayl tanlang', 'warn'); return; }
    setKorilmoqda(true); setNatija(null);
    try {
      const cfg = qoldan && Object.keys(qolUstun).length
        ? { ...(korish?.cols || {}), ...qolUstun } : null;
      const r = await gas<KorishNatija>('apiT2F2Korish', obyekt, faylId, varaq, cfg);
      setKorish(r);
      setOpId(yangiOperationId());
      if (r.ok) {
        setQadam(1);
        
        /* ⚠️ Backend natijasi ENDI ISHONCHLI.
           Avval bu yerda «backend auto-moslashni O'CHIRDIM» degan izoh
           turardi — o'shanda TO'G'RI edi, chunki backendda mening sodda
           SQL moslashtirishim ishlardi va u global qidirib xato ish
           turining resursini bog'lab yuborardi.
           Endi backendda Tizim_01 ning `f2MoslashEngine` i ishlaydi:
           razdel doirasi · birlik darvozasi · kod-kanon · yetim
           qutqarish. Uning natijasi urug' sifatida olinadi. */
        setQolBog({});
        setAutoMoslashZarur(true);
        toast(
          r.moslash
            ? `F2 o'qildi · ${r.moslash.moslandi}/${r.moslash.kirgan} bog'landi` +
              (r.moslash.topilmadi ? ` · ${r.moslash.topilmadi} qo'lda kerak` : '')
            : "F2 o'qildi",
          'ok'
        );
      } else {
        toast(r.xabar || 'O\'qilmadi', 'danger', undefined, 12000);
      }
    } catch (e: any) {
      setKorish({ ok: false, xabar: e?.message || String(e) });
    } finally { setKorilmoqda(false); }
  };

  // Korish o'zgarganda Smeta daraxtini yuklash
  useEffect(() => {
    if (!korish?.obyekt_id) {
      setSmetaTree(null);
      return;
    }
    setSmetaLoading(true);
    sbT2DaraxtOl(korish.obyekt_id).then((r) => {
      setSmetaLoading(false);
      if (r.ok && r.qatorlar) {
        const tree = sbT2TreeQur(r.qatorlar);
        setSmetaTree(tree);
      } else {
        toast('Smeta daraxtini yuklab bo\'lmadi: ' + (r.error || ''), 'danger');
      }
    });
  }, [korish?.obyekt_id]);

  // Draft borligini tekshirish
  useEffect(() => {
    if (qadam === 1 && korish?.obyekt_id && faylId) {
      const raw = localStorage.getItem(`T2_F2_DRAFT_${korish.obyekt_id}_${faylId}_${tur}_${oy}`);
      setDraftBor(!!raw);
    } else {
      setDraftBor(false);
    }
  }, [qadam, korish?.obyekt_id, faylId, tur, oy]);

  // Draftni yuklash
  const draftTikla = () => {
    if (!korish?.obyekt_id || !faylId) return;
    const raw = localStorage.getItem(`T2_F2_DRAFT_${korish.obyekt_id}_${faylId}_${tur}_${oy}`);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      if (draft.qolBog) setQolBog(draft.qolBog);
      toast('Saqlangan qoralama tiklandi', 'ok');
      setDraftBor(false);
    } catch (e) {}
  };

  // Draftni tozalash/o'chirish
  const draftOchir = () => {
    if (!korish?.obyekt_id || !faylId) return;
    localStorage.removeItem(`T2_F2_DRAFT_${korish.obyekt_id}_${faylId}_${tur}_${oy}`);
    setDraftBor(false);
    toast('Saqlangan qoralama o\'chirildi');
  };

  // Auto-saved draft monitoring
  useEffect(() => {
    if (qadam !== 1 || !korish?.obyekt_id || !faylId) return;
    // Don't overwrite an existing draft with an empty one immediately after loading
    if (Object.keys(qolBog).length === 0) return;
    const draft = {
      vaqt: Date.now(),
      qolBog
    };
    localStorage.setItem(`T2_F2_DRAFT_${korish.obyekt_id}_${faylId}_${tur}_${oy}`, JSON.stringify(draft));
  }, [qolBog, qadam, korish?.obyekt_id, faylId, tur, oy]);

  // F2 barg tugunlarini topish (DFS) — Tizim_01 barglar() mantiqiga o'xshash:
  // rz dan tashqari, BOLASIZ har qanday tugun barg hisoblanadi.
  // bl bolasiz bo'lsa ham barg! (Tizim_01: «bl summasi bolalarining yig'indisi
  // bo'lgani uchun uni QO'SHSAK ikki marta hisoblanadi» — bolali bl lar HISOBLANMAYDI)
  const aktBarglar = useMemo(() => {
    const out: any[] = [];
    const traverse = (nodes: any[]) => {
      nodes.forEach((n) => {
        const bolalar = n.children ?? [];
        if (n.type !== 'rz' && bolalar.length === 0) {
          out.push(n);
        }
        if (bolalar.length) traverse(bolalar);
      });
    };
    if (korish?.tree) traverse(korish.tree);
    return out;
  }, [korish]);

  // Helper: tree node search
  const findAktNode = (nodes: any[], uid: string): any | null => {
    for (const n of nodes) {
      if (n.uid === uid) return n;
      if (n.children) {
        const found = findAktNode(n.children, uid);
        if (found) return found;
      }
    }
    return null;
  };

  const findSmetaNode = (nodes: TreeNode[], id: number): TreeNode | null => {
    for (const n of nodes) {
      if (n.id === id) return n;
      if (n.children) {
        const found = findSmetaNode(n.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  // Matching check functions
  const bogMi = useCallback((kalit: string | undefined) => {
    return kalit !== undefined ? qolBog[kalit] !== undefined : false;
  }, [qolBog]);

  const getSmetaId = useCallback((kalit: string | undefined): number | undefined => {
    return kalit !== undefined ? qolBog[kalit] : undefined;
  }, [qolBog]);

  const smetaBogMi = useCallback((smetaKalit: string) => {
    const smetaId = Number(smetaKalit);
    if (!smetaId) return false;
    return Object.values(qolBog).includes(smetaId);
  }, [qolBog]);

  // Drop linking function
  const qolBogla = (aktKalit: string, smetaKalit: string) => {
    if (smetaKalit.startsWith('rz:')) {
      toast('Ish/resursni faqat smeta ish/resursiga bog\'lash mumkin', 'warn');
      return;
    }
    const smetaId = Number(smetaKalit);
    if (!smetaId) return;

    if (smetaBogMi(smetaKalit)) {
      toast('Bu smeta qatori allaqachon band', 'warn');
      return;
    }

    const n = findAktNode(korish?.tree || [], aktKalit);
    if (!n) {
      toast('Akt qatori topilmadi', 'danger');
      return;
    }

    // ⚠️ Tur va Nom mosligini tekshirish (ZAMENA xavfi)
    if (smetaTree) {
      const sn = findSmetaNode(smetaTree, smetaId);
      if (sn && n.type && sn.type) {
        // 1. Tur mosligi
        const turMos = n.type === sn.type;
        if (!turMos) {
          const tasd = window.confirm(
            `⚠️ Tur mos kelmaydi!\n` +
            `F2: "${n.nom}" (${n.type?.toUpperCase()})\n` +
            `Smeta: "${sn.nom}" (${sn.type?.toUpperCase()})\n\n` +
            `Bu NOTO'G'RI bog'lanish bo'lishi mumkin (masalan, ish turi o'rniga material bog'lamoqchisiz).\n` +
            `Shunda ham bog'laymizmi? (OK = Ha, Bekor = Yo'q)`
          );
          if (!tasd) return;
        }

        // 2. Nom va kod mosligi (Zamena qilinishini sezish uchun)
        const nNomF = (s: string | undefined) => String(s || '').toUpperCase().replace(/[^А-ЯЁA-Z0-9]/g, '');
        const aKod = nNomF(n.kod); const sKod = nNomF(sn.kod);
        const aNom = nNomF(n.nom); const sNom = nNomF(sn.nom);

        let isExactMatch = false;
        if (n.type === 'bl') {
            const kodMos = (aKod && sKod && aKod === sKod) || (!aKod || !sKod);
            if (kodMos && aNom === sNom) isExactMatch = true;
        } else {
            if (aNom && sNom && aNom === sNom) isExactMatch = true;
        }

        if (!isExactMatch) {
          const tasd = window.confirm(
            `⚠️ ZAMENA: F2 qatori smeta qatoridan farq qiladi!\n\n` +
            `F2: [${n.kod}] ${String(n.nom).slice(0, 50)}\n` +
            `Smeta: [${sn.kod}] ${String(sn.nom).slice(0, 50)}\n\n` +
            `Agar bog'lasangiz, bu F2 dagi hajm faktga shu smeta qatori ostida yoziladi (fakt oshib ketishi xavfi bor).\n` +
            `Davom etamizmi? (OK = Ha, Bekor = Yo'q)`
          );
          if (!tasd) return;
        }
      }
    }

    const newBog: Record<string, number> = { [aktKalit]: smetaId };

    if (n.type === 'bl' && smetaTree) {
      const smetaNode = findSmetaNode(smetaTree, smetaId);
      if (smetaNode) {
        const smetaChildren = smetaNode.children || [];
        const f2Children = n.children || [];

        const nNom = (s: string | undefined) => String(s || '').toUpperCase().replace(/[^А-ЯЁA-Z0-9]/g, '');
        const nKod = (s: string | undefined) => {
          let x = String(s || '').toUpperCase().replace(/[^А-ЯЁA-Z0-9]/g, '');
          return x.replace(/^0+/, '') || x;
        };
        const nBir = (s: string | undefined) => {
          let b = String(s || '').toUpperCase().replace(/\s+/g, '').replace(/[^А-ЯЁA-Z]/g, '');
          const m: any = { 'ШТ': 'ШТ', 'ДАНА': 'ШТ', 'ШТУК': 'ШТ', 'М3': 'М3', 'КУБ': 'М3', 'М2': 'М2', 'КВ': 'М2', 'Т': 'Т', 'ТОННА': 'Т', 'КГ': 'КГ', 'М': 'М', 'ПОГ': 'М', 'КОМПЛ': 'КОМПЛ', 'КМП': 'КОМПЛ' };
          return m[b] || b;
        };

        const alreadyBound = (scId: number) =>
          smetaBogMi(String(scId)) || Object.values(newBog).includes(scId);

        f2Children.forEach((fc: any) => {
          const fcKod = nKod(fc.kod);
          const fcNom = nNom(fc.nom);
          const fcBir = nBir(fc.bir || fc.birlik);

          // Agar bu F2 bola allaqachon bog'langan bo'lsa, o'tkazib yuborish
          if (qolBog[fc.uid] !== undefined || newBog[fc.uid] !== undefined) return;

          let bestChildMatch: any = null;
          let bestBall = 0;

          smetaChildren.forEach((sc: any) => {
            if (!sc.id || alreadyBound(sc.id) || sc.type !== fc.type) return;
            const scKod = nKod(sc.kod);
            const scNom = nNom(sc.nom);
            const scBir = nBir(sc.birlik);

            /* ⚠️ BIRLIK — DARVOZA, ball emas.
               Avval birlik atigi +10 ball edi: «АРМАТУРА / Т» ↔
               «АРМАТУРА / КГ» 30+20 = 50 ≥ 40 bo\'lib jimgina
               bog\'lanardi — 1000 BARAVAR xato.
               Dvigateldagi `_birMos` qoidasi: biri bo\'sh bo\'lsa hukm
               qilmaymiz, ikkalasi ma\'lum va farqli bo\'lsa — BEKOR. */
            if (fcBir && scBir && scBir !== fcBir) return;

            let ball = 0;
            if (fcKod && scKod === fcKod) ball += 50;
            if (fcNom && scNom === fcNom) ball += 30;
            if (fcBir && scBir === fcBir) ball += 10;
            if (fcNom && scNom && (scNom.includes(fcNom) || fcNom.includes(scNom))) ball += 20;

            if (ball > bestBall) {
              bestBall = ball;
              bestChildMatch = sc;
            }
          });

          if (bestChildMatch && bestBall >= 40) {
            newBog[fc.uid] = bestChildMatch.id;
          }
        });
      }
    }

    setUndoStack((prev) => [...prev.slice(-29), qolBog]);   // keep last 30
    setQolBog((prev) => ({ ...prev, ...newBog }));
    toast(`✓ Bog'landi: ${String(n.nom).slice(0, 40)}`);
  };

  const qolGapDop = (aktKalit?: string, smetaKalit?: string) => {
    // Smeta panelidan "qo'shish" tugmasi bosilganda qatorQoshModal ochiladi
    if (smetaKalit && !smetaKalit.startsWith('rz:') && smetaTree) {
      const sn = findSmetaNode(smetaTree, Number(smetaKalit));
      if (sn) {
        setYangiSmeta(sn.varaq || '');
        let targetRow = sn.row || '';
        // Agar resurs bo'lsa (rs/mat/ob), backendga ona BLOK qatori kerak
        if (sn.type === 'rs' || sn.type === 'mat' || sn.type === 'ob') {
          let parentBlRow: number | null = null;
          const findParentBl = (nodes: any[]) => {
            for (const rz of nodes) {
              if (rz.children) {
                for (const bl of rz.children) {
                  if (bl.type === 'bl') {
                    if (bl.id === sn.id) { parentBlRow = bl.row; return; }
                    if (bl.children) {
                      for (const child of bl.children) {
                        if (child.id === sn.id) { parentBlRow = bl.row; return; }
                      }
                    }
                  }
                }
              }
            }
          };
          findParentBl(smetaTree);
          if (parentBlRow) targetRow = parentBlRow;
        }
        setYangiQator(String(targetRow));
      }
    }
    // F2 panelidan "qo'shish" bosilsa, F2 node ma'lumotlari bilan to'ldirish
    if (aktKalit && korish?.tree) {
      const n = findAktNode(korish.tree, aktKalit);
      if (n) {
        setYangiNom(String(n.nom || ''));
        setYangiKod(String(n.kod || ''));
        setYangiBirlik(String(n.bir || n.birlik || ''));
        setYangiHajm(String(n.hajm ?? ''));
        setYangiNarx(String(n.narx ?? ''));
        setYangiTur(n.type === 'bl' ? 'bl' : n.type === 'mat' ? 'mat' : n.type === 'ob' ? 'ob' : 'rs');
        setYangiAktBoglashUid(aktKalit); // Zamena uchun eslab qolamiz
      }
    } else {
      setYangiAktBoglashUid(null);
    }
    setQatorQoshModal(true);
  };

  // Unlink functions
  const bogBekor = (aktKalit: string) => {
    const n = findAktNode(korish?.tree || [], aktKalit);
    const uidsToRemove = [aktKalit];
    if (n && n.type === 'bl') {
      const collectUids = (node: any) => {
        (node.children || []).forEach((c: any) => {
          uidsToRemove.push(c.uid);
          if (c.children) collectUids(c);
        });
      };
      collectUids(n);
    }

    setUndoStack((prev) => [...prev.slice(-29), qolBog]);
    setQolBog((prev) => {
      const next = { ...prev };
      uidsToRemove.forEach((uid) => {
        delete next[uid];
      });
      return next;
    });
    toast("Bog'lanish bekor qilindi");
  };

  const smetaBogBekor = (smetaKalit: string) => {
    const smetaId = Number(smetaKalit);
    if (!smetaId) return;

    let foundAktKalit: string | null = null;
    for (const [aKey, sId] of Object.entries(qolBog)) {
      if (sId === smetaId) { foundAktKalit = aKey; break; }
    }

    if (foundAktKalit) {
      bogBekor(foundAktKalit);
    }
  };

  // Reset mappings to empty — with confirmation
  const resetBinds = () => {
    if (!window.confirm(`Barcha ${Object.keys(qolBog).length} ta bog'lanish o'chiriladi. Davom etasizmi?`)) return;
    setUndoStack((prev) => [...prev.slice(-29), qolBog]);
    setQolBog({});
    toast("Barcha bog'lanishlar tozalandi");
  };

  /**
   * Dvigatel bergan mosliklarni qo'llaydi.
   *
   * ⚠️ BU YERDA AVVAL FRONTEND O'ZINING BALL TIZIMI BOR EDI:
   *     kod +50 · nom +30 · birlik +10 · nom ichida +20 · ball>=40 → bog'la
   *
   * Nega olib tashlandi: BIRLIK atigi 10 ball edi va DARVOZA emas edi.
   * «АРМАТУРА / Т» (smeta) ↔ «АРМАТУРА / КГ» (akt) → 30+20 = 50 ≥ 40
   * → jimgina bog'lanardi. Bu 1000 BARAVAR xato.
   * Xuddi shunday ПК↔ПБ (boshqa mahsulot) ham «nom ichida» +20 bilan
   * o'tib ketardi.
   *
   * `f2MoslashEngine` (35_F2Moslash.js) da bularning har biri DARVOZA:
   * birlik mos kelmasa moslik BEKOR qilinadi va sabab yoziladi.
   * Shuning uchun qaror GASda qabul qilinadi, bu yer faqat OYNA.
   * (Xotira: «og'ir mantiq GAS da, frontend oyna».)
   */
  const dvigatelniQolla = (jim = false) => {
    const mos = korish?.moslash;
    if (!mos || !mos.qatorlar) {
      if (!jim) toast('Moslashtirish natijasi yo\'q — faylni qayta o\'qing', 'warn');
      return 0;
    }
    const band = new Set<number>(Object.values(qolBog));
    const yangiBog: Record<string, number> = {};
    let count = 0;

    for (const q of mos.qatorlar) {
      if (q.holat !== 'moslandi' || q.qator_id == null || !q.uid) continue;
      if (qolBog[q.uid] !== undefined) continue;   // odam qo'lda bog'lagan — tegmaymiz
      if (band.has(q.qator_id)) continue;          // smeta qatori allaqachon band
      yangiBog[q.uid] = q.qator_id;
      band.add(q.qator_id);
      count++;
    }

    if (!count) {
      if (!jim) toast('Yangi moslik yo\'q — hammasi allaqachon bog\'langan', 'warn');
      return 0;
    }
    setUndoStack((prev) => [...prev.slice(-29), qolBog]);
    setQolBog((prev) => ({ ...prev, ...yangiBog }));
    if (!jim) {
      const s = mos.stat || {};
      toast(
        `🎯 ${count} ta qator bog'landi` +
        (s.birlikBlok ? ` · ⚖ ${s.birlikBlok} ta birlik farqi bloklandi` : ''),
        'ok'
      );
    }
    return count;
  };


  const applyAllTakliflar = dvigatelniQolla;
  const onAvtoMoslash = dvigatelniQolla;

  /* Fayl o'qilgandan keyin dvigatel natijasi DARROV qo'llanadi.
     ⚠️ Avval bu `takliflar` (frontend ball tizimi) tayyor
     bo'lishini kutardi — ya'ni ekranga aynan o'sha xavfli
     taxminlar tushardi. */
  useEffect(() => {
    if (autoMoslashZarur && korish?.moslash) {
      dvigatelniQolla(true);
      setAutoMoslashZarur(false);
    }
  }, [korish?.moslash, autoMoslashZarur]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setQatorQoshModal(false);
        return;
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        toast("Qoralama avtomatik saqlangan", "ok");
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        setUndoStack((prev) => {
          if (prev.length === 0) {
            toast("Qaytarish uchun tarix yo'q", "warn");
            return prev;
          }
          const last = prev[prev.length - 1];
          setQolBog(last);
          toast("✓ Qaytarildi (Ctrl+Z)", "ok");
          return prev.slice(0, -1);
        });
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        onAvtoMoslash();
        return;
      }

      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'SELECT') {
        e.preventDefault();
        const el = document.getElementById('f2-search-input');
        if (el) el.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [qolBog, onAvtoMoslash]);


  // Barcha bog'lanmagan F2 qatorlari uchun takliflarni hisoblash (Fuzzy heuristic from Tizim_01)
  useEffect(() => {
    if (!korish?.tree || !smetaTree) {
      setTakliflar({});
      return;
    }

    const nNom = (s: string | undefined) => String(s || '').toUpperCase().replace(/[^А-ЯЁA-Z0-9]/g, '');
    const nKod = (s: string | undefined) => {
      let x = String(s || '').toUpperCase().replace(/[^А-ЯЁA-Z0-9]/g, '');
      return x.replace(/^0+/, '') || x;
    };
    const nBir = (s: string | undefined) => {
      let b = String(s || '').toUpperCase().replace(/\s+/g, '').replace(/[^А-ЯЁA-Z]/g, '');
      const m: any = { 'ШТ': 'ШТ', 'ДАНА': 'ШТ', 'ШТУК': 'ШТ', 'М3': 'М3', 'КУБ': 'М3', 'М2': 'М2', 'КВ': 'М2', 'Т': 'Т', 'ТОННА': 'Т', 'КГ': 'КГ', 'М': 'М', 'ПОГ': 'М', 'КОМПЛ': 'КОМПЛ', 'КМП': 'КОМПЛ' };
      return m[b] || b;
    };

    // Smeta daraxtidan barcha kerakli tugunlarni yig'ish (rz dan tashqari)
    const smetaQatorlar: TreeNode[] = [];
    const collectSmeta = (nodes: TreeNode[]) => {
      nodes.forEach(n => {
        const bolalar = n.children ?? [];
        if (n.type !== 'rz') {
          smetaQatorlar.push(n);
        }
        if (bolalar.length) collectSmeta(bolalar);
      });
    };
    collectSmeta(smetaTree);

    // Pre-normalize all Smeta leaf nodes once
    const normalizedSmeta = smetaQatorlar.map(sq => ({
      sq,
      sk: nKod(sq.kod),
      sn: nNom(sq.nom),
      sb: nBir(sq.birlik)
    }));

    const tkl: Record<string, any[]> = {};
    const traverseF2 = (nodes: any[]) => {
      nodes.forEach(n => {
        const uid = n.uid;
        const bolalar = n.children ?? [];
        // rz dan tashqari hamma tugunlarga taklif izlash (ish turi va resurslar)
        if (uid && n.type !== 'rz') {
          const fk = nKod(n.kod);
          const fn = nNom(n.nom);
          const fb = nBir(n.bir || n.birlik);

          let candidates: any[] = [];
          normalizedSmeta.forEach(({ sq, sk, sn, sb }) => {
            // Faqat bir xil tur mos keladi (rs↔rs, mat↔mat, ob↔ob, bl↔bl)
            if (sq.type !== n.type) return;
            /* ⚠️ Birlik farqli nomzod TAKLIF sifatida ham chiqmaydi.
               Ro\'yxatda birinchi turgan nomzodni odam ishonch bilan
               bosadi — Т↔КГ ni birinchi qilib qo\'yish tuzoq bo\'lardi.
               Kerak bo\'lsa odam qo\'lda sudrab bog\'lay oladi. */
            if (fb && sb && sb !== fb) return;
            let ball = 0;
            if (fk && sk === fk) ball += 50;
            if (fn && sn === fn) ball += 30;
            if (fb && sb === fb) ball += 10;
            if (fn && sn && (sn.indexOf(fn) >= 0 || fn.indexOf(sn) >= 0)) ball += 20;

            if (ball > 0) {
              candidates.push({
                id: sq.id,
                nom: sq.nom,
                kod: sq.kod,
                birlik: sq.birlik,
                varaq: sq.varaq,
                row: sq.row,
                ball: ball
              });
            }
          });

          if (candidates.length > 0) {
            candidates.sort((a, b) => b.ball - a.ball);
            tkl[uid] = candidates.slice(0, 5);
          }
        }
        if (bolalar.length) traverseF2(bolalar);
      });
    };
    traverseF2(korish.tree);
    setTakliflar(tkl);
  }, [korish?.tree, smetaTree]);

  const findSmetaNodeByVaraqRow = (nodes: TreeNode[], varaq: string, row: number): TreeNode | null => {
    for (const n of nodes) {
      if (n.varaq === varaq && n.row === row) return n;
      if (n.children) {
        const found = findSmetaNodeByVaraqRow(n.children, varaq, row);
        if (found) return found;
      }
    }
    return null;
  };

  const onTaklifTanlandi = (aktUid: string, smetaVaraqRow: string) => {
    const [vrq, rwStr] = smetaVaraqRow.split('#');
    const rw = Number(rwStr);
    if (!smetaTree) return;
    const node = findSmetaNodeByVaraqRow(smetaTree, vrq, rw);
    if (node && node.id) {
      qolBogla(aktUid, String(node.id));
    }
  };

  // Dop/Zamena qator qo'shish modalini ko'rsatish
  const onDopClick = (aktKalit: string) => {
    if (!korish?.tree) return;
    const n = findAktNode(korish.tree, aktKalit);
    if (!n) return;

    setYangiNom(String(n.nom || ''));
    setYangiKod(String(n.kod || ''));
    setYangiBirlik(String(n.bir || n.birlik || ''));
    setYangiHajm(String(n.hajm ?? ''));
    setYangiNarx(String(n.narx ?? ''));
    setYangiTur(n.type === 'bl' ? 'bl' : 'rs');

    if (korish.obyekt_id) {
      const firstSheet = smetaTree && smetaTree[0]?.varaq ? smetaTree[0].varaq : (varaqlar[0] || '');
      setYangiSmeta(firstSheet);
    }
    setYangiQator('');
    setQatorQoshModal(true);
  };

  const onQatorQosh = (smetaKalit: string) => {
    if (!smetaTree) return;
    const node = findSmetaNode(smetaTree, Number(smetaKalit));
    if (!node) return;

    setYangiSmeta(node.varaq);
    setYangiQator(String(node.row));
    setYangiNom('');
    setYangiKod('');
    setYangiBirlik('');
    setYangiHajm('');
    setYangiNarx('');
    setYangiAktBoglashUid(null);
    setQatorQoshModal(true);
  };

  const onQatorSaqlash = async () => {
    if (!obyekt || !yangiSmeta || !yangiNom || !korish?.obyekt_id) {
      toast("Obyekt, Smeta (varaq) va Nomni kiritish majburiy!", "danger");
      return;
    }
    if (yangiTur !== 'rz' && (!yangiKod || !yangiBirlik || !yangiHajm)) {
      toast("Ish yoki resurs uchun Kod, Birlik va Hajm kiritilishi shart (Yuridik aniqlik uchun)!", "danger");
      return;
    }

    setQatorLoading(true);
    try {
      const res = await gas<{ ok: boolean; row?: number; xabar?: string }>('apiSmetaQatorQosh', obyekt, yangiSmeta, yangiTur, yangiQator, yangiKod, yangiNom, yangiBirlik, yangiHajm, yangiNarx);
      if (res && res.ok) {
        toast("Yangi qator Google Sheets'ga qo'shildi. Supabase sinxronizatsiya qilinmoqda...", "ok");
        
        // Sync to Supabase via apiT2ObyektImport
        const impRes = await gas<any>('apiT2ObyektImport', obyekt);
        if (impRes && impRes.ok) {
          toast("✓ Baza muvaffaqiyatli yangilandi", "ok");
          setQatorQoshModal(false);
          setYangiNom(''); setYangiKod(''); setYangiBirlik(''); setYangiHajm(''); setYangiNarx(''); setYangiQator('');
          
          // Reload tree from Supabase
          setSmetaLoading(true);
          const r = await sbT2DaraxtOl(korish.obyekt_id as number);
          setSmetaLoading(false);
          if (r.ok && r.qatorlar) {
            const tree = sbT2TreeQur(r.qatorlar);
            setSmetaTree(tree);
            
            // Avto-bog'lash (agar F2 dan ochilgan bo'lsa)
            if (yangiAktBoglashUid && res.row) {
              const findNewNode = (nodes: any[]): number | null => {
                for (const node of nodes) {
                  if (node.varaq === yangiSmeta && node.row === res.row) return node.id;
                  if (node.children) {
                    const found = findNewNode(node.children);
                    if (found) return found;
                  }
                }
                return null;
              };
              const newId = findNewNode(tree);
              if (newId) {
                setUndoStack((prev) => [...prev.slice(-29), qolBog]);
                setQolBog((prev) => ({ ...prev, [yangiAktBoglashUid]: newId }));
                toast(`✓ Yangi qator yaratildi va avtomatik bog'landi!`, 'ok');
              }
            }
            setYangiAktBoglashUid(null);
          }
        } else {
          toast(impRes?.xabar || "Supabase import xatosi", "danger");
        }
      } else {
        toast(res?.xabar || "Xatolik", "danger");
      }
    } catch(e: any) {
      toast(e.message || String(e), "danger");
    }
    setQatorLoading(false);
  };

  // Akt tarafidan bosilganda smeta tarafida mos qatorni ochib scroll qilish
  const aktOtishClick = (aktUid: string) => {
    const smetaId = getSmetaId(aktUid);
    if (!smetaId) return;
    setSmetaScrollTo(null);
    requestAnimationFrame(() => setSmetaScrollTo(String(smetaId)));
  };

  // Daraxtlarni qidiruv bo'yicha filtrlash (DFS)
  const filterDaraxt = (tree: any[], qidiruv: string) => {
    if (!qidiruv) return tree;
    const q = qidiruv.toLowerCase();
    const dfs = (nodes: any[]): any[] => {
      let result: any[] = [];
      nodes.forEach(n => {
        let isMatch = (n.nom && n.nom.toLowerCase().includes(q)) || (n.kod && n.kod.toLowerCase().includes(q));
        let children = n.children ? dfs(n.children) : [];
        if (isMatch || children.length > 0) result.push({ ...n, children });
      });
      return result;
    };
    return dfs(tree);
  };

  // F2 daraxtini faol holat filtri bo'yicha filtrlash (DFS)
  const filterByStatus = (nodes: any[]): any[] => {
    const dfs = (ns: any[]): any[] => {
      const res: any[] = [];
      ns.forEach(n => {
        let match = false;
        // aktBarglar bilan bir xil logika: rz dan tashqari, bolasiz tugunlar
        const isBarg = n.type !== 'rz' && !(n.children?.length);
        if (isBarg) {
          const isBog = bogMi(n.uid);
          if (filtr === 'hammasi') match = true;
          else if (filtr === 'boglangan') match = isBog;
          else if (filtr === 'boglanmagan') match = !isBog;
          else if (filtr === 'manfiy') match = (n.hajm ?? 0) < 0 || (n.summa ?? 0) < 0;
          else if (filtr === 'takliflar') match = !isBog && takliflar[n.uid] !== undefined && takliflar[n.uid].length > 0;
        }
        let children = n.children ? dfs(n.children) : [];
        if (match || children.length > 0) {
          res.push({ ...n, children });
        }
      });
      return res;
    };
    return dfs(nodes);
  };

  // JSX F2 Daraxti va Smeta Daraxti uchun ma'lumotlar
  const aktDaraxtMapped = useMemo(() => {
    if (!korish?.tree) return [];
    return mapAktToDaraxt(korish.tree);
  }, [korish?.tree]);

  const aktDaraxtFiltrlangan = useMemo(() => {
    let tree = aktDaraxtMapped;
    if (f2Qidiruv) {
      tree = filterDaraxt(tree, f2Qidiruv);
    }
    if (filtr !== 'hammasi') {
      tree = filterByStatus(tree);
    }
    return tree;
  }, [aktDaraxtMapped, f2Qidiruv, filtr, qolBog]);

  // Reverse index for bound nodes: Smeta ID -> F2 Node
  const smetaBoglanganAktMap = useMemo(() => {
    const map = new Map<number, any>();
    if (!korish?.tree) return map;
    
    // Find all F2 nodes
    const f2Leafs = new Map<string, any>();
    const traverseF2 = (nodes: any[]) => {
      nodes.forEach(n => {
        if (n.uid) f2Leafs.set(n.uid, n);
        if (n.children) traverseF2(n.children);
      });
    };
    traverseF2(korish.tree);

    Object.entries(qolBog).forEach(([f2Uid, smetaId]) => {
      const f2Node = f2Leafs.get(f2Uid);
      if (f2Node) {
        map.set(smetaId, f2Node);
      }
    });
    return map;
  }, [qolBog, korish?.tree]);

  // All unique sheet names in smetaTree
  const smetaVaraqlari = useMemo(() => {
    if (!smetaTree) return [];
    const set = new Set<string>();
    const collect = (nodes: TreeNode[]) => {
      nodes.forEach(n => {
        if (n.varaq) set.add(n.varaq);
        if (n.children) collect(n.children);
      });
    };
    collect(smetaTree);
    return Array.from(set).sort();
  }, [smetaTree]);

  const smetaDaraxtFiltrlangan = useMemo(() => {
    if (!smetaTree) return [];
    let tree = mapSmetaToDaraxt(smetaTree);

    if (tanlanganSmetaVaraqlar.length > 0) {
      const matchVaraq = (node: DaraxtTugun): boolean => {
        if (node.type !== 'rz') {
          const v = String(node.kalit).split('#')[0];
          return tanlanganSmetaVaraqlar.includes(v);
        }
        if (node.children) {
          return node.children.some(c => matchVaraq(c));
        }
        return false;
      };

      const filterTree = (nodes: DaraxtTugun[]): DaraxtTugun[] => {
        return nodes
          .filter(n => matchVaraq(n))
          .map(n => ({
            ...n,
            children: n.children ? filterTree(n.children) : undefined
          }));
      };

      tree = filterTree(tree);
    }

    return filterDaraxt(tree, smetaQidiruv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smetaTree, smetaQidiruv, smetaBoglanganAktMap, tanlanganSmetaVaraqlar]);

  // Tree mappers to DaraxtTugun format
  function mapAktToDaraxt(nodes: any[]): DaraxtTugun[] {
    const formatVol = (v: any) => {
      const num = Number(v ?? 0);
      return Number.isInteger(num) ? String(num) : num.toFixed(3);
    };

    return nodes.map(n => {
      const isRz = n.type === 'rz';
      
      const belgiElement = isRz ? undefined : (
        <div className="flex gap-2 items-center text-[10px] text-text-dim whitespace-nowrap">
          {n.hajm ? <span>Hajm: <span className="font-semibold text-emerald-400">{formatVol(n.hajm)}</span></span> : null}
          <span>Summa: <FmtN val={n.summa} /> so'm</span>
        </div>
      );

      return {
        kalit: n.uid,
        type: n.type,
        nom: n.nom || '',
        kod: n.kod,
        bir: n.bir,
        hajm: n.hajm,
        summa: n.summa,
        manfiy: (n.hajm ?? 0) < 0 || (n.summa ?? 0) < 0,
        belgi: belgiElement,
        children: n.children ? mapAktToDaraxt(n.children) : undefined
      };
    });
  }

  function mapSmetaToDaraxt(nodes: TreeNode[]): DaraxtTugun[] {
    const formatVol = (v: any) => {
      const num = Number(v ?? 0);
      return Number.isInteger(num) ? String(num) : num.toFixed(3);
    };

    return nodes.map(n => {
      const isRz = n.type === 'rz';
      const smetaId = n.id;
      
      let boglanganAktText = null;
      
      // sbT2TreeQur qoldiqni har doim 0 qilib beradi, chunki bu shunchaki daraxt.
      // VIZUAL uchun qoldiqni smetaHajm bilan teng deb faraz qilamiz:
      let bazaviyQoldiq = (n.qoldiq && n.qoldiq !== 0) ? n.qoldiq : (n.smetaHajm ?? 0);
      let joriyQoldiq = bazaviyQoldiq;

      if (smetaId) {
        const aktQator = smetaBoglanganAktMap.get(smetaId);
        if (aktQator) {
          const joriyF2Hajm = Number(aktQator.hajm ?? 0);
          joriyQoldiq = bazaviyQoldiq - joriyF2Hajm;
          
          const farq = bazaviyQoldiq - joriyF2Hajm;

          boglanganAktText = (
            <div className="mt-1 p-1 px-2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex justify-between items-center text-[10px] min-w-[200px]">
              <div className="flex items-center gap-2">
                <span>+ {formatVol(aktQator.hajm)} (F2: {aktQator.kod || 'kodsiz'}) - <FmtN val={aktQator.summa}/> so'm</span>
                {Math.abs(farq) > 0.001 && (
                  <span className={farq < 0 ? 'text-red-400 font-bold ml-1' : 'text-orange-300 ml-1'}>
                    Farq: {farq > 0 ? `+${formatVol(farq)}` : formatVol(farq)}
                  </span>
                )}
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); bogBekor(aktQator.uid); }} 
                className="ml-4 hover:text-red-400 font-bold px-1.5 rounded bg-black/20 hover:bg-black/40 transition-colors text-slate-300 cursor-pointer" 
                title="Bekor qilish"
              >
                ✕
              </button>
            </div>
          );
        }
      }

      let qoldiqColor = 'text-orange-400';
      let qoldiqBelgi = '';
      if (Math.abs(joriyQoldiq) < 0.001) {
        qoldiqColor = 'text-emerald-400 font-bold';
        qoldiqBelgi = ' ✓';
      } else if (joriyQoldiq < 0) {
        qoldiqColor = 'text-rose-400 font-bold';
        qoldiqBelgi = ' ⚠';
      }

      const belgiElement = isRz ? undefined : (
        <div className="flex flex-col items-end text-[10px] font-sans text-text-dim">
          <div className="flex gap-1.5 items-center whitespace-nowrap opacity-80">
            {n.smetaHajm != null && <span>Smeta: <span className="font-medium text-white">{formatVol(n.smetaHajm)}</span></span>}
            {n.fakt != null && n.fakt > 0 && <span>| O'tgan F2: <span className="text-blue-400">{formatVol(n.fakt)}</span></span>}
            <span>
              | Qoldiq: <span className={qoldiqColor}>{formatVol(joriyQoldiq)}{qoldiqBelgi}</span>
            </span>
          </div>
          {boglanganAktText}
        </div>
      );

      return {
        kalit: smetaId ? String(smetaId) : `rz:${n.nom}`,
        type: n.type,
        nom: n.nom || '',
        kod: n.kod,
        bir: n.birlik,
        hajm: n.smetaHajm,
        summa: n.smeta,
        isQosh: n.isQosh,
        isZamena: n.isZamena,
        manfiy: (n.smetaHajm ?? 0) < 0,
        belgi: belgiElement,
        children: n.children ? mapSmetaToDaraxt(n.children) : undefined
      };
    });
  }

  // Jami summalarni hisoblash
  // MUHIM: Ikkala taraf ham F2 faylning O'Z summasini ishlatadi.
  // Smeta narxiga murojaat yo'q — aks holda agar narxlar farqlansa
  // hammasini bog'lasa ham farq chiqaveradi.
  const aktJami = useMemo(() => {
    let sum = 0;
    aktBarglar.forEach((n) => {
      // F2 fayldan o'qilgan summa ustuvur, bo'lmasa hajm × narx
      const s = Number(n.summa ?? 0);
      if (s) {
        sum += s;
      } else {
        sum += (Number(n.hajm) || 0) * (Number(n.narx) || 0);
      }
    });
    return sum;
  }, [aktBarglar]);

  const boglanganJami = useMemo(() => {
    let sum = 0;
    aktBarglar.forEach((n) => {
      const smetaId = getSmetaId(n.uid);
      if (smetaId) {
        // Bir xil manba — F2 faylning o'z summasi
        const s = Number(n.summa ?? 0);
        if (s) {
          sum += s;
        } else {
          sum += (Number(n.hajm) || 0) * (Number(n.narx) || 0);
        }
      }
    });
    return sum;
  }, [aktBarglar, getSmetaId]);



  const manfiySoni = useMemo(() => {
    return aktBarglar.filter(n => (n.hajm || 0) < 0).length;
  }, [aktBarglar]);

  const manfiySumma = useMemo(() => {
    let sum = 0;
    aktBarglar.filter(n => (n.hajm || 0) < 0).forEach(n => {
      let price = n.narx || 0;
      const smetaId = getSmetaId(n.uid);
      if (!price && smetaId && smetaTree) {
        const sn = findSmetaNode(smetaTree, smetaId);
        if (sn) price = sn.narx || 0;
      }
      sum += (n.hajm || 0) * price;
    });
    return sum;
  }, [aktBarglar, getSmetaId, smetaTree]);

  const matchingStats = useMemo(() => {
    const total = aktBarglar.length;
    const mapped = aktBarglar.filter((n) => qolBog[n.uid] !== undefined).length;
    const pct = total > 0 ? Math.round((mapped / total) * 100) : 0;
    const unmapped = total - mapped;
    const withTaklif = aktBarglar.filter((n) => !qolBog[n.uid] && takliflar[n.uid]?.length > 0).length;
    const manfiy = aktBarglar.filter((n) => (n.hajm ?? 0) < 0).length;
    return { total, mapped, pct, unmapped, withTaklif, manfiy };
  }, [aktBarglar, qolBog, takliflar]);

  const farq = aktJami - boglanganJami;
  const constOk = Math.abs(farq) < 0.01;

  // Final document save/create RPC calling sbT2AktYarat
  const yozish = async () => {
    if (!korish?.obyekt_id) return;
    
    // Compile bindings
    const map = new Map<number, { qator_id: number; hajm: number; narx?: number }>();
    aktBarglar.forEach((n) => {
      const smetaId = getSmetaId(n.uid);
      if (smetaId) {
        const h = Number(n.hajm) || 0;
        const existing = map.get(smetaId);
        if (existing) {
          existing.hajm += h;
        } else {
          map.set(smetaId, {
            qator_id: smetaId,
            hajm: h,
            narx: n.narx > 0 ? n.narx : undefined
          });
        }
      }
    });
    
    const rows = Array.from(map.values());
    if (!rows.length) { toast('Bironta bog\'langan qator mavjud emas', 'warn'); return; }

    // Bog'lanmagan qatorlar soni
    const boglanmaganSoni = aktBarglar.filter((n) => !getSmetaId(n.uid)).length;

    if (boglanmaganSoni > 0) {
      // Ba'zi qatorlar bog'lanmagan — ogohlantirish bilan davom etish imkoniyati
      const tasd = window.confirm(
        `⚠️ ${boglanmaganSoni} ta F2 qatori hali smeta qatoriga bog'lanmagan!\n\n` +
        `Bu qatorlar F2 hujjatiga kirmaydi. Ularni bog'lamasdan davom etasizmi?\n` +
        `(OK = Ha, davom eting | Bekor = Orqaga qaytib bog'lang)`
      );
      if (!tasd) return;
    }
    // Agar hammasi bog'langan bo'lsa — narx bir xil manbadan (F2 summa)
    // bo'lgani uchun farq 0 bo'ladi, constOk tekshiruvi shart emas.

    setYozilmoqda(true); setNatija(null);
    try {
      const r = await sbT2AktYarat({
        obyektId: korish.obyekt_id,
        tur,
        oy: oy + '-01',
        qatorlar: rows,
        operationId: opId,
        raqam: raqam.trim() || undefined,
        majburiy: majburiy
      });
      setNatija(r);
      if (r.ok) {
        toast(r.takror ? 'Hujjat allaqachon yaratilgan' : 'Hujjat muvaffaqiyatli yaratildi', 'ok');
        // Clear drafts on success
        localStorage.removeItem(`T2_F2_DRAFT_${korish.obyekt_id}_${faylId}_${tur}_${oy}`);
        setQadam(2);
      } else {
        toast(r.xabar || r.error || 'Xato yuz berdi', 'danger', undefined, 12000);
      }
    } catch (e: any) {
      toast(e?.message || String(e), 'danger');
    } finally {
      setYozilmoqda(false);
    }
  };

  const KATAK = ({ nom, val, rang }: { nom: string; val: number; rang?: string }) => (
    <div className="karta p-3 flex-1 min-w-[140px]">
      <div className="text-[10px] text-text-dim mb-1">{nom}</div>
      <div className={'text-[14px] font-medium tabular-nums ' + (rang || 'text-text')}>
        <FmtN val={val} />
      </div>
    </div>
  );

  return (
    <Sahifa
      sarlavha="F2 / Fakt Fayl Import (Tizim_02)"
      tavsif="Excel aktini Supabase smeta qatorlariga vizual bog'laydi va F2 hujjatini yaratadi"
    >
      <div className="space-y-4">
        
        {/* Qadamlar paneli */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {['Fayl yuklash', 'Moslashtirish', 'Saqlash'].map((nom, i) => (
            <div key={nom} className="flex items-center gap-2">
              <span className={`h-7 px-3 inline-flex items-center gap-2 rounded-full text-[12px] font-medium border
                ${i === qadam ? 'bg-accent text-white border-transparent'
                  : i < qadam ? 'bg-ok/10 text-ok border-ok/25'
                  : 'karta text-text-mute'}`}>
                {i < qadam ? <CheckCircle2 size={13} /> : <span className="tabular-nums">{i + 1}</span>}
                {nom}
              </span>
              {i < 2 && <span className="text-text-mute">→</span>}
            </div>
          ))}
        </div>

        {/* ── QADAM 0: FAYL VA OBYEKT TANLASH ── */}
        {qadam === 0 && (
          <div className="karta p-4 space-y-3">
            <h3 className="text-sm font-semibold text-text">1-qadam · Obyekt va Excel fayl</h3>
            
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-text-dim">Obyekt</label>
              <select value={obyekt} onChange={(e) => setObyekt(e.target.value)}
                className="w-full bg-[var(--surface-2)] border border-border rounded-lg
                           px-3 py-2 text-[13px] text-text outline-none focus:border-accent/50">
                <option value="">— obyekt tanlang —</option>
                {obyektlar.map((o) => <option key={o.id} value={o.nom}>{o.nom}</option>)}
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col items-center justify-center gap-1.5 py-4
                                border-2 border-dashed border-border rounded-lg cursor-pointer
                                hover:border-accent/50 transition-colors bg-[var(--surface-2)]/30">
                <Upload size={18} className="text-accent" />
                <span className="text-[11px] font-medium text-text">
                  {yuklanmoqda ? 'Fayl yuklanmoqda…' : 'Kompyuterdan yuklash (.xlsx, .xls)'}
                </span>
                <input type="file" className="hidden" disabled={yuklanmoqda}
                  accept=".xlsx,.xls,.xlsm"
                  onChange={(e) => { fayllarYukla(e.target.files); e.currentTarget.value = ''; }} />
              </label>

              <div className="space-y-1">
                <label className="text-[11px] text-text-dim flex items-center gap-1.5">
                  <FolderOpen size={13} /> yoki yuklangan fayllardan ({manba.length})
                </label>
                <select value={faylId} onChange={(e) => faylTanla(e.target.value)}
                  className="w-full bg-[var(--surface-2)] border border-border rounded-lg
                             px-2.5 py-2.5 text-[12px] text-text outline-none">
                  <option value="">— tanlanmagan —</option>
                  {manba.filter((f) => f.oqiladi).map((f) => (
                    <option key={f.fayl_id} value={f.fayl_id}>{f.nom} · {f.sana}</option>
                  ))}
                </select>
              </div>
            </div>

            {varaqlar.length > 1 && (
              <div className="space-y-1">
                <label className="text-[11px] text-text-dim block">Varaq</label>
                <select value={varaq} onChange={(e) => setVaraq(e.target.value)}
                  className="w-full bg-[var(--surface-2)] border border-border rounded-lg
                             px-2.5 py-2 text-[12px] text-text outline-none">
                  <option value="">— birinchisi —</option>
                  {varaqlar.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            )}

            <button onClick={() => kor()} disabled={korilmoqda || !obyekt || !faylId}
              className="w-full sm:w-auto px-5 py-2 rounded-lg bg-accent text-white text-[13px] font-bold
                         hover:bg-accent/90 disabled:opacity-40 inline-flex items-center justify-center gap-2">
              {korilmoqda ? <RefreshCw size={15} className="animate-spin" /> : <FileInput size={15} />}
              {korilmoqda ? 'O\'qilmoqda…' : 'O\'qish va Moslashtirish'}
            </button>

            {korish && (
              <div className="border-t border-border/20 pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <button onClick={() => setUstunOchiq(p => !p)}
                    className="text-[11px] text-text-dim hover:text-white flex items-center gap-1 cursor-pointer">
                    ⚙️ Ustunlarni sozlash {ustunOchiq ? '▲' : '▼'}
                  </button>
                  {korish.cols && (
                    <span className="text-[10px] text-text-mute">
                      Aniqlangan: {Object.entries(korish.cols).map(([k, v]) => `${k.toUpperCase()}:${HARF(v)}`).join(' · ')}
                    </span>
                  )}
                </div>

                {ustunOchiq && (
                  <div className="p-3 bg-black/20 rounded-lg space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-text-dim">
                      {USTUN_NOM.map(([k, label]) => (
                        <label key={k} className="flex flex-col gap-1">
                          <span>{label}</span>
                          <select value={qolUstun[k] !== undefined ? qolUstun[k] : (korish.cols?.[k] !== undefined ? korish.cols[k] : -1)}
                            onChange={(e) => setQolUstun(p => ({ ...p, [k]: Number(e.target.value) }))}
                            className="bg-[var(--surface-2)] border border-border/30 rounded px-2 py-1 text-white outline-none">
                            <option value="-1">— yo'q —</option>
                            {Array.from({ length: korish.maxCol || 10 }).map((_, i) => (
                              <option key={i} value={i}>{HARF(i)}</option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                    <div className="flex justify-end">
                      <button onClick={() => kor(true)}
                        className="bg-accent/20 text-accent hover:bg-accent/35 px-3 py-1 rounded text-[11px] font-bold transition-all cursor-pointer">
                        Qayta o'qish
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── QADAM 1: INTERAKTIV MOSLASHTIRISH ── */}
        {qadam === 1 && korish && (
          <div className="space-y-3">
            
            {/* Mini Kafolat Bar */}
            <div className="bg-[var(--surface-2)]/60 border border-border/80 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 text-[12px]">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-semibold text-text-dim">F2 IMPORT SUMMARY:</span>
                <span>Akt jami: <b className="text-white"><FmtN val={aktJami} /> so'm</b></span>
                <span className="text-border">|</span>
                <span>Bog'langan jami: <b className="text-emerald-400"><FmtN val={boglanganJami} /> so'm</b></span>
                <span className="text-border">|</span>
                <span>
                  Farq: <b className={constOk ? 'text-emerald-400' : 'text-rose-400'}><FmtN val={farq} /> so'm</b>
                </span>
                <span className="text-border">|</span>
                <div className="flex items-center gap-1.5" title="Exceldagi resurs qatorlarining smeta bilan bog'lanish foizi">
                  <span>Bog'lanish:</span>
                  <div className="w-20 h-2 bg-black/40 rounded-full overflow-hidden border border-border/30 inline-block relative top-[0.5px]">
                    <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${matchingStats.pct}%` }} />
                  </div>
                  <span className="font-bold text-emerald-400">{matchingStats.mapped}/{matchingStats.total} ({matchingStats.pct}%)</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {constOk ? (
                  <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold flex items-center gap-1.5">
                    <CheckCircle size={14} /> JAMI BOG'LANISH TENG
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold flex items-center gap-1.5">
                    <AlertTriangle size={14} /> NOMUVOFIQLIK (BOG'LANG)
                  </span>
                )}
              </div>
            </div>

            {/* KPI kartalari */}
            <div className="flex flex-wrap gap-2">
              <KATAK nom="AKT JAMI" val={aktJami} />
              <KATAK nom="BOG'LANGAN JAMI" val={boglanganJami} rang={constOk ? 'text-ok' : 'text-warn'} />
              <KATAK nom="FARQ (QOLDIQ)" val={farq} rang={constOk ? 'text-ok' : 'text-danger'} />
              {manfiySoni > 0 && (
                <KATAK nom={`QAYTARIM (PERERASCHET - ${manfiySoni} ta)`} val={manfiySumma} rang="text-rose-400" />
              )}
              <div className="karta p-3 flex-1 min-w-[140px] flex flex-col justify-between">
                <div className="text-[10px] text-text-dim">STATUS</div>
                <div className="text-[12px] font-bold flex items-center gap-1.5 mt-1">
                  {constOk ? (
                    <span className="text-ok flex items-center gap-1"><CheckCircle size={14} /> Jami teng mos</span>
                  ) : (
                    <span className="text-danger flex items-center gap-1"><AlertTriangle size={14} /> Farq bor (bog'lang)</span>
                  )}
                </div>
              </div>
            </div>

            {/* Qoralama tiklash taklifi */}
            {draftBor && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[.07] p-3 flex items-center gap-3 justify-between flex-wrap">
                <div className="text-[12px] text-text-mute">
                  💡 Bu fayl uchun <b>saqlangan qoralama bog'lanishlar</b> mavjud. Oxirgi ish joyidan davom etasizmi?
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={draftTikla}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 text-[11px] font-bold transition-colors">
                    ↺ Qoralamani tiklash
                  </button>
                  <button onClick={draftOchir}
                    className="px-3 py-1.5 rounded-lg bg-white/5 text-text-mute hover:bg-white/10 text-[11px] transition-colors">
                    Tozalash
                  </button>
                </div>
              </div>
            )}

            {/* Invariant Ogohlantirishlar */}
            {korish.moslash && korish.moslash.topilmadi > 0 && (
              <div className="rounded-lg border border-warn/30 bg-warn/[.05] p-3 text-[12px] text-text-dim space-y-1">
                <p className="font-semibold text-warn flex items-center gap-1.5">
                  <AlertCircle size={14} /> Diqqat! {korish.moslash.topilmadi} ta qator smetaga bog'lanmadi
                </p>
                <p className="text-[11px] text-text-mute">
                  Bu qatorlar hujjatga <b>KIRMAYDI</b> — chap paneldan sudrab,
                  o'ngdagi tegishli smeta qatoriga bog'lang. Tizim taxmin qilmaydi:
                  noto'g'ri qatorga yozilgan hajm jim moliyaviy xato bo'lardi.
                </p>
                {/* ⚠️ Har bir qator uchun dvigatel NEGA topmaganini aytadi.
                    «topilmadi» deb qo'yib qo'yish odamni ko'r qiladi. */}
                {(() => {
                  const sab: Record<string, number> = {};
                  for (const q of korish.moslash!.qatorlar) {
                    if (q.holat !== 'topilmadi') continue;
                    const k = (q.sabab || 'сабаб кўрсатилмаган').slice(0, 60);
                    sab[k] = (sab[k] || 0) + 1;
                  }
                  return Object.entries(sab)
                    .sort((a, b) => b[1] - a[1]).slice(0, 6)
                    .map(([k, n]) => (
                      <p key={k} className="text-[11px] text-text-mute pl-2">
                        • <b>{n} ta</b> — {k}
                      </p>
                    ));
                })()}
                {korish.moslash.stat && (
                  <p className="text-[10px] text-text-mute pt-1 border-t border-border/40">
                    Дvigatel: razdel {korish.moslash.stat.rzMos ?? 0}/{korish.moslash.stat.rzJami ?? 0} ·
                    doira ichida {korish.moslash.stat.scopeHit ?? 0} ·
                    kod-kanon {korish.moslash.stat.kanonHit ?? 0} ·
                    taxminiy nom {korish.moslash.stat.fuzzyHit ?? 0} ·
                    <b className="text-warn"> birlik bloki {korish.moslash.stat.birlikBlok ?? 0}</b>
                  </p>
                )}
              </div>
            )}

            {/* Sozlamalar va Amallar */}
            <div className="karta p-4 flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div>
                  <label className="text-[10px] text-text-dim block mb-1">Hujjat turi</label>
                  <select value={tur} onChange={(e) => setTur(e.target.value as any)}
                    className="bg-[var(--surface-2)] border border-border rounded-lg px-2.5 py-1.5
                               text-[12px] text-text outline-none font-medium">
                    <option value="f2">Ф2 — topshiriladigan</option>
                    <option value="fakt">ФАКТ — bajarilgan ish</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-text-dim block mb-1">Oy</label>
                  <input type="month" value={oy} onChange={(e) => setOy(e.target.value)}
                    className="bg-[var(--surface-2)] border border-border rounded-lg px-2.5 py-1 text-[12px]
                               text-text outline-none" />
                </div>
                <div>
                  <label className="text-[10px] text-text-dim block mb-1">Hujjat №</label>
                  <input value={raqam} onChange={(e) => setRaqam(e.target.value)} placeholder="ixtiyoriy"
                    className="bg-[var(--surface-2)] border border-border rounded-lg px-2.5 py-1 text-[12px]
                               text-text outline-none w-28" />
                </div>
                <div className="flex items-center gap-2 mt-4 ml-2">
                  <input type="checkbox" id="majburiy" checked={majburiy} onChange={(e) => setMajburiy(e.target.checked)} className="cursor-pointer" />
                  <label htmlFor="majburiy" className="text-[12px] text-rose-400 font-medium cursor-pointer" title="Agar belgilansa, fakt / smeta chegarasidan oshib ketishiga ruxsat beriladi (Faqat adminlar uchun)">
                    Majburiy (limitdan oshish)
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => { setQadam(0); setNatija(null); }}
                  className="px-3 py-1.5 rounded-lg border border-border text-[12px] text-text-dim hover:bg-white/5">
                  Orqaga
                </button>
                {undoStack.length > 0 && (
                  <button
                    onClick={() => {
                      setUndoStack((prev) => {
                        if (prev.length === 0) return prev;
                        const last = prev[prev.length - 1];
                        setQolBog(last);
                        toast("✓ Qaytarildi", "ok");
                        return prev.slice(0, -1);
                      });
                    }}
                    title={`${undoStack.length} ta qadam qaytarish mumkin`}
                    className="px-3 py-1.5 rounded-lg border border-border text-[12px] text-text-dim hover:bg-white/5 inline-flex items-center gap-1">
                    ↩ Qaytarish <span className="text-[10px] bg-white/10 px-1 rounded">{undoStack.length}</span>
                  </button>
                )}
                {matchingStats.withTaklif > 0 && (
                  <button onClick={applyAllTakliflar}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[12px] text-emerald-400 hover:bg-emerald-500/25 inline-flex items-center gap-1 font-bold transition-all">
                    🎯 Takliflarni qo'llash ({matchingStats.withTaklif})
                  </button>
                )}
                <button onClick={resetBinds}
                  className="px-3 py-1.5 rounded-lg border border-danger/30 text-[12px] text-danger hover:bg-danger/5 inline-flex items-center gap-1">
                  <Trash2 size={13} /> Tozalash
                </button>
                <button onClick={yozish} disabled={yozilmoqda}
                  className="px-4 py-1.5 rounded-lg bg-accent text-white text-[12px] font-bold hover:bg-accent/90 disabled:opacity-40 inline-flex items-center gap-1.5">
                  {yozilmoqda ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                  Smetaga yozish
                </button>
              </div>
            </div>

            {/* ⭐ INTERAKTIV IKKI PANEL: chapda F2 Excel, o'ngda Supabase Smeta */}
            <IkkiPanel
              chapSarlavha={
                <div className="flex flex-col gap-2 w-full">
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-xs">F2 AKT FAYLI</span>
                    <button onClick={onAvtoMoslash}
                      title="Avtomatik moslash (Ctrl+Shift+M)"
                      className="flex items-center gap-1 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 px-2.5 py-1 rounded text-[10px] transition-colors font-bold whitespace-nowrap cursor-pointer">
                      🪄 Avto-Moslash <kbd className="ml-0.5 px-1 py-0.5 rounded text-[8px] bg-black/30 text-emerald-300 font-mono">⌃⇧M</kbd>
                    </button>
                  </div>
                  <div className="relative">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-mute" />
                    <input id="f2-search-input" value={f2Qidiruv} onChange={(e) => setF2Qidiruv(e.target.value)}
                      placeholder="nom yoki kod bo'yicha..."
                      className="w-full bg-[var(--surface-2)] border border-border rounded-lg pl-7 pr-7 py-1 text-[11px] text-text outline-none" />
                    {f2Qidiruv && (
                      <button onClick={() => setF2Qidiruv('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-text-mute hover:text-white transition-colors cursor-pointer">
                        <X size={11} />
                      </button>
                    )}
                  </div>
                </div>
              }
              ongSarlavha={
                <div className="flex flex-col gap-2 w-full">
                  <div className="flex items-center justify-between w-full flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs">SMETA DARAXYI (Supabase)</span>
                      {smetaLoading && <RefreshCw size={12} className="animate-spin text-accent" />}
                      {!smetaLoading && korish?.obyekt_id && (
                        <button
                          onClick={async () => {
                            setSmetaLoading(true);
                            const r = await sbT2DaraxtOl(korish.obyekt_id as number);
                            setSmetaLoading(false);
                            if (r.ok && r.qatorlar) setSmetaTree(sbT2TreeQur(r.qatorlar));
                            else toast('Smeta qayta yuklanmadi', 'danger');
                          }}
                          title="Smeta daraxtini qayta yuklash"
                          className="p-1 rounded hover:bg-white/10 text-text-mute hover:text-white transition-colors cursor-pointer">
                          <RefreshCw size={11} />
                        </button>
                      )}
                    </div>
                    {/* Varaq filter dropdown */}
                    {smetaVaraqlari.length > 0 && (
                      <div className="relative group/sheet-sel">
                        <button className="px-2 py-0.5 rounded bg-[var(--surface-2)] border border-border text-[10px] text-text hover:bg-white/5 cursor-pointer font-bold select-none">
                          📂 {tanlanganSmetaVaraqlar.length === 0 ? 'Barcha varaqlar' : `${tanlanganSmetaVaraqlar.length} varaq`} ▼
                        </button>
                        <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded shadow-xl p-2.5 z-50 hidden group-hover/sheet-sel:block w-52 max-h-60 overflow-y-auto text-left">
                          <div className="flex justify-between items-center text-[10px] text-text-dim border-b border-border pb-1.5 mb-1.5 font-bold">
                            <span>Smeta varaqlari</span>
                            <button onClick={() => setTanlanganSmetaVaraqlar([])} className="text-accent font-bold hover:underline cursor-pointer">
                              Tozalash
                            </button>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            {smetaVaraqlari.map((v) => {
                              const isChecked = tanlanganSmetaVaraqlar.includes(v);
                              return (
                                <label key={v} className="flex items-center gap-2 text-[11px] hover:text-white cursor-pointer select-none font-medium text-text-dim">
                                  <input 
                                    type="checkbox" 
                                    checked={isChecked}
                                    onChange={() => {
                                      setTanlanganSmetaVaraqlar(prev => 
                                        isChecked ? prev.filter(x => x !== v) : [...prev, v]
                                      );
                                    }}
                                    className="rounded border-border text-accent focus:ring-accent w-3.5 h-3.5"
                                  />
                                  <span className="truncate">{v}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-mute" />
                    <input value={smetaQidiruv} onChange={(e) => setSmetaQidiruv(e.target.value)}
                      placeholder="nom yoki kod bo'yicha..."
                      className="w-full bg-[var(--surface-2)] border border-border rounded-lg pl-7 pr-7 py-1 text-[11px] text-text outline-none" />
                    {smetaQidiruv && (
                      <button onClick={() => setSmetaQidiruv('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-text-mute hover:text-white transition-colors cursor-pointer">
                        <X size={11} />
                      </button>
                    )}
                  </div>
                </div>
              }
              chapOng={
                <div className="flex flex-col gap-1.5 w-full">
                  <div className="flex gap-1 bg-black/20 p-1 rounded-lg">
                    {(['hammasi', 'boglanmagan', 'boglangan', 'manfiy', 'takliflar'] as const).map((f) => {
                      const count =
                        f === 'hammasi' ? matchingStats.total
                        : f === 'boglangan' ? matchingStats.mapped
                        : f === 'boglanmagan' ? matchingStats.unmapped
                        : f === 'manfiy' ? matchingStats.manfiy
                        : matchingStats.withTaklif;
                      return (
                        <button key={f} onClick={() => setFiltr(f)}
                          className={`flex-1 h-6 px-1 rounded-md text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-1
                            ${filtr === f ? 'bg-accent text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                          <span>
                            {f === 'hammasi' ? 'Barchasi'
                              : f === 'boglangan' ? "✓ Bog\u2019langan"
                              : f === 'manfiy' ? '− Qaytarim'
                              : f === 'boglanmagan' ? "○ Bog\u2019lanmagan"
                              : '🎯 Takliflar'}
                          </span>
                          {count > 0 && (
                            <span className={`px-1 rounded-full text-[9px] leading-tight ${filtr === f ? 'bg-white/25' : 'bg-white/10'}`}>
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setOchiqSignal(s => s > 0 ? s + 1 : 1)}
                      className="flex-1 flex items-center justify-center gap-1 h-5 bg-white/5 hover:bg-white/10 text-slate-300 rounded text-[10px] transition-colors cursor-pointer">
                      Ochish
                    </button>
                    <button onClick={() => setOchiqSignal(s => s < 0 ? s - 1 : -1)}
                      className="flex-1 flex items-center justify-center gap-1 h-5 bg-white/5 hover:bg-white/10 text-slate-300 rounded text-[10px] transition-colors cursor-pointer">
                      Yig'ish
                    </button>
                  </div>
                </div>
              }
              chap={
                <F2Daraxt
                  tugunlar={aktDaraxtFiltrlangan}
                  bogMi={bogMi}
                  onBogBekor={bogBekor}
                  sudraladi
                  bosh="F2 daraxti bo'sh"
                  filtr={filtr === 'takliflar' ? 'boglanmagan' : filtr}
                  ochiqYopiqSignal={ochiqSignal}
                  onDopClick={onDopClick}
                  onOtishClick={aktOtishClick}
                  takliflar={takliflar}
                  onTaklifTanlandi={onTaklifTanlandi}
                />
              }
              ong={
                <F2Daraxt
                  tugunlar={smetaDaraxtFiltrlangan}
                  bogMi={smetaBogMi}
                  tashlanadi
                  onTashla={qolBogla}
                  onGapDrop={qolGapDop}
                  onBogBekor={smetaBogBekor}
                  bosh={smetaLoading ? "Smeta yuklanmoqda..." : "Smeta daraxti bo'sh"}
                  filtr={filtr === 'hammasi' ? 'hammasi' : 'hammasi'} // Keep smeta side fully visible
                  ochiqYopiqSignal={ochiqSignal}
                  onQatorQosh={onQatorQosh}
                  scrollToKey={smetaScrollTo}
                />
              }
            />
            
            <p className="text-[10px] text-text-mute text-center">
              💡 F2 aktidagi qatorni sudrab, o'ng tomondagi mos smeta qatoriga tashlang (drag & drop). Bog'lanishni bekor qilish uchun qatordagi belgini bosing.
            </p>

            {qatorQoshModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                <div className="bg-[var(--surface-1)] border border-border w-full max-w-lg rounded-lg shadow-2xl p-5 flex flex-col gap-4 max-h-[90vh] overflow-y-auto text-left">
                  <div className="border-b border-border/20 pb-2 flex items-center justify-between">
                    <div>
                      <h3 className="text-md font-bold text-accent">
                        Smetaga Yangi Qator Qo'shish (DOP / ZAMENA)
                      </h3>
                      {yangiQator && yangiSmeta && (
                        <p className="text-[11px] text-text-dim mt-1">
                          «{yangiSmeta}» varag'ining <b className="text-text">{yangiQator}</b>-qatoridan KEYIN qo'shiladi.
                        </p>
                      )}
                    </div>
                    <button onClick={() => setQatorQoshModal(false)}
                      className="text-text-mute hover:text-text p-1 rounded hover:bg-white/10">
                      <X size={16} />
                    </button>
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="flex flex-col gap-1 w-1/2">
                      <label className="text-[12px] font-medium text-text-dim">Varaq (Smeta):</label>
                      <select value={yangiSmeta} onChange={(e) => setYangiSmeta(e.target.value)}
                        className="bg-[var(--surface-2)] border border-border rounded px-3 py-1.5 text-[12px] text-text outline-none">
                        {varaqlar.map((v) => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1 w-1/2">
                      <label className="text-[12px] font-medium text-text-dim">Qator turi:</label>
                      <select value={yangiTur} onChange={(e) => setYangiTur(e.target.value)}
                        className="bg-[var(--surface-2)] border border-border rounded px-3 py-1.5 text-[12px] text-text outline-none">
                        <option value="rz">Razdel (Sarlavha)</option>
                        <option value="bl">Ish turi (Blok)</option>
                        <option value="rs">Resurs (Ish/Mat/Ob)</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <label className="text-[12px] font-medium text-text-dim">Nomi:</label>
                    <input value={yangiNom} onChange={(e) => setYangiNom(e.target.value)}
                      placeholder="Masalan: Qo'shimcha devor qurish..."
                      className="bg-[var(--surface-2)] border border-border rounded px-3 py-1.5 text-[12px] text-text outline-none w-full font-sans" />
                  </div>

                  {yangiTur !== 'rz' && (
                    <div className="grid grid-cols-2 gap-3 bg-black/20 p-3 rounded-md border border-border/30 text-[12px] text-text-dim">
                      <div className="flex flex-col gap-1">
                        <label className="font-medium">Kodi (Asos):</label>
                        <input value={yangiKod} onChange={(e) => setYangiKod(e.target.value)}
                          placeholder="Masalan: E11-1-1"
                          className="bg-[var(--surface-2)] border border-border rounded px-2.5 py-1 text-text outline-none w-full" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-medium">Birlik:</label>
                        <input value={yangiBirlik} onChange={(e) => setYangiBirlik(e.target.value)}
                          placeholder="m2, t, kg, sht"
                          className="bg-[var(--surface-2)] border border-border rounded px-2.5 py-1 text-text outline-none w-full" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-medium">Hajm:</label>
                        <input value={yangiHajm} onChange={(e) => setYangiHajm(e.target.value)}
                          type="number" step="any" placeholder="0.00"
                          className="bg-[var(--surface-2)] border border-border rounded px-2.5 py-1 text-text outline-none w-full" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-medium">Narx:</label>
                        <input value={yangiNarx} onChange={(e) => setYangiNarx(e.target.value)}
                          type="number" step="any" placeholder="Ixtiyoriy"
                          className="bg-[var(--surface-2)] border border-border rounded px-2.5 py-1 text-text outline-none w-full" />
                      </div>
                    </div>
                  )}
                  
                  <div className="flex flex-col gap-1">
                    <label className="text-[12px] font-medium text-text-dim">Qaysi qatordan keyin (ixtiyoriy):</label>
                    <input value={yangiQator} onChange={(e) => setYangiQator(e.target.value)}
                      placeholder="Bo'sh qoldirilsa oxiriga tushadi"
                      type="number"
                      className="bg-[var(--surface-2)] border border-border rounded px-3 py-1.5 text-[12px] text-text outline-none w-full" />
                  </div>
                  
                  <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border/20">
                    <button onClick={() => setQatorQoshModal(false)} disabled={qatorLoading}
                      className="px-4 py-1.5 rounded-lg border border-border hover:bg-white/5 text-[12px] text-text-dim disabled:opacity-40 cursor-pointer">
                      Bekor qilish
                    </button>
                    <button onClick={onQatorSaqlash} disabled={qatorLoading}
                      className="px-4 py-1.5 rounded-lg bg-accent text-white hover:bg-accent/90 text-[12px] font-bold disabled:opacity-40 cursor-pointer inline-flex items-center gap-1.5">
                      {qatorLoading ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                      Yuridik Saqlash
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── QADAM 2: MUVAFFFAQIYAT VA SAQLASH NATIJASI ── */}
        {qadam === 2 && natija && natija.ok && (
          <div className="karta p-6 border-ok/40 bg-ok/5 text-center space-y-4 max-w-lg mx-auto my-6">
            <CheckCircle size={48} className="text-ok mx-auto animate-bounce" />
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-ok">Hujjat muvaffaqiyatli saqlandi!</h2>
              <p className="text-[12px] text-text-dim">
                Faktura/Akt hujjati qoralama holatida Supabase omboriga yozildi.
              </p>
            </div>

            <div className="rounded-lg bg-[var(--surface-2)]/50 p-4 text-[12px] text-text-dim text-left space-y-2">
              <div className="flex justify-between border-b border-border/20 pb-2">
                <span>Hujjat ID:</span>
                <span className="font-bold text-text">#{natija.akt_id}</span>
              </div>
              <div className="flex justify-between border-b border-border/20 pb-2">
                <span>Oy:</span>
                <span className="font-bold text-text">{oy}</span>
              </div>
              <div className="flex justify-between border-b border-border/20 pb-2">
                <span>Hujjat turi:</span>
                <span className="font-bold text-text uppercase">{tur}</span>
              </div>
              <div className="flex justify-between border-b border-border/20 pb-2">
                <span>Qatorlar soni:</span>
                <span className="font-bold text-text">{natija.qator_soni}</span>
              </div>
              <div className="flex justify-between">
                <span>Jami summa:</span>
                <span className="font-bold text-ok"><FmtN val={natija.jami ?? 0} /> so'm</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button onClick={() => { setQadam(0); setKorish(null); setNatija(null); }}
                className="px-4 py-2 rounded-lg border border-border text-[12px] font-bold text-text hover:bg-white/5 transition-colors">
                Yangi fayl yuklash
              </button>
              <a href="/admin/test/f2"
                 className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-white text-[12px] font-bold hover:bg-accent/90 transition-colors">
                Hujjatlar ro'yxatiga o'tish <ExternalLink size={12} />
              </a>
            </div>
          </div>
        )}

        {/* Baza yozishni RAD ETSA sabab shu yerda ko'rinadi */}
        {natija && !natija.ok && (
          <div className="karta p-4 border-danger/40 bg-danger/5 space-y-2">
            <p className="text-[13px] text-danger font-bold flex items-center gap-2">
              <XCircle size={16} /> Hujjat saqlanmadi (Baza cheklovi)
            </p>
            <p className="text-[12px] text-text-dim">{natija.xabar || natija.error || 'Tranzaksiya rad etildi.'}</p>
            
            {!!natija.buzilish?.length && (
              <div className="max-h-48 overflow-auto space-y-1 border border-border/20 p-2 rounded bg-black/10">
                {natija.buzilish.map((b, i) => (
                  <p key={i} className="text-[11px] text-text-mute">
                    <button
                      onClick={() => {
                        if (b.qator_id) {
                          setSmetaScrollTo(null);
                          requestAnimationFrame(() => setSmetaScrollTo(String(b.qator_id)));
                        }
                      }}
                      className="text-danger font-medium hover:underline text-left inline-flex items-center gap-1 cursor-pointer font-sans bg-transparent border-0 p-0"
                      title="Smeta daraxtida ushbu qatorga sakrash"
                    >
                      ⚠️ {b.nom}
                    </button> —{' '}
                    {b.jami != null
                      ? <>jami <b>{b.jami}</b></>
                      : <>bor {b.bor}, qo'shilmoqda <b>{b.qoshilmoqda}</b></>}
                    {', max limit '}<b className="text-warn">{b.chegara}</b>
                  </p>
                ))}
              </div>
            )}
            
            {natija.maslahat && (
              <p className="text-[11px] text-text-mute italic mt-1">{natija.maslahat}</p>
            )}
          </div>
        )}

      </div>
    </Sahifa>
  );
}
