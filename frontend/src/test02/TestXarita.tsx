import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Building2, Warehouse, FileText, Truck, HardHat, FolderKanban,
  Users, Plus, X, ZoomIn, ZoomOut, RefreshCcw, Unlink, Move,
  LayoutGrid, Maximize2, Save, Trash2, ExternalLink, AlertTriangle, Clock, CheckCircle2, Activity,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useKompaniya } from './KompaniyaTanlov';
import { toast } from '../umumiy/ui/Toast';
import { pulQisqa } from '../lib/format';
import { sbObyektHodisalariOl, qachon, MODUL_RANG, type Hodisa } from '../api/t2-hodisa';
import {
  sbMindmapGrafOl, sbMindmapBog, sbMindmapBogOchir, sbMindmapTugunYarat,
  sbMindmapJoylashuvSaqla, sbMindmapTugunOchir, bogTuriniTop, RUXSAT_BOGLANISH, OCHIRSA_BOLADI,
  type MindmapGraf, type MindmapTugun, type TugunTur, type MindmapBelgi,
} from '../api/t2-mindmap';

/* Belgi turi → tugundagi qisqa yozuv. To'liq matn `title` da ko'rinadi. */
const BELGI_QISQA: Record<MindmapBelgi['tur'], string> = {
  zayavka:   'zayavka',
  narx_yoq:  'narxsiz',
  kozgu:     'ko\'zgu eski',
  smeta_yoq: 'smeta yo\'q',
};

/* ⚡ 2026-08-28 (2-bosqich) — foydalanuvchi shikoyatlari bo'yicha:
 *
 *   «yana yangidan qurayapdi, tayyor yaratilgan datalarni ko'rmayapdi»
 *      → JOYLASHUV SAQLANMASDI. Har ochilganda tugunlar avtomatik
 *        ustunlarga qayta terilardi — odam terib qo'ygan tartib
 *        yo'qolardi va "yangidan qurayotgandek" ko'rinardi. Endi har
 *        tugun joyi `t2_mindmap_joylashuv` da saqlanadi.
 *
 *   «bitta joyda qotib turadi hammasi... surib tartiblab taxlash kerak»
 *      → Tugunlar QAT'IY ustunlarga mixlangan edi, sudrab bo'lmasdi.
 *        Endi har tugunni sudrab istalgan joyga qo'yish mumkin.
 *
 *   «maydon ham qimirlamay qolgan, hamma joyga sayr qilish kerak»
 *      → Pan buzuq edi: tugun ustida bosilganda ham pan boshlanardi,
 *        hodisalar aralashib ketardi. Endi bitta ANIQ rejim mexanizmi
 *        (`rejim.current`): bo'sh joy=pan, tugun=sudrash, nuqta=chiziq.
 *        `setPointerCapture` bilan kursor maydondan chiqsa ham ishlaydi.
 *        G'ildirak kursor ostidagi nuqtani joyida saqlab zumlaydi.
 */

const NODE_W = 200;
const NODE_H = 54;
const KANVAS_W = 6000;
const KANVAS_H = 4000;

const TUR_RANG: Record<TugunTur, string> = {
  kompaniya: '#8b5cf6', loyiha: '#0ea5e9', obyekt: '#10b981', shartnoma: '#d946ef',
  sklad: '#f59e0b', texnika: '#fb923c', kadr: '#3b82f6', kontragent: '#f472b6',
};
const TUR_IKONKA: Record<TugunTur, any> = {
  kompaniya: Building2, loyiha: FolderKanban, obyekt: Building2, shartnoma: FileText,
  sklad: Warehouse, texnika: Truck, kadr: HardHat, kontragent: Users,
};
const TUR_NOM: Record<TugunTur, string> = {
  kompaniya: 'Kompaniya', loyiha: 'Loyiha', obyekt: 'Obyekt', shartnoma: 'Shartnoma',
  sklad: 'Sklad', texnika: 'Texnika', kadr: 'Xodim', kontragent: 'Kontragent',
};

const BOG_TUR_NOM: Record<string, string> = {
  loyiha_kompaniya: 'Kompaniya ↔ loyiha',
  obyekt_loyiha: 'Loyiha → obyekt',
  shartnoma_loyiha: 'Loyiha → shartnoma',
  shartnoma_obyekt: 'Shartnoma → obyekt',
  sklad_obyekt: 'Sklad → obyekt',
  texnika_obyekt: 'Texnika → obyekt',
  kadr_obyekt: 'Xodim → obyekt',
  qatnashchi: 'Kontragent → loyiha',
};

/** Avtomatik joylash ustunlari — FAQAT saqlangan joyi yo'q tugunlar uchun */
const USTUN_TARTIB: TugunTur[][] = [
  ['kontragent'], ['kompaniya', 'loyiha'], ['shartnoma'], ['obyekt'], ['sklad', 'texnika', 'kadr'],
];

const YARATSA_BOLADI: { tur: TugunTur; maydonlar: { kalit: string; nom: string; majburiy?: boolean }[] }[] = [
  { tur: 'loyiha',     maydonlar: [{ kalit: 'nom', nom: 'Loyiha nomi', majburiy: true }, { kalit: 'hudud', nom: 'Hudud' }] },
  { tur: 'shartnoma',  maydonlar: [{ kalit: 'nom', nom: 'Shartnoma raqami', majburiy: true }, { kalit: 'taraf', nom: 'Taraf (kim bilan)' }] },
  { tur: 'sklad',      maydonlar: [{ kalit: 'nom', nom: 'Sklad nomi', majburiy: true }, { kalit: 'manzil', nom: 'Manzil' }, { kalit: 'masul', nom: "Mas'ul shaxs" }] },
  { tur: 'texnika',    maydonlar: [{ kalit: 'nom', nom: 'Texnika nomi', majburiy: true }, { kalit: 'davlat_raqami', nom: 'Davlat raqami' }] },
  { tur: 'kadr',       maydonlar: [{ kalit: 'nom', nom: 'Ism sharif', majburiy: true }, { kalit: 'lavozim', nom: 'Lavozim', majburiy: true }] },
  { tur: 'kontragent', maydonlar: [{ kalit: 'nom', nom: 'Kompaniya nomi', majburiy: true }, { kalit: 'inn', nom: 'STIR (9 raqam)' }] },
];

const ROLLAR = [
  { kalit: 'zakazchik', nom: 'Zakazchik (buyurtmachi)' },
  { kalit: 'bosh_pudratchi', nom: 'Bosh pudratchi' },
  { kalit: 'subpudratchi', nom: 'Subpudratchi' },
  { kalit: 'loyihachi', nom: 'Loyihachi' },
  { kalit: 'taminotchi', nom: "Ta'minotchi" },
];

/** Tugun turidan to'liq sahifaga o'tish yo'li (bo'lmasa — tugma ko'rsatilmaydi) */
const SAHIFA_YOLI: Partial<Record<TugunTur, (id: number, nom: string) => string>> = {
  obyekt:     (_id, nom) => '/admin/test/smeta?obyekt=' + encodeURIComponent(nom),
  loyiha:     () => '/admin/test/portfel',
  shartnoma:  () => '/admin/test/moliya',
  sklad:      () => '/admin/test/logistika',
  texnika:    () => '/admin/test/erp?modul=texnika',
  kadr:       () => '/admin/test/erp?modul=kadrlar',
  kontragent: () => '/admin/test/kontragent',
};

