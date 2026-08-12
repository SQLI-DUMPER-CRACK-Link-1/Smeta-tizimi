import { useEffect, useMemo, useRef } from 'react';
import {
  useObyektlar, useF2Lokalkalar, useF2FaylYukla,
  useF2AvtoMoslash, useF2Yoz, useF2JobHolat, useF2Fayllar, useF2Varaqlar, useF2Ustunlar, useF2Daraxt, useHolat, useF2OyOchirish, useF2EskiFaylOqi
} from '../../api/hooks';
import {
  Sahifa, KpiKarta, Nishon, Tugma, Maydon, Kiritma, Tanlov, Juft, XatoHolat,
} from '../../umumiy/ui/Sahifa';
import { FmtN } from '../../lib/format';
import { IkkiPanel } from '../../umumiy/ui/IkkiPanel';
import { F2Daraxt, type DaraxtTugun } from '../../umumiy/ui/F2Daraxt';
import { toast } from '../../umumiy/ui/Toast';
import { Upload, FileSpreadsheet, Wand2, CheckCircle2, AlertTriangle, Send, FolderOpen, FolderClosed, ShieldAlert } from 'lucide-react';
import type { AktNode, F2Moslik } from '../../api/types';
import { resetF2Store, useF2Store } from '../store/useF2Store';

/* Akt daraxtidagi BARCHA barg (leaf) tugunlar — jami summa faqat shulardan.
 * ⚠️ bl summasi bolalarining yig'indisi bo'lgani uchun uni QO'SHSAK ikki marta
 * hisoblanadi (ilgari «akt 171M, yozildi 227M» xatosi shundan chiqqan). */
function barglar(nodes: AktNode[] = []): AktNode[] {
  const out: AktNode[] = [];
  const yur = (ns: AktNode[]) => ns.forEach((n) => {
    const bolalar = n.children ?? [];
    if (n.type !== 'rz' && bolalar.length === 0) out.push(n);
    if (bolalar.length) yur(bolalar);
  });
  yur(nodes);
  return out;
}

const _LAT2CYR_JS: Record<string, string> = { A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М', N: 'Н', O: 'О', P: 'Р', T: 'Т', V: 'В', X: 'Х', Y: 'У' };

function _f2NormNom(s?: string) {
  let r = String(s == null ? '' : s).toUpperCase();
  let out = '';
  for (let i = 0; i < r.length; i++) {
    const ch = r.charAt(i);
    out += _LAT2CYR_JS[ch] || ch;
  }
  return out.replace(/Ё/g, 'Е').replace(/[^0-9А-Я]/g, '');
}

function _f2NormBir(s?: string) {
  let raw = String(s == null ? '' : s).toUpperCase()
    .replace(/³/g, '3').replace(/²/g, '2').replace(/¹/g, '1')
    .replace(/Ё/g, 'Е').replace(/[\s.,\-\/]+/g, '');
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw.charAt(i);
    out += _LAT2CYR_JS[ch] || ch;
  }
  return out;
}

function _f2NormKod(s?: string) {
  let r = String(s == null ? '' : s).trim().toUpperCase().replace(/\s+/g, '');
  let out = '';
  for (let i = 0; i < r.length; i++) {
    const ch = r.charAt(i);
    out += _LAT2CYR_JS[ch] || ch;
  }
  if (/^\d+$/.test(out)) out = out.replace(/^0+/, '') || '0';
  return out;
}

function _f2KodKanon(kod?: string) {
  let s = String(kod == null ? '' : kod).trim().toUpperCase().replace(/Ё/g, 'Е');
  if (!s) return '';
  s = s.split(/\s+/)[0];
  let o = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s.charAt(i);
    o += _LAT2CYR_JS[ch] || ch;
  }
  s = o;
  const g = s.match(/\d+/g) || [];
  if (!g.length) return '';
  const pm = s.match(/([А-Я]+)/);
  const pref = pm ? pm[1] : '';
  const parts: string[] = [];
  g.forEach((x, ix) => {
    if (ix === 0 && x.length === 4 && g.length >= 2) {
      parts.push(x.slice(0, 2));
      parts.push(x.slice(2));
    } else parts.push(x);
  });
  const finalParts = parts.map(x => {
    const num = parseInt(x, 10);
    return isNaN(num) ? x : String(num);
  });
  return pref + finalParts.join('-');
}

function formatVol(val: any) {
  if (typeof val !== 'number') return val;
  return Number(val.toFixed(4));
}

const QADAMLAR = ['Fayl', "Moslashtirish va bog'lash", 'Yozish'];

