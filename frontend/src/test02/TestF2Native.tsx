/**
 * TestF2Native.tsx — T2-GAS-EXIT-001: F2 act faylini o'qish, moslashtirish
 * VA Supabase'ga yozish — TO'LIQ GAS'siz uchidan-uchigacha (Cloudflare
 * Worker: /api/f2-moslash -> readXlsx + f2FaylOqiCore + f2MatchEngine;
 * LRV daraxti `t2_daraxt`dan, canonical Supabase smeta, o'qiladi; yozish
 * `/api/sb-yoz` `akt_yarat` -> `t2_akt_yarat` RPC orqali — bularning
 * hammasi frontend/src/lib/f2-* va frontend/src/api/supabase.ts).
 *
 * Bu — ushbu ko'chirilgan yadroning BIRINCHI jonli sahifasi qayerda
 * Supabase'ga HAQIQIY yozuv sodir bo'ladi (avval faqat moslashtirish
 * xotirada tugardi). Mavjud GAS-asosli /admin/f2 (F2Import.tsx)
 * sahifasiga HECH TEGILMAGAN — bu alohida, parallel /admin/test/f2native
 * yo'li (test02 konvensiyasi: Tizim_01 ni buzmasdan Tizim_02 ni sinash).
 *
 * Doirasi (ataylab kichik, ops/handoff/T2_GAS_EXIT_001.md §Remaining):
 *  - Fayl base64 orqali yuboriladi (R2 saqlash YO'Q — hali faqat o'qish/
 *    moslashtirish, canonical fayl saqlash alohida ish).
 *  - LRV daraxti Supabase `t2_daraxt`dan o'qiladi va `row` ataylab
 *    HAQIQIY `qator_id` qilib qo'yiladi — shu bitta tanlov moslashgan
 *    qatorlarni to'g'ridan-to'g'ri `t2_akt_yarat`ga yozishga imkon
 *    beradi, qo'shimcha id-xaritalash qatlamisiz.
 *  - Katta fayllar (>15MB) yoki katta LRV (>20 000 qator) rad etiladi —
 *    resumable job modeli hali qo'llanmagan.
 */
import { useEffect, useState } from 'react';
import { CheckCircle2, FileUp, Loader2, Send, Sparkles, TriangleAlert } from 'lucide-react';
import { Sahifa } from '../umumiy/ui/Sahifa';
import { useKompaniya } from './KompaniyaTanlov';
import {
  sbT2AktYarat, sbT2DaraxtOl, sbT2ObyektlarOlKomp, yangiOperationId,
  type AktNatija, type T2Obyekt, type T2Qator,
} from '../api/supabase';
import type { F2Match, F2NodeType, LrvNode } from '../lib/f2-match-engine';

interface FaylOqiJavob {
  ok: boolean;
  code?: string;
  xabar?: string;
  sheetName?: string;
  sheetNames?: string[];
  mode?: 'config';
  hasMarker?: boolean;
  cols?: Record<string, number>;
  tree?: unknown[];
  stat?: never;
}
interface MoslashJavob {
  ok: boolean;
  code?: string;
  xabar?: string;
  mosliklar?: F2Match[];
  stat?: { moslashti: number; otkazib: number; ms?: number };
}

function countTreeNodes(tree: unknown[] | undefined): Record<string, number> {
  const counts: Record<string, number> = {};
  function walk(nodes: unknown[]) {
    for (const n of nodes) {
      const node = n as { type: string; children?: unknown[] };
      counts[node.type] = (counts[node.type] || 0) + 1;
      if (node.children) walk(node.children);
    }
  }
  walk(tree || []);
  return counts;
}

/**
 * `t2_daraxt` (flat, `ota_id` bilan) -> `LrvNode[]` (ichma-ich, matcher
 * kutgan shakl). `row` ataylab HAQIQIY `qator_id`: moslashtirish
 * natijasi (`F2Match.row`) shu tufayli o'zgarishsiz `t2_akt_yarat`ning
 * `p_qatorlar[].qator_id` sifatida ishlatiladi.
 * `varaq` doim bitta qiymat — engine node-ni band qilishda `varaq+row`
 * ishlatadi, `row` (=qator_id) allaqachon obyekt ichida yagona bo'lgani
 * uchun `varaq`ning aniq qiymati muhim emas.
 */
