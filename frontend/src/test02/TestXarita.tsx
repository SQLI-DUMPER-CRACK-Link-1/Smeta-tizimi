import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Building2, Warehouse, FileText, Truck, HardHat, FolderKanban,
  Users, Plus, X, ZoomIn, ZoomOut, RefreshCcw, Unlink, Move,
} from 'lucide-react';
import { useKompaniya } from './KompaniyaTanlov';
import { toast } from '../umumiy/ui/Toast';
import {
  sbMindmapGrafOl, sbMindmapBog, sbMindmapBogOchir, sbMindmapTugunYarat,
  bogTuriniTop, RUXSAT_BOGLANISH,
  type MindmapGraf, type MindmapTugun, type TugunTur,
} from '../api/t2-mindmap';

/* ⚡ 2026-08-28 — MINDMAP TUBDAN QAYTA QURILDI (foydalanuvchi ko'rsatmasi).
 *
 * AVVALGI HOLAT (nima uchun "juda noto'g'ri ishlardi"):
 *   • Mindmapda HECH NARSA YARATIB BO'LMASDI — sklad, shartnoma,
 *     texnika (avtopark), kontragent qo'shish imkoni yo'q edi.
 *   • Har obyekt ostidagi "Sklad (WMS)" / "Shartnomalar" tugunlari
 *     DEKORATIV edi — hech qanday haqiqiy yozuvga bog'lanmagan,
 *     shunchaki boshqa sahifaga navigatsiya tugmasi. Ya'ni ular
 *     obyektga bog'langandek KO'RINARDI, lekin bog'lanish YO'Q edi.
 *   • Yagona haqiqiy amal — obyektni loyihaga biriktirish, u ham
 *     chiziq bilan emas, modal ro'yxatdan tanlash orqali.
 *
 * HOZIRGI HOLAT: to'liq tahrirlash maydoni.
 *   • 6 turdagi tugun shu yerda YARATILADI (loyiha, shartnoma, sklad,
 *     texnika, kadr, kontragent).
 *   • Bog'lanish — tugun chetidagi nuqtadan CHIZIQ TORTIB. 7 turdagi
 *     bog'lanish qo'llab-quvvatlanadi (`RUXSAT_BOGLANISH`).
 *   • Chiziqni bosib UZISH mumkin (yozuvlar o'chmaydi, faqat bog'lanish).
 *   • Butun graf BITTA so'rovda o'qiladi (`t2_mindmap_grafi`).
 *
 * ⚠️ Obyekt ATAYLAB bu yerda yaratilmaydi — unga Drive papka tuzilmasi
 * ham kerak; yarim yaratilgan obyekt keyin smeta yuklashda sinardi.
 */

const NODE_W = 210;
const NODE_H = 56;
const GAP_Y = 18;
const COL_GAP = 300;
const TOP = 80;

type UstunTa = { tur: TugunTur[]; nom: string; Ikonka: any; rang: string };

/* Ustunlar chapdan o'ngga — bog'lanishlar tabiiy oqim bo'ylab ketsin */
const USTUNLAR: UstunTa[] = [
  { tur: ['kontragent'],                nom: 'Kontragentlar', Ikonka: Users,       rang: '#f472b6' },
  { tur: ['kompaniya', 'loyiha'],       nom: 'Loyihalar',     Ikonka: FolderKanban, rang: '#0ea5e9' },
  { tur: ['shartnoma'],                 nom: 'Shartnomalar',  Ikonka: FileText,    rang: '#d946ef' },
  { tur: ['obyekt'],                    nom: 'Obyektlar',     Ikonka: Building2,   rang: '#10b981' },
  { tur: ['sklad', 'texnika', 'kadr'],  nom: 'Resurslar',     Ikonka: Warehouse,   rang: '#f59e0b' },
];

const TUR_RANG: Record<TugunTur, string> = {
  kompaniya: '#8b5cf6', loyiha: '#0ea5e9', obyekt: '#10b981', shartnoma: '#d946ef',
  sklad: '#f59e0b', texnika: '#fb923c', kadr: '#3b82f6', kontragent: '#f472b6',
};
const TUR_IKONKA: Record<TugunTur, any> = {
  kompaniya: Building2, loyiha: FolderKanban, obyekt: Building2, shartnoma: FileText,
  sklad: Warehouse, texnika: Truck, kadr: HardHat, kontragent: Users,
};