type XY = { x: number; y: number };
type Rejim =
  | { tur: 'pan'; boshPan: XY; boshKursor: XY }
  | { tur: 'tugun'; id: string; siljish: XY; kochdi: boolean }
  | { tur: 'chiziq'; manba: string }
  | null;

export default function TestXarita() {
  const [params] = useSearchParams();
  const [korinish, setKorinish] = useState<'bosh' | 'qurilish' | 'taminot' | 'moliya' | 'resurs' | 'risk'>('bosh');
  const initialObyekt = params.get('obyekt');

  const { joriy } = useKompaniya();
  const aktKomp = joriy?.id ?? 0;

  const [graf, setGraf] = useState<MindmapGraf>({ tugunlar: [], bogichlar: [] });
  const [joylar, setJoylar] = useState<Record<string, XY>>({});
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [xato, setXato] = useState('');
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);
  const [oxirgiYangilanish, setOxirgiYangilanish] = useState<Date | null>(null);
  const [qidiruv, setQidiruv] = useState('');
  const [holatFiltri, setHolatFiltri] = useState<'barchasi' | 'etibor' | 'zayavka'>('barchasi');

  const [pan, setPan] = useState<XY>({ x: 60, y: 40 });
  const [zoom, setZoom] = useState(0.85);
  const [kursor, setKursor] = useState<XY>({ x: 0, y: 0 });
  /* Rejim ref'da — har piksel siljishda qayta render qilmasin.
     `rejimNishon` faqat KO'RINISH uchun (chiziq rejimida nishonlash). */
  const rejim = useRef<Rejim>(null);
  const [chiziqManbaId, setChiziqManbaId] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);

  const [yaratModal, setYaratModal] = useState<TugunTur | null>(null);
  const [maydonlar, setMaydonlar] = useState<Record<string, string>>({});
  const [rolModal, setRolModal] = useState<{ manbaId: number; maqsadId: number; expectedVersion: number } | null>(null);
  const [tanlangan, setTanlangan] = useState<string | null>(null);
  const [tanlanganBog, setTanlanganBog] = useState<MindmapGraf['bogichlar'][number] | null>(null);
  const [obyektHodisalari, setObyektHodisalari] = useState<Hodisa[]>([]);
  const [hodisaYuklanmoqda, setHodisaYuklanmoqda] = useState(false);
  const [hodisaXato, setHodisaXato] = useState('');
  const navigate = useNavigate();

  /** Saqlangan joyi yo'q tugunlarni ustunlarga teradi (mavjudlarga TEGMAYDI) */
  const avtoJoylash = useCallback((tugunlar: MindmapTugun[], mavjud: Record<string, XY>) => {
    const natija: Record<string, XY> = { ...mavjud };
    USTUN_TARTIB.forEach((turlar, ui) => {
      let qator = 0;
      tugunlar.filter((t) => turlar.includes(t.tur)).forEach((t) => {
        if (natija[t.id]) return;
        natija[t.id] = { x: 60 + ui * 300, y: 80 + qator * 78 };
        qator++;
      });
    });
    return natija;
  }, []);

  const yukla = useCallback(async () => {
    if (!aktKomp) return;
    setYuklanmoqda(true);
    setXato('');
    const r = await sbMindmapGrafOl(aktKomp);
    setYuklanmoqda(false);
    if (!r.ok) { setXato(r.error); return; }
    setGraf(r.graf);
    setOxirgiYangilanish(new Date());
    const saqlangan: Record<string, XY> = {};
    r.graf.tugunlar.forEach((t) => {
      if (t.x != null && t.y != null) saqlangan[t.id] = { x: Number(t.x), y: Number(t.y) };
    });
    setJoylar(avtoJoylash(r.graf.tugunlar, saqlangan));
  }, [aktKomp, avtoJoylash]);

  useEffect(() => { yukla(); }, [yukla]);

  /* Faqat frontend polling: rahbar oynasi yangi zayavka/belgilarni
     qo'lda Yangilash tugmasisiz ham ko'rsatsin. */
  useEffect(() => {
    if (!aktKomp) return;
    const timer = window.setInterval(yukla, 30_000);
    return () => window.clearInterval(timer);
  }, [aktKomp, yukla]);

  const kanvasKoord = useCallback((cx: number, cy: number): XY => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: (cx - r.left - pan.x) / zoom, y: (cy - r.top - pan.y) / zoom };
  }, [pan, zoom]);

  /* ── ZUM: kursor ostidagi nuqta JOYIDA qoladi ── */
  const gildirak = (e: React.WheelEvent) => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    const yangi = Math.min(2.5, Math.max(0.2, zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    setPan({ x: mx - ((mx - pan.x) / zoom) * yangi, y: my - ((my - pan.y) / zoom) * yangi });
    setZoom(yangi);
  };

  /* ── HODISALAR ── */
  const bosildiBoshJoy = (e: React.PointerEvent) => {
    if (rejim.current) return;                       // tugun/chiziq allaqachon boshlangan
    wrapRef.current?.setPointerCapture(e.pointerId);
    rejim.current = { tur: 'pan', boshPan: pan, boshKursor: { x: e.clientX, y: e.clientY } };
  };

  const bosildiTugun = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();                             // pan boshlanmasin
    const joy = joylar[id];
    if (!joy) return;
    wrapRef.current?.setPointerCapture(e.pointerId);
    const k = kanvasKoord(e.clientX, e.clientY);
    rejim.current = { tur: 'tugun', id, siljish: { x: k.x - joy.x, y: k.y - joy.y }, kochdi: false };
  };

  const bosildiNuqta = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();                             // tugun sudrash boshlanmasin
    wrapRef.current?.setPointerCapture(e.pointerId);
    rejim.current = { tur: 'chiziq', manba: id };
    setChiziqManbaId(id);
    setKursor(kanvasKoord(e.clientX, e.clientY));
  };

  const harakat = (e: React.PointerEvent) => {
    const r = rejim.current;
    if (!r) return;
    if (r.tur === 'pan') {
      setPan({ x: r.boshPan.x + (e.clientX - r.boshKursor.x), y: r.boshPan.y + (e.clientY - r.boshKursor.y) });
    } else if (r.tur === 'tugun') {
      const k = kanvasKoord(e.clientX, e.clientY);
      r.kochdi = true;
      setJoylar((j) => ({ ...j, [r.id]: { x: Math.round(k.x - r.siljish.x), y: Math.round(k.y - r.siljish.y) } }));
    } else if (r.tur === 'chiziq') {
      setKursor(kanvasKoord(e.clientX, e.clientY));
    }
  };

  /* ⚠️ 2026-08-28 KRITIK TUZATISH — «bog'lab bo'lmaydi» shikoyatining ildizi.
   * Chiziq tortilganda `setPointerCapture` wrapper'ga qo'yilgan edi, ya'ni
   * BARCHA keyingi pointer hodisalari (shu jumladan `pointerup`) wrapper'ga
   * YO'NALTIRILADI — nishon tugundagi `onPointerUp` HECH QACHON ishlamasdi.
   * Natijada chiziq tortilardi, lekin hech qachon TUGALLANMASDI: sklad,
   * texnika, xodim tugunlari osilib qolardi.
   * Yechim: nishonni kursor koordinatasidan `elementFromPoint` bilan
   * topamiz — capture bilan ham ishlaydi. */
  const nishonTugunniTop = (cx: number, cy: number): string | null => {
    const el = document.elementFromPoint(cx, cy);
    const tugun = (el as HTMLElement | null)?.closest('[data-tugun]');
    return tugun?.getAttribute('data-tugun') || null;
  };

  const qoyibYuborildi = async (e: React.PointerEvent) => {
    const r = rejim.current;
    rejim.current = null;
    setChiziqManbaId(null);

    if (r?.tur === 'chiziq') {
      const maqsadId = nishonTugunniTop(e.clientX, e.clientY);
      if (maqsadId && maqsadId !== r.manba) await chiziqniBogla(r.manba, maqsadId);
      return;
    }
    if (r?.tur !== 'tugun' || !r.kochdi || !aktKomp) return;
    const joy = joylar[r.id];
    if (!joy) return;
    setSaqlanmoqda(true);
    const nat = await sbMindmapJoylashuvSaqla(aktKomp, [{ tugun_id: r.id, x: joy.x, y: joy.y }]);
    setSaqlanmoqda(false);
    if (!nat.ok) toast('Joylashuv saqlanmadi: ' + (nat.error || ''), 'danger');
  };

  /** Ikki tugunni bog'laydi. Odam teskari tortsa ham to'g'ri tushunadi. */
  const chiziqniBogla = async (manbaId: string, maqsadId: string) => {
    const manba = graf.tugunlar.find((t) => t.id === manbaId);
    const maqsad = graf.tugunlar.find((t) => t.id === maqsadId);
    if (!manba || !maqsad) return;

    let qoida = bogTuriniTop(manba.tur, maqsad.tur);
    let mId = Number(manba.id.split(':')[1]);
    let qId = Number(maqsad.id.split(':')[1]);

    if (!qoida) {
      /* TESKARI yo'nalish — odam ko'pincha obyektdan skladga tortadi */
      const teskari = bogTuriniTop(maqsad.tur, manba.tur);
      if (!teskari) {
        toast(TUR_NOM[manba.tur] + ' → ' + TUR_NOM[maqsad.tur] + ' bog\'lanishi mavjud emas', 'danger');
        return;
      }
      qoida = teskari;
      const v = mId; mId = qId; qId = v;
    }
    const target = qoida.manba === manba.tur ? manba : maqsad;
    const expectedVersion = Number(target.meta?.versiya);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 0) { toast('Tugun versiyasi mavjud emas, qayta yuklang', 'danger'); return; }
    if (qoida.tur === 'qatnashchi') { setRolModal({ manbaId: mId, maqsadId: qId, expectedVersion }); return; }

    const nat = await sbMindmapBog(aktKomp, qoida.tur, mId, qId, expectedVersion);
    if (nat.ok) { toast(qoida.nom + ' — bajarildi', 'ok'); yukla(); }
    else toast(nat.error || 'Bog\'lanmadi', 'danger');
  };

  const rolniTasdiqla = async (rol: string) => {
    if (!rolModal) return;
    const r = await sbMindmapBog(aktKomp, 'qatnashchi', rolModal.manbaId, rolModal.maqsadId, rolModal.expectedVersion, rol);
    setRolModal(null);
    if (r.ok) { toast('Qatnashchi biriktirildi', 'ok'); yukla(); }
    else toast(r.error || 'Bog\'lanmadi', 'danger');
  };

  const chiziqUz = async (b: MindmapGraf['bogichlar'][number]) => {
    if (!b.uzsa_boladi) { toast('Bu tuzilmaviy bog\'lanish — uzib bo\'lmaydi', 'danger'); return; }
    if (!confirm('Bog\'lanishni uzasizmi? (Yozuvlarning o\'zi O\'CHMAYDI)')) return;
    const target = graf.tugunlar.find((t) => t.id === b.maqsad);
    const expectedVersion = Number(target?.meta?.versiya);
    if (!target || !Number.isInteger(expectedVersion) || expectedVersion < 0) { toast('Tugun versiyasi mavjud emas, qayta yuklang', 'danger'); return; }
    const r = await sbMindmapBogOchir(aktKomp, b.tur, Number(b.manba.split(':')[1]), Number(b.maqsad.split(':')[1]), expectedVersion, b.rol);
    if (r.ok) { setTanlanganBog(null); toast('Bog\'lanish uzildi', 'ok'); yukla(); }
    else toast(r.error || 'Uzilmadi', 'danger');
  };

  const tugunYarat = async () => {
    if (!yaratModal || !aktKomp) return;
    const r = await sbMindmapTugunYarat(yaratModal, aktKomp, maydonlar);
    if (r.ok) { toast('Yaratildi', 'ok'); setYaratModal(null); setMaydonlar({}); yukla(); }
    else toast(r.error || 'Yaratilmadi', 'danger');
  };

  /** Hammasini ustunlarga qayta terib SAQLAYDI */
  const hammasiniQaytaTer = async () => {
    if (!aktKomp) return;
    const yangi = avtoJoylash(graf.tugunlar, {});
    setJoylar(yangi);
    setSaqlanmoqda(true);
    const r = await sbMindmapJoylashuvSaqla(aktKomp,
      Object.entries(yangi).map(([tugun_id, p]) => ({ tugun_id, x: p.x, y: p.y })));
    setSaqlanmoqda(false);
    if (r.ok) toast('Qayta terildi va saqlandi', 'ok');
    else toast(r.error || 'Saqlanmadi', 'danger');
  };

  /** Barcha tugun ko'rinadigan qilib zum/pan tanlaydi */
  const ekrangaSigdir = () => {
    const p = Object.values(joylar);
    if (!p.length || !wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    const minX = Math.min(...p.map((a) => a.x)), maxX = Math.max(...p.map((a) => a.x)) + NODE_W;
    const minY = Math.min(...p.map((a) => a.y)), maxY = Math.max(...p.map((a) => a.y)) + NODE_H;
    const z = Math.min(2, Math.max(0.2,
      Math.min((r.width - 80) / Math.max(1, maxX - minX), (r.height - 80) / Math.max(1, maxY - minY))));
    setZoom(z);
    setPan({ x: 40 - minX * z, y: 40 - minY * z });
  };

  const tanlanganTugun = tanlangan ? graf.tugunlar.find((t) => t.id === tanlangan) || null : null;
  const tanlanganBoglar = tanlangan
    ? graf.bogichlar.filter((b) => b.manba === tanlangan || b.maqsad === tanlangan) : [];
  const tanlanganObyektHolati = tanlanganTugun?.tur === 'obyekt' ? tanlanganTugun.meta : null;

  useEffect(() => {
    if (!tanlanganTugun || tanlanganTugun.tur !== 'obyekt') {
      setObyektHodisalari([]);
      setHodisaXato('');
      return;
    }
    const obyektId = Number(tanlanganTugun.id.split(':')[1]);
    if (!Number.isFinite(obyektId)) return;
    let bekor = false;
    setHodisaYuklanmoqda(true);
    setHodisaXato('');
    sbObyektHodisalariOl(aktKomp, obyektId, 8).then((r) => {
      if (bekor) return;
      if (r.error) { setHodisaXato(r.error); setObyektHodisalari([]); }
      else setObyektHodisalari(r.qatorlar || []);
      setHodisaYuklanmoqda(false);
    }).catch((e: any) => {
      if (bekor) return;
      setHodisaXato(e?.message || 'Hodisa tarixi o\'qilmadi');
      setHodisaYuklanmoqda(false);
    });
    return () => { bekor = true; };
  }, [aktKomp, tanlanganTugun?.id, tanlanganTugun?.tur]);

  const tugunOchir = async (t: MindmapTugun) => {
    if (!confirm('«' + t.nom + '» o\'chirilsinmi? (Bekor qilinadi, butunlay yo\'qolmaydi)')) return;
    const expectedVersion = Number(t.meta?.versiya);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 0) { toast('Tugun versiyasi mavjud emas, qayta yuklang', 'danger'); return; }
    const r = await sbMindmapTugunOchir(aktKomp, t.tur, Number(t.id.split(':')[1]), expectedVersion);
    if (r.ok) { toast('O\'chirildi', 'ok'); setTanlangan(null); yukla(); }
    else toast(r.error || 'O\'chirilmadi', 'danger');
  };

  const bezier = (x1: number, y1: number, x2: number, y2: number) => {
    const cx = (x1 + x2) / 2;
    return 'M ' + x1 + ' ' + y1 + ' C ' + cx + ' ' + y1 + ', ' + cx + ' ' + y2 + ', ' + x2 + ' ' + y2;
  };

  const chiziqManba = chiziqManbaId ? joylar[chiziqManbaId] : null;

  const tafsilot = (t: MindmapTugun) => {
    const m = t.meta || {};
    if (t.tur === 'obyekt') return m.lat != null ? '📍 ' + m.lat + ', ' + m.lng : 'lokatsiya belgilanmagan';
    if (t.tur === 'loyiha') return m.byudjet != null ? 'Byudjet: ' + Number(m.byudjet).toLocaleString() : 'byudjet belgilanmagan';
    if (t.tur === 'shartnoma') return m.taraf || 'taraf ko\'rsatilmagan';
    if (t.tur === 'sklad') return m.manzil || 'manzil yo\'q';
    if (t.tur === 'texnika') return m.davlat_raqami || 'davlat raqami yo\'q';
    if (t.tur === 'kadr') return m.lavozim || '';
    if (t.tur === 'kontragent') return m.inn ? 'STIR ' + m.inn : 'STIR kiritilmagan';
    return 'Bosh tashkilot';
  };

  /* Rahbar muammo chiqqan joyni tez ajratib olishi uchun canvas filtrlari.
     Filtr faqat ko'rinishni o'zgartiradi — grafdagi hech qanday yozuvni
     o'chirmaydi yoki yashirincha qayta bog'lamaydi. */
  const tugunMuammolari = (t: MindmapTugun) => (Array.isArray(t.meta?.belgi) ? t.meta.belgi : []) as MindmapBelgi[];
  const qidiruvKalit = qidiruv.trim().toLocaleLowerCase('uz-UZ');
  const korsatilganTugunlar = graf.tugunlar.filter((t) => {
    const belgilar = tugunMuammolari(t);
    const nomMos = !qidiruvKalit || t.nom.toLocaleLowerCase('uz-UZ').includes(qidiruvKalit);
    const holatMos = holatFiltri === 'barchasi'
      || (holatFiltri === 'etibor' && belgilar.length > 0)
      || (holatFiltri === 'zayavka' && belgilar.some((b) => b.tur === 'zayavka'));
    return nomMos && holatMos;
  });
  const korsatilganIdlar = new Set(korsatilganTugunlar.map((t) => t.id));
  const korsatilganBoglar = graf.bogichlar.filter((b) => korsatilganIdlar.has(b.manba) && korsatilganIdlar.has(b.maqsad));
  const tanlanganBogManba = tanlanganBog ? graf.tugunlar.find((t) => t.id === tanlanganBog.manba) : null;
  const tanlanganBogMaqsad = tanlanganBog ? graf.tugunlar.find((t) => t.id === tanlanganBog.maqsad) : null;

  return (
    <div className="h-full flex flex-col bg-[#0a0f1d] text-white overflow-hidden">
      {/* BOSHQARUV */}
      <div className="flex-shrink-0 border-b border-white/10 bg-black/40 px-5 py-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Move size={18} className="text-sky-400" /> Rahbarning tirik holat xaritasi
              {saqlanmoqda && <span className="text-[10px] text-amber-400 inline-flex items-center gap-1"><Save size={11} /> saqlanmoqda…</span>}
            </h1>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Obyekt ustidagi belgi — shu obyekt bo'yicha real e'tibor talab qiladigan holat.
              Xarita har 30 soniyada yangilanadi · tugunni sudrang, nuqtadan chiziq torting
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {oxirgiYangilanish && <span className="text-[10px] text-zinc-500 inline-flex items-center gap-1 mr-1"><Clock size={11} /> {oxirgiYangilanish.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</span>}
            <button onClick={hammasiniQaytaTer} title="Hammasini ustunlarga qayta terish"
              className="px-2.5 py-2 bg-white/5 hover:bg-white/10 rounded-lg inline-flex items-center gap-1.5 text-[11px]">
              <LayoutGrid size={14} /> Qayta terish
            </button>
            <button onClick={ekrangaSigdir} title="Ekranga sig'dirish"
              className="p-2 bg-white/5 hover:bg-white/10 rounded-lg"><Maximize2 size={15} /></button>
            <button onClick={() => setZoom((z) => Math.max(0.2, z - 0.15))} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg"><ZoomOut size={15} /></button>
            <span className="text-[11px] text-zinc-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg"><ZoomIn size={15} /></button>
            <button onClick={yukla} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg"><RefreshCcw size={15} className={yuklanmoqda ? 'animate-spin' : ''} /></button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 flex-wrap border-t border-white/5 pt-3">
          <span className="text-[11px] text-zinc-500 mr-1">Rejim:</span>
          {['bosh', 'qurilish', 'taminot', 'moliya', 'resurs', 'risk'].map((m) => (
            <button key={m} onClick={() => setKorinish(m as any)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                korinish === m ? 'bg-sky-500/20 border-sky-500/50 text-sky-300' : 'border-transparent text-zinc-400 hover:bg-white/10'
              }`}>
              {m === 'bosh' ? 'Bosh panel' : m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="text-[11px] text-zinc-500 mr-1">Yangi qo'shish:</span>
          {YARATSA_BOLADI.map((y) => {
            const Ik = TUR_IKONKA[y.tur];
            return (
              <button key={y.tur} onClick={() => { setYaratModal(y.tur); setMaydonlar({}); }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border hover:bg-white/10 transition-colors"
                style={{ borderColor: TUR_RANG[y.tur] + '55', color: TUR_RANG[y.tur] }}>
                <Plus size={12} /> <Ik size={12} /> {TUR_NOM[y.tur]}
              </button>
            );
          })}
          <span className="text-[10px] text-zinc-600 ml-2">
            (Obyekt — «Obyektlar» sahifasidan, unga Drive papkasi ham kerak)
          </span>
        </div>

        {graf.jamlanma && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-sky-500/15 bg-sky-500/5 px-3 py-2 text-[11px]">
            <span className="font-semibold text-sky-300 inline-flex items-center gap-1.5"><CheckCircle2 size={13} /> Tashkilot holati</span>
            <span className="text-zinc-300">{graf.jamlanma.obyekt_soni} ta obyekt</span>
            <span className="text-zinc-400">Smeta: <b className="text-white">{pulQisqa(graf.jamlanma.smeta_jami)}</b></span>
            <span className="text-zinc-400">Fakt: <b className="text-white">{pulQisqa(graf.jamlanma.fakt_jami)}</b></span>
            <span className="text-zinc-400">F2: <b className="text-white">{pulQisqa(graf.jamlanma.f2_jami)}</b></span>
            {graf.jamlanma.zayavka_kutilmoqda > 0 && <span className="text-amber-300">{graf.jamlanma.zayavka_kutilmoqda} ta ochiq zayavka</span>}
            {graf.jamlanma.narxsiz_obyekt > 0 && <span className="text-amber-300">{graf.jamlanma.narxsiz_obyekt} ta obyektda narx yo'q</span>}
            {graf.jamlanma.smetasiz_obyekt > 0 && <span className="text-rose-300">{graf.jamlanma.smetasiz_obyekt} ta obyektda smeta yo'q</span>}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <input
              value={qidiruv}
              onChange={(e) => { setQidiruv(e.target.value); setTanlangan(null); setTanlanganBog(null); }}
              placeholder="Obyekt, loyiha yoki resursni qidiring…"
              aria-label="Mindmap tugunlarini qidirish"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white outline-none placeholder:text-zinc-600 focus:border-sky-400/60"
            />
          </div>
          <span className="text-[10px] text-zinc-600">Ko'rinish:</span>
          {([
            ['barchasi', 'Barchasi'],
            ['etibor', "E'tibor kerak"],
            ['zayavka', 'Ochiq zayavka'],
          ] as const).map(([kalit, nom]) => (
            <button
              key={kalit}
              type="button"
              onClick={() => { setHolatFiltri(kalit); setTanlangan(null); setTanlanganBog(null); }}
              className={'rounded-lg border px-2.5 py-1.5 text-[10px] transition-colors ' +
                (holatFiltri === kalit ? 'border-sky-400/60 bg-sky-400/15 text-sky-200' : 'border-white/10 bg-white/5 text-zinc-400 hover:text-white')}
            >{nom}</button>
          ))}
          <span className="text-[10px] text-zinc-600 ml-auto">{korsatilganTugunlar.length}/{graf.tugunlar.length} tugun</span>
        </div>
      </div>

      {xato && <div className="m-3 p-3 bg-red-900/20 border border-red-500/30 text-red-400 rounded-lg text-sm">{xato}</div>}

      {/* KANVAS */}
      <div
        ref={wrapRef}
        className="flex-1 relative overflow-hidden touch-none"
        style={{
          cursor: chiziqManbaId ? 'crosshair' : 'grab',
          backgroundImage: 'radial-gradient(circle, #1e293b 1px, transparent 1px)',
          backgroundSize: (24 * zoom) + 'px ' + (24 * zoom) + 'px',
          backgroundPosition: pan.x + 'px ' + pan.y + 'px',
        }}
        onPointerDown={bosildiBoshJoy}
        onPointerMove={harakat}
        onPointerUp={qoyibYuborildi}
        onPointerCancel={qoyibYuborildi}
        onWheel={gildirak}
      >
        <div className="absolute top-0 left-0 origin-top-left"
          style={{ transform: 'translate(' + pan.x + 'px,' + pan.y + 'px) scale(' + zoom + ')', width: KANVAS_W, height: KANVAS_H }}>

          <svg className="absolute inset-0 pointer-events-none" width={KANVAS_W} height={KANVAS_H}>
            {korsatilganBoglar.map((b, i) => {
              const m = joylar[b.manba], q = joylar[b.maqsad];
              if (!m || !q) return null;
              const manbaTur = graf.tugunlar.find((t) => t.id === b.manba)?.tur || 'obyekt';
              const maqsadTur = graf.tugunlar.find((t) => t.id === b.maqsad)?.tur || 'obyekt';
              const maxsusBog = ['sklad', 'texnika', 'kadr'].includes(manbaTur) || ['sklad', 'texnika', 'kadr'].includes(maqsadTur);
              const rang = maxsusBog ? '#facc15' : TUR_RANG[manbaTur];
              const qalinlik = maxsusBog ? 3 : 2;
              const bogNomi = RUXSAT_BOGLANISH.find(r => r.tur === b.tur)?.nom || BOG_TUR_NOM[b.tur] || b.tur;
              const d = bezier(m.x + NODE_W, m.y + NODE_H / 2, q.x, q.y + NODE_H / 2);
              const bogTanlangan = tanlanganBog?.manba === b.manba && tanlanganBog?.maqsad === b.maqsad && tanlanganBog?.tur === b.tur;
              const midX = (m.x + NODE_W + q.x) / 2;
              const midY = (m.y + NODE_H / 2 + q.y + NODE_H / 2) / 2;
              return (
                <g key={b.tur + '_' + i} className="pointer-events-auto"
                  style={{ cursor: b.uzsa_boladi ? 'pointer' : 'default' }}
                  onClick={(e) => { e.stopPropagation(); setTanlanganBog(b); setTanlangan(null); }}>
                  <title>{bogNomi} · {b.uzsa_boladi ? 'Tekshirish yoki uzish uchun bosing' : 'Tuzilmaviy bog\'lanish'}</title>
                  <path d={d} fill="none" stroke="transparent" strokeWidth={16} />
                  <path d={d} fill="none" stroke={bogTanlangan ? '#f8fafc' : rang} strokeWidth={bogTanlangan ? 4 : qalinlik}
                    strokeOpacity={bogTanlangan ? 1 : (b.uzsa_boladi ? 0.6 : 0.25)}
                    strokeDasharray={b.uzsa_boladi ? 'none' : '4,4'} />
                  {bogTanlangan && (
                    <text x={midX} y={midY - 10} fill="#94a3b8" fontSize="10" textAnchor="middle" pointerEvents="none" className="select-none shadow-black drop-shadow-md">
                      {bogNomi} {b.rol ? `(${b.rol})` : ''}
                    </text>
                  )}
                </g>
              );
            })}
            {chiziqManba && (
              <path d={bezier(chiziqManba.x + NODE_W, chiziqManba.y + NODE_H / 2, kursor.x, kursor.y)}
                fill="none" stroke="#38bdf8" strokeWidth={2} strokeDasharray="6,4" />
            )}
          </svg>

          {korsatilganTugunlar.map((t) => {
            const joy = joylar[t.id];
            if (!joy) return null;
            const Ik = TUR_IKONKA[t.tur];
            const rang = TUR_RANG[t.tur];
            const nishon = chiziqManbaId != null && chiziqManbaId !== t.id;
            const manbaTugun = chiziqManbaId ? graf.tugunlar.find((x) => x.id === chiziqManbaId) : null;
            const boglashMumkin = !!manbaTugun && (bogTuriniTop(manbaTugun.tur, t.tur) || bogTuriniTop(t.tur, manbaTugun.tur));
            return (
              <div key={t.id}
                data-tugun={t.id}
                onPointerDown={(e) => bosildiTugun(e, t.id)}
                onClick={() => { if (!rejim.current) { setTanlangan(t.id); setTanlanganBog(null); } }}
                className={'absolute rounded-xl border bg-[#111827] px-3 py-2 flex flex-col justify-center select-none shadow-lg transition-opacity duration-300 ' +
                  (korinish === 'risk' && !((t.meta?.belgi || []) as MindmapBelgi[]).some(b => b.daraja === 'ogoh') ? 'opacity-30 grayscale ' : 'opacity-100 ') +
                  (nishon && boglashMumkin ? 'ring-2 ring-sky-400/70' : '') + (nishon && !boglashMumkin ? 'opacity-50 ring-2 ring-rose-500/70' : '') + (tanlangan === t.id ? ' ring-2 ring-white/70' : '')}
                style={{ left: joy.x, top: joy.y, width: NODE_W, height: NODE_H, borderColor: rang + '66', cursor: 'move' }}>
                
                  {/* ⚠️ 2026-08-28 (Claude) — SOXTA BELGI OLIB TASHLANDI.
                      Avval shart bunday edi:
                        t.tur === 'obyekt' && t.nom.includes('Yangi')
                      va ekranga QATTIQ YOZILGAN «90m parog (Zayavka)»
                      chiqarilardi. Ya'ni nomida «Yangi» bo'lgan har qanday
                      obyekt hech qanday zayavkasiz ham bildirishnoma
                      ko'rsatardi — bu loyihaning eng qat'iy qoidasini
                      (soxta ma'lumot) buzardi.

                      Endi belgilar bazada HAQIQIY manbadan hisoblanadi
                      (`t2_mindmap_grafi` → `meta.belgi`): kutilayotgan
                      zayavka, narxsiz qator, eskirgan ko'zgu, yuklanmagan
                      smeta. Manba bo'sh bo'lsa belgi CHIQMAYDI. */}
                  {(() => {
                    const belgilar = (t.meta?.belgi ?? []) as MindmapBelgi[];
                    if (!belgilar.length) return null;
                    const ogoh = belgilar.some((b) => b.daraja === 'ogoh');
                    return (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const nom = encodeURIComponent(t.nom);
                          const yol = belgilar[0].tur === 'zayavka'
                            ? '/admin/test/zayavka?obyekt=' + nom
                            : belgilar[0].tur === 'kozgu'
                              ? '/admin/tezlik'
                              : '/admin/test/smeta?obyekt=' + nom;
                          navigate(yol);
                        }}
                        title={belgilar.map((b) => '• ' + b.matn).join('\n')}
                        className={'absolute -top-2 -left-2 text-white text-[10px] font-bold ' +
                          'px-2 py-0.5 rounded-full border-2 border-[#111827] shadow-lg ' +
                          'flex items-center gap-1 z-20 ' +
                          (ogoh ? 'bg-amber-500 hover:bg-amber-400' : 'bg-sky-500 hover:bg-sky-400')}>
                        <AlertTriangle size={11} />
                        {belgilar.length === 1
                          ? (belgilar[0].soni ?? '') + ' ' + BELGI_QISQA[belgilar[0].tur]
                          : belgilar.length + ' ogohlantirish'}
                      </button>
                    );
                  })()}

                  <div className="flex items-center gap-1.5 font-semibold text-[12px] truncate" style={{ color: rang }}>
                  <Ik size={13} className="flex-shrink-0" /><span className="truncate">{t.nom}</span>
                </div>
                <div className="text-[10px] text-zinc-500 truncate">{tafsilot(t)}</div>
                {t.tur !== 'kompaniya' && (
                  <div onPointerDown={(e) => bosildiNuqta(e, t.id)}
                    title="Bog'lash uchun shu nuqtadan chiziq torting"
                    aria-label={t.nom + ' uchun bog\'lash porti'}
                    className="absolute -right-[7px] top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-[#0a0f1d] cursor-crosshair hover:scale-150 transition-transform"
                    style={{ background: rang }} />
                )}
              </div>
            );
          })}

          {chiziqManbaId && (
            <div className="absolute left-4 top-4 z-10 rounded-lg border border-sky-400/30 bg-[#111827]/90 px-3 py-2 text-[10px] text-sky-100 shadow-lg backdrop-blur">
              Ko'k halqali tugunlar — ulash mumkin · xira tugunlar — bu tur bilan ulash mumkin emas
            </div>
          )}

          {!yuklanmoqda && graf.tugunlar.length <= 1 && (
            <div className="absolute text-zinc-500 text-sm" style={{ left: 60, top: 100, width: 520 }}>
              Hali tugun yo'q. Tepadagi «Yangi qo'shish» tugmalaridan loyiha, sklad,
              texnika yoki kontragent yarating — keyin ularni chiziq bilan bog'laysiz.
            </div>
          )}
          {!yuklanmoqda && graf.tugunlar.length > 1 && korsatilganTugunlar.length === 0 && (
            <div className="absolute text-zinc-500 text-sm" style={{ left: 60, top: 100, width: 520 }}>
              Qidiruv yoki tanlangan filtrga mos tugun topilmadi. «Barchasi»ni tanlab, qidiruvni tozalang.
            </div>
          )}
        </div>
      </div>

      {/* BOG'LANISH INSPEKTORI — noto'g'ri chiziqni avval ko'rib,
          keyin ongli ravishda uzish uchun. Chiziq endi darhol o'chmaydi. */}
      {tanlanganBog && tanlanganBogManba && tanlanganBogMaqsad && (
        <div className="absolute right-4 top-4 z-20 w-[320px] rounded-xl border border-white/15 bg-[#111827]/95 p-4 shadow-2xl backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-sky-300">Bog'lanish tekshiruvi</div>
              <div className="mt-1 text-sm font-semibold text-white">{BOG_TUR_NOM[tanlanganBog.tur] || tanlanganBog.tur}</div>
            </div>
            <button type="button" onClick={() => setTanlanganBog(null)} className="text-zinc-500 hover:text-white" aria-label="Bog'lanish panelini yopish"><X size={16} /></button>
          </div>
          <div className="mt-3 rounded-lg border border-white/10 bg-black/25 p-2.5 text-[11px]">
            <div className="flex items-center gap-2"><span className="truncate" style={{ color: TUR_RANG[tanlanganBogManba.tur] }}>{tanlanganBogManba.nom}</span><span className="text-zinc-600">→</span><span className="truncate" style={{ color: TUR_RANG[tanlanganBogMaqsad.tur] }}>{tanlanganBogMaqsad.nom}</span></div>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-zinc-400">Chiziq noto'g'ri bo'lsa, «Bog'lanishni uzish»ni bosing. Bu tegishli yozuvlarni o'chirmaydi, faqat ular orasidagi aloqani bekor qiladi.</p>
          {tanlanganBog.uzsa_boladi ? (
            <button type="button" onClick={() => chiziqUz(tanlanganBog)} className="mt-3 w-full rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/20">Bog'lanishni uzish</button>
          ) : (
            <div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[10px] text-zinc-500">Bu tuzilmaviy bog'lanish. Uni uzib bo'lmaydi.</div>
          )}
        </div>
      )}

      {/* TAFSILOT PANELI — tugun bosilganda o'ngda ochiladi */}
      {tanlanganTugun && (
        <div className="absolute right-0 top-0 bottom-0 w-[300px] bg-[#0d1424] border-l border-white/10 z-30 flex flex-col shadow-2xl">
          <div className="p-4 border-b border-white/10 flex justify-between items-start">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider" style={{ color: TUR_RANG[tanlanganTugun.tur] }}>
                {TUR_NOM[tanlanganTugun.tur]}
              </div>
              <div className="font-bold truncate">{tanlanganTugun.nom}</div>
              <div className="text-[11px] text-zinc-500 mt-0.5">{tafsilot(tanlanganTugun)}</div>
            </div>
            <button onClick={() => setTanlangan(null)} className="text-zinc-500 hover:text-white flex-shrink-0"><X size={16} /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {tanlanganObyektHolati && (
                <div className="space-y-3 mb-6 bg-black/20 p-3 rounded-xl border border-white/5">
                  <h4 className="text-[11px] font-bold text-sky-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Building2 size={12} /> Obyekt holati</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                      <div className="text-[10px] text-zinc-500">Smeta</div>
                      <div className="text-[12px] font-bold text-emerald-400">{pulQisqa(tanlanganObyektHolati.smeta)}</div>
                    </div>
                    <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                      <div className="text-[10px] text-zinc-500">F2</div>
                      <div className="text-[12px] font-bold text-sky-400">{pulQisqa(tanlanganObyektHolati.f2)}</div>
                    </div>
                  </div>
                  {(tanlanganObyektHolati.belgi?.length ?? 0) > 0 && (
                    <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-2.5 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-300"><AlertTriangle size={12} /> E'tibor kerak</div>
                      {tanlanganObyektHolati.belgi?.map((b: MindmapBelgi, i: number) => <div key={i} className="text-[11px] text-amber-100">{b.matn}</div>)}
                    </div>
                  )}
                  <div className="bg-white/5 p-2 rounded-lg border border-white/5 space-y-2 text-[11px]">
                    <div className="flex justify-between"><span className="text-zinc-400">Fakt</span><span className="text-white font-bold">{pulQisqa(tanlanganObyektHolati.fakt)}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-400">Fakt / smeta</span><span className="text-white font-bold">{tanlanganObyektHolati.fakt_foiz == null ? '—' : tanlanganObyektHolati.fakt_foiz + '%'}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-400">F2 / smeta</span><span className="text-white font-bold">{tanlanganObyektHolati.f2_foiz == null ? '—' : tanlanganObyektHolati.f2_foiz + '%'}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-400">Resurs qatorlari</span><span className="text-white font-bold">{tanlanganObyektHolati.resurs_qatori ?? '—'}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-400">Narxsiz qatorlar</span><span className={(tanlanganObyektHolati.narxsiz ?? 0) > 0 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>{tanlanganObyektHolati.narxsiz ?? '—'}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-400">Hisob holati</span><span className={tanlanganObyektHolati.toliq === false ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>{tanlanganObyektHolati.toliq == null ? '—' : tanlanganObyektHolati.toliq ? 'To‘liq' : 'To‘liq emas'}</span></div>
                    <button type="button" onClick={() => navigate('/admin/test/zayavka?obyekt=' + encodeURIComponent(tanlanganTugun!.nom))} className="w-full mt-1 rounded-lg bg-amber-500/10 px-2 py-1.5 text-amber-300 hover:bg-amber-500/20 text-left">
                      Ochiq zayavkalar: <b>{tanlanganObyektHolati.zayavka ?? '—'}</b>
                    </button>
                  </div>
                </div>
              )}
              {tanlanganTugun?.tur === 'obyekt' && (
                <div className="rounded-xl border border-white/5 bg-black/20 p-3">
                  <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-300"><Clock size={12} /> So'nggi hodisalar</h4>
                  {hodisaYuklanmoqda && <div className="text-[10px] text-zinc-500">Hodisa tarixi yuklanmoqda…</div>}
                  {!hodisaYuklanmoqda && hodisaXato && <div className="text-[10px] text-amber-300">Hodisa tarixi mavjud emas: {hodisaXato}</div>}
                  {!hodisaYuklanmoqda && !hodisaXato && obyektHodisalari.length === 0 && <div className="text-[10px] text-zinc-600">Bu obyekt uchun hali muhim hodisa yozilmagan.</div>}
                  {!hodisaYuklanmoqda && obyektHodisalari.length > 0 && (
                    <div className="space-y-2">
                      {obyektHodisalari.slice(0, 5).map((h) => (
                        <div key={h.id} className="flex gap-2 text-[10px]">
                          <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: MODUL_RANG[h.modul] || '#64748b' }} />
                          <div className="min-w-0 flex-1"><div className="text-zinc-200">{h.satr || h.tafsilot || h.amal_turi}</div><div className="mt-0.5 text-zinc-600">{qachon(h.yaratilgan_vaqt)}{h.kim ? ' · ' + h.kim : ''}</div></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div>
                <div className="text-[11px] text-zinc-400 mb-2">Bog'lanishlari ({tanlanganBoglar.length})</div>
              {tanlanganBoglar.length === 0 && (
                <p className="text-[11px] text-zinc-600">Hali hech narsaga bog'lanmagan — o'ng chetidagi nuqtadan chiziq torting.</p>
              )}
              <div className="space-y-1.5">
                {tanlanganBoglar.map((b, i) => {
                  const qarshi = b.manba === tanlangan ? b.maqsad : b.manba;
                  const qt = graf.tugunlar.find((t) => t.id === qarshi);
                  if (!qt) return null;
                  const Ik = TUR_IKONKA[qt.tur];
                  return (
                    <div key={i} onClick={(e) => { e.stopPropagation(); setTanlanganBog(b); setTanlangan(null); }} className="flex items-center gap-2 bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 cursor-pointer hover:border-sky-400/40">
                      <Ik size={13} style={{ color: TUR_RANG[qt.tur] }} className="flex-shrink-0" />
                      <span className="min-w-0 flex-1"><span className="block text-[11px] truncate">{qt.nom}</span><span className="block text-[9px] truncate text-zinc-600">{b.rol ? `${RUXSAT_BOGLANISH.find(r => r.tur === b.tur)?.nom || BOG_TUR_NOM[b.tur] || b.tur} (${b.rol})` : (RUXSAT_BOGLANISH.find(r => r.tur === b.tur)?.nom || BOG_TUR_NOM[b.tur] || b.tur)}</span></span>
                      {b.uzsa_boladi && (
                        <button onClick={() => chiziqUz(b)} title="Bog'lanishni uzish"
                          className="text-zinc-500 hover:text-rose-400 flex-shrink-0"><Unlink size={12} /></button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-white/10">
              {tanlanganTugun.tur === 'shartnoma' && (
                <div className="rounded-xl border border-white/5 bg-black/20 p-3 mb-2">
                  <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-300"><FileText size={12} /> Shartnoma ma'lumotlari</h4>
                  <div className="space-y-2 text-[11px]">
                     <div className="flex justify-between"><span className="text-zinc-400">Taraf:</span><span className="text-white font-bold">{tanlanganTugun.meta?.taraf || '—'}</span></div>
                     <div className="flex justify-between"><span className="text-zinc-400">Summa:</span><span className="text-white font-bold">{tanlanganTugun.meta?.summa ? pulQisqa(tanlanganTugun.meta.summa) : (tanlanganTugun.meta?.summa_bez_nds ? pulQisqa(tanlanganTugun.meta.summa_bez_nds) : '—')}</span></div>
                     <div className="flex justify-between"><span className="text-zinc-400">Holat:</span><span className="text-white font-bold">{tanlanganTugun.meta?.holat || '—'}</span></div>
                     <div className="mt-2 border-t border-white/10 pt-2 text-zinc-400">Loyihalar: <span className="text-white">{tanlanganBoglar.filter(b => b.tur === 'shartnoma_loyiha').map(b => graf.tugunlar.find(t => t.id === (b.manba === tanlanganTugun.id ? b.maqsad : b.manba))?.nom).join(', ') || '—'}</span></div>
                     <div className="text-zinc-400">Obyektlar: <span className="text-white">{tanlanganBoglar.filter(b => b.tur === 'shartnoma_obyekt').map(b => graf.tugunlar.find(t => t.id === (b.manba === tanlanganTugun.id ? b.maqsad : b.manba))?.nom).join(', ') || '—'}</span></div>
                  </div>
                </div>
              )}
              {tanlanganTugun.tur === 'kontragent' && (
                <div className="rounded-xl border border-white/5 bg-black/20 p-3 mb-2">
                  <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-300"><Users size={12} /> Ishtirok ma'lumotlari</h4>
                  <div className="space-y-2 text-[11px]">
                     <div className="flex justify-between"><span className="text-zinc-400">STIR (INN):</span><span className="text-white font-bold">{tanlanganTugun.meta?.inn || '—'}</span></div>
                     <div className="mt-2 border-t border-white/10 pt-2 text-zinc-400">Loyihalardagi rollari:</div>
                     {tanlanganBoglar.filter(b => b.tur === 'qatnashchi').length === 0 ? <span className="text-zinc-500">Hali loyihalarga biriktirilmagan</span> : null}
                     {tanlanganBoglar.filter(b => b.tur === 'qatnashchi').map((b, idx) => {
                         const l = graf.tugunlar.find(t => t.id === (b.manba === tanlanganTugun.id ? b.maqsad : b.manba));
                         return <div key={idx} className="flex justify-between"><span className="text-zinc-400 truncate max-w-[150px]">{l?.nom || "Noma'lum"}</span><span className="text-sky-300 font-bold">{b.rol || 'Biriktirilgan'}</span></div>;
                     })}
                  </div>
                </div>
              )}
              {tanlanganTugun.tur === 'obyekt' && (
                <div className="rounded-xl border border-white/5 bg-black/20 p-3 mb-2 space-y-3">
                  <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                    <Activity size={12} /> Obyekt KPI (Holati)
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                     <div className="bg-white/5 p-2 rounded border border-white/5">
                        <div className="text-zinc-500 mb-0.5">Smeta Hajmi</div>
                        <div className="font-bold text-sky-300">{tanlanganTugun.meta?.smeta ? pulQisqa(tanlanganTugun.meta.smeta) : 'Kiritilmagan'}</div>
                     </div>
                     <div className="bg-white/5 p-2 rounded border border-white/5">
                        <div className="text-zinc-500 mb-0.5">Fakt (F2)</div>
                        <div className="font-bold text-emerald-400">{tanlanganTugun.meta?.fakt ? pulQisqa(tanlanganTugun.meta.fakt) : '0'}</div>
                     </div>
                     <div className="bg-white/5 p-2 rounded border border-white/5">
                        <div className="text-zinc-500 mb-0.5">Bajarildi %</div>
                        <div className="font-bold text-white">{tanlanganTugun.meta?.foiz ? tanlanganTugun.meta.foiz + '%' : '0%'}</div>
                     </div>
                     <div className="bg-white/5 p-2 rounded border border-white/5">
                        <div className="text-zinc-500 mb-0.5">Ochiq Zayavkalar</div>
                        <div className="font-bold text-amber-400">{tanlanganTugun.meta?.zayavka_soni || 0} ta</div>
                     </div>
                  </div>
                  <button type="button" onClick={() => navigate('/admin/test/zayavka?obyekt=' + encodeURIComponent(tanlanganTugun.nom))}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500/15 py-2 text-[12px] text-amber-200 hover:bg-amber-500/25">
                    <AlertTriangle size={13} /> Zayavkalarni boshqarish
                  </button>
                </div>
              )}
              {SAHIFA_YOLI[tanlanganTugun.tur] && (
                <button onClick={() => navigate(SAHIFA_YOLI[tanlanganTugun.tur]!(Number(tanlanganTugun.id.split(':')[1]), tanlanganTugun.nom))}
                  className="w-full inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 py-2 rounded-lg text-[12px]">
                  <ExternalLink size={13} /> To'liq sahifada ochish
                </button>
              )}
              {OCHIRSA_BOLADI.includes(tanlanganTugun.tur) && (
                <button onClick={() => tugunOchir(tanlanganTugun)}
                  className="w-full inline-flex items-center justify-center gap-2 bg-rose-950/40 border border-rose-500/30 hover:bg-rose-900/40 text-rose-300 py-2 rounded-lg text-[12px]">
                  <Trash2 size={13} /> O'chirish
                </button>
              )}
              {tanlanganTugun.tur === 'obyekt' && (
                <p className="text-[10px] text-zinc-600">
                  Obyekt mindmapdan o'chirilmaydi — unda smeta/F2/pul bor, «Obyektlar» sahifasi orqali.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QO'LLANMA */}
      <div className="flex-shrink-0 border-t border-white/10 bg-black/40 px-5 py-2 flex flex-wrap gap-x-4 gap-y-1 items-center">
        {RUXSAT_BOGLANISH.map((r) => (
          <span key={r.tur} className="text-[10px] text-zinc-500">
            <span style={{ color: TUR_RANG[r.manba] }}>{TUR_NOM[r.manba]}</span>
            <span className="mx-1">→</span>
            <span style={{ color: TUR_RANG[r.maqsad] }}>{TUR_NOM[r.maqsad]}</span>
          </span>
        ))}
        <span className="text-[10px] text-zinc-600 inline-flex items-center gap-1 ml-auto">
          <Unlink size={11} /> chiziqni bosing → tekshirib uzing
        </span>
      </div>

      {/* YANGI TUGUN */}
      {yaratModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setYaratModal(null)}>
          <div className="bg-[#111827] border border-white/10 rounded-xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold" style={{ color: TUR_RANG[yaratModal] }}>Yangi {TUR_NOM[yaratModal]}</h3>
              <button onClick={() => setYaratModal(null)} className="text-zinc-500 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              {YARATSA_BOLADI.find((y) => y.tur === yaratModal)?.maydonlar.map((m) => (
                <div key={m.kalit}>
                  <label className="block text-[11px] text-zinc-400 mb-1">
                    {m.nom}{m.majburiy && <span className="text-rose-400"> *</span>}
                  </label>
                  <input value={maydonlar[m.kalit] || ''}
                    onChange={(e) => setMaydonlar({ ...maydonlar, [m.kalit]: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-sky-500 outline-none" />
                </div>
              ))}
            </div>
            <button onClick={tugunYarat} className="w-full mt-4 bg-sky-600 hover:bg-sky-500 py-2 rounded-lg font-medium text-sm">
              Yaratish
            </button>
          </div>
        </div>
      )}

      {/* ROL TANLASH */}
      {rolModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setRolModal(null)}>
          <div className="bg-[#111827] border border-white/10 rounded-xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-pink-400 mb-1">Loyihadagi roli</h3>
            <p className="text-[11px] text-zinc-500 mb-4">Bitta kompaniya turli loyihalarda turli rolda bo'lishi mumkin.</p>
            <div className="space-y-2">
              {ROLLAR.map((r) => (
                <button key={r.kalit} onClick={() => rolniTasdiqla(r.kalit)}
                  className="w-full text-left px-3 py-2 rounded-lg bg-black/40 border border-white/10 hover:border-pink-500/50 text-sm">
                  {r.nom}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

