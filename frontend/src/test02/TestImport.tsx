/**
 * TestImport.tsx — TIZIM_02: OBYEKT YARATISH VA ICHINI TO'LDIRISH
 * ═══════════════════════════════════════════════════════════════════
 *
 * ⚠️ 2026-08-19 IKKINCHI QAYTA QURISH — TARTIB TESKARI EDI.
 *
 * Foydalanuvchi: «SHU BU OBYEKTNI RES QISMI, BU LRV QISMI DEB HAR BIR
 * OBYEKTNI YARATIB ICHINI TO'LDIRISH IMKONI BERILISHI KERAK».
 *
 * Avvalgi tartib FAYLDAN boshlanardi: fayl yuklanadi → keyin obyekt
 * nomi so'raladi. Shuning uchun bitta obyektga IKKINCHI hujjat qo'shish
 * yo'li ekranda umuman ko'rinmasdi — LRV va RES esa alohida hujjat.
 *
 * ENDI OBYEKTDAN BOSHLANADI:
 *      1) obyekt yaratiladi yoki tanlanadi
 *      2) uning «LRV qismi» ga hujjat(lar) solinadi
 *      3) uning «RES qismi» ga hujjat(lar) solinadi
 *      4) har hujjat ichidagi varaqlar belgilanadi
 *      5) hisoblanadi
 *
 * Bazadagi hujjatlar ham SHU ikki qism ichida ko'rinadi — ya'ni ekran
 * obyektning haqiqiy holatini ko'rsatadi, faqat shu seansda yuklanganini
 * emas.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, CheckCircle, AlertTriangle, Clock, ArrowRight, FileSpreadsheet,
  ExternalLink, RefreshCw, Trash2, ChevronDown, ChevronRight, FileText,
  Plus, Database, FolderPlus,
} from 'lucide-react';
import { Sahifa } from '../umumiy/ui/Sahifa';
import { toast } from '../umumiy/ui/Toast';
import { gas } from '../api/client';
import { sbT2ObyektlarOlKomp, type T2Obyekt } from '../api/supabase';
import { useKompaniya } from './KompaniyaTanlov';

type Rol = 'lokalka' | 'svodka';
type Varaq = { nom: string; qator: number; ustun: number };

/** Obyekt ichidagi bitta HUJJAT. */
type Hujjat = {
  fayl_id: string;
  nom: string;                       // ko'rsatiladigan nom
  rol: Rol;
  varaqlar: Varaq[];
  olinsin: Record<string, boolean>;  // varaq nomi → olinadimi
  ochiq: boolean;
  bazada?: boolean;                  // allaqachon import qilingan
  toliq?: boolean;                   // Drive'dan to'liq varaq ro'yxati tortilganmi
  jami_qator?: number;
};

type ImportNatija = {
  ok: boolean; obyekt?: string; xabar?: string; xatolar?: string[];
  ms?: number; hujjat_soni?: number; varaq_soni?: number;
  import?: Array<{ ok: boolean; hujjat?: string; varaq?: string; rol?: string;
                   format?: string; xom_qator?: number; xabar?: string }>;
  hisob?: { ok: boolean;
            bosqichlar?: Array<{ bosqich: string; varaq?: string; ms?: number; natija?: any }> };
};

const QISMLAR: Array<{ rol: Rol; sarlavha: string; izoh: string }> = [
  { rol: 'lokalka', sarlavha: 'LRV qismi — lokal smeta',
    izoh: 'Ishlar va resurslar ro\'yxati. Bularsiz hisob yo\'q.' },
  { rol: 'svodka', sarlavha: 'RES qismi — resurs svodkasi',
    izoh: 'Narxlar shu yerdan olinadi. Bo\'lmasa qatorlar narxsiz qoladi.' },
];