/** Mindmapdan yaratsa bo'ladigan turlar va ularning maydonlari */
const YARATSA_BOLADI: { tur: TugunTur; nom: string; maydonlar: { kalit: string; nom: string; majburiy?: boolean }[] }[] = [
  { tur: 'loyiha',     nom: 'Loyiha',     maydonlar: [{ kalit: 'nom', nom: 'Loyiha nomi', majburiy: true }, { kalit: 'hudud', nom: 'Hudud' }] },
  { tur: 'shartnoma',  nom: 'Shartnoma',  maydonlar: [{ kalit: 'nom', nom: 'Shartnoma raqami', majburiy: true }, { kalit: 'taraf', nom: 'Taraf (kim bilan)' }] },
  { tur: 'sklad',      nom: 'Sklad',      maydonlar: [{ kalit: 'nom', nom: 'Sklad nomi', majburiy: true }, { kalit: 'manzil', nom: 'Manzil' }, { kalit: 'masul', nom: "Mas'ul shaxs" }] },
  { tur: 'texnika',    nom: 'Texnika',    maydonlar: [{ kalit: 'nom', nom: 'Texnika nomi', majburiy: true }, { kalit: 'davlat_raqami', nom: 'Davlat raqami' }] },
  { tur: 'kadr',       nom: 'Xodim',      maydonlar: [{ kalit: 'nom', nom: 'Ism sharif', majburiy: true }, { kalit: 'lavozim', nom: 'Lavozim', majburiy: true }] },
  { tur: 'kontragent', nom: 'Kontragent', maydonlar: [{ kalit: 'nom', nom: 'Kompaniya nomi', majburiy: true }, { kalit: 'inn', nom: 'STIR (9 raqam)' }] },
];

const ROLLAR = [
  { kalit: 'zakazchik', nom: 'Zakazchik (buyurtmachi)' },
  { kalit: 'bosh_pudratchi', nom: 'Bosh pudratchi' },
  { kalit: 'subpudratchi', nom: 'Subpudratchi' },
  { kalit: 'loyihachi', nom: 'Loyihachi' },
  { kalit: 'taminotchi', nom: "Ta'minotchi" },
];

type Joylashuv = { x: number; y: number; tugun: MindmapTugun };