function daraxtdanLrvQur(qatorlar: T2Qator[]): LrvNode[] {
  const tugunlar = new Map<number, LrvNode>();
  const ildizlar: LrvNode[] = [];
  for (const q of qatorlar) {
    tugunlar.set(q.id, {
      type: (q.tur || 'mat') as F2NodeType,
      kod: q.kod || undefined,
      nom: q.nom || undefined,
      birlik: q.birlik || undefined,
      varaq: 'SB', row: q.id,
      children: [],
    });
  }
  for (const q of qatorlar) {
    const tugun = tugunlar.get(q.id)!;
    const ota = q.ota_id != null ? tugunlar.get(q.ota_id) : undefined;
    if (ota) (ota.children as LrvNode[]).push(tugun);
    else ildizlar.push(tugun);
  }
  return ildizlar;
}

async function postF2Moslash<T>(body: Record<string, unknown>): Promise<T> {
  const r = await fetch('/api/f2-moslash', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.xabar || j?.code || 'HTTP ' + r.status);
  return j as T;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function TestF2Native() {
  const { joriy, yuklanmoqda: kompYuk } = useKompaniya();
  const [obyektlar, setObyektlar] = useState<T2Obyekt[]>([]);
  const [obyektId, setObyektId] = useState<number | null>(null);

  const [ishlayapti, setIshlayapti] = useState(false);
  const [xato, setXato] = useState('');
  const [faylOqiNatija, setFaylOqiNatija] = useState<FaylOqiJavob | null>(null);

  const [lrvYuk, setLrvYuk] = useState(false);
  const [lrvJson, setLrvJson] = useState('');
  const [lrvManba, setLrvManba] = useState<'' | 'sb' | 'qolda'>('');
  const [moslashNatija, setMoslashNatija] = useState<MoslashJavob | null>(null);

  const [tur, setTur] = useState<'fakt' | 'f2'>('f2');
  const [oy, setOy] = useState(() => new Date().toISOString().slice(0, 7));
  const [opId, setOpId] = useState('');
  const [yozilmoqda, setYozilmoqda] = useState(false);
  const [yozNatija, setYozNatija] = useState<AktNatija | null>(null);

  useEffect(() => {
    if (kompYuk) return;
    if (!joriy?.id) { setObyektlar([]); setObyektId(null); return; }
    sbT2ObyektlarOlKomp(joriy.id).then((r) => {
      if (!r.ok) return;
      const o = (r.qatorlar as T2Obyekt[]) || [];
      setObyektlar(o);
      setObyektId((oldingi) => oldingi ?? (o[0]?.id ?? null));
    });
  }, [joriy?.id, kompYuk]);

  async function faylTanlandi(file: File) {
    setIshlayapti(true); setXato(''); setFaylOqiNatija(null); setMoslashNatija(null); setYozNatija(null);
    try {
      const fileBase64 = await fileToBase64(file);
      // 1-bosqich: ustunlarni avto-aniqlash (colConfig'siz so'rov)
      const preview = await postF2Moslash<FaylOqiJavob>({ amal: 'fayl_oqi', fileBase64 });
      if (!preview.ok) { setXato(preview.xabar || preview.code || 'Xatolik'); setIshlayapti(false); return; }
      // 2-bosqich: avto-aniqlangan ustunlar bilan darhol daraxt qurish
      const built = await postF2Moslash<FaylOqiJavob>({ amal: 'fayl_oqi', fileBase64, colConfig: preview.cols });
      setFaylOqiNatija(built);
    } catch (e) {
      setXato(e instanceof Error ? e.message : String(e));
    }
    setIshlayapti(false);
  }

  async function lrvSupabasedanYukla() {
    if (!obyektId) return;
    setLrvYuk(true); setXato('');
    const r = await sbT2DaraxtOl(obyektId);
    setLrvYuk(false);
    if (!r.ok) { setXato(r.error || 'Smeta daraxti o\'qilmadi'); return; }
    const tree = daraxtdanLrvQur((r.qatorlar as T2Qator[]) || []);
    setLrvJson(JSON.stringify(tree));
    setLrvManba('sb');
  }

  async function moslashniIshga() {
    if (!faylOqiNatija?.tree || !lrvJson.trim()) return;
    setIshlayapti(true); setXato(''); setMoslashNatija(null); setYozNatija(null);
    try {
      const lrvTree = JSON.parse(lrvJson);
      const res = await postF2Moslash<MoslashJavob>({ amal: 'moslash', aktTree: faylOqiNatija.tree, lrvTree });
      setMoslashNatija(res);
      if (res.ok) setOpId(yangiOperationId());
    } catch (e) {
      setXato(e instanceof Error ? e.message : String(e));
    }
    setIshlayapti(false);
  }

  async function hujjatgaYoz() {
    if (!obyektId || !moslashNatija?.mosliklar?.length || lrvManba !== 'sb') return;
    setYozilmoqda(true); setXato('');
    const qatorlar = moslashNatija.mosliklar
      .filter((m) => Number.isFinite(m.row) && Number.isFinite(m.hajm))
      .map((m) => ({ qator_id: m.row, hajm: m.hajm as number, narx: Number.isFinite(m.narx) ? m.narx : undefined }));
    const r = await sbT2AktYarat({ obyektId, tur, oy: oy + '-01', qatorlar, operationId: opId });
    setYozilmoqda(false);
    setYozNatija(r);
  }

  const counts = countTreeNodes(faylOqiNatija?.tree);

  return (
    <Sahifa
      sarlavha="F2 — GAS'siz (native)"
      tavsif="O'qish, moslashtirish VA Supabase'ga yozish endi Cloudflare'da ishlaydi — GAS umuman chaqirilmaydi (T2-GAS-EXIT-001)"
    >
      <div className="space-y-3 max-w-4xl">
        <div className="karta p-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[240px] flex-1">
            <label className="text-[12px] font-medium text-text block mb-1.5">Obyekt (Supabase — canonical smeta)</label>
            <select value={obyektId ?? ''} onChange={(e) => setObyektId(Number(e.target.value))}
              className="w-full bg-[var(--surface-2)] border border-border rounded-lg
                         px-3 py-2 text-[13px] text-text outline-none focus:border-accent/50">
              {!obyektlar.length && <option value="">— obyekt yo'q —</option>}
              {obyektlar.map((o) => <option key={o.id} value={o.id}>{o.nom}</option>)}
            </select>
          </div>
        </div>

        <div className="karta p-4">
          <label className="flex items-center gap-2 text-[13px] font-medium text-text mb-2">
            <FileUp size={15} className="text-accent" /> F2 akt faylini tanlang (.xlsx)
          </label>
          <input
            type="file" accept=".xlsx,.xlsm"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void faylTanlandi(f); }}
            disabled={ishlayapti}
            className="text-[12px] text-text-dim file:mr-3 file:px-3 file:py-1.5 file:rounded-lg
                       file:border-0 file:bg-accent/15 file:text-accent file:text-[12px] file:font-medium" />
          <p className="text-[11px] text-text-mute mt-2">
            Fayl brauzerdan to'g'ridan-to'g'ri Cloudflare'ga yuboriladi — Google Drive/Sheets/GAS ishtirok etmaydi.
          </p>
        </div>

        {ishlayapti && (
          <div className="karta p-4 flex items-center gap-2 text-[13px] text-text-dim">
            <Loader2 size={15} className="animate-spin text-accent" /> Ishlanmoqda…
          </div>
        )}

        {xato && (
          <div className="karta p-4 border-danger/40 bg-danger/5">
            <p className="text-[13px] text-danger flex items-center gap-2">
              <TriangleAlert size={15} /> {xato}
            </p>
          </div>
        )}

        {faylOqiNatija?.ok && (
          <div className="karta p-4">
            <p className="text-[13px] font-medium text-text mb-3 flex items-center gap-2">
              <CheckCircle2 size={15} className="text-ok" /> "{faylOqiNatija.sheetName}" o'qildi
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-text-dim mb-3">
              {Object.entries(counts).map(([type, n]) => (
                <span key={type}><b className="text-text tabular-nums">{n}</b> {type}</span>
              ))}
            </div>
            <p className="text-[11px] text-text-mute">
              Varaqlar: {faylOqiNatija.sheetNames?.join(', ')}
            </p>

            <div className="mt-4 pt-4 border-t border-border">
              <label className="text-[12px] font-medium text-text block mb-1.5 flex items-center gap-2">
                <Sparkles size={14} className="text-accent" /> LRV (smeta) daraxti
              </label>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <button onClick={() => void lrvSupabasedanYukla()} disabled={!obyektId || lrvYuk}
                  className="px-3 py-1.5 rounded-lg karta text-[12px] font-medium text-text
                             hover:border-[var(--accent)]/50 transition-colors disabled:opacity-40
                             inline-flex items-center gap-1.5">
                  {lrvYuk ? <Loader2 size={13} className="animate-spin" /> : null}
                  Supabase smetasidan yuklash ({obyektlar.find((o) => o.id === obyektId)?.nom || '—'})
                </button>
                {lrvManba === 'sb' && (
                  <span className="text-[11px] text-ok">✓ Supabase `t2_daraxt`dan yuklandi — to'g'ridan-to'g'ri yozish mumkin</span>
                )}
              </div>
              <textarea
                value={lrvJson}
                onChange={(e) => { setLrvJson(e.target.value); setLrvManba('qolda'); }}
                placeholder='[{"type":"rz","nom":"...","children":[...]}]  (yoki yuqoridagi tugma bilan Supabase-dan yuklang)'
                rows={4}
                className="w-full bg-[var(--surface-2)] border border-border rounded-lg px-3 py-2
                           text-[11px] font-mono text-text outline-none focus:border-accent/50" />
              {lrvManba === 'qolda' && (
                <p className="text-[11px] text-warn mt-1">
                  Qo'lda kiritilgan JSON — bunda `row` haqiqiy `qator_id` bo'lmasa, natijani Supabase'ga to'g'ridan yozib bo'lmaydi.
                </p>
              )}
              <button onClick={() => void moslashniIshga()} disabled={!lrvJson.trim() || ishlayapti}
                className="mt-2 px-4 py-2 rounded-lg bg-accent text-white text-[13px] font-medium
                           hover:bg-accent/90 transition-colors disabled:opacity-40">
                Moslashtirish (f2MatchEngine)
              </button>
            </div>
          </div>
        )}

        {moslashNatija?.ok && moslashNatija.stat && (
          <div className="karta p-4">
            <p className="text-[13px] font-medium text-text mb-2">Moslashtirish natijasi</p>
            <div className="flex gap-5 text-[11px] text-text-dim mb-3">
              <span><b className="text-ok tabular-nums">{moslashNatija.stat.moslashti}</b> moslashti</span>
              <span><b className="text-warn tabular-nums">{moslashNatija.stat.otkazib}</b> o'tkazib yuborildi</span>
              {moslashNatija.stat.ms != null && <span>{moslashNatija.stat.ms} ms</span>}
            </div>

            {lrvManba === 'sb' ? (
              <div className="pt-3 border-t border-border">
                <p className="text-[12px] font-medium text-text mb-2 flex items-center gap-2">
                  <Send size={14} className="text-accent" /> Supabase'ga yozish (`t2_akt_yarat`)
                </p>
                <div className="flex flex-wrap items-end gap-2 mb-2">
                  <div>
                    <label className="text-[11px] text-text-dim block mb-1">Tur</label>
                    <select value={tur} onChange={(e) => setTur(e.target.value as 'fakt' | 'f2')}
                      className="bg-[var(--surface-2)] border border-border rounded-lg px-2 py-1.5 text-[12px] text-text">
                      <option value="f2">f2</option>
                      <option value="fakt">fakt</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-text-dim block mb-1">Oy</label>
                    <input type="month" value={oy} onChange={(e) => setOy(e.target.value)}
                      className="bg-[var(--surface-2)] border border-border rounded-lg px-2 py-1.5 text-[12px] text-text" />
                  </div>
                  <button onClick={() => void hujjatgaYoz()}
                    disabled={yozilmoqda || !moslashNatija.mosliklar?.length}
                    className="px-4 py-1.5 rounded-lg bg-accent text-white text-[12px] font-medium
                               hover:bg-accent/90 transition-colors disabled:opacity-40 inline-flex items-center gap-1.5">
                    {yozilmoqda ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                    Hujjat yaratish ({moslashNatija.mosliklar?.length || 0} qator)
                  </button>
                </div>
                {yozNatija && (
                  <p className={'text-[12px] ' + (yozNatija.ok ? 'text-ok' : 'text-danger')}>
                    {yozNatija.ok
                      ? (yozNatija.takror ? '✓ Bu hujjat allaqachon yaratilgan' : `✓ Hujjat yaratildi — ${yozNatija.qator_soni ?? '?'} qator, jami ${yozNatija.jami ?? '?'}`)
                      : `✗ ${yozNatija.xabar || yozNatija.error || 'Yaratilmadi'}`}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-text-mute pt-3 border-t border-border">
                Supabase'ga yozish uchun LRV daraxtini yuqoridagi "Supabase smetasidan yuklash" tugmasi bilan oling
                (qo'lda kiritilgan `row` qiymatlari haqiqiy `qator_id` emas).
              </p>
            )}
          </div>
        )}
      </div>
    </Sahifa>
  );
}
