/**
 * TezlikSinovi.tsx — SHEETS ↔ SUPABASE: TEZLIK VA TO'G'RILIK
 * ═══════════════════════════════════════════════════════════════════
 *
 * NIMA UCHUN BOR. Foydalanuvchi: «tezlikdan qoniqmayapman, Supabase'ni
 * juda tez deyapsan — o'shanga to'liq integratsiya qilib ko'rishimiz
 * kerak, boshlanishiga bir kichik test».
 *
 * Bu sahifa AYNAN shu: bitta obyektni IKKALA manbadan ham o'qiydi va
 * yonma-yon qo'yadi. Maqsad ikkitasi, va ikkinchisi birinchisidan
 * MUHIMROQ:
 *
 *   1) TEZLIK  — qaysi biri necha millisekundda javob beradi.
 *   2) TO'G'RILIK — raqamlar MOS KELADIMI. Tez, lekin noto'g'ri ko'zgu
 *      —  foydasiz va xatarli. Agar summalar farq qilsa, bu yerda
 *      DARHOL ko'rinadi va Supabase'ga o'tish TO'XTATILADI.
 *
 * ⚠️ Bu sahifa hech narsani O'ZGARTIRMAYDI — faqat o'qiydi va
 * solishtiradi. Yagona haqiqat manbai Google Sheets bo'lib qoladi.
 */
import { useState } from 'react';
import { Gauge, Database, FileSpreadsheet, CheckCircle, AlertTriangle, Play } from 'lucide-react';
import { Sahifa } from '../../umumiy/ui/Sahifa';
import { FmtN } from '../../lib/format';
import { useObyektlar } from '../../api/hooks';
import { gas } from '../../api/client';
import { sbHolatOl, sbDaraxtQur, type SbHolatQator } from '../../api/supabase';

type Jamlanma = { qatorlar: number; smeta: number; fakt: number; f2: number };
type Yon = { ms: number; jam: Jamlanma | null; xato?: string; sozlanmagan?: boolean };

/** GAS daraxtidan jamlanma — barcha tugunlarni aylanib chiqadi. */
function gasJamla(tree: any[]): Jamlanma {
  let qatorlar = 0, smeta = 0, fakt = 0, f2 = 0;
  (function yur(n: any[]) {
    for (const x of n || []) {
      if (x.type !== 'rz') {
        qatorlar++;
        /* Faqat ish (bl) darajasida yig'amiz — resurslar ishning ichida
           takror hisoblanmasin. Bu `apiBossObyekt` mantig'i bilan bir xil. */
        if (x.type === 'bl') {
          smeta += Number(x.smeta) || 0;
          fakt += Number(x.stFakt) || 0;
          f2 += Number(x.stF2) || 0;
        }
      }
      if (x.children?.length) yur(x.children);
    }
  })(tree);
  return { qatorlar, smeta, fakt, f2 };
}

/** Supabase tekis qatorlaridan AYNI qoida bo'yicha jamlanma. */
function sbJamla(qatorlar: SbHolatQator[]): Jamlanma {
  let n = 0, smeta = 0, fakt = 0, f2 = 0;
  for (const r of qatorlar) {
    n++;
    if (r.tur === 'bl') {
      smeta += Number(r.smeta_pul) || 0;
      fakt += Number(r.st_fakt) || 0;
      f2 += Number(r.st_f2) || 0;
    }
  }
  return { qatorlar: n, smeta, fakt, f2 };
}

/** Ikki son farqi — foizda. Ikkisi ham 0 bo'lsa farq yo'q. */
function farqFoiz(a: number, b: number): number {
  if (!a && !b) return 0;
  const katta = Math.max(Math.abs(a), Math.abs(b));
  return katta ? (Math.abs(a - b) / katta) * 100 : 0;
}