export default function TestXarita() {
  const { joriy } = useKompaniya();
  const aktKomp = joriy?.id ?? 0;

  const [graf, setGraf] = useState<MindmapGraf>({ tugunlar: [], bogichlar: [] });
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [xato, setXato] = useState('');

  const [pan, setPan] = useState({ x: 40, y: 20 });
  const [zoom, setZoom] = useState(0.85);
  const surish = useRef(false);
  const oxirgi = useRef({ x: 0, y: 0 });

  const wrapRef = useRef<HTMLDivElement>(null);
  const [qoralama, setQoralama] = useState<{ manba: string; x: number; y: number } | null>(null);

  const [yaratModal, setYaratModal] = useState<TugunTur | null>(null);
  const [maydonlar, setMaydonlar] = useState<Record<string, string>>({});
  const [rolModal, setRolModal] = useState<{ manbaId: number; maqsadId: number } | null>(null);

  const yukla = useCallback(async () => {
    if (!aktKomp) return;
    setYuklanmoqda(true);
    setXato('');
    const r = await sbMindmapGrafOl(aktKomp);
    setYuklanmoqda(false);
    if (r.ok) setGraf(r.graf);
    else setXato(r.error);
  }, [aktKomp]);

  useEffect(() => { yukla(); }, [yukla]);

  /* ── JOYLASHUV: har tur o'z ustunida, vertikal stack ── */
  const joylar = new Map<string, Joylashuv>();
  USTUNLAR.forEach((u, ui) => {
    const tugunlar = graf.tugunlar.filter((t) => u.tur.includes(t.tur));
    tugunlar.forEach((t, ti) => {
      joylar.set(t.id, { x: 40 + ui * COL_GAP, y: TOP + ti * (NODE_H + GAP_Y), tugun: t });
    });
  });

  const kanvasKoord = (e: React.PointerEvent | React.MouseEvent) => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: (e.clientX - r.left - pan.x) / zoom, y: (e.clientY - r.top - pan.y) / zoom };
  };

  /* ── CHIZIQ TORTISH ── */
  const chiziqBoshla = (e: React.PointerEvent, tugunId: string) => {
    e.stopPropagation();
    const p = kanvasKoord(e);
    setQoralama({ manba: tugunId, x: p.x, y: p.y });
  };

  const chiziqTugat = async (maqsadId: string) => {
    if (!qoralama || qoralama.manba === maqsadId) { setQoralama(null); return; }
    const manba = graf.tugunlar.find((t) => t.id === qoralama.manba);
    const maqsad = graf.tugunlar.find((t) => t.id === maqsadId);
    setQoralama(null);
    if (!manba || !maqsad) return;

    const qoida = bogTuriniTop(manba.tur, maqsad.tur);
    if (!qoida) {
      toast(manba.tur + ' → ' + maqsad.tur + ' bog\'lanishi mavjud emas', 'danger');
      return;
    }
    const manbaId = Number(manba.id.split(':')[1]);
    const maqsadId2 = Number(maqsad.id.split(':')[1]);

    if (qoida.tur === 'qatnashchi') {
      setRolModal({ manbaId, maqsadId: maqsadId2 });
      return;
    }
    const r = await sbMindmapBog(qoida.tur, manbaId, maqsadId2);
    if (r.ok) { toast(qoida.nom + ' — bajarildi', 'ok'); yukla(); }
    else toast(r.error || 'Bog\'lanmadi', 'danger');
  };

  const rolniTasdiqla = async (rol: string) => {
    if (!rolModal) return;
    const r = await sbMindmapBog('qatnashchi', rolModal.manbaId, rolModal.maqsadId, rol);
    setRolModal(null);
    if (r.ok) { toast('Qatnashchi biriktirildi', 'ok'); yukla(); }
    else toast(r.error || 'Bog\'lanmadi', 'danger');
  };

  const chiziqUz = async (b: { manba: string; maqsad: string; tur: any; uzsa_boladi: boolean }) => {
    if (!b.uzsa_boladi) { toast('Bu tuzilmaviy bog\'lanish — uzib bo\'lmaydi', 'danger'); return; }
    if (!confirm('Bog\'lanishni uzasizmi? (Yozuvlarning o\'zi O\'CHMAYDI)')) return;
    const r = await sbMindmapBogOchir(b.tur, Number(b.manba.split(':')[1]), Number(b.maqsad.split(':')[1]));
    if (r.ok) { toast('Bog\'lanish uzildi', 'ok'); yukla(); }
    else toast(r.error || 'Uzilmadi', 'danger');
  };

  const tugunYarat = async () => {
    if (!yaratModal || !aktKomp) return;
    const r = await sbMindmapTugunYarat(yaratModal, aktKomp, maydonlar);
    if (r.ok) {
      toast('Yaratildi', 'ok');
      setYaratModal(null); setMaydonlar({});
      yukla();
    } else toast(r.error || 'Yaratilmadi', 'danger');
  };

  /* ── BEZIER ── */
  const bezier = (x1: number, y1: number, x2: number, y2: number) => {
    const cx = (x1 + x2) / 2;
    return 'M ' + x1 + ' ' + y1 + ' C ' + cx + ' ' + y1 + ', ' + cx + ' ' + y2 + ', ' + x2 + ' ' + y2;
  };

  const qoralamaManba = qoralama ? joylar.get(qoralama.manba) : null;

  return (
    <div className="h-full flex flex-col bg-[#0a0f1d] text-white overflow-hidden">
      {/* BOSHQARUV PANELI */}
      <div className="flex-shrink-0 border-b border-white/10 bg-black/30 px-5 py-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Move size={18} className="text-sky-400" /> Arxitektura Xaritasi
            </h1>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Tugun chetidagi <span className="text-sky-400">•</span> nuqtadan boshqa tugunga <b>chiziq torting</b> — bog'lanadi.
              Chiziqni bosib uzasiz.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setZoom((z) => Math.max(0.3, z - 0.15))} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg"><ZoomOut size={15} /></button>
            <span className="text-[11px] text-zinc-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(2, z + 0.15))} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg"><ZoomIn size={15} /></button>
            <button onClick={yukla} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg"><RefreshCcw size={15} className={yuklanmoqda ? 'animate-spin' : ''} /></button>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="text-[11px] text-zinc-500 mr-1">Yangi qo'shish:</span>
          {YARATSA_BOLADI.map((y) => {
            const Ik = TUR_IKONKA[y.tur];
            return (
              <button key={y.tur}
                onClick={() => { setYaratModal(y.tur); setMaydonlar({}); }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors hover:bg-white/10"
                style={{ borderColor: TUR_RANG[y.tur] + '55', color: TUR_RANG[y.tur] }}>
                <Plus size={12} /> <Ik size={12} /> {y.nom}
              </button>
            );
          })}
        </div>
      </div>

      {xato && <div className="m-3 p-3 bg-red-900/20 border border-red-500/30 text-red-400 rounded-lg text-sm">{xato}</div>}

      {/* KANVAS */}
      <div
        ref={wrapRef}
        className="flex-1 relative overflow-hidden"
        style={{ cursor: surish.current ? 'grabbing' : 'grab' }}
        onPointerDown={(e) => { if (!qoralama) { surish.current = true; oxirgi.current = { x: e.clientX, y: e.clientY }; } }}
        onPointerMove={(e) => {
          if (qoralama) { const p = kanvasKoord(e); setQoralama({ ...qoralama, x: p.x, y: p.y }); return; }
          if (!surish.current) return;
          setPan((p) => ({ x: p.x + (e.clientX - oxirgi.current.x), y: p.y + (e.clientY - oxirgi.current.y) }));
          oxirgi.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={() => { surish.current = false; setQoralama(null); }}
        onPointerLeave={() => { surish.current = false; setQoralama(null); }}
      >
        <div className="absolute origin-top-left" style={{ transform: 'translate(' + pan.x + 'px,' + pan.y + 'px) scale(' + zoom + ')', width: 2400, height: 1800 }}>
          {/* USTUN SARLAVHALARI */}
          {USTUNLAR.map((u, ui) => (
            <div key={u.nom} className="absolute text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5"
              style={{ left: 40 + ui * COL_GAP, top: 40, color: u.rang }}>
              <u.Ikonka size={13} /> {u.nom}
            </div>
          ))}

          {/* CHIZIQLAR */}
          <svg className="absolute inset-0 pointer-events-none" width={2400} height={1800}>
            {graf.bogichlar.map((b, i) => {
              const m = joylar.get(b.manba); const q = joylar.get(b.maqsad);
              if (!m || !q) return null;
              const x1 = m.x + NODE_W, y1 = m.y + NODE_H / 2;
              const x2 = q.x, y2 = q.y + NODE_H / 2;
              const rang = TUR_RANG[m.tugun.tur] || '#64748b';
              return (
                <g key={b.tur + i} className="pointer-events-auto" style={{ cursor: b.uzsa_boladi ? 'pointer' : 'default' }}
                   onClick={() => chiziqUz(b)}>
                  <path d={bezier(x1, y1, x2, y2)} fill="none" stroke="transparent" strokeWidth={14} />
                  <path d={bezier(x1, y1, x2, y2)} fill="none" stroke={rang} strokeWidth={2}
                        strokeOpacity={b.uzsa_boladi ? 0.55 : 0.25}
                        strokeDasharray={b.uzsa_boladi ? 'none' : '4,4'} />
                </g>
              );
            })}
            {/* Tortilayotgan qoralama chiziq */}
            {qoralama && qoralamaManba && (
              <path d={bezier(qoralamaManba.x + NODE_W, qoralamaManba.y + NODE_H / 2, qoralama.x, qoralama.y)}
                    fill="none" stroke="#38bdf8" strokeWidth={2} strokeDasharray="6,4" />
            )}
          </svg>

          {/* TUGUNLAR */}
          {Array.from(joylar.values()).map(({ x, y, tugun }) => {
            const Ik = TUR_IKONKA[tugun.tur];
            const rang = TUR_RANG[tugun.tur];
            const nishon = qoralama && qoralama.manba !== tugun.id;
            return (
              <div key={tugun.id}
                onPointerUp={(e) => { e.stopPropagation(); chiziqTugat(tugun.id); }}
                className={'absolute rounded-xl border bg-[#111827] px-3 py-2 flex flex-col justify-center transition-colors ' +
                           (nishon ? 'ring-2 ring-sky-400/60' : '')}
                style={{ left: x, top: y, width: NODE_W, height: NODE_H, borderColor: rang + '66' }}>
                <div className="flex items-center gap-1.5 font-semibold text-[12px] truncate" style={{ color: rang }}>
                  <Ik size={13} className="flex-shrink-0" /> <span className="truncate">{tugun.nom}</span>
                </div>
                <div className="text-[10px] text-zinc-500 truncate">
                  {tugun.tur === 'obyekt' && (tugun.meta?.lat != null ? '📍 ' + tugun.meta.lat + ', ' + tugun.meta.lng : 'lokatsiya belgilanmagan')}
                  {tugun.tur === 'loyiha' && (tugun.meta?.byudjet != null ? 'Byudjet: ' + Number(tugun.meta.byudjet).toLocaleString() : 'byudjet belgilanmagan')}
                  {tugun.tur === 'shartnoma' && (tugun.meta?.taraf || 'taraf ko\'rsatilmagan')}
                  {tugun.tur === 'sklad' && (tugun.meta?.manzil || 'manzil yo\'q')}
                  {tugun.tur === 'texnika' && (tugun.meta?.davlat_raqami || 'raqam yo\'q')}
                  {tugun.tur === 'kadr' && (tugun.meta?.lavozim || '')}
                  {tugun.tur === 'kontragent' && (tugun.meta?.inn ? 'STIR ' + tugun.meta.inn : 'STIR kiritilmagan')}
                  {tugun.tur === 'kompaniya' && 'Bosh tashkilot'}
                </div>
                {/* CHIZIQ TORTISH NUQTASI */}
                {tugun.tur !== 'kompaniya' && (
                  <div
                    onPointerDown={(e) => chiziqBoshla(e, tugun.id)}
                    title="Bog'lash uchun shu nuqtadan chiziq torting"
                    className="absolute -right-[7px] top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-[#0a0f1d] cursor-crosshair hover:scale-150 transition-transform"
                    style={{ background: rang }} />
                )}
              </div>
            );
          })}

          {!yuklanmoqda && graf.tugunlar.length <= 1 && (
            <div className="absolute text-center text-zinc-500 text-sm" style={{ left: 40, top: TOP + 20, width: 520 }}>
              Hali tugun yo'q. Tepadagi «Yangi qo'shish» tugmalaridan loyiha, sklad,
              texnika yoki kontragent yarating — keyin ularni chiziq bilan bog'laysiz.
            </div>
          )}
        </div>
      </div>

      {/* QO'LLANMA */}
      <div className="flex-shrink-0 border-t border-white/10 bg-black/30 px-5 py-2 flex flex-wrap gap-x-4 gap-y-1">
        {RUXSAT_BOGLANISH.map((r) => (
          <span key={r.tur} className="text-[10px] text-zinc-500">
            <span style={{ color: TUR_RANG[r.manba] }}>{r.manba}</span>
            <span className="mx-1">→</span>
            <span style={{ color: TUR_RANG[r.maqsad] }}>{r.maqsad}</span>
          </span>
        ))}
        <span className="text-[10px] text-zinc-600 inline-flex items-center gap-1 ml-auto">
          <Unlink size={11} /> chiziqni bosib uzasiz
        </span>
      </div>

      {/* YANGI TUGUN MODALI */}
      {yaratModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setYaratModal(null)}>
          <div className="bg-[#111827] border border-white/10 rounded-xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold" style={{ color: TUR_RANG[yaratModal] }}>
                Yangi {YARATSA_BOLADI.find((y) => y.tur === yaratModal)?.nom}
              </h3>
              <button onClick={() => setYaratModal(null)} className="text-zinc-500 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              {YARATSA_BOLADI.find((y) => y.tur === yaratModal)?.maydonlar.map((m) => (
                <div key={m.kalit}>
                  <label className="block text-[11px] text-zinc-400 mb-1">
                    {m.nom}{m.majburiy && <span className="text-rose-400"> *</span>}
                  </label>
                  <input
                    value={maydonlar[m.kalit] || ''}
                    onChange={(e) => setMaydonlar({ ...maydonlar, [m.kalit]: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-sky-500 outline-none" />
                </div>
              ))}
            </div>
            <button onClick={tugunYarat}
              className="w-full mt-4 bg-sky-600 hover:bg-sky-500 py-2 rounded-lg font-medium text-sm">
              Yaratish
            </button>
          </div>
        </div>
      )}

      {/* ROL TANLASH MODALI (kontragent → loyiha) */}
      {rolModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setRolModal(null)}>
          <div className="bg-[#111827] border border-white/10 rounded-xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-pink-400 mb-1">Loyihadagi roli</h3>
            <p className="text-[11px] text-zinc-500 mb-4">
              Bitta kompaniya turli loyihalarda turli rolda bo'lishi mumkin.
            </p>
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
