/**
 * TestF2.tsx — TIZIM_02: SMETA / FAKT / F2 / QOLDIQ
 * ═══════════════════════════════════════════════════════════════════
 *
 * Reja (TIZIM_02_TAHLIL_VA_REJA.md) E bosqichi. Tizim_01 dagi eng
 * qimmatli ish sikli shu: smeta → bajarilgani (FAKT) → topshirilgani
 * (F2) → qoldiq.
 *
 * ⚠️ UCH QAT'IY QOIDA — tarixdan olingan, takrorlanmasin:
 *
 *  1. F2 O'Z NARXIDA. Akt summasi aktning o'z narxidan hisoblanadi,
 *     smeta narxidan EMAS. Avval smeta narxi ishlatilgani uchun akt
 *     2.11 mlrd bo'lsa panel 2.43 mlrd ko'rsatgan.
 *
 *  2. MANFIY HAJM RUXSAT. ПЕРЕРАСЧЁТ korrektirovkasi manfiy keladi.
 *     Tizim_01 da 4 joyda `>0` to'sig'i bor edi va bunday qatorlar jim
 *     tushib qolardi.
 *
 *  3. REESTR KAFOLATI. Hujjatda yozilgan jami ↔ bazaga tushgan jami
 *     solishtiriladi. Hujjat jami noma'lum bo'lsa «mos» DEB
 *     AYTILMAYDI — tekshirishning ikkinchi tomoni yo'q.
 *
 * Bu sahifa hozircha FAQAT O'QIYDI. F2 import yo'li keyingi qadam.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, CheckCircle, RefreshCw, FileText, TrendingUp, Search,
} from 'lucide-react';
import { Sahifa } from '../umumiy/ui/Sahifa';
import { FmtN } from '../lib/format';
import { sbOqi, sbT2ObyektlarOlKomp, type T2Obyekt } from '../api/supabase';
import { useKompaniya } from './KompaniyaTanlov';

type QatorHolat = {
  id: number; tur: string; raqam: string | null; nom: string | null;
  birlik: string | null; kat: string | null;
  smeta_summa: number | null; fakt_summa: number; f2_summa: number;
  qoldiq_summa: number | null; f2_mumkin_summa: number;
};

type Reestr = {
  id: number; tur: string; raqam: string | null; oy: string; holat: string;
  hujjat_jami: number | null; yozilgan_jami: number; farq: number | null;
  reestr_holat: string; qator_soni: number | null;
  narxsiz_qator: number | null; manfiy_qator: number | null;
};

const REESTR_RANG: Record<string, string> = {
  mos: 'text-ok',
  farq: 'text-danger',
  jami_nomalum: 'text-warn',
};
const REESTR_MATN: Record<string, string> = {
  mos: 'mos',
  farq: 'FARQ BOR',
  jami_nomalum: 'hujjat jami noma\'lum',
};

export default function TestF2() {
  const { joriy, yuklanmoqda: kompYuk } = useKompaniya();
  const [obyektlar, setObyektlar] = useState<T2Obyekt[]>([]);
  const [obyektId, setObyektId] = useState<number | null>(null);

  const [qatorlar, setQatorlar] = useState<QatorHolat[] | null>(null);
  const [reestr, setReestr] = useState<Reestr[]>([]);
  const [qidiruv, setQidiruv] = useState('');
  const [yuk, setYuk] = useState(false);
  const [xato, setXato] = useState('');

  useEffect(() => {
    if (kompYuk) return;
    sbT2ObyektlarOlKomp(joriy?.id).then((r) => {
      if (!r.ok) return;
      const o = (r.qatorlar as T2Obyekt[]) || [];
      setObyektlar(o);
      setObyektId((oldingi) => oldingi ?? (o[0]?.id ?? null));
    });
  }, [joriy?.id, kompYuk]);

  const yukla = useCallback(async () => {
    if (!obyektId) return;
    setYuk(true); setXato('');

    const [q, r] = await Promise.all([
      sbOqi<QatorHolat>({
        jadval: 't2_qator_holat',
        /* Faqat bajariladigan turlar — razdel/blok jamlanma, ular
           bolalarining yig'indisi va ikki marta sanalardi. */
        filtr: 'obyekt_id=eq.' + obyektId + '&tur=in.(rs,mat,ob)',
        ustunlar: 'id,tur,raqam,nom,birlik,kat,smeta_summa,fakt_summa,' +
                  'f2_summa,qoldiq_summa,f2_mumkin_summa',
        tartib: 'tartib.asc', limit: 20000,
      }),
      sbOqi<Reestr>({
        jadval: 't2_akt_reestr',
        filtr: 'obyekt_id=eq.' + obyektId,
        tartib: 'oy.desc', limit: 500,
      }),
    ]);

    setYuk(false);
    if (!q.ok) { setXato(q.error || 'O\'qilmadi'); return; }
    setQatorlar((q.qatorlar as QatorHolat[]) || []);
    setReestr(r.ok ? ((r.qatorlar as Reestr[]) || []) : []);
  }, [obyektId]);

  useEffect(() => { yukla(); }, [yukla]);

  const jami = (qatorlar || []).reduce((a, x) => ({
    smeta: a.smeta + (Number(x.smeta_summa) || 0),
    fakt: a.fakt + (Number(x.fakt_summa) || 0),
    f2: a.f2 + (Number(x.f2_summa) || 0),
  }), { smeta: 0, fakt: 0, f2: 0 });
  const qoldiq = jami.smeta - jami.fakt;
  const f2Mumkin = jami.fakt - jami.f2;

  const suz = (qatorlar || []).filter((x) => {
    const s = qidiruv.trim().toLowerCase();
    if (!s) return true;
    return String(x.nom || '').toLowerCase().includes(s);
  });
  /* Ish boshlangan qatorlar tepada — bo'sh ro'yxatni varaqlash foydasiz */
  const faol = suz.filter((x) => Number(x.fakt_summa) || Number(x.f2_summa));

  const KATAK = ({ nom, val, rang }: { nom: string; val: number; rang?: string }) => (
    <div className="karta p-3">
      <div className="text-[11px] text-text-dim mb-1">{nom}</div>
      <div className={'text-[15px] font-medium tabular-nums ' + (rang || 'text-text')}>
        <FmtN val={val} />
      </div>
    </div>
  );

  return (
    <Sahifa
      sarlavha="F2 / Fakt (Tizim_02)"
      tavsif="Smeta → bajarilgani → topshirilgani → qoldiq"
      amallar={
        <button onClick={yukla} disabled={yuk || !obyektId}
          className="h-9 px-3 inline-flex items-center gap-2 rounded-[10px] karta text-sm
                     text-text hover:border-[var(--accent)]/50 transition-colors
                     disabled:opacity-50">
          <RefreshCw size={15} className={yuk ? 'animate-spin' : ''} /> Yangilash
        </button>
      }
    >
      <div className="space-y-3">
        <div className="karta p-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[240px] flex-1">
            <label className="text-[12px] font-medium text-text block mb-1.5">Obyekt</label>
            <select value={obyektId ?? ''} onChange={(e) => setObyektId(Number(e.target.value))}
              className="w-full bg-[var(--surface-2)] border border-border rounded-lg
                         px-3 py-2 text-[13px] text-text outline-none focus:border-accent/50">
              {!obyektlar.length && <option value="">— obyekt yo'q —</option>}
              {obyektlar.map((o) => <option key={o.id} value={o.id}>{o.nom}</option>)}
            </select>
          </div>
          <div className="min-w-[200px] flex-1">
            <label className="text-[12px] font-medium text-text block mb-1.5">Qidiruv</label>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-mute" />
              <input value={qidiruv} onChange={(e) => setQidiruv(e.target.value)}
                placeholder="resurs nomi…"
                className="w-full bg-[var(--surface-2)] border border-border rounded-lg
                           pl-7 pr-3 py-2 text-[13px] text-text outline-none focus:border-accent/50" />
            </div>
          </div>
        </div>

        {xato && (
          <div className="karta p-4 border-danger/40 bg-danger/5">
            <p className="text-[13px] text-danger flex items-center gap-2">
              <AlertTriangle size={15} /> {xato}
            </p>
          </div>
        )}

        {/* ── JAMLANMA ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          <KATAK nom="СМЕТА" val={jami.smeta} />
          <KATAK nom="ФАКТ (bajarilgan)" val={jami.fakt} />
          <KATAK nom="Ф2 (topshirilgan)" val={jami.f2} />
          <KATAK nom="ҚОЛДИҚ (смета − факт)" val={qoldiq}
                 rang={qoldiq < 0 ? 'text-danger' : 'text-text'} />
          <KATAK nom="Ф2 МУМКИН (факт − ф2)" val={f2Mumkin}
                 rang={f2Mumkin < 0 ? 'text-danger' : 'text-ok'} />
        </div>

        {jami.fakt === 0 && jami.f2 === 0 && (
          <div className="karta p-4">
            <p className="text-[12px] text-text-mute">
              Bu obyektga hali FAKT yoki F2 kiritilmagan — shuning uchun bajarilgan
              va topshirilgan 0. Smeta esa{' '}
              <b className="text-text"><FmtN val={jami.smeta} /></b> so'm.
            </p>
          </div>
        )}

        {/* ── REESTR: qancha kirdi = qancha tushdi ── */}
        <div className="karta p-3">
          <p className="text-[12px] font-medium text-text mb-2 flex items-center gap-2">
            <FileText size={14} className="text-accent" />
            Hujjatlar reestri ({reestr.length})
          </p>
          <p className="text-[11px] text-text-mute mb-2">
            Har hujjat uchun: hujjatda yozilgan jami ↔ bazaga tushgan jami.
            Hujjat jami noma'lum bo'lsa «mos» deb aytilmaydi — tekshirishning
            ikkinchi tomoni yo'q.
          </p>
          {!reestr.length ? (
            <p className="text-[12px] text-text-mute italic">Hujjat kiritilmagan.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] min-w-[640px]">
                <thead>
                  <tr className="border-b border-border text-text-dim">
                    <th className="text-left py-1.5 font-medium w-16">Tur</th>
                    <th className="text-left py-1.5 font-medium w-24">Raqam</th>
                    <th className="text-left py-1.5 font-medium w-24">Oy</th>
                    <th className="text-right py-1.5 font-medium">Hujjatda</th>
                    <th className="text-right py-1.5 font-medium">Bazada</th>
                    <th className="text-right py-1.5 font-medium">Farq</th>
                    <th className="text-left py-1.5 font-medium w-36">Holat</th>
                  </tr>
                </thead>
                <tbody>
                  {reestr.map((a) => (
                    <tr key={a.id} className="border-b border-border last:border-0">
                      <td className="py-1 text-text uppercase">{a.tur}</td>
                      <td className="py-1 text-text-dim">{a.raqam || '—'}</td>
                      <td className="py-1 text-text-mute">{String(a.oy).slice(0, 7)}</td>
                      <td className="py-1 text-right tabular-nums text-text-dim">
                        {a.hujjat_jami == null
                          ? <span className="text-warn">noma'lum</span>
                          : <FmtN val={Number(a.hujjat_jami)} />}
                      </td>
                      <td className="py-1 text-right tabular-nums text-text">
                        <FmtN val={Number(a.yozilgan_jami) || 0} />
                      </td>
                      <td className="py-1 text-right tabular-nums">
                        {a.farq == null ? '—' : <FmtN val={Number(a.farq)} />}
                      </td>
                      <td className={'py-1 ' + (REESTR_RANG[a.reestr_holat] || 'text-text-mute')}>
                        {REESTR_MATN[a.reestr_holat] || a.reestr_holat}
                        {!!a.manfiy_qator && (
                          <span className="text-text-mute"> · {a.manfiy_qator} manfiy</span>
                        )}
                        {!!a.narxsiz_qator && (
                          <span className="text-warn"> · {a.narxsiz_qator} narxsiz</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── QATORLAR ── */}
        <div className="karta p-3">
          <p className="text-[12px] font-medium text-text mb-2 flex items-center gap-2">
            <TrendingUp size={14} className="text-accent" />
            Ish boshlangan qatorlar ({faol.length} / {suz.length})
          </p>
          {yuk && !qatorlar && <div className="skel h-24 rounded" />}
          {!!qatorlar && !faol.length && (
            <p className="text-[12px] text-text-mute italic">
              Hali bironta qatorga fakt yoki f2 kiritilmagan.
            </p>
          )}
          {!!faol.length && (
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-[11px] min-w-[720px]">
                <thead className="sticky top-0 bg-[var(--surface-1)]">
                  <tr className="border-b border-border text-text-dim">
                    <th className="text-left py-1.5 font-medium w-14">№</th>
                    <th className="text-left py-1.5 font-medium">Resurs</th>
                    <th className="text-left py-1.5 font-medium w-16">Birlik</th>
                    <th className="text-right py-1.5 font-medium">Смета</th>
                    <th className="text-right py-1.5 font-medium">Факт</th>
                    <th className="text-right py-1.5 font-medium">Ф2</th>
                    <th className="text-right py-1.5 font-medium">Қолдиқ</th>
                    <th className="text-right py-1.5 font-medium">Ф2 мумкин</th>
                  </tr>
                </thead>
                <tbody>
                  {faol.slice(0, 400).map((x) => (
                    <tr key={x.id} className="border-b border-border last:border-0">
                      <td className="py-1 text-text-mute">{x.raqam || ''}</td>
                      <td className="py-1 text-text truncate max-w-[260px]">{x.nom}</td>
                      <td className="py-1 text-text-mute">{x.birlik}</td>
                      <td className="py-1 text-right tabular-nums text-text-dim">
                        <FmtN val={Number(x.smeta_summa) || 0} />
                      </td>
                      <td className="py-1 text-right tabular-nums text-text">
                        <FmtN val={Number(x.fakt_summa) || 0} />
                      </td>
                      <td className="py-1 text-right tabular-nums text-text">
                        <FmtN val={Number(x.f2_summa) || 0} />
                      </td>
                      <td className={'py-1 text-right tabular-nums ' +
                        (Number(x.qoldiq_summa) < 0 ? 'text-danger' : 'text-text-dim')}>
                        {x.qoldiq_summa == null ? '—' : <FmtN val={Number(x.qoldiq_summa)} />}
                      </td>
                      <td className={'py-1 text-right tabular-nums ' +
                        (Number(x.f2_mumkin_summa) < 0 ? 'text-danger' : 'text-ok')}>
                        <FmtN val={Number(x.f2_mumkin_summa) || 0} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {faol.length > 400 && (
                <p className="text-[10px] text-text-mute pt-1">
                  … va yana {faol.length - 400} ta
                </p>
              )}
            </div>
          )}
        </div>

        <div className="karta p-3 border-accent/30 bg-accent/5">
          <p className="text-[11px] text-text-dim flex items-start gap-2">
            <CheckCircle size={13} className="text-accent flex-shrink-0 mt-0.5" />
            <span>
              Bu sahifa hozircha faqat <b>o'qiydi</b>. F2 hujjatini Excel'dan
              import qilish yo'li — keyingi qadam. Baza tayyor: manfiy
              korrektirovka qabul qilinadi, narx aktning o'zidan olinadi,
              narxsiz qator 0 emas <b>bo'sh</b> qoladi.
            </span>
          </p>
        </div>
      </div>
    </Sahifa>
  );
}
