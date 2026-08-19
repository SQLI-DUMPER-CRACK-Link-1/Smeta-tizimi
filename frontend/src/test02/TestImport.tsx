/**
 * TestImport.tsx — TIZIM_02: SMETA YUKLASH ESHIGI
 * ═══════════════════════════════════════════════════════════════════
 *
 * Foydalanuvchi: «hali hech smetalarni yuklash uchun bir joy yo'q…
 * yangi tizim uchun qayerdan smetalarni kiritaman, qayerdan uni
 * narxlayman, qayerdan bog'lanishlarni tekshiraman?»
 *
 * To'g'ri e'tiroz edi. Zanjir (GAS `apiT2ObyektImport` → `apiT2Ishla`)
 * ALLAQACHON yozilgan va ishlaydi, lekin uni ishga tushiradigan TUGMA
 * hech qayerda yo'q edi. Ya'ni poydevor qurilgan, eshik qo'yilmagan.
 *
 * Shu sahifa — o'sha eshik. Bitta joyda:
 *   1) Drive'dagi obyektni tanlash (Tizim_01 skani ishlatiladi)
 *   2) Import — GAS faqat O'QIYDI, xom qatorlarni bazaga yuboradi
 *   3) Hisob — markirovka → narxlash → jamlash (hammasi Postgres'da)
 *   4) Natija: nechta qator, nechtasi narxlanmagan, qancha vaqt ketdi
 *
 * ⚠️ TIZIM_01 GA TEGILMAYDI. Bu yerda Drive'dagi fayl faqat O'QILADI.
 * Na LRV_PLUS yaratiladi, na varaq o'zgartiriladi.
 */
import { useState } from 'react';
import { Upload, CheckCircle, AlertTriangle, Clock, ArrowRight,
         FileSpreadsheet, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Sahifa } from '../umumiy/ui/Sahifa';
import { toast } from '../umumiy/ui/Toast';
import { useObyektlar } from '../api/hooks';
import { gas } from '../api/client';
import { useKompaniya } from './KompaniyaTanlov';

type ImportNatija = {
  ok: boolean;
  obyekt?: string;
  xabar?: string;
  xatolar?: string[];
  ms?: number;
  import?: Array<{
    ok: boolean; varaq?: string; rol?: string; format?: string;
    xom_qator?: number; xabar?: string;
    vaqt?: { oqish?: number; merge?: number; yuklash?: number; jami?: number };
  }>;
  hisob?: {
    ok: boolean; ms?: number;
    bosqichlar?: Array<{ bosqich: string; varaq?: string; ms?: number; natija?: any }>;
    jami?: any;
  };
};