export default function TezlikSinovi() {
  const obyektlar = useObyektlar();
  const [obyekt, setObyekt] = useState('');
  const [ishlayapti, setIshlayapti] = useState(false);
  const [sheets, setSheets] = useState<Yon | null>(null);
  const [supa, setSupa] = useState<Yon | null>(null);

  const sinovOtkaz = async () => {
    if (!obyekt) return;
    setIshlayapti(true); setSheets(null); setSupa(null);

    /* ⚠️ KETMA-KET o'qiymiz, parallel EMAS: brauzer ulanishlari va
       Cloudflare navbati ikkisini bir-biriga sekinlashtirmasin —
       aks holda o'lchov yolg'on chiqadi. */
    const t1 = performance.now();
    try {
      const h = await gas<{ tree: any[] }>('apiHolatOl', obyekt);
      setSheets({ ms: Math.round(performance.now() - t1), jam: gasJamla(h?.tree || []) });
    } catch (e: any) {
      setSheets({ ms: Math.round(performance.now() - t1), jam: null, xato: e?.message || String(e) });
    }

    const r = await sbHolatOl(obyekt);
    if (!r.ok) {
      setSupa({ ms: r.ms || 0, jam: null, xato: r.error, sozlanmagan: r.sozlanmagan });
    } else {
      const q = r.qatorlar || [];
      setSupa({ ms: r.ms || 0, jam: sbJamla(q) });
      /* Daraxt qurilishini ham sinaymiz — tez, lekin ishlashi kerak */
      try { sbDaraxtQur(q); } catch { /* quruvchi yiqilsa jamlanma baribir ko'rinadi */ }
    }
    setIshlayapti(false);
  };

  const ikkalasiBor = !!sheets?.jam && !!supa?.jam;
  const tezlashuv = ikkalasiBor && supa!.ms > 0 ? sheets!.ms / supa!.ms : 0;
  const farqlar = ikkalasiBor ? {
    qatorlar: sheets!.jam!.qatorlar - supa!.jam!.qatorlar,
    smeta: farqFoiz(sheets!.jam!.smeta, supa!.jam!.smeta),
    fakt: farqFoiz(sheets!.jam!.fakt, supa!.jam!.fakt),
    f2: farqFoiz(sheets!.jam!.f2, supa!.jam!.f2),
  } : null;
  /* 0.5% — yaxlitlash farqi uchun chidam. Undan katta farq = ko'zgu eskirgan */
  const mosKeladi = farqlar
    ? farqlar.qatorlar === 0 && farqlar.smeta < 0.5 && farqlar.fakt < 0.5 && farqlar.f2 < 0.5
    : false;

  return (
    <Sahifa
      sarlavha="Tezlik sinovi"
      tavsif="Bitta obyektni Google Sheets va Supabase'dan o'qib solishtiradi — hech narsa o'zgarmaydi"
    >
      <div className="space-y-4 max-w-5xl">
        <div className="karta p-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[240px]">
              <label className="text-[12px] font-medium text-text block mb-1.5">
                Sinov uchun obyekt
              </label>
              {/* Ro’yxat kelmasa ham sinov o’tkazish MUMKIN bo’lishi kerak:
                  aynan tizim sekin/nosoz bo’lganda bu sahifa kerak bo’ladi,
                  o’shanda esa obyektlar ro’yxati ham kelmasligi mumkin.
                  Shuning uchun tanlash ham, qo’lda yozish ham bor. */}
              <input list="tezlik-obyektlar" value={obyekt}
                onChange={(e) => setObyekt(e.target.value)}
                placeholder="obyekt nomini tanlang yoki yozing"
                className="w-full bg-[var(--surface-2)] border border-border rounded-lg
                           px-3 py-2 text-[13px] text-text outline-none focus:border-accent/50" />
              <datalist id="tezlik-obyektlar">
                {(obyektlar.data ?? []).map((o: any) => (
                  <option key={o.obyekt} value={o.obyekt} />
                ))}
              </datalist>
              {obyektlar.isError && (
                <p className="text-[10px] text-warn mt-1">
                  Obyektlar ro’yxati kelmadi — nomni qo’lda yozing
                </p>
              )}
            </div>
            <button onClick={sinovOtkaz} disabled={!obyekt || ishlayapti}
              className="px-4 py-2 rounded-lg bg-accent text-white text-[13px] font-medium
                         hover:bg-accent/90 transition-colors disabled:opacity-40
                         inline-flex items-center gap-2">
              <Play size={15} />
              {ishlayapti ? 'O‘lchanmoqda…' : 'Sinovni boshlash'}
            </button>
          </div>
          <p className="text-[11px] text-text-mute mt-2">
            Ikkala manba KETMA-KET so‘raladi — bir-birini sekinlashtirmasligi uchun.
          </p>
        </div>

        {(sheets || supa) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Yonlama nom="Google Sheets (GAS)" Ikonka={FileSpreadsheet} yon={sheets} />
            <Yonlama nom="Supabase (ko‘zgu)" Ikonka={Database} yon={supa} />
          </div>
        )}

        {ikkalasiBor && (
          <div className="karta p-4">
            <h3 className="text-[14px] font-semibold text-text mb-3 flex items-center gap-2">
              <Gauge size={16} className="text-accent" /> Xulosa
            </h3>

            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-[28px] font-bold text-accent tabular-nums">
                {tezlashuv >= 1 ? tezlashuv.toFixed(1) + '×' : (1 / tezlashuv).toFixed(1) + '×'}
              </span>
              <span className="text-[13px] text-text-dim">
                {tezlashuv >= 1 ? 'Supabase tezroq' : 'Sheets tezroq'}
                {' '}({sheets!.ms} ms → {supa!.ms} ms)
              </span>
            </div>

            <div className={`rounded-lg border p-3 ${mosKeladi
              ? 'border-ok/40 bg-ok/5' : 'border-danger/40 bg-danger/5'}`}>
              <p className={`text-[13px] font-medium mb-2 flex items-center gap-2 ${
                mosKeladi ? 'text-ok' : 'text-danger'}`}>
                {mosKeladi ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
                {mosKeladi
                  ? 'Raqamlar MOS KELDI — ko‘zguga ishonish mumkin'
                  : 'Raqamlar FARQ QILDI — ko‘zgu eskirgan yoki to‘liq emas'}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <Farq nom="Qatorlar" a={sheets!.jam!.qatorlar} b={supa!.jam!.qatorlar} son />
                <Farq nom="Smeta" a={sheets!.jam!.smeta} b={supa!.jam!.smeta} />
                <Farq nom="Fakt" a={sheets!.jam!.fakt} b={supa!.jam!.fakt} />
                <Farq nom="Ф2" a={sheets!.jam!.f2} b={supa!.jam!.f2} />
              </div>
              {!mosKeladi && (
                <p className="text-[11px] text-text-dim mt-2">
                  Sabab odatda: bu obyekt oxirgi sinxronizatsiyadan keyin o‘zgargan.
                  Supabase sahifasidan to‘liq sinxronni ishga tushirib qayta sinang.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </Sahifa>
  );
}

function Yonlama({ nom, Ikonka, yon }:
  { nom: string; Ikonka: any; yon: Yon | null }) {
  return (
    <div className="karta p-4">
      <p className="text-[12px] font-medium text-text mb-2 flex items-center gap-2">
        <Ikonka size={15} className="text-accent" /> {nom}
      </p>
      {!yon && <div className="skel h-16 rounded" />}
      {yon && (
        <>
          <p className="text-[26px] font-bold text-text tabular-nums leading-none mb-2">
            {yon.ms} <span className="text-[13px] font-normal text-text-dim">ms</span>
          </p>
          {yon.xato ? (
            <p className={`text-[11px] ${yon.sozlanmagan ? 'text-warn' : 'text-danger'}`}>
              {yon.xato}
            </p>
          ) : yon.jam && (
            <div className="space-y-0.5 text-[11px] text-text-dim">
              <div>{yon.jam.qatorlar} qator</div>
              <div>Smeta: <FmtN val={yon.jam.smeta} /></div>
              <div>Fakt: <FmtN val={yon.jam.fakt} /></div>
              <div>Ф2: <FmtN val={yon.jam.f2} /></div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Farq({ nom, a, b, son }: { nom: string; a: number; b: number; son?: boolean }) {
  const teng = son ? a === b : farqFoiz(a, b) < 0.5;
  return (
    <div>
      <p className="text-text-mute mb-0.5">{nom}</p>
      <p className={teng ? 'text-ok' : 'text-danger font-medium'}>
        {teng ? 'teng' : (son ? `${a} ↔ ${b}` : `${farqFoiz(a, b).toFixed(2)}% farq`)}
      </p>
    </div>
  );
}
