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
  XCircle, Send, ExternalLink, Trash2, Search, CheckCircle2, AlertCircle
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
  holat: 'moslandi' | 'ikkilamchi' | 'topilmadi';
  nom: string;
  birlik: string;
  hajm: number;
  narx: number | null;
  qator_id: number | null;
  nomzod_soni: number;
};

type Moslash = {
  ok: boolean;
  kirgan: number;
  moslandi: number;
  ikkilamchi: number;
  topilmadi: number;
  kafolat: boolean;
  qatorlar: MosQator[];
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
  const [filtr, setFiltr] = useState<'hammasi' | 'boglanmagan' | 'boglangan' | 'manfiy'>('hammasi');
  const [ochiqSignal, setOchiqSignal] = useState(0);

  // Saqlangan qoralama holati
  const [draftBor, setDraftBor] = useState(false);

  // Yozish natijasi
  const [yozilmoqda, setYozilmoqda] = useState(false);
  const [natija, setNatija] = useState<AktNatija | null>(null);
  const [opId, setOpId] = useState('');

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
        setQolBog({});
        toast('F2 o\'qildi va auto-moslashtirildi', 'ok');
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
      const raw = localStorage.getItem(`T2_F2_DRAFT_${korish.obyekt_id}_${faylId}`);
      setDraftBor(!!raw);
    } else {
      setDraftBor(false);
    }
  }, [qadam, korish?.obyekt_id, faylId]);

  // Draftni yuklash
  const draftTikla = () => {
    if (!korish?.obyekt_id || !faylId) return;
    const raw = localStorage.getItem(`T2_F2_DRAFT_${korish.obyekt_id}_${faylId}`);
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
    localStorage.removeItem(`T2_F2_DRAFT_${korish.obyekt_id}_${faylId}`);
    setDraftBor(false);
    toast('Saqlangan qoralama o\'chirildi');
  };

  // Auto-saved draft monitoring
  useEffect(() => {
    if (qadam !== 1 || !korish?.obyekt_id || !faylId) return;
    const draft = {
      vaqt: Date.now(),
      qolBog
    };
    localStorage.setItem(`T2_F2_DRAFT_${korish.obyekt_id}_${faylId}`, JSON.stringify(draft));
  }, [qolBog, qadam, korish?.obyekt_id, faylId]);

  // F2 barg tugunlarini topish (DFS)
  const aktBarglar = useMemo(() => {
    const out: any[] = [];
    const traverse = (nodes: any[]) => {
      nodes.forEach((n) => {
        if (n.type === 'rs' || n.type === 'mat' || n.type === 'ob') {
          out.push(n);
        }
        if (n.children) traverse(n.children);
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

    setQolBog((prev) => ({ ...prev, [aktKalit]: smetaId }));
    toast(`✓ Bog'landi: ${String(n.nom).slice(0, 40)}`);
  };

  const qolGapDop = () => {
    toast('Tizim_02 da F2 ekranidan smetaga yangi qator qo\'shish taqiqlangan', 'warn');
  };

  // Unlink functions
  const bogBekor = (aktKalit: string) => {
    setQolBog((prev) => {
      const next = { ...prev };
      delete next[aktKalit];
      return next;
    });
    toast('Bog\'lanish bekor qilindi');
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

  // Client-side auto-matching logic (copied and optimized from Tizim_01)
  const onAvtoMoslash = () => {
    if (!korish?.tree || !smetaTree) return;
    let matchCount = 0;

    // Normalizatsiya
    const nNom = (s: string | undefined) => String(s || '').toUpperCase().replace(/[^А-ЯЁA-Z0-9]/g, '');
    const nKod = (s: string | undefined) => String(s || '').toUpperCase().replace(/[^А-ЯЁA-Z0-9]/g, '').replace(/^0+/, '');

    // Collect all leaf nodes from smetaTree
    const smetaQatorlar: TreeNode[] = [];
    const collectSmeta = (nodes: TreeNode[]) => {
      nodes.forEach(n => {
        if (n.type === 'rs' || n.type === 'mat' || n.type === 'ob') {
          smetaQatorlar.push(n);
        }
        if (n.children) collectSmeta(n.children);
      });
    };
    collectSmeta(smetaTree);

    // Index smeta rows by normalized name
    const nomIndeks = new Map<string, TreeNode[]>();
    smetaQatorlar.forEach((sq) => {
      const k = nNom(sq.nom);
      if (!k) return;
      const bor = nomIndeks.get(k);
      if (bor) bor.push(sq); else nomIndeks.set(k, [sq]);
    });

    const bandJoy = new Set<number>();
    Object.values(qolBog).forEach((id) => bandJoy.add(id));

    const yangiBog: Record<string, number> = {};
    const yur = (nodes: any[]) => {
      nodes.forEach(n => {
        const uid = n.uid;
        if (uid && (n.type === 'rs' || n.type === 'mat' || n.type === 'ob') && !bogMi(uid) && !yangiBog[uid]) {
          const fKod = nKod(n.kod);
          const fNom = nNom(n.nom);

          const nomzodlar = fNom ? (nomIndeks.get(fNom) ?? []) : [];
          const exact = nomzodlar.find((sq) => {
            if (!sq.id) return false;
            if (bandJoy.has(sq.id)) return false;
            const sKod = nKod(sq.kod);
            if (fKod && sKod) return fKod === sKod;
            return true;
          });

          if (exact && exact.id) {
            bandJoy.add(exact.id);
            yangiBog[uid] = exact.id;
            matchCount++;
          }
        }
        if (n.children) yur(n.children);
      });
    };
    yur(korish.tree);

    if (matchCount > 0) {
      setQolBog((prev) => ({ ...prev, ...yangiBog }));
      toast(`✓ Yuridik aniq mos tushgan ${matchCount} ta qator avtomatik bog'landi!`, "ok");
    } else {
      toast("Smetada sizning aktga 100% (so'zma-so'z) mos keladigan bo'sh qatorlar topilmadi.", "danger");
    }
  };

  // Reset mappings to empty
  const resetBinds = () => {
    setQolBog({});
    toast('Barcha bog\'lanishlar tozalandi');
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
        if (n.type === 'rs' || n.type === 'mat' || n.type === 'ob') {
          const isBog = bogMi(n.uid);
          if (filtr === 'hammasi') match = true;
          else if (filtr === 'boglangan') match = isBog;
          else if (filtr === 'boglanmagan') match = !isBog;
          else if (filtr === 'manfiy') match = (n.hajm ?? 0) < 0;
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
  const aktDaraxtFiltrlangan = useMemo(() => {
    if (!korish?.tree) return [];
    let tree = mapAktToDaraxt(korish.tree);
    tree = filterDaraxt(tree, f2Qidiruv);
    return filterByStatus(tree);
  }, [korish?.tree, f2Qidiruv, filtr, qolBog]);

  const smetaDaraxtFiltrlangan = useMemo(() => {
    if (!smetaTree) return [];
    const tree = mapSmetaToDaraxt(smetaTree);
    return filterDaraxt(tree, smetaQidiruv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smetaTree, smetaQidiruv]);

  // Tree mappers to DaraxtTugun format
  function mapAktToDaraxt(nodes: any[]): DaraxtTugun[] {
    return nodes.map(n => ({
      kalit: n.uid,
      type: n.type,
      nom: n.nom || '',
      kod: n.kod,
      bir: n.bir,
      hajm: n.hajm,
      summa: n.summa,
      children: n.children ? mapAktToDaraxt(n.children) : undefined
    }));
  }

  function mapSmetaToDaraxt(nodes: TreeNode[]): DaraxtTugun[] {
    return nodes.map(n => ({
      kalit: n.id ? String(n.id) : `rz:${n.nom}`,
      type: n.type,
      nom: n.nom || '',
      kod: n.kod,
      bir: n.birlik,
      hajm: n.smetaHajm,
      summa: n.smeta,
      isQosh: n.isQosh,
      isZamena: n.isZamena,
      children: n.children ? mapSmetaToDaraxt(n.children) : undefined
    }));
  }

  // Jami summalarni hisoblash
  const aktJami = useMemo(() => {
    let sum = 0;
    aktBarglar.forEach((n) => {
      let price = n.narx || 0;
      if (!price && smetaTree && korish?.moslash?.qatorlar) {
        const mq = korish.moslash.qatorlar.find((q) => q.uid === n.uid);
        if (mq && mq.qator_id) {
          const sn = findSmetaNode(smetaTree, mq.qator_id);
          if (sn) price = sn.narx || 0;
        }
      }
      sum += (n.hajm || 0) * price;
    });
    return sum;
  }, [korish, smetaTree, aktBarglar]);

  const boglanganJami = useMemo(() => {
    let sum = 0;
    aktBarglar.forEach((n) => {
      const smetaId = getSmetaId(n.uid);
      if (smetaId) {
        let price = n.narx || 0;
        if (!price && smetaTree) {
          const sn = findSmetaNode(smetaTree, smetaId);
          if (sn) price = sn.narx || 0;
        }
        sum += (n.hajm || 0) * price;
      }
    });
    return sum;
  }, [korish, getSmetaId, smetaTree, aktBarglar]);



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

    if (!constOk) {
      const tasd = window.confirm(`Diqqat! Akt jami va Bog'langan jami o'rtasida farq bor: ${farq.toFixed(2)} so'm. Shunda ham saqlaymizmi?`);
      if (!tasd) return;
    }

    setYozilmoqda(true); setNatija(null);
    try {
      const r = await sbT2AktYarat({
        obyektId: korish.obyekt_id,
        tur,
        oy: oy + '-01',
        qatorlar: rows,
        operationId: opId,
        raqam: raqam.trim() || undefined
      });
      setNatija(r);
      if (r.ok) {
        toast(r.takror ? 'Hujjat allaqachon yaratilgan' : 'Hujjat muvaffaqiyatli yaratildi', 'ok');
        // Clear drafts on success
        localStorage.removeItem(`T2_F2_DRAFT_${korish.obyekt_id}_${faylId}`);
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
            {korish.moslash && (korish.moslash.ikkilamchi > 0 || korish.moslash.topilmadi > 0) && (
              <div className="rounded-lg border border-warn/30 bg-warn/[.05] p-3 text-[12px] text-text-dim space-y-1">
                <p className="font-semibold text-warn flex items-center gap-1.5">
                  <AlertCircle size={14} /> Diqqat! {korish.moslash.ikkilamchi + korish.moslash.topilmadi} ta qator auto-moslanmadi
                </p>
                <p className="text-[11px] text-text-mute">
                  • <b>Ikkilamchi ({korish.moslash.ikkilamchi} ta):</b> Smetada bir xil nomli bir nechta nomzod bor. Chap panelda ularni topib, o'ngdagi kerakli smeta qatoriga <b>sudrab bog'lang</b>.
                </p>
                <p className="text-[11px] text-text-mute">
                  • <b>Topilmagan ({korish.moslash.topilmadi} ta):</b> Nom yoki birlik farqi sababli avtomat topilmadi. Chap paneldan sudrab, o'ngdagi tegishli qatorga bog'lang.
                </p>
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
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => { setQadam(0); setNatija(null); }}
                  className="px-3 py-1.5 rounded-lg border border-border text-[12px] text-text-dim hover:bg-white/5">
                  Orqaga
                </button>
                <button onClick={resetBinds}
                  className="px-3 py-1.5 rounded-lg border border-danger/30 text-[12px] text-danger hover:bg-danger/5 inline-flex items-center gap-1">
                  <Trash2 size={13} /> Qayta tiklash
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
                      className="flex items-center gap-1 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 px-2.5 py-1 rounded text-[10px] transition-colors font-bold whitespace-nowrap cursor-pointer">
                      🪄 + Barchasini Avto-Moslash
                    </button>
                  </div>
                  <div className="relative">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-mute" />
                    <input value={f2Qidiruv} onChange={(e) => setF2Qidiruv(e.target.value)}
                      placeholder="nom yoki kod bo'yicha..."
                      className="w-full bg-[var(--surface-2)] border border-border rounded-lg pl-7 pr-3 py-1 text-[11px] text-text outline-none" />
                  </div>
                </div>
              }
              ongSarlavha={
                <div className="flex flex-col gap-2 w-full">
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-xs">SMETA DARAXYI (Supabase)</span>
                    {smetaLoading && <RefreshCw size={12} className="animate-spin text-accent" />}
                  </div>
                  <div className="relative">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-mute" />
                    <input value={smetaQidiruv} onChange={(e) => setSmetaQidiruv(e.target.value)}
                      placeholder="nom yoki kod bo'yicha..."
                      className="w-full bg-[var(--surface-2)] border border-border rounded-lg pl-7 pr-3 py-1 text-[11px] text-text outline-none" />
                  </div>
                </div>
              }
              chapOng={
                <div className="flex flex-col gap-1.5 w-full">
                  <div className="flex gap-1 bg-black/20 p-1 rounded-lg">
                    {(['hammasi', 'boglanmagan', 'boglangan', 'manfiy'] as const).map((f) => (
                      <button key={f} onClick={() => setFiltr(f)}
                        className={`flex-1 h-6 px-1 rounded-md text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap
                          ${filtr === f ? 'bg-accent text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                        {f === 'hammasi' ? 'Barchasi'
                          : f === 'boglangan' ? '✓ Bog‘langan'
                          : f === 'manfiy' ? `− Qaytarim`
                          : '○ Bog‘lanmagan'}
                      </button>
                    ))}
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
                  filtr={filtr}
                  ochiqYopiqSignal={ochiqSignal}
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
                />
              }
            />
            
            <p className="text-[10px] text-text-mute text-center">
              💡 F2 aktidagi qatorni sudrab, o'ng tomondagi mos smeta qatoriga tashlang (drag & drop). Bog'lanishni bekor qilish uchun qatordagi belgini bosing.
            </p>
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
                    <span className="text-danger font-medium">⚠️ {b.nom}</span> —{' '}
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