export default function TestImport() {
  const navigate = useNavigate();
  const { joriy } = useKompaniya();

  /* ── Obyekt ── */
  const [obyektlar, setObyektlar] = useState<T2Obyekt[]>([]);
  const [obyekt, setObyekt] = useState('');        // tanlangan/yaratilgan nom
  const [yangiNom, setYangiNom] = useState('');
  const [yaratilmoqda, setYaratilmoqda] = useState(false);

  /* ── Hujjatlar ── */
  const [hujjatlar, setHujjatlar] = useState<Hujjat[]>([]);
  const [yuklanayotgan, setYuklanayotgan] = useState<Rol | null>(null);
  const [ketyapti, setKetyapti] = useState(false);
  const [natija, setNatija] = useState<ImportNatija | null>(null);

  const [kozgu, setKozgu] = useState<{ ok: boolean; url?: string;
                                       xabar?: string; qator?: number } | null>(null);
  const [kozguKetyapti, setKozguKetyapti] = useState(false);

  const obyektlarYukla = useCallback(() => {
    sbT2ObyektlarOlKomp(joriy?.id).then((r) => {
      if (r.ok) setObyektlar((r.qatorlar as T2Obyekt[]) || []);
    }).catch(() => {});
  }, [joriy?.id]);
  useEffect(() => { obyektlarYukla(); }, [obyektlarYukla]);

  /* Obyekt tanlanganda uning BAZADAGI hujjatlari tortiladi. */
  const hujjatlarYukla = useCallback(async (nom: string) => {
    if (!nom) { setHujjatlar([]); return; }
    try {
      const r = await gas<any>('apiT2ObyektHujjatlar', nom);
      if (!r.ok) { toast(r.xabar || 'Hujjatlar o\'qilmadi', 'warn'); return; }
      setHujjatlar((r.hujjatlar || []).map((h: any): Hujjat => {
        const olinsin: Record<string, boolean> = {};
        (h.varaqlar || []).forEach((v: any) => { olinsin[v.nom] = true; });
        return {
          fayl_id: h.fayl_id, nom: h.fayl_nom || h.fayl_id,
          rol: (h.rol === 'svodka' ? 'svodka' : 'lokalka') as Rol,
          varaqlar: (h.varaqlar || []).map((v: any) => ({
            nom: v.nom, qator: v.qator || 0, ustun: 0 })),
          olinsin, ochiq: false, bazada: true, jami_qator: h.jami_qator,
        };
      }));
    } catch (e: any) { toast(e?.message || 'Xato', 'danger'); }
  }, []);

  const obyektTanla = (nom: string) => {
    setObyekt(nom); setNatija(null); setKozgu(null);
    hujjatlarYukla(nom);
  };

  const obyektYarat = async () => {
    const nom = yangiNom.trim();
    if (!nom) { toast('Obyekt nomini kiriting', 'warn'); return; }
    if (obyektlar.some((o) => o.nom === nom)) {
      toast('Bunday obyekt bor — ro\'yxatdan tanlang', 'warn'); return;
    }
    setYaratilmoqda(true);
    try {
      const r = await gas<any>('apiT2ObyektYarat', nom);
      if (!r.ok) { toast(r.xabar || 'Yaratilmadi', 'danger', undefined, 9000); return; }
      toast('Obyekt yaratildi — endi ichini to\'ldiring', 'ok');
      setYangiNom(''); obyektlarYukla(); obyektTanla(nom);
    } catch (e: any) {
      toast(e?.message || 'Xato', 'danger', undefined, 9000);
    } finally { setYaratilmoqda(false); }
  };

  /* ── Qism ichiga fayl yuklash ── */
  const fayllarTanlandi = async (list: FileList | null, rol: Rol) => {
    if (!list?.length) return;
    setYuklanayotgan(rol);
    let qoshildi = 0;

    for (const f of Array.from(list)) {
      try {
        const b64: string = await new Promise((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(String(fr.result).split(',')[1] || '');
          fr.onerror = () => rej(new Error('Faylni o\'qib bo\'lmadi'));
          fr.readAsDataURL(f);
        });
        const r = await gas<any>('apiT2FaylYukla', f.name, b64, f.type);
        if (!r.ok) {
          toast(f.name + ': ' + (r.xabar || 'yuklanmadi'), 'danger', undefined, 9000);
          continue;
        }

        /* Boshida HAMMA varaq belgilanadi. Teskarisi xavfli: unutilgan
           varaq jim tushib qoladi va buni keyin sezish qiyin. */
        const olinsin: Record<string, boolean> = {};
        (r.varaqlar || []).forEach((v: Varaq) => { olinsin[v.nom] = true; });

        /* ⚠️ Rol foydalanuvchi bosgan QISMDAN olinadi, fayl nomidan
           taxmin qilingan `rol_taklif` dan emas. Qism — aniq niyat,
           taxmin esa faqat taxmin. Ziddiyat bo'lsa ogohlantiramiz. */
        if (r.rol_taklif && r.rol_taklif !== rol) {
          toast('«' + f.name + '» nomi ' + (r.rol_taklif === 'svodka' ? 'RES' : 'LRV') +
                ' ga o\'xshaydi, lekin ' + (rol === 'svodka' ? 'RES' : 'LRV') +
                ' qismiga qo\'yildi — tekshiring', 'warn', undefined, 9000);
        }

        setHujjatlar((p) => [...p, {
          fayl_id: r.fayl_id, nom: r.asl_nom || f.name, rol,
          varaqlar: r.varaqlar || [], olinsin,
          ochiq: (r.varaqlar || []).length > 1,
        }]);
        qoshildi++;
      } catch (e: any) {
        toast(f.name + ': ' + (e?.message || 'xato'), 'danger', undefined, 9000);
      }
    }

    setYuklanayotgan(null);
    if (qoshildi) toast(qoshildi + ' hujjat qo\'shildi', 'ok');
  };

  const varaqOzgar = (id: string, varaq: string, qiymat: boolean) =>
    setHujjatlar((p) => p.map((h) =>
      h.fayl_id === id ? { ...h, olinsin: { ...h.olinsin, [varaq]: qiymat } } : h));

  /**
   * Hujjat yoyilganda BAZADAGI varaqlar yetarli emas.
   *
   * `apiT2ObyektHujjatlar` varaqlarni `t2_manba` dan oladi — ya'ni faqat
   * avval import qilinganlarini. O'tgan safar belgilanmagan varaq
   * ro'yxatda umuman yo'q va uni qo'shib bo'lmaydi. Shuning uchun birinchi
   * yoyilishda Drive'dagi TO'LIQ ro'yxat tortiladi va ikkalasi
   * birlashtiriladi: import qilinganlari belgilangan, qolganlari bo'sh.
   */
  const ochYop = async (id: string) => {
    const h = hujjatlar.find((x) => x.fayl_id === id);
    if (!h) return;
    const yopilyapti = h.ochiq;
    setHujjatlar((p) => p.map((x) => (x.fayl_id === id ? { ...x, ochiq: !x.ochiq } : x)));
    if (yopilyapti || !h.bazada || h.toliq) return;

    try {
      const r = await gas<any>('apiT2HujjatVaraqlar', id);
      if (!r.ok) { toast(r.xabar || 'Varaqlar o\'qilmadi', 'warn'); return; }
      setHujjatlar((p) => p.map((x) => {
        if (x.fayl_id !== id) return x;
        const import1 = new Set(x.varaqlar.map((v) => v.nom));
        const olinsin = { ...x.olinsin };
        const varaqlar: Varaq[] = (r.varaqlar || []).map((v: any) => {
          if (!import1.has(v.nom)) olinsin[v.nom] = false;   // import qilinmagan
          return { nom: v.nom, qator: v.qator || 0, ustun: v.ustun || 0 };
        });
        /* Drive'da yo'q, lekin bazada bor varaq — fayl o'zgargan bo'lishi
           mumkin. Yo'qotmaymiz, ro'yxat oxirida qoldiramiz. */
        const driveda = new Set(varaqlar.map((v) => v.nom));
        x.varaqlar.forEach((v) => { if (!driveda.has(v.nom)) varaqlar.push(v); });
        return { ...x, varaqlar, olinsin, toliq: true };
      }));
    } catch (e: any) { toast(e?.message || 'Xato', 'warn'); }
  };

  const rolKochir = (id: string, rol: Rol) =>
    setHujjatlar((p) => p.map((h) => (h.fayl_id === id ? { ...h, rol } : h)));

  const hujjatOchir = async (h: Hujjat) => {
    if (h.bazada) {
      try {
        const r = await gas<any>('apiT2HujjatOchir', obyekt, h.fayl_id);
        if (!r.ok) { toast(r.xabar || 'O\'chirilmadi', 'danger', undefined, 9000); return; }
        toast('Hujjat obyektdan olib tashlandi (Drive\'dagi fayl joyida)', 'ok');
      } catch (e: any) { toast(e?.message || 'Xato', 'danger'); return; }
    }
    setHujjatlar((p) => p.filter((x) => x.fayl_id !== h.fayl_id));
  };

  /* ── Import va hisob ── */
  const boshla = async () => {
    if (!obyekt) { toast('Avval obyekt tanlang', 'warn'); return; }
    if (!hujjatlar.some((h) => h.rol === 'lokalka')) {
      toast('LRV qismi bo\'sh — ishlar ro\'yxatisiz hisob yo\'q', 'warn'); return;
    }
    setKetyapti(true); setNatija(null); setKozgu(null);
    try {
      const yuk = hujjatlar.map((h) => ({
        fayl_id: h.fayl_id, rol: h.rol, nom: h.nom,
        varaqlar: h.varaqlar
          .filter((v) => h.olinsin[v.nom] !== false)
          .map((v) => ({ nom: v.nom, olinsin: true })),
      }));
      const r = await gas<ImportNatija>('apiT2YuklanganImport', obyekt, yuk);
      setNatija(r);
      toast(r.ok ? 'Import va hisob tugadi' : (r.xabar || 'Tugallanmadi'),
            r.ok ? 'ok' : 'danger', undefined, 9000);
      if (r.ok) { obyektlarYukla(); hujjatlarYukla(obyekt); }
    } catch (e: any) {
      setNatija({ ok: false, xabar: e?.message || String(e) });
      toast(e?.message || 'Xato', 'danger', undefined, 9000);
    } finally { setKetyapti(false); }
  };

  const kozguYarat = async () => {
    setKozguKetyapti(true); setKozgu(null);
    try { setKozgu(await gas<any>('apiT2KozguYarat', obyekt)); }
    catch (e: any) { setKozgu({ ok: false, xabar: e?.message || String(e) }); }
    finally { setKozguKetyapti(false); }
  };

  const jamiXom = (natija?.import || []).reduce((a, x) => a + (x.xom_qator || 0), 0);

  /* ── Bitta hujjat kartochkasi ──
   * Ichida holat yo'q (hammasi `hujjatlar` massivida), shuning uchun
   * har render'da qayta yaratilishi zararsiz. */
  const HujjatKarta = ({ h }: { h: Hujjat }) => {
    const olingan = h.varaqlar.filter((v) => h.olinsin[v.nom] !== false).length;
    return (
      <div className="rounded-lg border border-border bg-[var(--surface-2)]/40 p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => ochYop(h.fayl_id)} aria-label="Varaqlarni ochish"
            className="text-text-mute hover:text-text p-0.5">
            {h.ochiq ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <FileText size={14} className="text-accent flex-shrink-0" />
          <span className="flex-1 min-w-[120px] text-[12px] text-text truncate" title={h.nom}>
            {h.nom}
          </span>
          {h.bazada && (
            <span className="inline-flex items-center gap-1 text-[10px] text-ok
                             bg-ok/10 border border-ok/30 rounded px-1.5 py-0.5">
              <Database size={10} /> bazada{h.jami_qator ? ' · ' + h.jami_qator : ''}
            </span>
          )}
          <span className="text-[10px] text-text-mute">
            {olingan}/{h.varaqlar.length} varaq
          </span>
          <button
            onClick={() => rolKochir(h.fayl_id, h.rol === 'lokalka' ? 'svodka' : 'lokalka')}
            title="Boshqa qismga ko'chirish"
            className="text-[10px] text-text-mute hover:text-accent px-1.5 py-0.5
                       rounded hover:bg-white/5 border border-border">
            → {h.rol === 'lokalka' ? 'RES' : 'LRV'}
          </button>
          <button onClick={() => hujjatOchir(h)} aria-label="Olib tashlash"
            title={h.bazada ? 'Obyektdan olib tashlash' : 'Ro\'yxatdan olib tashlash'}
            className="text-text-mute hover:text-danger p-1 rounded hover:bg-white/10">
            <Trash2 size={13} />
          </button>
        </div>

        {h.ochiq && (
          <div className="mt-2 pl-6 space-y-1">
            {!h.varaqlar.length && (
              <p className="text-[11px] text-text-mute italic">Varaq ma'lumoti yo'q</p>
            )}
            {h.varaqlar.map((v) => (
              <label key={v.nom}
                className="flex items-center gap-2 text-[11px] cursor-pointer
                           hover:bg-white/[0.03] rounded px-1 py-0.5">
                <input type="checkbox" checked={h.olinsin[v.nom] !== false}
                  onChange={(e) => varaqOzgar(h.fayl_id, v.nom, e.target.checked)}
                  className="accent-[var(--accent)]" />
                <span className="flex-1 text-text truncate">{v.nom}</span>
                {/* Drive'da bor, lekin bu obyektga hali import qilinmagan varaq */}
                {h.toliq && h.olinsin[v.nom] === false && (
                  <span className="text-[10px] text-warn">import qilinmagan</span>
                )}
                <span className="text-text-mute">
                  {v.qator}{v.ustun ? ' × ' + v.ustun : ' qator'}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Sahifa
      sarlavha="Obyekt yaratish va to'ldirish (Tizim_02)"
      tavsif="Avval obyekt, keyin uning LRV va RES qismlariga hujjatlar"
    >
      <div className="space-y-3 max-w-4xl">

        {/* ── 1. OBYEKT ── */}
        <div className="karta p-4">
          <p className="text-[12px] font-medium text-text mb-3 flex items-center gap-2">
            <FolderPlus size={14} className="text-accent" /> 1-qadam · Obyekt
          </p>

          <div className="flex flex-wrap items-end gap-2 mb-3">
            <div className="flex-1 min-w-[220px]">
              <label className="text-[11px] text-text-dim block mb-1">Yangi obyekt yaratish</label>
              <input value={yangiNom} onChange={(e) => setYangiNom(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') obyektYarat(); }}
                placeholder="masalan: Amfiteatr — arxitektura"
                className="w-full bg-[var(--surface-2)] border border-border rounded-lg
                           px-3 py-2 text-[13px] text-text outline-none focus:border-accent/50" />
            </div>
            <button onClick={obyektYarat} disabled={yaratilmoqda || !yangiNom.trim()}
              className="px-3 py-2 rounded-lg bg-accent text-white text-[13px] font-medium
                         hover:bg-accent/90 transition-colors disabled:opacity-40
                         inline-flex items-center gap-1.5">
              <Plus size={14} /> {yaratilmoqda ? 'Yaratilmoqda…' : 'Yaratish'}
            </button>
          </div>

          <div>
            <label className="text-[11px] text-text-dim block mb-1">
              yoki mavjud obyektni tanlang ({obyektlar.length})
            </label>
            <select value={obyekt} onChange={(e) => obyektTanla(e.target.value)}
              className="w-full bg-[var(--surface-2)] border border-border rounded-lg
                         px-3 py-2 text-[13px] text-text outline-none focus:border-accent/50">
              <option value="">— tanlanmagan —</option>
              {obyektlar.map((o) => <option key={o.id} value={o.nom}>{o.nom}</option>)}
            </select>
          </div>

          <p className="text-[11px] text-text-mute mt-2">
            Kompaniya: <b className="text-text-dim">{joriy?.nom || '—'}</b> ·
            Fayllar Drive'dagi <b>Tizim_02 / _MANBA</b> papkasiga tushadi
          </p>
        </div>

        {/* ── 2. QISMLAR ── */}
        {!obyekt ? (
          <div className="karta p-6 text-center">
            <p className="text-[13px] text-text-mute">
              Obyekt yarating yoki tanlang — keyin uning LRV va RES qismlari ochiladi.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              {QISMLAR.map((q) => {
                const royxat = hujjatlar.filter((h) => h.rol === q.rol);
                const bosh = !royxat.length;
                return (
                  <div key={q.rol}
                    className={'karta p-3 ' + (bosh && q.rol === 'lokalka' ? 'border-warn/40' : '')}>
                    <p className="text-[12px] font-medium text-text">{q.sarlavha}</p>
                    <p className="text-[11px] text-text-mute mt-0.5 mb-2">{q.izoh}</p>

                    <div className="space-y-2 mb-2">
                      {royxat.map((h) => <HujjatKarta key={h.fayl_id} h={h} />)}
                    </div>

                    <label className="flex flex-col items-center justify-center gap-1 py-4
                                      border-2 border-dashed border-border rounded-lg cursor-pointer
                                      hover:border-accent/50 hover:bg-white/[0.02] transition-colors">
                      <Upload size={18} className="text-accent" />
                      <span className="text-[12px] text-text">
                        {yuklanayotgan === q.rol ? 'Yuklanmoqda…'
                          : (bosh ? 'Hujjat qo\'shing' : 'Yana qo\'shish')}
                      </span>
                      <span className="text-[10px] text-text-mute">
                        .xlsx · .xls · bir nechtasi mumkin
                      </span>
                      <input type="file" multiple className="hidden"
                        disabled={yuklanayotgan !== null}
                        accept=".xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                        onChange={(e) => { fayllarTanlandi(e.target.files, q.rol);
                                           e.currentTarget.value = ''; }} />
                    </label>

                    {bosh && q.rol === 'lokalka' && (
                      <p className="text-[11px] text-warn mt-1.5">
                        Bu qism bo'sh — hisob boshlanmaydi.
                      </p>
                    )}
                    {bosh && q.rol === 'svodka' && (
                      <p className="text-[11px] text-text-mute mt-1.5">
                        Bo'sh qolsa qatorlar narxsiz qoladi. Narx o'zidan to'qilmaydi.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="karta p-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-text-dim">
                <b className="text-text">{obyekt}</b> ·{' '}
                {hujjatlar.filter((h) => h.rol === 'lokalka').length} LRV ·{' '}
                {hujjatlar.filter((h) => h.rol === 'svodka').length} RES
              </span>
              <button onClick={boshla}
                disabled={ketyapti || !hujjatlar.some((h) => h.rol === 'lokalka')}
                className="px-4 py-2 rounded-lg bg-accent text-white text-[13px] font-medium
                           hover:bg-accent/90 transition-colors disabled:opacity-40
                           inline-flex items-center gap-2">
                {ketyapti ? <Clock size={15} className="animate-spin" />
                          : <RefreshCw size={15} />}
                {ketyapti ? 'Ishlanmoqda…' : 'Import va hisob'}
              </button>
            </div>
          </>
        )}

        {ketyapti && <div className="skel h-24 rounded-xl" />}

        {/* ── 3. NATIJA ── */}
        {natija && (
          <>
            <div className={'karta p-4 ' + (natija.ok
              ? 'border-ok/40 bg-ok/5' : 'border-danger/40 bg-danger/5')}>
              <p className={'text-[13px] font-medium flex items-center gap-2 mb-2 ' +
                (natija.ok ? 'text-ok' : 'text-danger')}>
                {natija.ok ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
                {natija.ok ? 'Import va hisob tugadi' : (natija.xabar || 'Tugallanmadi')}
              </p>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-text-dim">
                {natija.hujjat_soni != null && (
                  <span>Hujjat: <b className="text-text">{natija.hujjat_soni}</b></span>)}
                {natija.varaq_soni != null && (
                  <span>Varaq: <b className="text-text">{natija.varaq_soni}</b></span>)}
                <span>Xom qator: <b className="text-text">{jamiXom}</b></span>
                {natija.ms != null && <span>Jami: <b className="text-text">{natija.ms} ms</b></span>}
              </div>

              {!!natija.xatolar?.length && (
                <div className="mt-2 rounded border border-danger/30 bg-danger/5 p-2 space-y-0.5">
                  {natija.xatolar.map((x, i) => (
                    <p key={i} className="text-[11px] text-danger">{x}</p>))}
                </div>
              )}

              {natija.ok && (
                <>
                  <button
                    onClick={() => navigate('/admin/test/daraxt?obyekt=' + encodeURIComponent(obyekt))}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                               bg-accent/15 text-accent text-[12px] font-medium
                               hover:bg-accent/25 transition-colors">
                    Daraxtni ochish <ArrowRight size={13} />
                  </button>
                  <div className="mt-3 pt-3 border-t border-border">
                    <button onClick={kozguYarat} disabled={kozguKetyapti}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                 border border-border text-text text-[12px]
                                 hover:bg-white/5 transition-colors disabled:opacity-40">
                      <FileSpreadsheet size={13} />
                      {kozguKetyapti ? 'Chizilmoqda…' : 'Sheets ko‘zgusini yaratish'}
                    </button>
                    {kozgu && (
                      <div className={'mt-2 text-[11px] ' + (kozgu.ok ? 'text-ok' : 'text-danger')}>
                        {kozgu.ok ? (
                          <span className="inline-flex items-center gap-2 flex-wrap">
                            Chizildi{kozgu.qator ? ' · ' + kozgu.qator + ' qator' : ''}
                            {kozgu.url && (
                              <a href={kozgu.url} target="_blank" rel="noreferrer"
                                 className="text-accent hover:underline inline-flex items-center gap-1">
                                ochish <ExternalLink size={11} />
                              </a>
                            )}
                          </span>
                        ) : (kozgu.xabar || 'Chizilmadi')}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {!!natija.import?.length && (
              <div className="karta p-3">
                <p className="text-[11px] uppercase tracking-wide text-text-dim mb-2">
                  O'qilgan varaqlar
                </p>
                {natija.import.map((f, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-x-3 text-[11px]
                                          border-b border-border last:border-0 py-1.5">
                    <span className={f.ok ? 'text-ok' : 'text-danger'}>{f.ok ? '✓' : '✗'}</span>
                    {f.hujjat && <span className="text-text-mute truncate max-w-[160px]">{f.hujjat}</span>}
                    <span className="text-text">{f.varaq || '—'}</span>
                    <span className="text-text-mute">{f.rol}</span>
                    {f.format && <span className="text-text-mute">{f.format}</span>}
                    {f.xom_qator != null && <span className="text-text-dim">{f.xom_qator} qator</span>}
                    {!f.ok && f.xabar && <span className="text-danger">{f.xabar}</span>}
                  </div>
                ))}
              </div>
            )}

            {!!natija.hisob?.bosqichlar?.length && (
              <div className="karta p-3">
                <p className="text-[11px] uppercase tracking-wide text-text-dim mb-2">
                  Hisob bosqichlari (Postgres)
                </p>
                {natija.hisob.bosqichlar.map((b, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-x-3 text-[11px]
                                          border-b border-border last:border-0 py-1.5">
                    <span className="text-text w-24">{b.bosqich}</span>
                    {b.varaq && <span className="text-text-mute truncate max-w-[180px]">{b.varaq}</span>}
                    <span className="text-text-dim">{b.ms} ms</span>
                    {b.natija && typeof b.natija === 'object' && (
                      <span className="text-text-mute font-mono text-[10px]">
                        {Object.entries(b.natija).filter(([k]) => k !== 'ok').slice(0, 6)
                          .map(([k, v]) => `${k}=${v}`).join(' · ')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Sahifa>
  );
}
