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
  Plus, Database, FolderPlus, FolderOpen,
} from 'lucide-react';
import { Sahifa } from '../umumiy/ui/Sahifa';
import { FmtN } from '../lib/format';
import { toast } from '../umumiy/ui/Toast';
import { gas } from '../api/client';
import { sbOqi, sbT2ObyektlarOlKomp, type T2Obyekt } from '../api/supabase';
import { useKompaniya } from './KompaniyaTanlov';

type Rol = 'lokalka' | 'svodka';
type Varaq = { nom: string; qator: number; ustun: number };

/** Drive'da allaqachon turgan manba hujjat (bir yuklash = bir qator). */
type ManbaFayl = {
  fayl_id: string; asl_id: string; nom: string; sana: string;
  oqiladi: boolean; rol_taklif: Rol;
};

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
  tugadi?: boolean; davom?: DavomHolat;
  import?: Array<{ ok: boolean; hujjat?: string; varaq?: string; rol?: string;
                   format?: string; xom_qator?: number; xabar?: string }>;
  hisob?: { ok: boolean; xabar?: string;
            jami?: { ok?: boolean; jami?: number; toliq?: boolean;
                     narxsiz_qator?: number; izoh?: string };
            bosqichlar?: Array<{ bosqich: string; varaq?: string; ms?: number; natija?: any }> };
};

/** Katta hujjat bo'lakli import qilinganda — qayerda turibmiz. */
type DavomHolat = {
  fayl_id: string; nom: string; rol: string; varaq: string;
  keyingi_qator: number; jami_qator: number; foiz: number; urinish?: number;
};

/** Obyektning bazadagi HOZIRGI holati (import natijasi emas). */
type ObyektHolat = {
  id: number; jami: number | null; narxsiz: number | null; qator_soni: number | null;
  chel: number | null; mash: number | null; mat: number | null; ob: number | null;
  varaq_url?: string;
};