export function F2Import() {
  const obyektlar = useObyektlar();
  const [state, setState] = useF2Store();
  const { obyekt, oyNom, lokalka, qadam, aktTree, natija, yozishBoshlandi, fid, faylNomi, varaq, cfg, hover, filtr, ochiqSignal, qolBekor, qolBog, qolDop, dopModalUid, dropState, smetaScrollTo } = state;

  const createSetter = <K extends keyof typeof state>(key: K) => {
    return (val: (typeof state)[K] | ((prev: (typeof state)[K]) => (typeof state)[K])) => {
      setState((s: any) => ({ [key]: typeof val === 'function' ? (val as any)(s[key]) : val }));
    };
  };

  const setObyekt = createSetter('obyekt');
  const setOyNom = createSetter('oyNom');
  const setLokalka = createSetter('lokalka');
  const setQadam = createSetter('qadam');
  const setAktTree = createSetter('aktTree');
  const setNatija = createSetter('natija');
  const setYozishBoshlandi = createSetter('yozishBoshlandi');
  const setFid = createSetter('fid');
  const setFaylNomi = createSetter('faylNomi');
  const setVaraq = createSetter('varaq');
  const setCfg = createSetter('cfg');
  const setHover = createSetter('hover');
  const setFiltr = createSetter('filtr');
  const setOchiqSignal = createSetter('ochiqSignal');
  const setQolBekor = createSetter('qolBekor');
  const setQolBog = createSetter('qolBog');
  const setQolDop = createSetter('qolDop');
  const setDopModalUid = createSetter('dopModalUid');
  const setDropState = createSetter('dropState');
  const setSmetaScrollTo = createSetter('smetaScrollTo');

  const faylRef = useRef<HTMLInputElement>(null);

  const loklar = useF2Lokalkalar(obyekt);
  const fayllar = useF2Fayllar(obyekt);
  const yukla = useF2FaylYukla();
  const varaqlar = useF2Varaqlar(fid);
  const ustun = useF2Ustunlar();
  const daraxt = useF2Daraxt();
  const moslash = useF2AvtoMoslash();
  const yoz = useF2Yoz();
  const job = useF2JobHolat(true);
  const lrv = useHolat(obyekt);
  const useF2OyOchirishHook = useF2OyOchirish();
  const useF2EskiFaylOqiHook = useF2EskiFaylOqi();

  // Umumiy obyektdagi Smeta va Oldingi F2 ni hisoblash
  const { umumiySmeta, umumiyOldingiF2 } = useMemo(() => {
    let smeta = 0;
    let oldingiF2 = 0;
    if (lrv.data?.tree) {
      const b = barglar(lrv.data.tree as unknown as any[]);
      b.forEach(n => {
        smeta += Number((n as any).smeta || 0);
        oldingiF2 += Number((n as any).stF2 || 0);
      });
    }
    return { umumiySmeta: smeta, umumiyOldingiF2: oldingiF2 };
  }, [lrv.data?.tree]);

  const obNomlari = useMemo(
    () => Array.from(new Set((obyektlar.data ?? []).map((o) => o.obyekt.split(' - ')[0]))),
    [obyektlar.data],
  );

  const aktBarglar = useMemo(() => barglar(aktTree ?? []), [aktTree]);
  const aktJami = useMemo(() => aktBarglar.reduce((a, n) => a + (n.summa || 0), 0), [aktBarglar]);
  /** Akt daraxtidagi BARCHA tugun (bl ham) — qo'lda bog'lashda izlash uchun */
  const aktBarchaTugun = useMemo(() => {
    const out: AktNode[] = [];
    const yur = (ns: AktNode[]) => (ns ?? []).forEach((n) => { if (n.type !== 'rz') out.push(n); if (n.children?.length) yur(n.children); });
    yur(aktTree ?? []);
    return out;
  }, [aktTree]);

  /** Barg uid'lari — solishtiruv FAQAT shular bo'yicha */
  const bargUidlar = useMemo(() => new Set(aktBarglar.map((n) => n.uid)), [aktBarglar]);

  /**
   * Bog'langan summa — FAQAT BARG mosliklaridan.
   * ⚠️ `mosliklar` ichida ish (bl) qatorlari HAM bor, va `bl.summa` o'z
   * bolalarining yig'indisi. Hammasini qo'shsak bir pul IKKI MARTA sanaladi —
   * shuning uchun «Bog'langan» akt jamisidan katta chiqib, farq manfiy bo'lardi
   * (1.96 mlrd > 1.44 mlrd, farq −714 mln). aktJami barglardan olinadi, demak
   * bog'langan ham barglardan olinishi shart.
   */
  /* Bog'lanishlar: uid -> {varaq,row} va teskarisi. Qo'lda bekor qilinganlar chiqariladi. */
  const moslikMap = useMemo(() => {
    const m = new Map<string, F2Moslik>();
    (natija?.mosliklar ?? []).forEach((x) => { if (!qolBekor.has(x.uid)) m.set(x.uid, x); });
    Object.values(qolBog).forEach((x) => m.set(x.uid, x));   // qo'lda bog'langanlar ustuvor
    return m;
  }, [natija, qolBekor, qolBog]);
  const joyMap = useMemo(() => {
    const m = new Map<string, string>();
    moslikMap.forEach((v, uid) => m.set(`${v.varaq}#${v.row}`, uid));
    return m;
  }, [moslikMap]);
  const boglanganJoylar = useMemo(() => new Set(joyMap.keys()), [joyMap]);

  const aktBogMi = (k: string) => {
    if (moslikMap.has(k)) return true;
    if (qolDop[k]) return true;
    for (const dop of Object.values(qolDop)) {
      if (dop.childUids?.includes(k)) return true;
    }
    // Agar server qaytargan stat ichida qolibDopps bo'lsa (kelajakda):
    if ((natija?.stat as any)?.qolibDopps?.some((d: any) => d.uid === k || d.childUids?.includes(k))) return true;
    return false;
  };

  const boglanganJami = useMemo(
    () => [...moslikMap.values()].filter((m) => bargUidlar.has(m.uid)).reduce((a, m) => a + (m.summa || 0), 0),
    [moslikMap, bargUidlar],
  );

  /** Ish (bl) darajasida bog'langanlar — alohida ko'rsatiladi, summaga QO'SHILMAYDI */
  const ishMosliklari = useMemo(
    () => [...moslikMap.values()].filter((m) => !bargUidlar.has(m.uid)).length,
    [moslikMap, bargUidlar],
  );
  /** Bog'lanmagan barglar — ular endi avtomatik qoshilmaydi, faqat Dop modal orqali qoshiladi */
  const doppedUids = useMemo(() => {
    const s = new Set<string>();
    Object.values(qolDop).forEach(d => {
      s.add(d.uid);
      if (d.childUids) d.childUids.forEach((c: string) => s.add(c));
    });
    return s;
  }, [qolDop]);

  const boglanmagan = useMemo(() => {
    return aktBarglar.filter((n) => !moslikMap.has(n.uid) && !doppedUids.has(n.uid));
  }, [aktBarglar, moslikMap, doppedUids]);
  
  const blKam = useMemo(() => {
    return aktBarchaTugun.filter((n) => n.type === 'bl' && !moslikMap.has(n.uid) && !qolDop[n.uid]);
  }, [aktBarchaTugun, moslikMap, qolDop]);

  const limitOsh = useMemo(() => {
    if (!lrv.data?.tree) return [];
    const v: { nom: string; farq: number }[] = [];
    const check = (nodes: any[]) => {
      for (const n of nodes) {
        if (n.type !== 'rz') {
          const kalit = `${n.varaq}#${n.row}`;
          const aktUid = joyMap.get(kalit);
          if (aktUid) {
            const aNode = aktBarchaTugun.find(a => a.uid === aktUid);
            if (aNode && aNode.hajm && n.qoldiq != null && aNode.hajm > n.qoldiq) {
              v.push({ nom: n.nom, farq: aNode.hajm - n.qoldiq });
            }
          }
        }
        if (n.children) check(n.children);
      }
    };
    check(lrv.data.tree);
    return v;
  }, [lrv.data, joyMap, aktBarchaTugun]);

  const dopJami = useMemo(() => {
    return aktBarglar
      .filter(n => doppedUids.has(n.uid) && !moslikMap.has(n.uid))
      .reduce((a, n) => a + (n.summa || 0), 0);
  }, [aktBarglar, doppedUids, moslikMap]);

  useEffect(() => {
    const holat = job.data?.job?.status;
    if (!holat) return;
    if (holat !== 'navbat' && holat !== 'ishlayapti') return;
    if (!yozishBoshlandi) setYozishBoshlandi(true);
    if (qadam !== 2) setQadam(2);
  }, [job.data?.job?.status, qadam, yozishBoshlandi]);

  /** Hamma bog'lanishlarni bekor qilish: moslikMap ham, qolDop ham. Farzandlarini ham qo'shib bekor qiladi */
  function bogBekor(uid: string) {
    const toRemove = new Set<string>([uid]);
    const n = aktBarchaTugun.find((x) => x.uid === uid);
    if (n && n.children) {
      const getKids = (node: AktNode) => {
        if (node.children) {
          node.children.forEach(c => {
            toRemove.add(c.uid);
            getKids(c);
          });
        }
      };
      getKids(n);
    }

    setQolBekor((p) => {
      const s = new Set(p);
      toRemove.forEach(u => s.add(u));
      return s;
    });
    setQolBog((p) => {
      const np = { ...p };
      toRemove.forEach(u => delete np[u]);
      return np;
    });
    setQolDop((p) => {
      const np = { ...p };
      toRemove.forEach(u => delete np[u]);
      return np;
    });
  }

  function smetaBogBekor(smetaKalit: string) {
    const aktUid = joyMap.get(smetaKalit);
    if (aktUid) bogBekor(aktUid);
  }

  /** Sudrab tashlash: akt qatori → smeta qatori. «varaq#row» yoki rz:nom:row dan ajratamiz. */
  function qolBogla(aktKalit: string, smetaKalit: string) {
    if (smetaKalit.startsWith('rz:')) {
      const parts = smetaKalit.split(':');
      const row = Number(parts[2] || 0);
      const rz = smetaRazdellar.find(r => r.row === row && r.nom === parts[1]);
      if (rz) {
        setDopModalUid(aktKalit); // modalni trigger qilmasdan to'g'ridan to'g'ri qo'shamiz
        tasdiqlaDropRz(aktKalit, rz);
      }
      return;
    }

    const i = smetaKalit.lastIndexOf('#');
    if (i < 0) return;
    const varaqNom = smetaKalit.slice(0, i);
    const row = Number(smetaKalit.slice(i + 1));
    if (!row) return;
    if (joyMap.has(smetaKalit)) { toast('Bu smeta qatori allaqachon band'); return; }
    const n = aktBarglar.find((x) => x.uid === aktKalit)
      ?? aktBarchaTugun.find((x) => x.uid === aktKalit);
    if (!n) { toast('Akt qatori topilmadi'); return; }
    
    // Exact match tekshiruvi (Aynan bir xil kod, nom, birlik bo'lsa - avtomatik ulanadi)
    let targetSmetaNode: any = null;
    const findSmetaNode = (nodes: any[]) => {
       for (const sn of nodes) {
          if (sn.row === row && sn.varaq === varaqNom) { targetSmetaNode = sn; return; }
          if (sn.children) findSmetaNode(sn.children);
          if (targetSmetaNode) return;
       }
    };
    findSmetaNode(lrv.data?.tree || []);

    if (targetSmetaNode) {
       const aKod = _f2NormKod(n.kod); const sKod = _f2NormKod(targetSmetaNode.kod);
       const aKodK = _f2KodKanon(n.kod); const sKodK = _f2KodKanon(targetSmetaNode.kod);
       const aNom = _f2NormNom(n.nom); const sNom = _f2NormNom(targetSmetaNode.nom);
       const aBir = _f2NormBir(n.bir); const sBir = _f2NormBir(targetSmetaNode.birlik);
       
       let isExactMatch = false;
       
       if (n.type === 'bl') {
           const kodMos = (aKod && sKod && aKod === sKod) || (aKodK && sKodK && aKodK === sKodK) || (!aKod || !sKod);
           if (kodMos && aNom === sNom && aBir === sBir) {
               isExactMatch = true;
           }
       } else {
           if (aNom && sNom && aNom === sNom && aBir === sBir) {
               isExactMatch = true;
           }
       }

       if (isExactMatch) {
          bajarDropZamena(aktKalit, row, varaqNom);
          toast(`✓ Bog'landi: ${String(n.nom).slice(0, 40)}`);
          return;
       }
    }

    // Farq bor — modal ochish (3 variant: Bog'lash / Zamena / Qo'shimcha)
    setDropState({ aktKalit, smetaKalit, smetaRow: row, varaqNom });
  }

  function tasdiqlaDropZamena() {
    if (!dropState) return;
    const { aktKalit, smetaRow, varaqNom } = dropState;
    const d = aktBarchaTugun.find((x) => x.uid === aktKalit);
    if (!d) return;

    const tur = (d.type === 'ob') ? 'ob' : ((d.type === 'mat' || d.type === 'rs') ? 'mat' : 'bl');
    const getKids = (node: AktNode): any[] => {
      let k: any[] = [];
      (node.children || []).forEach(c => {
         k.push({uid: c.uid, type: c.type, kod: c.kod, nom: c.nom, bir: c.bir, hajm: c.hajm, narx: c.narx, summa: c.summa});
         if (c.children) k = k.concat(getKids(c));
      });
      return k;
    };
    const kids = (tur === 'bl') ? getKids(d).filter(k => !moslikMap.has(k.uid) && !qolDop[k.uid]) : [];

    setQolBekor((p) => { const s = new Set(p); s.add(d.uid); return s; });
    setQolBog((p) => { const nb = { ...p }; delete nb[d.uid]; return nb; });

    setQolDop((p) => ({
      ...p,
      [d.uid]: {
        uid: d.uid, varaq: varaqNom, action: 'zamena_add', tur, targetRow: smetaRow,
        kod: d.kod, nom: d.nom, bir: d.bir, hajm: d.hajm, narx: d.narx || 0,
        summa: d.summa || 0, children: kids, childUids: kids.map(c => c.uid), zamena: true, droppedOnRow: smetaRow
      }
    }));
    toast(`Zamena qator qo'shildi: ${String(d.nom).slice(0, 34)}`);
    setDropState(null);
  }

  function bajarDropZamena(aktKalit: string, smetaRow: number, varaqNom: string) {
    const n = aktBarchaTugun.find((x) => x.uid === aktKalit);
    if (!n) return;
    
    setQolBekor((p) => { const s = new Set(p); s.delete(aktKalit); return s; });
    setQolDop((p) => { const nd = { ...p }; delete nd[aktKalit]; return nd; });

    const newBog: Record<string, any> = { [aktKalit]: {
      uid: aktKalit, varaq: varaqNom, row: smetaRow,
      kod: n.kod ?? '', hajm: n.hajm ?? 0, narx: n.narx ?? 0, summa: n.summa ?? 0,
    } };

    // Agar BL bo'lsa va ichida rs lari bo'lsa, va ular bog'lanmagan bo'lsa, ularni ham Dop qilib qo'shamiz!
    if (n.type === 'bl') {
       let targetSmetaNode: any = null;
       const findSmetaNode = (nodes: any[]) => {
         for (const sn of nodes) {
            if (sn.row === smetaRow && sn.varaq === varaqNom) { targetSmetaNode = sn; return; }
            if (sn.children) findSmetaNode(sn.children);
            if (targetSmetaNode) return;
         }
       };
       findSmetaNode(lrv.data?.tree || []);

       const smetaBolalar = targetSmetaNode?.children || [];
       const bandBolalar = new Set<string>(); // qaysi smeta row band bo'ldi
       const cleanStr = (s?: string) => (s || '').replace(/\s+/g, '').toUpperCase();

       const getKids = (node: AktNode): any[] => {
         let k: any[] = [];
         (node.children || []).forEach(c => {
            k.push({uid: c.uid, type: c.type, kod: c.kod, nom: c.nom, bir: c.bir, hajm: c.hajm, narx: c.narx, summa: c.summa});
            if (c.children) k = k.concat(getKids(c));
         });
         return k;
       };
       
       const kids = getKids(n).filter(k => !moslikMap.has(k.uid) && !qolDop[k.uid]);
       
       kids.forEach(k => {
          let mapped = false;
          for (const sb of smetaBolalar) {
             if (bandBolalar.has(sb.varaq + '#' + sb.row) || joyMap.has(sb.varaq + '#' + sb.row)) continue;
             if ((k.kod && sb.kod && cleanStr(k.kod) === cleanStr(sb.kod)) || 
                 (cleanStr(k.nom) === cleanStr(sb.nom) && cleanStr(k.bir) === cleanStr(sb.birlik))) {
                
                newBog[k.uid] = {
                   uid: k.uid, varaq: sb.varaq, row: sb.row,
                   kod: k.kod ?? '', hajm: k.hajm ?? 0, narx: k.narx ?? 0, summa: k.summa ?? 0,
                };
                bandBolalar.add(sb.varaq + '#' + sb.row);
                setQolBekor((p) => { const s = new Set(p); s.delete(k.uid); return s; });
                mapped = true;
                break;
             }
          }

          if (!mapped) {
             setQolBekor((p) => { const s = new Set(p); s.add(k.uid); return s; });
             setQolDop(p => ({
               ...p,
               [k.uid]: {
                 uid: k.uid, varaq: varaqNom, action: 'add_rs', tur: k.type === 'ob' ? 'ob' : 'mat', targetRow: smetaRow,
                 kod: k.kod, nom: k.nom, bir: k.bir, hajm: k.hajm, narx: k.narx || 0,
                 summa: k.summa || 0, children: [], childUids: []
               }
             }));
          }
       });
    }

    setQolBog((p) => ({ ...p, ...newBog }));
    toast(`Bog'landi: ${String(n.nom).slice(0, 34)}`);
  }

  function tasdiqlaDropDop() {
    if (!dropState) return;
    const { aktKalit, smetaRow, varaqNom } = dropState;
    const d = aktBarchaTugun.find((x) => x.uid === aktKalit);
    if (!d) return;

    const tur = (d.type === 'ob') ? 'ob' : ((d.type === 'mat' || d.type === 'rs') ? 'mat' : 'bl');
    const getKids = (node: AktNode): any[] => {
      let k: any[] = [];
      (node.children || []).forEach(c => {
         k.push({uid: c.uid, type: c.type, kod: c.kod, nom: c.nom, bir: c.bir, hajm: c.hajm, narx: c.narx, summa: c.summa});
         if (c.children) k = k.concat(getKids(c));
      });
      return k;
    };
    const kids = (tur === 'bl') ? getKids(d).filter(k => !moslikMap.has(k.uid) && !qolDop[k.uid]) : [];

    setQolBekor((p) => { const s = new Set(p); s.add(d.uid); return s; });
    setQolBog((p) => { const nb = { ...p }; delete nb[d.uid]; return nb; });

    setQolDop((p) => ({
      ...p,
      [d.uid]: {
        uid: d.uid, varaq: varaqNom, action: 'add_bl', tur, targetRow: smetaRow,
        kod: d.kod, nom: d.nom, bir: d.bir, hajm: d.hajm, narx: d.narx || 0,
        summa: d.summa || 0, children: kids, childUids: kids.map(c => c.uid)
      }
    }));
    toast(`Qo'shimcha ish qilib qo'shildi!`);
    setDropState(null);
  }

  function handleDopClick(uid: string) {
    setDopModalUid(uid);
  }

  const smetaRazdellar = useMemo(() => {
    const out: {nom: string, varaq: string, lastRow: number, row: number}[] = [];
    (lrv.data?.tree || []).forEach((n: any) => {
      if (n.type === 'rz') {
        let lastRow = n.row || 0;
        (n.children || []).forEach((c: any) => {
          if (c.row > lastRow) lastRow = c.row;
          (c.children || []).forEach((r2: any) => { if (r2.row > lastRow) lastRow = r2.row; });
        });
        out.push({ nom: n.nom || '(nom yo\'q)', varaq: n.varaq || '', lastRow, row: n.row || 0 });
      }
    });
    return out;
  }, [lrv.data]);

  function tasdiqlaDop(rz: typeof smetaRazdellar[0]) {
    if (!dopModalUid) return;
    const d = aktBarchaTugun.find((x) => x.uid === dopModalUid);
    if (!d) return;
    const tur = (d.type === 'ob') ? 'ob' : ((d.type === 'mat' || d.type === 'rs') ? 'mat' : 'bl');
    
    // Agar BL bo'lsa, uning bolalarini ham yig'ib olish
    const getKids = (node: AktNode): any[] => {
      let k: any[] = [];
      (node.children || []).forEach(c => {
         k.push({uid: c.uid, type: c.type, kod: c.kod, nom: c.nom, bir: c.bir, hajm: c.hajm, narx: c.narx, summa: c.summa});
         if (c.children) k = k.concat(getKids(c));
      });
      return k;
    };
    const kids = (tur === 'bl') ? getKids(d).filter(k => !moslikMap.has(k.uid) && !qolDop[k.uid]) : [];

    setQolBekor((p) => { const s = new Set(p); s.add(d.uid); return s; });
    setQolBog((p) => { const nb = { ...p }; delete nb[d.uid]; return nb; });

    setQolDop((p) => ({
      ...p,
      [d.uid]: {
        uid: d.uid, varaq: rz.varaq, action: 'add_bl', tur, targetRow: rz.lastRow,
        kod: d.kod, nom: d.nom, bir: d.bir, hajm: d.hajm, narx: d.narx || 0,
        summa: d.summa || 0, children: kids, childUids: kids.map(c => c.uid)
      }
    }));
    setDopModalUid(null);
    toast(`${rz.nom} ga Qo'shimcha ish bo'lib qo'shildi`, 'ok');
  }

  function tasdiqlaDropRz(aktKalit: string, rz: typeof smetaRazdellar[0]) {
    const d = aktBarchaTugun.find((x) => x.uid === aktKalit);
    if (!d) return;
    const tur = (d.type === 'ob') ? 'ob' : ((d.type === 'mat' || d.type === 'rs') ? 'mat' : 'bl');
    
    const getKids = (node: AktNode): any[] => {
      let k: any[] = [];
      (node.children || []).forEach(c => {
         k.push({uid: c.uid, type: c.type, kod: c.kod, nom: c.nom, bir: c.bir, hajm: c.hajm, narx: c.narx, summa: c.summa});
         if (c.children) k = k.concat(getKids(c));
      });
      return k;
    };
    const kids = (tur === 'bl') ? getKids(d).filter(k => !moslikMap.has(k.uid) && !qolDop[k.uid]) : [];

    setQolBekor((p) => { const s = new Set(p); s.add(d.uid); return s; });
    setQolBog((p) => { const nb = { ...p }; delete nb[d.uid]; return nb; });

    setQolDop((p) => ({
      ...p,
      [d.uid]: {
        uid: d.uid, varaq: rz.varaq, action: 'add_bl', tur, targetRow: rz.lastRow,
        kod: d.kod, nom: d.nom, bir: d.bir, hajm: d.hajm, narx: d.narx || 0,
        summa: d.summa || 0, children: kids, childUids: kids.map(c => c.uid)
      }
    }));
    toast(`${rz.nom} ga Qo'shimcha ish bo'lib qo'shildi`, 'ok');
  }

  function handleBekorSmetaTaraf(aktUid: string) {
    setQolBekor((p) => { const s = new Set(p); s.add(aktUid); return s; });
    setQolBog((p) => { const nb = { ...p }; delete nb[aktUid]; return nb; });
    setQolDop((p) => { const nd = { ...p }; delete nd[aktUid]; return nd; });
  }

  /** Gap drop: akt qatorini smeta qatorlari ORASIGA tashlash — shu qatordan keyin add_bl yoki add_rs */
  function qolGapDop(aktKalit: string, smetaKalit: string) {
    const i = smetaKalit.lastIndexOf('#');
    if (i < 0) return;
    const varaqNom = smetaKalit.slice(0, i);
    const row = Number(smetaKalit.slice(i + 1));
    if (!row) return;
    const n = aktBarchaTugun.find((x) => x.uid === aktKalit);
    if (!n) { toast('Akt qatori topilmadi'); return; }

    const tur = (n.type === 'ob') ? 'ob' : ((n.type === 'mat' || n.type === 'rs') ? 'mat' : 'bl');
    const getKids = (node: AktNode): any[] => {
      let k: any[] = [];
      (node.children || []).forEach(c => {
         if (!moslikMap.has(c.uid) && !qolDop[c.uid]) {
           k.push({uid: c.uid, type: c.type, kod: c.kod, nom: c.nom, bir: c.bir, hajm: c.hajm, narx: c.narx, summa: c.summa});
           if (c.children) k = k.concat(getKids(c));
         }
      });
      return k;
    };
    const kids = (tur === 'bl') ? getKids(n) : [];

    setQolBekor((p) => { const s = new Set(p); s.add(aktKalit); return s; });
    setQolBog((p) => { const nb = { ...p }; delete nb[aktKalit]; return nb; });
    setQolDop(p => ({
      ...p,
      [aktKalit]: {
        uid: aktKalit, varaq: varaqNom,
        action: tur === 'bl' ? 'add_bl' : 'add_rs',
        tur, targetRow: row,
        kod: n.kod, nom: n.nom, bir: n.bir, hajm: n.hajm, narx: n.narx || 0,
        summa: n.summa || 0, children: kids, childUids: kids.map(c => c.uid),
        droppedOnRow: row,
      }
    }));
    toast(`↓ Orasiga qo'shildi: ${String(n.nom).slice(0, 40)}`);
  }

  /** Akt tarafidan → bosilganda smeta tarafida mos qatorni ochib scroll qilish */
  function aktOtishClick(aktUid: string) {
    const m = moslikMap.get(aktUid);
    if (!m) return;
    const smetaKalit = `${m.varaq}#${m.row}`;
    setSmetaScrollTo(null); // reset
    requestAnimationFrame(() => setSmetaScrollTo(smetaKalit));
  }


  /** AKT daraxti — razdel → ish → resurs, bog'lanish belgilari bilan */
  const aktDaraxt = useMemo((): DaraxtTugun[] => {
    const map = (ns: AktNode[]): DaraxtTugun[] => (ns ?? []).map((n) => ({
      kalit: n.uid,
      type: n.type,
      nom: n.nom,
      kod: n.kod,
      bir: n.bir,
      summa: n.summa,
      belgi: n.type === 'rz' ? undefined : (
        <div className="flex gap-3 items-center text-[12px] whitespace-nowrap">
          {n.hajm ? <span>Hajm: <span className="font-medium text-emerald-400">{formatVol(n.hajm)}</span></span> : null}
          <span>Summa: <FmtN val={n.summa} /></span>
        </div>
      ),
      children: n.children?.length ? map(n.children) : undefined,
    }));
    return map(aktTree ?? []);
  }, [aktTree]);

  /** SMETA daraxti — LRV_PLUS ierarxiyasi */
  const smetaDaraxt = useMemo((): DaraxtTugun[] => {
    const map = (ns: any[]): DaraxtTugun[] => (ns ?? []).map((n) => {
      const kalit = n.type === 'rz' ? `rz:${n.nom}:${n.row ?? ''}` : `${n.varaq}#${n.row}`;
      const boglanganAktUid = joyMap.get(kalit);
      let boglanganAktText = null;
      if (boglanganAktUid) {
        const aktQator = aktBarchaTugun.find(a => a.uid === boglanganAktUid);
        if (aktQator) {
           const farq = (n.qoldiq ?? 0) - (aktQator.hajm ?? 0);
           boglanganAktText = (
             <div className="mt-1 p-1 px-2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex justify-between items-center text-[11px] min-w-[200px]">
                <div className="flex items-center gap-2">
                   <span>+ {formatVol(aktQator.hajm)} (F2: {aktQator.kod || 'kodsiz'}) - <FmtN val={aktQator.summa}/></span>
                   {Math.abs(farq) > 0.001 && <span className={farq < 0 ? 'text-red-400 ml-2 font-bold' : 'text-orange-300 ml-2'}>Farq: {farq > 0 ? `+${formatVol(farq)}` : formatVol(farq)}</span>}
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleBekorSmetaTaraf(boglanganAktUid); }} className="ml-4 hover:text-red-400 font-bold px-2 rounded bg-black/20 hover:bg-black/40 transition-colors text-slate-300" title="Bekor qilish">
                   ✕
                </button>
             </div>
           );
        }
      }

      let mappedChildren = n.children?.length ? map(n.children) : undefined;

      const rowDopps = Object.values(qolDop).filter(d => d.varaq === n.varaq && (d.droppedOnRow === n.row || d.targetRow === n.row));
      
      const doppsContent = rowDopps.length > 0 ? (
        <div className="flex flex-col gap-1 mt-1 w-full max-w-[600px]">
          {rowDopps.map(d => {
            const isZamena = d.action === 'zamena_add';
            const bgClass = isZamena ? 'bg-orange-500/10 border-orange-500/30' : 'bg-yellow-500/10 border-yellow-500/30';
            const textClass = isZamena ? 'text-orange-400' : 'text-yellow-400';
            const amalName = isZamena ? '🔄 ZAMENA' : d.tur === 'bl' ? '➕ ISH' : d.tur === 'rz' ? '📂 RAZDEL' : '➕ DOP';
            
            return (
              <div key={d.uid} className={`p-1.5 px-2 rounded border border-dashed flex flex-col gap-1 text-[11px] ${bgClass}`}>
                <div className="flex justify-between items-start">
                   <div className="flex flex-col gap-0.5 max-w-[85%]">
                     <div className="flex items-center gap-2">
                       <span className={`font-bold px-1 rounded bg-black/20 ${textClass}`}>{amalName}</span>
                       <span className="text-slate-300 font-medium">F2: {d.kod || 'kodsiz'}</span>
                     </div>
                     <div className="text-slate-100 font-medium leading-tight mt-0.5 truncate" title={d.nom}>
                       {d.nom}
                     </div>
                     <div className="flex items-center gap-3 text-slate-400 mt-0.5">
                       <span>Hajm: <span className="text-emerald-300 font-bold">{formatVol(d.hajm)} {d.bir}</span></span>
                       {d.narx > 0 && <span>Narxi: <span className="text-emerald-300"><FmtN val={d.narx}/></span></span>}
                     </div>
                   </div>
                   <div className="flex flex-col items-end gap-1">
                     <span className="font-bold text-yellow-300"><FmtN val={d.summa}/> so'm</span>
                     <button onClick={(e) => { e.stopPropagation(); handleBekorSmetaTaraf(d.uid); }} className="hover:text-red-400 font-bold px-2 py-0.5 rounded bg-black/20 hover:bg-black/40 transition-colors text-slate-400" title="Bekor qilish">
                        ✕
                     </button>
                   </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null;

      return {
        kalit,
        type: n.type,
        nom: n.nom,
        kod: n.kod,
        bir: n.birlik,
        belgi: n.type === 'rz' ? undefined : (
          <div className="flex flex-col items-end">
            <div className="flex gap-2 items-center text-[11px] opacity-80 whitespace-nowrap">
              {n.smetaHajm != null && <span>Smeta: <span className="font-medium text-white">{formatVol(n.smetaHajm)}</span></span>}
              {n.qoldiq != null && <span>| Qoldiq: <span className="text-orange-400">{formatVol(n.qoldiq)}</span></span>}
              {n.fakt > 0 && <span>| O'tgan F2: <span className="text-blue-400">{formatVol(n.fakt)}</span></span>}
            </div>
            {boglanganAktText}
            {doppsContent}
          </div>
        ),
        children: mappedChildren,
      };
    });
    return map(lrv.data?.tree ?? []);
  }, [lrv.data, joyMap, aktBarchaTugun, qolDop]);

  const farq = aktJami - (boglanganJami + dopJami);
  const constOk = Math.abs(farq) < 1;

  /* ---------- 1a. Faylni tanlash — varaq bosqichiga o'tadi ----------
   * ⚠️ apiF2FaylOqi IKKI BOSQICHLI. Avval bir marta chaqirib `tree` kutilgani
   * uchun har doim «fayl o'qilmadi» chiqardi (u `mode:'config'` qaytaradi). */
  function faylTanla(fileId: string, nom: string) {
    setFid(fileId);
    setFaylNomi(nom);
    setVaraq('');
    setCfg(null);
    setAktTree(null);
  }

  /** Varaq tanlandi → ustunlarni tahlil qilamiz.
   * ⚠️ Bu yerda QADAM ALMASHTIRILMAYDI — o'qilgan daraxt faqat oldindan
   * ko'rsatiladi, moslashtirishga o'tish FAQAT «Davom etish» tugmasi
   * bosilganda (foydalanuvchi talabi: fayl tanlangach avval tasdiqlash kerak). */
  async function varaqTanla(v: string) {
    setVaraq(v);
    setCfg(null);
    setAktTree(null);
    try {
      const r = await ustun.mutateAsync({ fileId: fid, varaq: v });
      if (!r.ok) { toast(r.xabar || "Varaq o'qilmadi"); return; }
      if (r.tree) { setAktTree(r.tree); return; }   // config kerak emas — lekin qadam SHU YERDA o'zgarmaydi
      if (r.cols) setCfg(r.cols);
      else toast('Ustunlar aniqlanmadi');
    } catch (e: any) { toast(`Xato: ${e.message}`); }
  }

  /** Ustunlar tasdiqlandi → daraxt quriladi (hali oldindan ko'rish, qadam o'zgarmaydi) */
  async function daraxtQur() {
    if (!cfg) return;
    try {
      const r = await daraxt.mutateAsync({ fileId: fid, varaq, colConfig: cfg });
      if (!r.ok || !r.tree) { toast(r.xabar || "Daraxt qurilmadi"); return; }
      setAktTree(r.tree);
      toast(`${faylNomi}: ${barglar(r.tree).length} ta qator o'qildi`);
    } catch (e: any) { toast(`Xato: ${e.message}`); }
  }

  /* ---------- 1b. Kompyuterdan yuklash ---------- */
  async function faylTanlandi(f: File) {
    if (!obyekt) { toast('Avval obyektni tanlang'); return; }
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(',')[1] ?? '');
        r.onerror = rej;
        r.readAsDataURL(f);
      });
      const u = await yukla.mutateAsync({
        obyekt, base64, mimeType: f.type || 'application/vnd.ms-excel', filename: f.name, oyNom,
      });
      if (!u.ok || !u.fileId) { toast(u.xabar || 'Fayl yuklanmadi'); return; }
      fayllar.refetch();
      faylTanla(u.fileId, u.name || f.name);
      toast('Yuklandi — endi varaqni tanlang');
    } catch (e: any) { toast(`Xato: ${e.message}`); }
  }

  /* ---------- 2. Moslashtirish ---------- */
  async function moslashtir() {
    if (!aktTree) return;
      try {
        const r = await moslash.mutateAsync({ aktTree, obyekt, lokalka, qatiy: false });
        setNatija(r);
    } catch (e: any) { toast(`Moslashtirishda xato: ${e.message}`); }
  }

  /* ---------- 4. Yozish ---------- */
  async function yozish() {
    if (!natija) return;
    if (!constOk) {
      if (!window.confirm("Diqqat! Akt jami summasi va bog'langan summa o'rtasida farq mavjud. Yozishni baribir davom ettirasizmi?")) {
        return;
      }
    }
    // Dopps endi boglanmagan ro'yxatidan EMAS, faqat qo'lda tasdiqlangan qolDop dan keladi!
    const dopps = Object.values(qolDop);
    try {
      const r = await yoz.mutateAsync({
        obyekt, oyNom, edits: [...moslikMap.values()] as F2Moslik[], dopps, aktJami,
      });
      if (!r.ok) { toast(r.xabar || 'Navbatga qo\'shilmadi'); return; }
      setYozishBoshlandi(true);
      setQadam(2);
      await job.refetch();
    } catch (e: any) { toast(`Xato: ${e.message}`); }
  }

  const j = job.data?.job;
  const foiz = j?.total ? Math.round(((j.done || 0) / j.total) * 100) : 0;

  return (
    <Sahifa
      sarlavha="Ф2 импорт"
      tavsif="Akt faylini smetaga bog'lash — summa tiyingacha mos tushishi shart"
    >
      {/* Qadamlar */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {QADAMLAR.map((nom, i) => (
          <div key={nom} className="flex items-center gap-2">
            <span className={`h-7 px-3 inline-flex items-center gap-2 rounded-full text-[12px] font-medium border
              ${i === qadam ? 'bg-accent text-white border-transparent'
                : i < qadam ? 'bg-ok/10 text-ok border-ok/25'
                : 'karta text-text-mute'}`}>
              {i < qadam ? <CheckCircle2 size={13} /> : <span className="tabular-nums">{i + 1}</span>}
              {nom}
            </span>
            {i < QADAMLAR.length - 1 && <span className="text-text-mute">→</span>}
          </div>
        ))}
      </div>

      {dopModalUid && (
        <div className="fixed inset-0 bg-black/60 z-[10000] flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setDopModalUid(null); }}>
          <div className="bg-[#18181b] border border-border/40 rounded-xl p-5 max-w-lg w-full max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center mb-3 border-b border-border/20 pb-3">
              <h3 className="font-bold text-lg text-emerald-400">Qaysi razdelga qo'shamiz?</h3>
              <button onClick={() => setDopModalUid(null)} className="text-text-mute hover:text-white transition-colors">
                ✕
              </button>
            </div>
            <div className="text-[12px] text-text-mute mb-4">
               F2 aktidagi o'qilmagan ishni Smeta qoldig'iga (Qo'shimcha ish sifatida) qo'shish uchun Smeta razdelini tanlang.
               Bu jarayon ostidagi barcha material/mexanizmlarni ham avtomatik o'ziga ergashtiradi.
            </div>
            <div className="overflow-auto flex-1 pr-2 custom-scrollbar flex flex-col gap-1">
              {smetaRazdellar.length === 0 ? (
                 <div className="text-center p-4 text-orange-400">Smetada razdellar topilmadi</div>
              ) : smetaRazdellar.map((rz, i) => (
                <div 
                  key={i} 
                  onClick={() => tasdiqlaDop(rz)}
                  className="px-3 py-3 border-b border-border/20 cursor-pointer text-[13px] font-semibold hover:bg-emerald-500/10 transition-colors text-white"
                >
                  <span className="text-emerald-500 mr-2">➜</span>
                  {rz.nom} <span className="text-text-mute text-[10px] ml-1 font-normal">({rz.varaq})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {dropState && (
        <div className="fixed inset-0 bg-black/60 z-[10000] flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setDropState(null); }}>
          <div className="bg-[#18181b] border border-border/40 rounded-xl p-6 max-w-lg w-full shadow-2xl">
            <h3 className="font-bold text-lg text-white mb-1 text-center">Bu qator bilan nima qilamiz?</h3>
            <p className="text-text-mute text-[12px] text-center mb-5">
              Akt qatori: <span className="text-white font-medium">{aktBarchaTugun.find(x=>x.uid===dropState.aktKalit)?.nom?.slice(0,50)}</span>
            </p>
            <div className="grid grid-cols-3 gap-3">
              <button onClick={() => { bajarDropZamena(dropState.aktKalit, dropState.smetaRow, dropState.varaqNom); toast('Bog\'landi'); setDropState(null); }}
                className="flex flex-col items-center justify-center p-3 rounded-xl border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 transition-colors text-sky-400 cursor-pointer">
                <span className="text-xl mb-1.5">🔗</span>
                <span className="font-bold text-[13px]">Bog'lash</span>
                <span className="text-[10px] opacity-70 mt-1 text-center">Hajmini aynan ushbu smeta qatoriga yozadi</span>
              </button>
              <button onClick={tasdiqlaDropZamena}
                className="flex flex-col items-center justify-center p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors text-emerald-400 cursor-pointer">
                <span className="text-xl mb-1.5">🔄</span>
                <span className="font-bold text-[13px]">Zamena</span>
                <span className="text-[10px] opacity-70 mt-1 text-center">Eski qator o'rniga yangi qator qo'shadi</span>
              </button>
              <button onClick={tasdiqlaDropDop}
                className="flex flex-col items-center justify-center p-3 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 transition-colors text-blue-400 cursor-pointer">
                <span className="text-xl mb-1.5">➕</span>
                <span className="font-bold text-[13px]">Qo'shimcha</span>
                <span className="text-[10px] opacity-70 mt-1 text-center">Shu qatordan keyin yangi qator ochiladi</span>
              </button>
            </div>
            <button onClick={() => setDropState(null)} className="mt-4 w-full text-center text-text-mute text-[12px] hover:text-white transition-colors py-1 cursor-pointer">Bekor qilish</button>
          </div>
        </div>
      )}

      {/* ---------- QADAM 1 ---------- */}
      {qadam === 0 && (
        <div className="flex flex-col xl:flex-row gap-5 items-start">
          <div className="karta p-5 space-y-4 w-full max-w-2xl flex-shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Maydon nom="Obyekt">
              <Tanlov
                qiymat={obyekt}
                ozgardi={(v) => { setObyekt(v); setLokalka(''); }}
                variantlar={['', ...obNomlari]}
              />
            </Maydon>
            <Maydon nom="Oy" izoh="MM.YYYY">
              <Kiritma qiymat={oyNom} ozgardi={setOyNom} placeholder="07.2026" />
            </Maydon>
          </div>

          {loklar.data?.kop && (
            <Maydon nom="Lokalka" izoh="Bo'sh qoldirsangiz tizim o'zi aniqlaydi — tavsiya etiladi">
              <Tanlov qiymat={lokalka} ozgardi={setLokalka} variantlar={['', ...(loklar.data.lokalkalar || [])]} />
            </Maydon>
          )}

          {/* ⭐ Drive'dagi TAYYOR Ф2 fayllar — asosiy yo'l.
              Har safar kompyuterdan tashlash shart emas. */}
          {obyekt && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[11px] uppercase tracking-[0.04em] text-text-dim">
                  Drive papkasidagi Ф2 fayllar
                </h4>
                {fayllar.isFetching && <span className="text-[11px] text-text-mute">qidirilmoqda…</span>}
              </div>

              {fayllar.isLoading ? (
                <div className="karta divide-y divide-border">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="px-4 py-3"><div className="skel h-3 rounded w-2/3" /></div>
                  ))}
                </div>
              ) : (fayllar.data?.fayllar ?? []).length === 0 ? (
                <div className="karta p-4 text-sm text-text-dim">
                  Bu obyekt papkasida Ф2 fayl topilmadi.
                  {fayllar.data?.xabar && <span className="text-text-mute"> ({fayllar.data.xabar})</span>}
                  <span className="block mt-1">Pastdan kompyuterdan yuklashingiz mumkin.</span>
                </div>
              ) : (
                <div className="karta divide-y divide-border max-h-64 overflow-y-auto">
                  {(fayllar.data?.fayllar ?? []).map((f) => (
                    <button
                      key={f.id}
                      onClick={() => faylTanla(f.id, f.name)}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 text-sm
                                 transition-colors duration-[120ms] cursor-pointer
                                 ${fid === f.id ? 'bg-[var(--accent)]/10' : 'hover:bg-[var(--surface-2)]/60'}`}
                    >
                      <FileSpreadsheet size={16} className={fid === f.id ? 'text-accent' : 'text-text-dim'} />
                      <span className={`truncate flex-1 ${fid === f.id ? 'text-accent' : 'text-text'}`} title={f.name}>
                        {f.name}
                      </span>
                      <span className="text-[11px] text-text-mute">{fid === f.id ? '✓ tanlandi' : 'tanlash →'}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Muqobil yo'l — kompyuterdan */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] uppercase tracking-[0.04em] text-text-mute">yoki kompyuterdan</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div
            onClick={() => obyekt && faylRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) faylTanlandi(f); }}
            className={`rounded-[10px] border-2 border-dashed p-8 text-center transition-colors
              ${obyekt ? 'border-border hover:border-[var(--accent)]/60 cursor-pointer' : 'border-border opacity-50 cursor-not-allowed'}`}
          >
            <Upload size={28} className="mx-auto text-text-mute mb-2" strokeWidth={1.5} />
            <p className="text-text text-sm font-medium">
              {yukla.isPending ? 'Yuklanmoqda…' : 'Faylni bu yerga tashlang'}
            </p>
            <p className="text-[12px] text-text-dim mt-1">
              {obyekt ? '.xlsx, .xls, Google Sheets — Drive papkasiga ham saqlanadi' : 'Avval obyektni tanlang'}
            </p>
          </div>
          <input
            ref={faylRef} type="file" hidden
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) faylTanlandi(f); e.target.value = ''; }}
          />

          {/* ---- Varaq tanlash ---- */}
          {fid && (
            <section className="pt-2 border-t border-border">
              <h4 className="text-[11px] uppercase tracking-[0.04em] text-text-dim mb-2">
                Varaq — «{faylNomi}»
              </h4>
              {varaqlar.isLoading ? (
                <div className="skel h-9 rounded" />
              ) : !varaqlar.data?.ok ? (
                <p className="text-sm text-danger">{varaqlar.data?.xabar || "Varaqlar o'qilmadi"}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(varaqlar.data.varaqlar ?? []).map((v) => (
                    <button
                      key={v.nom}
                      onClick={() => varaqTanla(v.nom)}
                      disabled={ustun.isPending}
                      className={`h-9 px-3 rounded-[10px] border text-sm transition-colors cursor-pointer
                        ${varaq === v.nom ? 'bg-accent text-white border-transparent' : 'karta text-text hover:border-[var(--accent)]/50'}
                        disabled:opacity-50`}
                    >
                      {v.nom}
                      <span className="ml-2 text-[11px] opacity-70 tabular-nums">{v.qatorlar}</span>
                    </button>
                  ))}
                </div>
              )}
              {ustun.isPending && <p className="text-sm text-text-dim mt-2">Tuzilishi tahlil qilinmoqda…</p>}
            </section>
          )}

          {/* ---- Ustunlarni tasdiqlash ---- */}
          {cfg && (
            <section className="pt-2 border-t border-border space-y-3">
              <div>
                <h4 className="text-[11px] uppercase tracking-[0.04em] text-text-dim">Ustunlar</h4>
                <p className="text-sm text-text-dim mt-1">
                  Tizim avtomat aniqladi. Noto'g'ri bo'lsa raqamni o'zgartiring (1 = A ustun).
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {([
                  ['kod', 'Shifr'], ['nom', 'Nomi'], ['bir', 'Birlik'], ['norma', 'Norma'],
                  ['obyom', "Hajm"], ['narx', 'Narx'], ['sum', 'Summa'],
                ] as const).map(([k, nom]) => (
                  <Maydon key={k} nom={nom}>
                    <Kiritma
                      tur="number"
                      qiymat={cfg[k] ?? 0}
                      ozgardi={(v) => setCfg({ ...cfg, [k]: Number(v) || 0 })}
                    />
                  </Maydon>
                ))}
              </div>
              <Tugma tur="primary" onBos={daraxtQur} band={daraxt.isPending}>
                {daraxt.isPending ? 'Daraxt qurilmoqda…' : 'Ustunlarni tasdiqlash'}
              </Tugma>
            </section>
          )}

          {/* ---- Fayl o'qildi — aniq «Davom etish» tugmasi ----
              ⚠️ Foydalanuvchi talabi: fayl/varaq tanlangach avtomatik
              o'tmasin, alohida tasdiqlash bosqichi bo'lsin. */}
          {aktTree && (
            <section className="pt-2 border-t border-border">
              <div className="rounded-[10px] border border-ok/25 bg-ok/[.08] p-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-text font-medium">✅ Fayl o'qildi — «{faylNomi}»</p>
                  <p className="text-sm text-text-dim tabular-nums">
                    {barglar(aktTree).length} qator · <FmtN val={aktJami} /> so'm
                  </p>
                </div>
                <Tugma tur="primary" onBos={() => setQadam(1)}>
                  Davom etish →
                </Tugma>
              </div>
            </section>
          )}
        </div>

          {/* Tarix va Boshqaruv (O'ng tomon) */}
          {obyekt && (
            <div className="karta p-4 w-full xl:w-[320px] flex-shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <ShieldAlert size={16} className="text-text-dim" />
                <h3 className="font-medium text-sm">F2 Tarixi va Nazorat</h3>
              </div>

              {!lrv.isLoading && (
                <div className="mb-4 space-y-1 p-2 rounded bg-white/5 text-[12px] border border-white/10">
                  <div className="flex justify-between">
                    <span className="text-text-mute">Smeta jami:</span>
                    <span className="font-medium text-white"><FmtN val={umumiySmeta} /> so'm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-mute">O'tgan F2 lar (Jami):</span>
                    <span className="font-medium text-blue-300"><FmtN val={umumiyOldingiF2} /> so'm</span>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-1 mt-1">
                    <span className="text-text-mute">Smeta qoldiq:</span>
                    <span className="font-medium text-amber-300"><FmtN val={umumiySmeta - umumiyOldingiF2} /> so'm</span>
                  </div>
                </div>
              )}
              
              {lrv.isLoading ? (
                <div className="space-y-2">
                  <div className="skel h-8 rounded" />
                  <div className="skel h-8 rounded" />
                </div>
              ) : !lrv.data?.oylar?.length ? (
                <p className="text-sm text-text-mute text-center py-4">Bu obyekt uchun F2 kiritilmagan</p>
              ) : (
                <div className="space-y-2">
                  {lrv.data.oylar.map((oy) => {
                    let oySum = 0;
                    const barglarTugun = barglar(lrv.data?.tree as unknown as any[] || []);
                    barglarTugun.forEach(n => {
                      const v = Number((n as any).oylar?.[oy] || (n as any).stF2?.[oy] || 0);
                      const p = Number(n.narx || 0);
                      oySum += v * p;
                    });
                    
                    return (
                      <div key={oy} className="flex flex-col gap-1.5 p-2 rounded border border-border bg-[var(--surface-2)]">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm text-accent">{oy}</span>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => {
                                useF2EskiFaylOqiHook.mutate({ obyekt, oyNom: oy }, {
                                  onSuccess: (r: any) => {
                                    if(r.ok) {
                                      resetF2Store();
                                      setState({ fid: r.fileId, oyNom: oy, faylNomi: `[Arxivdan] ${oy}`, varaq: '', cfg: null, aktTree: null, qadam: 0 });
                                      toast("Fayl topildi. Iltimos varaqni tanlang.", "ok");
                                    } else {
                                      toast("Xato: " + r.xabar, "danger");
                                    }
                                  },
                                  onError: (e: any) => toast(e.message, "danger")
                                });
                              }}
                              disabled={useF2EskiFaylOqiHook.isPending && useF2EskiFaylOqiHook.variables?.oyNom === oy}
                              className="text-[11px] px-2 py-1 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 rounded transition-colors"
                            >
                              {useF2EskiFaylOqiHook.isPending && useF2EskiFaylOqiHook.variables?.oyNom === oy ? 'Ochilmoqda...' : 'Tahrirlash'}
                            </button>
                            <button 
                              onClick={() => {
                                if(window.confirm(`⚠️ "${oy}" oyi uchun yozilgan BARCHA qiymatlar (hajm/narx/summa) ushbu obyektdan BUTUNLAY o'chiriladi.\n\nDavom etamizmi?`)) {
                                  useF2OyOchirishHook.mutate({ obyekt, oyNom: oy }, {
                                    onSuccess: (r) => {
                                      if(r.ok) {
                                        toast(r.xabar || "Oy tozalandi", "ok");
                                        lrv.refetch();
                                      } else {
                                        toast("Xato: " + r.xabar, "danger");
                                      }
                                    },
                                    onError: (e: any) => toast(e.message, "danger")
                                  });
                                }
                              }}
                              disabled={useF2OyOchirishHook.isPending && useF2OyOchirishHook.variables?.oyNom === oy}
                              className="text-[11px] px-2 py-1 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded transition-colors"
                            >
                              {useF2OyOchirishHook.isPending && useF2OyOchirishHook.variables?.oyNom === oy ? 'Tozalanmoqda...' : 'Tozalash'}
                            </button>
                          </div>
                        </div>
                        <div className="text-[12px] text-text-mute flex justify-between">
                          <span>Jami summa:</span>
                          <span className="font-medium text-text"><FmtN val={oySum} /> so'm</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---------- QADAM 2: moslashtirish va qo'lda bog'lash ---------- */}
      {qadam === 1 && aktTree && (
        <div className="space-y-4">
          {/* Avto-moslashtirish — daraxtlar ustida */}
          <div className="karta p-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <Tugma tur="primary" onBos={moslashtir} band={moslash.isPending} ikonka={<Wand2 size={16} />}>
                {moslash.isPending ? 'Moslashtirilmoqda…' : natija ? 'Qayta moslashtirish' : 'Avto-moslashtirish'}
              </Tugma>
              <p className="text-[12px] text-text-dim mt-2">
                {natija
                  ? "Aniq mosliklar bog'landi. Qolganini quyida AKT'dan SMETA'ga sudrab bog'lang."
                  : `Akt: ${aktBarglar.length} qator · ${aktTree.filter((n) => n.type === 'rz').length} razdel. Moslashtirish serverda bajariladi.`}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <Tugma onBos={() => { setQadam(0); setNatija(null); }}>Orqaga</Tugma>
              {natija && (
                <Tugma tur="primary" onBos={yozish} band={yoz.isPending} ikonka={<Send size={16} />}>
                  Smetaga yozish {constOk ? '' : '(Farq mavjud!)'}
                </Tugma>
              )}
            </div>
          </div>

          {natija && <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiKarta 
              nom="Bog'landi" 
              qiymat={natija.stat.moslashti} 
              ost={`${natija.stat.scopeHit} ta razdel ichida`} 
            />
            <KpiKarta 
              nom="Qoldiq (Bog'lanmagan)" 
              qiymat={boglanmagan.length} 
              ost={<span title={blKam.slice(0, 15).map(b => b.nom).join('\n') + (blKam.length > 15 ? '\n...' : '')}>{blKam.length} ta Ish (BL) qoldi</span>} 
            />
            <KpiKarta 
              nom="Razdel mosligi" 
              qiymat={`${natija.stat.rzMos}/${natija.stat.rzJami}`} 
            />
            <KpiKarta 
              nom="Vaqt" 
              qiymat={`${(natija.stat.ms / 1000).toFixed(1)} s`} 
            />
          </div>}

          {/* Limitdan oshgan qatorlar xabarnomasi */}
          {limitOsh.length > 0 && (
            <div className="rounded-lg bg-danger/10 border border-danger/20 p-3">
              <h4 className="text-danger font-bold text-sm mb-1 flex items-center gap-2">
                <ShieldAlert size={16} /> Diqqat! {limitOsh.length} ta qatorda F2 hajmi smeta qoldig'idan oshib ketgan
              </h4>
              <ul className="text-danger/80 text-[12px] pl-6 list-disc max-h-32 overflow-auto">
                {limitOsh.map((v, i) => (
                  <li key={i}>{v.nom} (+{formatVol(v.farq)} hajm ortiqcha)</li>
                ))}
              </ul>
            </div>
          )}

          {/* CONSTANTA nazorati */}
          {natija && <div className={`karta p-5 ${constOk ? '' : 'border-danger/40'}`}>
            <h4 className="text-[11px] uppercase tracking-[0.04em] text-text-dim mb-3">Solishtiruv</h4>
            <Juft nom="Smeta jami (Barcha)" qiymat={<FmtN val={umumiySmeta} />} />
              <Juft nom="O'tgan F2 jami (Barcha)" qiymat={<span className="text-blue-300"><FmtN val={umumiyOldingiF2} /></span>} />
              <div className="w-full h-[1px] bg-border my-1" />
              <Juft nom="Hozirgi import (Yangi F2)" qiymat={<span className="text-emerald-400 font-bold"><FmtN val={aktJami} /></span>} />
            <Juft
              nom="Bog'langan"
              qiymat={
                <>
                  <FmtN val={boglanganJami} />
                  {ishMosliklari > 0 && (
                    <span className="text-text-mute text-[11px] ml-2">
                      (+{ishMosliklari} ta ish qatori — summasi bolalarida)
                    </span>
                  )}
                </>
              }
            />
            <Juft nom="Qo'shimcha ish (Dop)" qiymat={<FmtN val={dopJami} />} />
            <Juft
              nom="Farq (Qoldiq)"
              qiymat={
                <span className={constOk ? 'text-ok' : 'text-danger'}>
                  <FmtN val={farq} /> {constOk ? '✅' : '⛔'}
                </span>
              }
            />
            {!constOk && (
              <p className="text-sm text-danger mt-3">
                Farq nolga teng emas — yozish bloklandi. Akt fayli noto'g'ri o'qilgan bo'lishi mumkin.
              </p>
            )}
          </div>}

          {/* Himoyalar */}
          {natija && (natija.stat.birlikBlok > 0 || natija.stat.zamenaShubha > 0) && (
            <div className="rounded-[10px] border border-warn/25 bg-warn/[.08] p-4 space-y-2">
              <div className="flex gap-2 items-center">
                <AlertTriangle size={16} className="text-warn" />
                <span className="text-sm font-medium text-text">Qo'lda tekshirish tavsiya etiladi</span>
              </div>
              {natija.stat.birlikBlok > 0 && (
                <p className="text-sm text-text-dim">
                  <Nishon matn={`${natija.stat.birlikBlok} ta`} tur="warn" /> birlik farqli (Т↔КГ kabi) —
                  1000 barobar xato xavfi bo'lgani uchun avtomat bog'lanmadi.
                </p>
              )}
              {natija.stat.zamenaShubha > 0 && (
                <p className="text-sm text-text-dim">
                  <Nishon matn={`${natija.stat.zamenaShubha} ta`} tur="warn" /> marka farqli (ПК↔ПБ kabi) —
                  ehtimoliy zamena, qo'lda hal qiling.
                </p>
              )}
            </div>
          )}

          {/* ⭐ IKKI PANEL — panel'dagi kabi: chapda AKT, o'ngda SMETA */}
          <IkkiPanel
            chapSarlavha={`AKT (fayldan) — ${aktBarglar.length} qator`}
            ongSarlavha={`SMETA (LRV) — ${boglanganJoylar.size} qator band`}
            chapOng={
                <div className="flex flex-col gap-2 w-full">
                  <div className="flex gap-1 flex-shrink-0 bg-black/20 p-1 rounded-lg flex-wrap">
                    {(['hammasi', 'boglanmagan', 'boglangan', 'qolDop'] as const).map((f) => (
                      <button key={f} onClick={() => setFiltr(f as any)}
                        className={`flex-1 h-7 px-2 rounded-md text-[11px] font-bold transition-all cursor-pointer shadow-sm whitespace-nowrap
                          ${filtr === f ? 'bg-accent text-white scale-100' : 'text-slate-400 hover:text-white hover:bg-white/10 scale-95'}`}>
                        {f === 'hammasi' ? 'Barchasi' : f === 'boglangan' ? '✓ Bog‘langan' : f === 'qolDop' ? '➕ Doplar' : '○ Bog‘lanmagan'}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setOchiqSignal(s => s > 0 ? s + 1 : 1)} className="flex-1 flex items-center justify-center gap-1.5 h-6 bg-white/5 hover:bg-white/10 text-slate-300 rounded text-[11px] transition-colors">
                      <FolderOpen size={13} /> Barchasini ochish
                    </button>
                    <button onClick={() => setOchiqSignal(s => s < 0 ? s - 1 : -1)} className="flex-1 flex items-center justify-center gap-1.5 h-6 bg-white/5 hover:bg-white/10 text-slate-300 rounded text-[11px] transition-colors">
                      <FolderClosed size={13} /> Barchasini yig'ish
                    </button>
                  </div>
                </div>
              }
            chap={
              <F2Daraxt
                tugunlar={aktDaraxt}
                bogMi={aktBogMi}
                dopMi={(k) => !!qolDop[k]}
                hover={hover}
                setHover={setHover}
                onBogBekor={bogBekor}
                sudraladi
                onDopClick={handleDopClick}
                onOtishClick={aktOtishClick}
                bosh="Akt daraxti bo‘sh"
                filtr={filtr}
                ochiqYopiqSignal={ochiqSignal}
              />
            }
            ong={
              <F2Daraxt
                tugunlar={smetaDaraxt}
                bogMi={(k) => boglanganJoylar.has(k)}
                hover={hover}
                setHover={setHover}
                tashlanadi
                onTashla={qolBogla}
                onGapDrop={qolGapDop}
                onBogBekor={smetaBogBekor}
                scrollToKey={smetaScrollTo}
                bosh={lrv.isLoading ? "Smeta o‘qilmoqda…" : "Smeta daraxti bo‘sh"}
                filtr={filtr}
                ochiqYopiqSignal={ochiqSignal}
              />
            }
          />

          <p className="text-[11px] text-text-mute">
            ● bog'langan · ○ bog'lanmagan · bir tomonga kursor kelsa ikkinchisi ham yoritiladi ·
            ● ni bosish bog'lanishni bekor qiladi
          </p>

          {/* Yozish tugmasi yuqorida — daraxtlar uzun bo'lgani uchun pastda ko'rinmaydi */}
        </div>
      )}

      {/* ---------- QADAM 4 ---------- */}
      {qadam === 2 && (
        <div className="karta p-6 max-w-2xl space-y-4">
          <div className="flex items-center gap-3">
            <FileSpreadsheet size={20} className="text-accent" />
            <h3 className="text-[17px] font-semibold text-text">
              {j?.status === 'tugadi' ? 'Yozildi' : j?.status === 'xato' ? 'Xato' : 'Yozilmoqda'}
            </h3>
          </div>

          <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${j?.status === 'tugadi' ? 100 : foiz}%` }}
            />
          </div>

          <p className="text-sm text-text-dim tabular-nums">
            {j?.done ?? 0} / {j?.total ?? 0} qator{j?.xabar ? ` · ${j.xabar}` : ''}
          </p>

          <div className="rounded-[10px] bg-ok/[.08] border border-ok/25 p-3 text-sm text-text-dim">
            ✅ Kompyuterni o'chirsangiz ham yozuv davom etadi. Keyin qaytib kelib shu sahifadan kuzatasiz.
          </div>

          {job.error && <XatoHolat xato={job.error} qayta={() => job.refetch()} />}

          {(j?.status === 'tugadi' || j?.status === 'xato') && (
            <Tugma
              tur="primary"
              onBos={() => {
                resetF2Store();
              }}
            >
              Yangi Ф2 import
            </Tugma>
          )}
        </div>
      )}
    </Sahifa>
  );
}

export default F2Import;
