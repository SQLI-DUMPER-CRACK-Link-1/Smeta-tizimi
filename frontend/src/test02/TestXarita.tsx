import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Building2, Warehouse, FileText, Truck, HardHat, FolderKanban,
  Users, Plus, X, ZoomIn, ZoomOut, RefreshCcw, Unlink, Move,
  LayoutGrid, Maximize2, Save, Trash2, ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useKompaniya } from './KompaniyaTanlov';
import { toast } from '../umumiy/ui/Toast';
import {
  sbMindmapGrafOl, sbMindmapBog, sbMindmapBogOchir, sbMindmapTugunYarat,
  sbMindmapJoylashuvSaqla, sbMindmapTugunOchir, bogTuriniTop, RUXSAT_BOGLANISH, OCHIRSA_BOLADI,
  type MindmapGraf, type MindmapTugun, type TugunTur,
} from '../api/t2-mindmap';

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
  const { joriy } = useKompaniya();
  const aktKomp = joriy?.id ?? 0;

  const [graf, setGraf] = useState<MindmapGraf>({ tugunlar: [], bogichlar: [] });
  const [joylar, setJoylar] = useState<Record<string, XY>>({});
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [xato, setXato] = useState('');
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);

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
  const [rolModal, setRolModal] = useState<{ manbaId: number; maqsadId: number } | null>(null);
  const [tanlangan, setTanlangan] = useState<string | null>(null);
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
    const saqlangan: Record<string, XY> = {};
    r.graf.tugunlar.forEach((t) => {
      if (t.x != null && t.y != null) saqlangan[t.id] = { x: Number(t.x), y: Number(t.y) };
    });
    setJoylar(avtoJoylash(r.graf.tugunlar, saqlangan));
  }, [aktKomp, avtoJoylash]);

  useEffect(() => { yukla(); }, [yukla]);

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
    if (qoida.tur === 'qatnashchi') { setRolModal({ manbaId: mId, maqsadId: qId }); return; }

    const nat = await sbMindmapBog(qoida.tur, mId, qId);
    if (nat.ok) { toast(qoida.nom + ' — bajarildi', 'ok'); yukla(); }
    else toast(nat.error || 'Bog\'lanmadi', 'danger');
  };

  const rolniTasdiqla = async (rol: string) => {
    if (!rolModal) return;
    const r = await sbMindmapBog('qatnashchi', rolModal.manbaId, rolModal.maqsadId, rol);
    setRolModal(null);
    if (r.ok) { toast('Qatnashchi biriktirildi', 'ok'); yukla(); }
    else toast(r.error || 'Bog\'lanmadi', 'danger');
  };

  const chiziqUz = async (b: MindmapGraf['bogichlar'][number]) => {
    if (!b.uzsa_boladi) { toast('Bu tuzilmaviy bog\'lanish — uzib bo\'lmaydi', 'danger'); return; }
    if (!confirm('Bog\'lanishni uzasizmi? (Yozuvlarning o\'zi O\'CHMAYDI)')) return;
    const r = await sbMindmapBogOchir(b.tur, Number(b.manba.split(':')[1]), Number(b.maqsad.split(':')[1]));
    if (r.ok) { toast('Bog\'lanish uzildi', 'ok'); yukla(); }
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

  const tugunOchir = async (t: MindmapTugun) => {
    if (!confirm('«' + t.nom + '» o\'chirilsinmi? (Bekor qilinadi, butunlay yo\'qolmaydi)')) return;
    const r = await sbMindmapTugunOchir(t.tur, Number(t.id.split(':')[1]));
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

  return (
    <div className="h-full flex flex-col bg-[#0a0f1d] text-white overflow-hidden">
      {/* BOSHQARUV */}
      <div className="flex-shrink-0 border-b border-white/10 bg-black/40 px-5 py-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Move size={18} className="text-sky-400" /> Arxitektura Xaritasi
              {saqlanmoqda && <span className="text-[10px] text-amber-400 inline-flex items-center gap-1"><Save size={11} /> saqlanmoqda…</span>}
            </h1>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Tugunni <b>sudrab</b> ko'chiring · o'ng chetidagi <span className="text-sky-400">•</span> dan <b>chiziq torting</b> ·
              bo'sh joyni sudrab maydonni suring · g'ildirak bilan zumlang
            </p>
          </div>
          <div className="flex items-center gap-1.5">
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
            {graf.bogichlar.map((b, i) => {
              const m = joylar[b.manba], q = joylar[b.maqsad];
              if (!m || !q) return null;
              const manbaTur = graf.tugunlar.find((t) => t.id === b.manba)?.tur || 'obyekt';
              const rang = TUR_RANG[manbaTur];
              const d = bezier(m.x + NODE_W, m.y + NODE_H / 2, q.x, q.y + NODE_H / 2);
              return (
                <g key={b.tur + '_' + i} className="pointer-events-auto"
                  style={{ cursor: b.uzsa_boladi ? 'pointer' : 'default' }}
                  onClick={() => chiziqUz(b)}>
                  <path d={d} fill="none" stroke="transparent" strokeWidth={16} />
                  <path d={d} fill="none" stroke={rang} strokeWidth={2}
                    strokeOpacity={b.uzsa_boladi ? 0.6 : 0.25}
                    strokeDasharray={b.uzsa_boladi ? 'none' : '4,4'} />
                </g>
              );
            })}
            {chiziqManba && (
              <path d={bezier(chiziqManba.x + NODE_W, chiziqManba.y + NODE_H / 2, kursor.x, kursor.y)}
                fill="none" stroke="#38bdf8" strokeWidth={2} strokeDasharray="6,4" />
            )}
          </svg>

          {graf.tugunlar.map((t) => {
            const joy = joylar[t.id];
            if (!joy) return null;
            const Ik = TUR_IKONKA[t.tur];
            const rang = TUR_RANG[t.tur];
            const nishon = chiziqManbaId != null && chiziqManbaId !== t.id;
            return (
              <div key={t.id}
                data-tugun={t.id}
                onPointerDown={(e) => bosildiTugun(e, t.id)}
                onClick={() => { if (!rejim.current) setTanlangan(t.id); }}
                className={'absolute rounded-xl border bg-[#111827] px-3 py-2 flex flex-col justify-center select-none shadow-lg ' +
                  (nishon ? 'ring-2 ring-sky-400/70' : '') + (tanlangan === t.id ? ' ring-2 ring-white/70' : '')}
                style={{ left: joy.x, top: joy.y, width: NODE_W, height: NODE_H, borderColor: rang + '66', cursor: 'move' }}>
                
                  {/* Bildirishnoma / Zayavka (Tick) */}
                  {(t.meta?.zayavka || t.meta?.bildirishnoma || (t.tur === 'obyekt' && t.nom.includes('Yangi'))) && (
                    <div className="absolute -top-2 -left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-[#111827] shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse flex items-center gap-1 z-20">
                      <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                      {t.meta?.zayavka || t.meta?.bildirishnoma || (t.tur === 'obyekt' && t.nom.includes('Yangi') ? '90m parog (Zayavka)' : '')}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 font-semibold text-[12px] truncate" style={{ color: rang }}>
                  <Ik size={13} className="flex-shrink-0" /><span className="truncate">{t.nom}</span>
                </div>
                <div className="text-[10px] text-zinc-500 truncate">{tafsilot(t)}</div>
                {t.tur !== 'kompaniya' && (
                  <div onPointerDown={(e) => bosildiNuqta(e, t.id)}
                    title="Bog'lash uchun shu nuqtadan chiziq torting"
                    className="absolute -right-[7px] top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-[#0a0f1d] cursor-crosshair hover:scale-150 transition-transform"
                    style={{ background: rang }} />
                )}
              </div>
            );
          })}

          {!yuklanmoqda && graf.tugunlar.length <= 1 && (
            <div className="absolute text-zinc-500 text-sm" style={{ left: 60, top: 100, width: 520 }}>
              Hali tugun yo'q. Tepadagi «Yangi qo'shish» tugmalaridan loyiha, sklad,
              texnika yoki kontragent yarating — keyin ularni chiziq bilan bog'laysiz.
            </div>
          )}
        </div>
      </div>

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
              
              {/* === MINI DASHBOARD (FUNKSIONALLIK KARKASI) === */}
              {tanlanganTugun.tur === 'obyekt' && (
                <div className="space-y-3 mb-6 bg-black/20 p-3 rounded-xl border border-white/5 shadow-[inset_0_0_20px_rgba(56,189,248,0.02)]">
                  <h4 className="text-[11px] font-bold text-sky-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Building2 size={12} /> Obyekt Holati</h4>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                      <div className="text-[10px] text-zinc-500">Byudjet (Smeta)</div>
                      <div className="text-[12px] font-bold text-emerald-400">12.5 Mlrd</div>
                    </div>
                    <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                      <div className="text-[10px] text-zinc-500">O'zlashtirildi (F2)</div>
                      <div className="text-[12px] font-bold text-sky-400">8.2 Mlrd <span className="text-[10px] text-zinc-500">(65%)</span></div>
                    </div>
                  </div>

                  <div className="bg-white/5 p-2 rounded-lg border border-white/5 space-y-2 mt-2">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-zinc-400">Jarayondagi Zayavkalar:</span>
                      <span className="text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded cursor-pointer hover:bg-amber-500/20" onClick={() => window.location.href='/admin/test/zayavka'}>3 ta</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-zinc-400">Sklad qoldig'i:</span>
                      <span className="text-emerald-400 font-bold cursor-pointer hover:text-emerald-300" onClick={() => window.location.href='/admin/test/logistika'}>142 tonna</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-zinc-400">Biriktirilgan Texnikalar:</span>
                      <span className="text-white font-bold">4 ta aylanma</span>
                    </div>
                  </div>
                </div>
              )}

              {tanlanganTugun.tur === 'shartnoma' && (
                <div className="space-y-3 mb-6 bg-black/20 p-3 rounded-xl border border-white/5 shadow-[inset_0_0_20px_rgba(52,211,153,0.02)]">
                  <h4 className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><FileText size={12} /> Moliyaviy Holat</h4>
                  <div className="bg-white/5 p-2 rounded-lg border border-white/5 space-y-2">
                    <div>
                      <div className="text-[10px] text-zinc-500">Shartnoma Summasi (NDS bilan)</div>
                      <div className="text-[13px] font-bold text-white">4 500 000 000 so'm</div>
                    </div>
                    <div className="w-full bg-black/50 rounded-full h-1.5 mt-2 overflow-hidden">
                      <div className="bg-emerald-500 h-1.5" style={{ width: '45%' }}></div>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-emerald-400">To'langan: 2.02 Mlrd</span>
                      <span className="text-rose-400">Qarz: 2.47 Mlrd</span>
                    </div>
                  </div>
                </div>
              )}

              {tanlanganTugun.tur === 'kontragent' && (
                <div className="space-y-3 mb-6 bg-black/20 p-3 rounded-xl border border-white/5 shadow-[inset_0_0_20px_rgba(251,146,60,0.02)]">
                  <h4 className="text-[11px] font-bold text-orange-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Users size={12} /> Kontragent Ma'lumoti</h4>
                  <div className="bg-white/5 p-3 rounded-lg border border-white/5 text-[11px] space-y-2">
                    <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-zinc-500">Turi:</span><span className="text-white font-medium">Subpudratchi (B2B)</span></div>
                    <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-zinc-500">Reyting:</span><span className="text-amber-400 tracking-widest">★★★★☆</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Aktiv Shartnomalar:</span><span className="text-emerald-400 font-bold">2 ta</span></div>
                  </div>
                </div>
              )}
              {/* ================================================== */}

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
                    <div key={i} className="flex items-center gap-2 bg-black/30 border border-white/10 rounded-lg px-2 py-1.5">
                      <Ik size={13} style={{ color: TUR_RANG[qt.tur] }} className="flex-shrink-0" />
                      <span className="text-[11px] truncate flex-1">{qt.nom}</span>
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
          <Unlink size={11} /> chiziqni bosib uzasiz
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