/** Sheets → baza qaytarish natijasi. */
type QaytarNatija = {
  ok: boolean; xabar?: string; tekshirildi?: number; ozgardi?: number;
  ziddiyat?: Array<{ qator: number; nom: string; maydon: string; sabab: string }>;
  xatolar?: string[];
  hisob?: { ok: boolean; jami?: { jami?: number; toliq?: boolean; narxsiz_qator?: number } };
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

  const [varaq, setVaraq] = useState<{
    ok: boolean; url?: string; xabar?: string; qator?: number;
    avto_sinx?: { ok: boolean; holat: string; xabar?: string };
  } | null>(null);
  const [varaqKetyapti, setVaraqKetyapti] = useState(false);

  /* ── Avval yuklangan hujjatlar (Drive: Tizim_02/_MANBA) ──
   * Foydalanuvchi: «ikkita hujjat yuklanadi YOKI shu paytgacha
   * yuklanganlar tanlanadi». Ya'ni yuklash yagona yo'l emas — bir marta
   * yuklangan hujjat keyingi obyektlarda qayta ishlatilishi kerak. */
  const [manba, setManba] = useState<ManbaFayl[]>([]);
  const [manbaOchiq, setManbaOchiq] = useState<Rol | null>(null);
  const [manbaYuk, setManbaYuk] = useState(false);
  const [manbaUrl, setManbaUrl] = useState('');

  const manbaYukla = useCallback(() => {
    setManbaYuk(true);
    gas<any>('apiT2ManbaFayllar')
      .then((r) => { if (r.ok) { setManba(r.fayllar || []); setManbaUrl(r.papka_url || ''); } })
      .catch(() => {})
      .finally(() => setManbaYuk(false));
  }, []);
  useEffect(() => { manbaYukla(); }, [manbaYukla]);

  const obyektlarYukla = useCallback(() => {
    if (!joriy?.id) { setObyektlar([]); return; }
    sbT2ObyektlarOlKomp(joriy.id).then((r) => {
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

  /* ── OBYEKT HOLATI — BAZADAN, JONLI ──
   *
   * Foydalanuvchi: «MAN O'ZGARTIRDIM MASALAN KATTA SUMMAGA 4MLRD GA
   * LEKIN PANELGA KO'RSATMAYAPDIKU».
   *
   * To'g'ri: panel faqat oxirgi IMPORT natijasini ko'rsatardi. Sheets'da
   * qilingan tahrir bazaga tushsa ham ekranda eski raqam qolardi.
   * Endi obyekt tanlanishi bilan haqiqiy holat bazadan o'qiladi. */
  const [holat, setHolat] = useState<ObyektHolat | null>(null);
  const [holatYuk, setHolatYuk] = useState(false);

  const holatYukla = useCallback(async (nom: string) => {
    if (!nom || !joriy?.id) { setHolat(null); return; }
    setHolatYuk(true);
    try {
      const j = await sbOqi<any>({
        jadval: 't2_obyekt_jami',
        filtr: 'kompaniya_id=eq.' + joriy.id + '&nom=eq.' + encodeURIComponent(nom),
        ustunlar: 'id,jami,narxsiz,qator_soni,chel,mash,mat,ob',
        limit: 1,
      });
      const q = (j.ok && j.qatorlar?.[0]) || null;
      if (!q) { setHolat(null); return; }

      /* Varaq havolasi — «Sheets'da ochish» tugmasi uchun */
      let url = '';
      try {
        const k = await sbOqi<any>({
          jadval: 't2_kozgu', filtr: 'obyekt_id=eq.' + q.id,
          ustunlar: 'fayl_id,oxirgi_yozish', limit: 1,
        });
        const fid = k.ok && k.qatorlar?.[0]?.fayl_id;
        if (fid) url = 'https://docs.google.com/spreadsheets/d/' + fid + '/edit';
      } catch { /* varaq hali yo'q — normal */ }

      setHolat({ ...q, varaq_url: url });
    } catch { setHolat(null); }
    finally { setHolatYuk(false); }
  }, [joriy?.id]);

  const obyektTanla = (nom: string) => {
    setObyekt(nom); setNatija(null); setVaraq(null);
    hujjatlarYukla(nom);
    holatYukla(nom);
  };

  const obyektYarat = async () => {
    const nom = yangiNom.trim();
    if (!nom) { toast('Obyekt nomini kiriting', 'warn'); return; }
    if (obyektlar.some((o) => o.nom === nom)) {
      toast('Bunday obyekt bor — ro\'yxatdan tanlang', 'warn'); return;
    }
    setYaratilmoqda(true);
    try {
      const r = await gas<any>('apiT2YangiObyektYarat', nom);
      if (!r.ok) { toast(r.xabar || 'Yaratilmadi', 'danger', undefined, 9000); return; }
      toast('Obyekt va Drive papkalari yaratildi', 'ok');
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
    if (qoshildi) { toast(qoshildi + ' hujjat qo\'shildi', 'ok'); manbaYukla(); }
  };

  /* ── Avval yuklangan hujjatni qismga biriktirish ── */
  const manbadanQosh = async (m: ManbaFayl, rol: Rol) => {
    if (hujjatlar.some((h) => h.fayl_id === m.fayl_id)) {
      toast('Bu hujjat allaqachon qo\'shilgan', 'warn'); return;
    }
    if (!m.oqiladi) {
      toast('«' + m.nom + '» Google Sheets ga o\'girilmagan — o\'qib bo\'lmaydi. ' +
            'Uni qaytadan yuklang.', 'danger', undefined, 9000);
      return;
    }
    setYuklanayotgan(rol);
    try {
      const r = await gas<any>('apiT2HujjatVaraqlar', m.fayl_id);
      if (!r.ok) { toast(r.xabar || 'Varaqlar o\'qilmadi', 'danger', undefined, 9000); return; }

      const olinsin: Record<string, boolean> = {};
      (r.varaqlar || []).forEach((v: Varaq) => { olinsin[v.nom] = true; });

      if (m.rol_taklif !== rol) {
        toast('«' + m.nom + '» nomi ' + (m.rol_taklif === 'svodka' ? 'RES' : 'LRV') +
              ' ga o\'xshaydi — tekshiring', 'warn', undefined, 8000);
      }
      setHujjatlar((p) => [...p, {
        fayl_id: m.fayl_id, nom: m.nom, rol,
        varaqlar: r.varaqlar || [], olinsin,
        ochiq: (r.varaqlar || []).length > 1, toliq: true,
      }]);
      setManbaOchiq(null);
      toast('«' + m.nom + '» qo\'shildi', 'ok');
    } catch (e: any) {
      toast(e?.message || 'Xato', 'danger', undefined, 9000);
    } finally { setYuklanayotgan(null); }
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
  /* ⚡ KATTA HUJJAT — BO'LAKLI IMPORT.
   *
   * Foydalanuvchi: «bu katta smetalarda ishlay olmasak GAS dan
   * o'tganimizni tezlikdan boshqa foydasi yo'q ekanda».
   *
   * GAS bitta ijroga 6 daqiqa beradi. 50 000 qatorli hujjat bunga
   * sig'maydi, shuning uchun server tugamasa `davom` holatini
   * qaytaradi va biz shu yerdan qaytadan chaqiramiz. Foydalanuvchi
   * foizni ko'rib turadi.
   *
   * Avtomatik davom etamiz, lekin CHEKSIZ emas — 30 martadan keyin
   * to'xtab, tugmani ko'rsatamiz. Cheksiz halqa yomon xatoni
   * yashirib yuborardi. */
  const [davom, setDavom] = useState<DavomHolat | null>(null);

  const boshla = async (davomdan?: DavomHolat) => {
    if (!obyekt) { toast('Avval obyekt tanlang', 'warn'); return; }
    if (!hujjatlar.some((h) => h.rol === 'lokalka')) {
      toast('LRV qismi bo\'sh — ishlar ro\'yxatisiz hisob yo\'q', 'warn'); return;
    }
    if (!davomdan) { setNatija(null); setVaraq(null); setDavom(null); }
    setKetyapti(true);
    try {
      const yuk = hujjatlar.map((h) => ({
        fayl_id: h.fayl_id, rol: h.rol, nom: h.nom,
        varaqlar: h.varaqlar
          .filter((v) => h.olinsin[v.nom] !== false)
          .map((v) => ({ nom: v.nom, olinsin: true })),
      }));
      /* Har chaqiruv qolgan joydan davom etadi — server `davom` holatida
         qaysi qatordan boshlashni o'zi biladi (t2_manba da saqlangan). */
      let r: ImportNatija | null = null;
      let urinish = (davomdan?.urinish ?? 0);

      for (;;) {
        r = await gas<ImportNatija>('apiT2YuklanganImport', obyekt, yuk);
        if (r.tugadi !== false || !r.davom) break;

        urinish++;
        setDavom({ ...r.davom, urinish });
        setNatija(r);
        if (urinish >= 30) {
          toast('Import ' + r.davom.foiz + '% da to\'xtadi — «Davom ettirish» ni bosing',
                'warn', undefined, 9000);
          return;
        }
      }

      setNatija(r); setDavom(null);
      toast(r.ok ? 'Import va hisob tugadi' : (r.xabar || 'Tugallanmadi'),
            r.ok ? 'ok' : 'danger', undefined, 9000);
      if (r.ok) { obyektlarYukla(); hujjatlarYukla(obyekt); holatYukla(obyekt); }
    } catch (e: any) {
      setNatija({ ok: false, xabar: e?.message || String(e) });
      toast(e?.message || 'Xato', 'danger', undefined, 9000);
    } finally { setKetyapti(false); }
  };

  const varaqYarat = async () => {
    setVaraqKetyapti(true); setVaraq(null);
    try { setVaraq(await gas<any>('apiT2VaraqYarat', obyekt)); }
    catch (e: any) { setVaraq({ ok: false, xabar: e?.message || String(e) }); }
    finally { setVaraqKetyapti(false); }
  };

  /* Sheets → baza. Ishchi smeta varag'i bir tomonlama emas: odam Sheets'da
     tahrirlagan NОМ/БИРЛИК/ХАЖМ/НАРХ shu tugma orqali bazaga qaytadi. */
  const [qaytar, setQaytar] = useState<QaytarNatija | null>(null);
  const [qaytarKetyapti, setQaytarKetyapti] = useState(false);
  const varaqQaytar = async () => {
    setQaytarKetyapti(true); setQaytar(null);
    try {
      const r = await gas<QaytarNatija>('apiT2VaraqQaytar', obyekt);
      setQaytar(r);
      toast(r.ok ? (r.ozgardi ? r.ozgardi + ' o\'zgarish bazaga yozildi'
                              : 'O\'zgarish topilmadi')
                 : (r.xabar || 'Qaytarilmadi'),
            r.ok ? 'ok' : 'danger', undefined, 9000);
      if (r.ok && r.ozgardi) { hujjatlarYukla(obyekt); holatYukla(obyekt); }
    } catch (e: any) {
      setQaytar({ ok: false, xabar: e?.message || String(e) });
      toast(e?.message || 'Xato', 'danger', undefined, 9000);
    } finally { setQaytarKetyapti(false); }
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

        {/* ── OBYEKT HOLATI (bazadan, jonli) ── */}
        {obyekt && holat && (
          <div className="karta p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-[12px] font-medium text-text">
                Hozirgi holat — bazadan
              </span>
              <div className="flex items-center gap-2">
                <button onClick={() => holatYukla(obyekt)} disabled={holatYuk}
                  className="text-[11px] text-text-mute hover:text-text
                             inline-flex items-center gap-1 disabled:opacity-40">
                  <RefreshCw size={11} className={holatYuk ? 'animate-spin' : ''} /> Yangilash
                </button>
                {/* Foydalanuvchi: «KERAKLI JOYIDA PANELDAN SHEETSGA
                    O'TA OLADIGAN TUGMA BO'LISHI KERAK» */}
                {holat.varaq_url && (
                  <a href={holat.varaq_url} target="_blank" rel="noreferrer"
                     className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg
                                bg-ok/15 text-ok text-[12px] font-medium
                                hover:bg-ok/25 transition-colors">
                    <FileSpreadsheet size={13} /> Sheets'da ochish
                    <ExternalLink size={11} />
                  </a>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
              <span className="text-[11px] text-text-dim">ЖАМИ</span>
              <span className="text-[16px] font-medium text-text tabular-nums">
                <FmtN val={Number(holat.jami) || 0} />
              </span>
              <span className={'text-[11px] ' + (holat.narxsiz ? 'text-warn' : 'text-ok')}>
                Narxsiz: <b>{holat.narxsiz ?? 0}</b>
              </span>
              <span className="text-[11px] text-text-mute">{holat.qator_soni ?? 0} qator</span>
            </div>

            {/* Накрутка har kategoriya bo'yicha alohida hisoblanadi */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
              {([['ЧЕЛ', holat.chel], ['МАШ', holat.mash],
                 ['МАТ', holat.mat], ['ОБ', holat.ob]] as const).map(([nm, v]) => (
                <div key={nm} className="rounded-lg bg-[var(--surface-2)]/50 px-2.5 py-1.5">
                  <div className="text-[10px] text-text-mute">{nm}</div>
                  <div className={'text-[12px] tabular-nums ' +
                    (Number(v) ? 'text-text' : 'text-text-mute')}>
                    <FmtN val={Number(v) || 0} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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

                    {/* Hujjatni qismga solishning IKKI yo'li — teng huquqli */}
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex flex-col items-center justify-center gap-1 py-3
                                        border-2 border-dashed border-border rounded-lg cursor-pointer
                                        hover:border-accent/50 hover:bg-white/[0.02] transition-colors">
                        <Upload size={16} className="text-accent" />
                        <span className="text-[11px] text-text text-center leading-tight">
                          {yuklanayotgan === q.rol ? 'Ishlanmoqda…' : 'Kompyuterdan yuklash'}
                        </span>
                        <input type="file" multiple className="hidden"
                          disabled={yuklanayotgan !== null}
                          accept=".xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                          onChange={(e) => { fayllarTanlandi(e.target.files, q.rol);
                                             e.currentTarget.value = ''; }} />
                      </label>

                      <button type="button" disabled={yuklanayotgan !== null}
                        onClick={() => setManbaOchiq(manbaOchiq === q.rol ? null : q.rol)}
                        className={'flex flex-col items-center justify-center gap-1 py-3 rounded-lg ' +
                          'border-2 border-dashed transition-colors disabled:opacity-40 ' +
                          (manbaOchiq === q.rol
                            ? 'border-accent/60 bg-accent/5'
                            : 'border-border hover:border-accent/50 hover:bg-white/[0.02]')}>
                        <FolderOpen size={16} className="text-accent" />
                        <span className="text-[11px] text-text text-center leading-tight">
                          Yuklanganlardan tanlash
                        </span>
                        <span className="text-[10px] text-text-mute">{manba.length} hujjat</span>
                      </button>
                    </div>

                    {/* ── Manba ro'yxati ── */}
                    {manbaOchiq === q.rol && (
                      <div className="mt-2 rounded-lg border border-border bg-[var(--surface-2)]/50 p-2">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] text-text-dim">
                            Drive: Tizim_02 / _MANBA
                          </span>
                          <div className="flex items-center gap-2">
                            {manbaUrl && (
                              <a href={manbaUrl} target="_blank" rel="noreferrer"
                                 className="text-[10px] text-accent hover:underline
                                            inline-flex items-center gap-1">
                                papka <ExternalLink size={10} />
                              </a>
                            )}
                            <button onClick={manbaYukla} disabled={manbaYuk}
                              className="text-text-mute hover:text-text disabled:opacity-40"
                              aria-label="Ro'yxatni yangilash" title="Ro'yxatni yangilash">
                              <RefreshCw size={12} className={manbaYuk ? 'animate-spin' : ''} />
                            </button>
                          </div>
                        </div>

                        {!manba.length ? (
                          <p className="text-[11px] text-text-mute italic py-1">
                            {manbaYuk ? 'O\'qilmoqda…'
                              : 'Hali hujjat yuklanmagan — chapdagi tugmadan yuklang.'}
                          </p>
                        ) : (
                          <div className="max-h-52 overflow-auto space-y-0.5">
                            {manba.map((m) => {
                              /* ⚠️ «Band» BUTUN OBYEKT bo'yicha tekshiriladi, faqat
                                 shu qism bo'yicha emas — bir hujjat ikkala qismda
                                 tura olmaydi. Lekin QAYSI qismda turgani aytilishi
                                 shart: aks holda RES qismiga qo'shilgan hujjat LRV
                                 ro'yxatida quruq «qo'shilgan» bo'lib ko'rinadi va
                                 u LRV ga tushgandek tuyuladi. */
                              const qayerda = hujjatlar.find((h) => h.fayl_id === m.fayl_id);
                              const band = !!qayerda;
                              const shuQismda = qayerda?.rol === q.rol;
                              return (
                                <button key={m.fayl_id} type="button" disabled={band || !!yuklanayotgan}
                                  onClick={() => manbadanQosh(m, q.rol)}
                                  className={'w-full flex items-center gap-2 text-left px-1.5 py-1 rounded ' +
                                    (band ? 'opacity-50 cursor-default'
                                          : 'hover:bg-white/[0.05] cursor-pointer')}>
                                  <FileText size={12} className="text-accent flex-shrink-0" />
                                  <span className="flex-1 text-[11px] text-text truncate" title={m.nom}>
                                    {m.nom}
                                  </span>
                                  {m.rol_taklif !== q.rol && !band && (
                                    <span className="text-[9px] text-warn">
                                      {m.rol_taklif === 'svodka' ? 'RES?' : 'LRV?'}
                                    </span>
                                  )}
                                  {!m.oqiladi && (
                                    <span className="text-[9px] text-danger">o‘qilmaydi</span>
                                  )}
                                  <span className="text-[10px] text-text-mute">{m.sana}</span>
                                  {band
                                    ? <span className={'text-[10px] ' + (shuQismda ? 'text-ok' : 'text-text-mute')}>
                                        {shuQismda ? 'shu yerda'
                                          : (qayerda!.rol === 'svodka' ? 'RES da' : 'LRV da')}
                                      </span>
                                    : <Plus size={12} className="text-text-mute" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

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
              <button onClick={() => boshla()}
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

        {/* ── KATTA HUJJAT: BO'LAKLI IMPORT JARAYONI ── */}
        {davom && (
          <div className="karta p-3 border-warn/40 bg-warn/5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12px] text-text">
                Katta hujjat bo'laklab yuklanmoqda — <b>{davom.foiz}%</b>
                <span className="text-text-mute">
                  {' '}({davom.keyingi_qator.toLocaleString('ru-RU')} /{' '}
                  {davom.jami_qator.toLocaleString('ru-RU')} qator)
                </span>
              </span>
              {!ketyapti && (
                <button onClick={() => boshla(davom)}
                  className="px-3 py-1.5 rounded-lg bg-warn/20 text-warn text-[12px]
                             font-medium hover:bg-warn/30 transition-colors">
                  Davom ettirish
                </button>
              )}
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-[var(--surface-3)] overflow-hidden">
              <div className="h-full bg-warn transition-all"
                   style={{ width: davom.foiz + '%' }} />
            </div>
            <p className="text-[11px] text-text-mute mt-1.5">
              GAS bitta ishga 6 daqiqa beradi — shuning uchun hujjat bo'lak-bo'lak
              o'qiladi. Yarim yuklangan ma'lumot hisoblanmaydi.
            </p>
          </div>
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

              {/* ── JAMI VA NARXSIZLAR — eng muhim raqam ──
                * `toliq:false` bo'lsa jami TO'LIQ EMAS. Uni oddiy raqam
                * qilib ko'rsatish xavfli: odam uni haqiqiy smeta summasi
                * deb o'qiydi. Shuning uchun ogohlantirish raqam bilan
                * BIR JOYDA turadi. */}
              {natija.hisob?.jami && (
                <div className={'mt-2 rounded border p-2 ' + (natija.hisob.jami.toliq
                  ? 'border-ok/30 bg-ok/5' : 'border-warn/40 bg-warn/5')}>
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <span className="text-[11px] text-text-dim">JAMI</span>
                    <span className="text-[15px] font-medium text-text tabular-nums">
                      {Number(natija.hisob.jami.jami || 0).toLocaleString('ru-RU',
                        { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className={'text-[11px] ' + (natija.hisob.jami.narxsiz_qator
                      ? 'text-warn' : 'text-ok')}>
                      Narxsiz: <b>{natija.hisob.jami.narxsiz_qator ?? 0}</b>
                    </span>
                  </div>
                  {natija.hisob.jami.izoh && (
                    <p className={'text-[11px] mt-1 ' + (natija.hisob.jami.toliq
                      ? 'text-ok' : 'text-warn')}>
                      {natija.hisob.jami.izoh}
                    </p>
                  )}
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
                    <button onClick={varaqYarat} disabled={varaqKetyapti}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                 border border-border text-text text-[12px]
                                 hover:bg-white/5 transition-colors disabled:opacity-40">
                      <FileSpreadsheet size={13} />
                      {varaqKetyapti ? 'Chizilmoqda…' : 'Ishchi smeta varag\'ini yaratish'}
                    </button>
                    {/* Sinxron avtomatik, lekin «hoziroq» kerak bo'lishi mumkin */}
                    <button onClick={varaqQaytar} disabled={qaytarKetyapti}
                      title="Avtomatik sinxronni kutmasdan hoziroq yozish"
                      className="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                 border border-border text-text-dim text-[12px]
                                 hover:bg-white/5 transition-colors disabled:opacity-40">
                      <ArrowRight size={13} className="rotate-180" />
                      {qaytarKetyapti ? 'Yozilmoqda…' : 'Hoziroq sinxronlash'}
                    </button>

                    {varaq && (
                      <div className={'mt-2 text-[11px] ' + (varaq.ok ? 'text-ok' : 'text-danger')}>
                        {varaq.ok ? (
                          <span className="inline-flex items-center gap-2 flex-wrap">
                            Chizildi{varaq.qator ? ' · ' + varaq.qator + ' qator' : ''}
                            {varaq.url && (
                              <a href={varaq.url} target="_blank" rel="noreferrer"
                                 className="text-accent hover:underline inline-flex items-center gap-1">
                                ochish <ExternalLink size={11} />
                              </a>
                            )}
                            {/* ⚠️ Avtomatik sinxron o'rnatilmagan bo'lsa buni
                                AYTISH shart — odam «o'zi yoziladi» deb o'ylab
                                tahririni yo'qotmasin. */}
                            {varaq.avto_sinx && !varaq.avto_sinx.ok ? (
                              <span className="text-warn">
                                ⚠ avto-sinxron yo'q: {varaq.avto_sinx.xabar || varaq.avto_sinx.holat}
                              </span>
                            ) : (
                              <span className="text-text-mute">· tahrir o'zi yoziladi (~1 daq.)</span>
                            )}
                          </span>
                        ) : (varaq.xabar || 'Chizilmadi')}
                      </div>
                    )}

                    {/* ── Sheets → baza natijasi ── */}
                    {qaytar && (
                      <div className={'mt-2 rounded border p-2 ' + (qaytar.ok
                        ? (qaytar.ziddiyat?.length ? 'border-warn/40 bg-warn/5'
                                                   : 'border-ok/30 bg-ok/5')
                        : 'border-danger/40 bg-danger/5')}>
                        {!qaytar.ok ? (
                          <p className="text-[11px] text-danger">{qaytar.xabar || 'Qaytarilmadi'}</p>
                        ) : (
                          <>
                            <p className="text-[11px] text-text-dim">
                              Tekshirildi: <b className="text-text">{qaytar.tekshirildi ?? 0}</b>
                              {' · '}Yozildi: <b className={qaytar.ozgardi ? 'text-ok' : 'text-text'}>
                                {qaytar.ozgardi ?? 0}</b>
                              {qaytar.hisob?.jami?.jami != null && (
                                <> {' · '}Yangi JAMI: <b className="text-text">
                                  {Number(qaytar.hisob.jami.jami).toLocaleString('ru-RU',
                                    { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></>
                              )}
                            </p>
                            {/* ⚠️ Ziddiyat JIM o'tkazilmaydi: bazada boshqa kimdir
                                o'zgartirgan qator YOZILMAGAN — buni aytish shart,
                                aks holda odam ishim saqlandi deb o'ylaydi. */}
                            {!!qaytar.ziddiyat?.length && (
                              <div className="mt-1.5 space-y-0.5">
                                <p className="text-[11px] text-warn">
                                  {qaytar.ziddiyat.length} qator YOZILMADI — bazada
                                  keyinroq o'zgartirilgan. Varaqni qayta chizing.
                                </p>
                                {qaytar.ziddiyat.slice(0, 8).map((z, i) => (
                                  <p key={i} className="text-[10px] text-text-mute">
                                    {z.qator}-qator · {z.nom} · {z.maydon}
                                  </p>
                                ))}
                              </div>
                            )}
                            {!!qaytar.xatolar?.length && (
                              <div className="mt-1.5 space-y-0.5">
                                {qaytar.xatolar.slice(0, 6).map((x, i) => (
                                  <p key={i} className="text-[10px] text-danger">{x}</p>
                                ))}
                              </div>
                            )}
                          </>
                        )}
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