export default function TestImport() {
  const navigate = useNavigate();
  const { joriy } = useKompaniya();
  /* Obyektlar ro'yxati Tizim_01 skanidan — Drive'da nima borligini
     faqat u biladi. Bu O'QISH, Tizim_01 ga ta'sir qilmaydi. */
  const obyektlar = useObyektlar();

  const [obyekt, setObyekt] = useState('');
  const [ketyapti, setKetyapti] = useState(false);
  const [natija, setNatija] = useState<ImportNatija | null>(null);

  /* Sheets ko'zgusi — Drive'dagi «Tizim_02» papkasiga chiziladi.
     Foydalanuvchi: «hujjatlar uchun drive da hali joy yo'q».
     Papka GAS tomonda AVTOMAT yaratiladi (`_t2KozguPapka`) — bu yerda
     faqat tugma yetishmayotgan edi. */
  const [kozgu, setKozgu] = useState<{
    ok: boolean; url?: string; xabar?: string; qator?: number; ms?: number;
  } | null>(null);
  const [kozguKetyapti, setKozguKetyapti] = useState(false);

  const kozguYarat = async () => {
    if (!obyekt) return;
    setKozguKetyapti(true); setKozgu(null);
    try {
      const r = await gas<any>('apiT2KozguYarat', obyekt);
      setKozgu(r);
      toast(r.ok ? 'Sheets ko\'zgusi chizildi' : (r.xabar || 'Chizilmadi'),
            r.ok ? 'ok' : 'danger', undefined, 9000);
    } catch (e: any) {
      setKozgu({ ok: false, xabar: e?.message || String(e) });
      toast(e?.message || 'Xato', 'danger', undefined, 9000);
    } finally {
      setKozguKetyapti(false);
    }
  };

  const boshla = async () => {
    if (!obyekt) return;
    setKetyapti(true); setNatija(null);
    try {
      /* ⚠️ Bu og'ir chaqiruv: GAS faylni ochadi, o'qiydi va bazaga
         yuboradi, keyin Postgres hisoblaydi. Katta smetada bir necha
         o'n soniya olishi mumkin — foydalanuvchiga aytamiz. */
      const r = await gas<ImportNatija>('apiT2ObyektImport', obyekt);
      setNatija(r);
      if (r.ok) toast('Import va hisob tugadi', 'ok');
      else toast(r.xabar || 'Import tugallanmadi', 'danger', undefined, 9000);
    } catch (e: any) {
      setNatija({ ok: false, xabar: e?.message || String(e) });
      toast(e?.message || 'Xato', 'danger', undefined, 9000);
    } finally {
      setKetyapti(false);
    }
  };

  const jamiXom = (natija?.import || []).reduce((a, x) => a + (x.xom_qator || 0), 0);
  const rollup = natija?.hisob?.jami;

  return (
    <Sahifa
      sarlavha="Smeta yuklash (Tizim_02)"
      tavsif="Drive'dagi fayl O'QILADI → xom qatorlar bazaga → Postgres hisoblaydi"
    >
      <div className="space-y-3 max-w-4xl">
        <div className="karta p-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[280px]">
              <label className="text-[12px] font-medium text-text block mb-1.5">
                Drive'dagi obyekt
              </label>
              <input list="import-obyektlar" value={obyekt}
                onChange={(e) => setObyekt(e.target.value)}
                placeholder="obyekt nomini tanlang yoki yozing"
                className="w-full bg-[var(--surface-2)] border border-border rounded-lg
                           px-3 py-2 text-[13px] text-text outline-none focus:border-accent/50" />
              <datalist id="import-obyektlar">
                {(obyektlar.data ?? []).map((o: any) => (
                  <option key={o.obyekt} value={o.obyekt} />
                ))}
              </datalist>
            </div>
            <button onClick={boshla} disabled={!obyekt || ketyapti}
              className="px-4 py-2 rounded-lg bg-accent text-white text-[13px] font-medium
                         hover:bg-accent/90 transition-colors disabled:opacity-40
                         inline-flex items-center gap-2">
              {ketyapti ? <Clock size={15} className="animate-spin" /> : <Upload size={15} />}
              {ketyapti ? 'Ishlanmoqda…' : 'Import va hisob'}
            </button>
          </div>

          <div className="mt-2.5 text-[11px] text-text-mute space-y-1">
            <p>
              Ketma-ketlik: <b>lokalka + svodka o'qiladi</b> → xom qatorlar bazaga →
              markirovka → narxlash → jamlash. Hammasi bitta tugmada.
            </p>
            <p>
              Kompaniya: <b className="text-text-dim">{joriy?.nom || '—'}</b>.
              Katta smetada bir necha o'n soniya ketishi mumkin — kutib turing.
            </p>
            <p className="text-warn">
              ⚠️ Drive'dagi fayl faqat O'QILADI. Tizim_01 ga tegilmaydi:
              na LRV_PLUS yaratiladi, na varaq o'zgaradi.
            </p>
          </div>
        </div>

        {ketyapti && <div className="skel h-32 rounded-xl" />}

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
                <button
                  onClick={() => navigate('/admin/test/daraxt?obyekt=' + encodeURIComponent(obyekt))}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                             bg-accent/15 text-accent text-[12px] font-medium
                             hover:bg-accent/25 transition-colors">
                  Daraxtni ochish <ArrowRight size={13} />
                </button>
              )}

              {/* ── Sheets ko'zgusi (Drive'dagi «Tizim_02» papkasi) ── */}
              {natija.ok && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-[11px] text-text-dim mb-2">
                    Odam o‘qiydigan hujjat kerakmi? Drive‘dagi <b>Tizim_02</b> papkasiga
                    Sheets ko‘zgusi chiziladi — papka birinchi safar avtomat yaratiladi.
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
                          {kozgu.ms ? ' · ' + kozgu.ms + ' ms' : ''}
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
              )}
            </div>

            {/* ── O'qilgan fayllar ── */}
            {!!natija.import?.length && (
              <div className="karta p-3">
                <p className="text-[11px] uppercase tracking-wide text-text-dim mb-2">
                  O'qilgan varaqlar
                </p>
                <div className="space-y-1">
                  {natija.import.map((f, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]
                                            border-b border-border last:border-0 py-1.5">
                      <span className={f.ok ? 'text-ok' : 'text-danger'}>
                        {f.ok ? '✓' : '✗'}
                      </span>
                      <span className="text-text">{f.varaq || '—'}</span>
                      <span className="text-text-mute">{f.rol}</span>
                      {f.format && <span className="text-text-mute">{f.format}</span>}
                      {f.xom_qator != null && (
                        <span className="text-text-dim">{f.xom_qator} qator</span>
                      )}
                      {f.vaqt?.jami != null && (
                        <span className="text-text-mute">{f.vaqt.jami} ms</span>
                      )}
                      {!f.ok && f.xabar && <span className="text-danger">{f.xabar}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Hisob bosqichlari ── */}
            {!!natija.hisob?.bosqichlar?.length && (
              <div className="karta p-3">
                <p className="text-[11px] uppercase tracking-wide text-text-dim mb-2">
                  Hisob bosqichlari (Postgres)
                </p>
                <div className="space-y-1">
                  {natija.hisob.bosqichlar.map((b, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-x-3 text-[11px]
                                            border-b border-border last:border-0 py-1.5">
                      <span className="text-text w-24">{b.bosqich}</span>
                      {b.varaq && <span className="text-text-mute truncate max-w-[220px]">{b.varaq}</span>}
                      <span className="text-text-dim">{b.ms} ms</span>
                      {b.natija && typeof b.natija === 'object' && (
                        <span className="text-text-mute font-mono text-[10px]">
                          {Object.entries(b.natija)
                            .filter(([k]) => k !== 'ok')
                            .slice(0, 6)
                            .map(([k, v]) => `${k}=${v}`)
                            .join(' · ')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                {rollup && typeof rollup === 'object' && (
                  <div className="mt-2 pt-2 border-t border-border text-[11px] text-text-dim">
                    <span className="text-text-mute">Jamlash natijasi: </span>
                    <span className="font-mono text-[10px]">
                      {Object.entries(rollup).slice(0, 8).map(([k, v]) => `${k}=${v}`).join(' · ')}
                    </span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Sahifa>
  );
}
