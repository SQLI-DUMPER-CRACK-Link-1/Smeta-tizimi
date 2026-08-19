/**
 * TestImport.tsx — TIZIM_02: SMETA YUKLASH
 * ═══════════════════════════════════════════════════════════════════
 *
 * Foydalanuvchi: «kompyuterga yuklash degan narsa yo'qku bu yerda,
 * dropdown chiqayapdi. Uni bossa Tizim_01 lrv pluslari chiqayapdi».
 *
 * IKKALA E'TIROZ TO'G'RI EDI:
 *   1) Kompyuterdan yuklash yo'li YO'Q edi.
 *   2) Ro'yxat Tizim_01 skanidan kelardi — eski tizimning obyektlari va
 *      LRV_PLUS ishchi fayllari. Tizim_02 MUSTAQIL va BO'SH bo'lishi
 *      kerak edi, bunday ro'yxat esa uni eski tizimga bog'lab qo'yardi.
 *
 * ENDI: fayl kompyuterdan yuklanadi → Drive'dagi «Tizim_02/_MANBA»
 * papkasiga tushadi → varaqlari ko'rsatiladi → foydalanuvchi qaysi
 * varaq LOKALKA, qaysi biri SVODKA ekanini O'ZI belgilaydi → import
 * va hisob.
 *
 * ⚠️ TIZIM_01 GA TEGILMAYDI: yangi fayl butunlay boshqa papkaga tushadi.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, CheckCircle, AlertTriangle, Clock, ArrowRight,
  FileSpreadsheet, ExternalLink, FolderOpen, RefreshCw,
} from 'lucide-react';
import { Sahifa } from '../umumiy/ui/Sahifa';
import { toast } from '../umumiy/ui/Toast';
import { gas } from '../api/client';
import { useKompaniya } from './KompaniyaTanlov';

type Varaq = { nom: string; qator: number; ustun: number; taklif: string };
type Yuklash = {
  ok: boolean; xabar?: string; fayl_id?: string; nom?: string;
  konvert?: boolean; varaqlar?: Varaq[]; papka_url?: string; ms?: number;
};
type ImportNatija = {
  ok: boolean; obyekt?: string; xabar?: string; xatolar?: string[]; ms?: number;
  import?: Array<{ ok: boolean; varaq?: string; rol?: string; format?: string;
                   xom_qator?: number; xabar?: string;
                   vaqt?: { jami?: number } }>;
  hisob?: { ok: boolean; ms?: number;
            bosqichlar?: Array<{ bosqich: string; varaq?: string; ms?: number; natija?: any }>;
            jami?: any };
};

export default function TestImport() {
  const navigate = useNavigate();
  const { joriy } = useKompaniya();

  const [obyektNom, setObyektNom] = useState('');
  const [yuklash, setYuklash] = useState<Yuklash | null>(null);
  const [rollar, setRollar] = useState<Record<string, string>>({});
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [ketyapti, setKetyapti] = useState(false);
  const [natija, setNatija] = useState<ImportNatija | null>(null);

  const [kozgu, setKozgu] = useState<{ ok: boolean; url?: string; xabar?: string;
                                       qator?: number; ms?: number } | null>(null);
  const [kozguKetyapti, setKozguKetyapti] = useState(false);

  /* Avval yuklangan manba fayllar — qayta yuklamasdan ishlatish uchun */
  const [manbalar, setManbalar] = useState<Array<{ id: string; nom: string; sana: string }>>([]);
  const manbaYukla = () => {
    gas<any>('apiT2ManbaFayllar')
      .then((r) => { if (r.ok) setManbalar(r.fayllar || []); })
      .catch(() => {});
  };
  useEffect(() => { manbaYukla(); }, []);

  /* ── 1. Faylni kompyuterdan yuklash ── */
  const faylTanlandi = async (f: File | null) => {
    if (!f) return;
    setYuklanmoqda(true); setYuklash(null); setNatija(null); setKozgu(null);
    try {
      /* Faylni base64 ga o'giramiz. `FileReader` natijasi
         «data:...;base64,XXXX» ko'rinishida — vergulgacha kesamiz. */
      const b64: string = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result).split(',')[1] || '');
        fr.onerror = () => rej(new Error('Faylni o\'qib bo\'lmadi'));
        fr.readAsDataURL(f);
      });

      const r = await gas<Yuklash>('apiT2FaylYukla', f.name, b64, f.type);
      setYuklash(r);
      if (!r.ok) { toast(r.xabar || 'Yuklanmadi', 'danger', undefined, 9000); return; }

      /* Varaq rollarini serverning TAKLIFI bilan to'ldiramiz — lekin
         bu faqat boshlang'ich holat, foydalanuvchi o'zgartira oladi. */
      const boshlangich: Record<string, string> = {};
      (r.varaqlar || []).forEach((v) => { boshlangich[v.nom] = v.taklif || ''; });
      setRollar(boshlangich);

      /* Obyekt nomi kiritilmagan bo'lsa fayl nomidan taklif qilamiz */
      if (!obyektNom) setObyektNom(f.name.replace(/\.[^.]+$/, ''));
      toast('Fayl yuklandi — endi varaqlarni belgilang', 'ok');
      manbaYukla();
    } catch (e: any) {
      toast(e?.message || 'Xato', 'danger', undefined, 9000);
    } finally {
      setYuklanmoqda(false);
    }
  };

  /* ── 2. Import va hisob ── */
  const boshla = async () => {
    if (!yuklash?.fayl_id || !obyektNom.trim()) return;
    const varaqlar = Object.entries(rollar)
      .filter(([, rol]) => rol === 'lokalka' || rol === 'svodka')
      .map(([nom, rol]) => ({ nom, rol }));
    if (!varaqlar.some((v) => v.rol === 'lokalka')) {
      toast('Kamida bitta varaqni LOKALKA deb belgilang', 'warn'); return;
    }

    setKetyapti(true); setNatija(null);
    try {
      const r = await gas<ImportNatija>('apiT2YuklanganImport',
        obyektNom.trim(), yuklash.fayl_id, varaqlar);
      setNatija(r);
      toast(r.ok ? 'Import va hisob tugadi' : (r.xabar || 'Tugallanmadi'),
            r.ok ? 'ok' : 'danger', undefined, 9000);
    } catch (e: any) {
      setNatija({ ok: false, xabar: e?.message || String(e) });
      toast(e?.message || 'Xato', 'danger', undefined, 9000);
    } finally { setKetyapti(false); }
  };

  const kozguYarat = async () => {
    if (!obyektNom) return;
    setKozguKetyapti(true); setKozgu(null);
    try {
      const r = await gas<any>('apiT2KozguYarat', obyektNom.trim());
      setKozgu(r);
      toast(r.ok ? 'Sheets ko\'zgusi chizildi' : (r.xabar || 'Chizilmadi'),
            r.ok ? 'ok' : 'danger', undefined, 9000);
    } catch (e: any) {
      setKozgu({ ok: false, xabar: e?.message || String(e) });
    } finally { setKozguKetyapti(false); }
  };

  const jamiXom = (natija?.import || []).reduce((a, x) => a + (x.xom_qator || 0), 0);

  return (
    <Sahifa
      sarlavha="Smeta yuklash (Tizim_02)"
      tavsif="Faylni kompyuterdan yuklang — Tizim_01 dan mustaqil"
    >
      <div className="space-y-3 max-w-4xl">

        {/* ── QADAM 1: FAYL ── */}
        <div className="karta p-4">
          <p className="text-[12px] font-medium text-text mb-2">
            1-qadam · Smeta faylini yuklash
          </p>

          <label className="flex flex-col items-center justify-center gap-2 py-6
                            border-2 border-dashed border-border rounded-xl
                            cursor-pointer hover:border-accent/50 hover:bg-white/[0.02]
                            transition-colors">
            <Upload size={22} className="text-accent" />
            <span className="text-[13px] text-text">
              {yuklanmoqda ? 'Yuklanmoqda…' : 'Kompyuterdan fayl tanlang'}
            </span>
            <span className="text-[11px] text-text-mute">
              .xlsx · .xls · Google Sheets
            </span>
            <input type="file" className="hidden" disabled={yuklanmoqda}
              accept=".xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={(e) => faylTanlandi(e.target.files?.[0] || null)} />
          </label>

          <p className="text-[11px] text-text-mute mt-2">
            Fayl Drive'dagi <b>Tizim_02 / _MANBA</b> papkasiga saqlanadi
            (papka avtomat yaratiladi). Kompaniya: <b className="text-text-dim">
            {joriy?.nom || '—'}</b>.
          </p>

          {/* Avval yuklanganlar */}
          {!!manbalar.length && (
            <details className="mt-3">
              <summary className="text-[11px] text-text-mute cursor-pointer hover:text-text-dim
                                  inline-flex items-center gap-1.5">
                <FolderOpen size={12} /> Avval yuklangan fayllar ({manbalar.length})
              </summary>
              <div className="mt-1.5 max-h-40 overflow-auto space-y-0.5">
                {manbalar.slice(0, 40).map((m) => (
                  <div key={m.id} className="flex items-center gap-2 text-[10px]
                                             text-text-mute py-0.5">
                    <span className="flex-1 truncate">{m.nom}</span>
                    <span>{m.sana}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        {/* ── QADAM 2: VARAQLAR ── */}
        {yuklash?.ok && (
          <div className="karta p-4">
            <p className="text-[12px] font-medium text-text mb-1">
              2-qadam · Qaysi varaq nima?
            </p>
            <p className="text-[11px] text-text-mute mb-3">
              LOKALKA — ishlar va resurslar ro'yxati. SVODKA — narxlar manbai.
              Taklif avtomat qo'yilgan, lekin oxirgi qaror sizniki.
              {yuklash.konvert && ' Fayl Google Sheets ga o\'girildi.'}
            </p>

            <div className="space-y-1.5">
              {(yuklash.varaqlar || []).map((v) => (
                <div key={v.nom} className="flex flex-wrap items-center gap-2 p-2 rounded-lg
                                            bg-[var(--surface-2)]/40 border border-border">
                  <span className="flex-1 min-w-[160px] text-[12px] text-text truncate">
                    {v.nom}
                  </span>
                  <span className="text-[10px] text-text-mute">
                    {v.qator} × {v.ustun}
                  </span>
                  <select value={rollar[v.nom] || ''}
                    onChange={(e) => setRollar((p) => ({ ...p, [v.nom]: e.target.value }))}
                    className="bg-[var(--surface-3)] border border-border rounded px-2 py-1
                               text-[11px] text-text outline-none focus:border-accent/50">
                    <option value="">— o'tkazib yuborish —</option>
                    <option value="lokalka">LOKALKA (ishlar)</option>
                    <option value="svodka">SVODKA (narxlar)</option>
                  </select>
                </div>
              ))}
            </div>

            <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[240px]">
                <label className="text-[12px] font-medium text-text block mb-1.5">
                  Obyekt nomi (Tizim_02 da shu nom bilan turadi)
                </label>
                <input value={obyektNom} onChange={(e) => setObyektNom(e.target.value)}
                  placeholder="masalan: Amfiteatr — arxitektura"
                  className="w-full bg-[var(--surface-2)] border border-border rounded-lg
                             px-3 py-2 text-[13px] text-text outline-none focus:border-accent/50" />
              </div>
              <button onClick={boshla} disabled={ketyapti || !obyektNom.trim()}
                className="px-4 py-2 rounded-lg bg-accent text-white text-[13px] font-medium
                           hover:bg-accent/90 transition-colors disabled:opacity-40
                           inline-flex items-center gap-2">
                {ketyapti ? <Clock size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                {ketyapti ? 'Ishlanmoqda…' : 'Import va hisob'}
              </button>
            </div>
          </div>
        )}

        {yuklash && !yuklash.ok && (
          <div className="karta p-4 border-danger/40 bg-danger/5">
            <p className="text-[13px] text-danger flex items-center gap-2">
              <AlertTriangle size={15} /> {yuklash.xabar}
            </p>
          </div>
        )}

        {ketyapti && <div className="skel h-28 rounded-xl" />}

        {/* ── QADAM 3: NATIJA ── */}
        {natija && (
          <>
            <div className={`karta p-4 ${natija.ok
              ? 'border-ok/40 bg-ok/5' : 'border-danger/40 bg-danger/5'}`}>
              <p className={`text-[13px] font-medium flex items-center gap-2 mb-2 ${
                natija.ok ? 'text-ok' : 'text-danger'}`}>
                {natija.ok ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
                {natija.ok ? 'Import va hisob tugadi' : (natija.xabar || 'Tugallanmadi')}
              </p>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-text-dim">
                <span>Xom qator: <b className="text-text">{jamiXom}</b></span>
                {natija.ms != null && <span>Jami: <b className="text-text">{natija.ms} ms</b></span>}
                {natija.hisob?.ms != null && (
                  <span>Hisob: <b className="text-text">{natija.hisob.ms} ms</b></span>
                )}
              </div>

              {!!natija.xatolar?.length && (
                <div className="mt-2 rounded border border-danger/30 bg-danger/5 p-2">
                  {natija.xatolar.map((x, i) => (
                    <p key={i} className="text-[11px] text-danger">{x}</p>
                  ))}
                </div>
              )}

              {natija.ok && (
                <>
                  <button
                    onClick={() => navigate('/admin/test/daraxt?obyekt=' + encodeURIComponent(obyektNom))}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                               bg-accent/15 text-accent text-[12px] font-medium
                               hover:bg-accent/25 transition-colors">
                    Daraxtni ochish <ArrowRight size={13} />
                  </button>

                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-[11px] text-text-dim mb-2">
                      Odam o‘qiydigan hujjat kerakmi? Drive‘dagi <b>Tizim_02</b>
                      papkasiga Sheets ko‘zgusi chiziladi.
                    </p>
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
                            Chizildi
                            {kozgu.qator ? ' · ' + kozgu.qator + ' qator' : ''}
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

            {!!natija.hisob?.bosqichlar?.length && (
              <div className="karta p-3">
                <p className="text-[11px] uppercase tracking-wide text-text-dim mb-2">
                  Hisob bosqichlari (Postgres)
                </p>
                {natija.hisob.bosqichlar.map((b, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-x-3 text-[11px]
                                          border-b border-border last:border-0 py-1.5">
                    <span className="text-text w-24">{b.bosqich}</span>
                    {b.varaq && <span className="text-text-mute truncate max-w-[200px]">{b.varaq}</span>}
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
