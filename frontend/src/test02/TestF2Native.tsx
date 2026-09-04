/**
 * TestF2Native.tsx — T2-GAS-EXIT-001: F2 act faylini o'qish va moslashtirish,
 * TO'LIQ GAS'siz (Cloudflare Worker: /api/f2-moslash -> readXlsx +
 * f2FaylOqiCore + f2MatchEngine, hammasi frontend/src/lib/f2-*).
 *
 * Bu — ushbu ko'chirilgan yadroning BIRINCHI jonli, bosiladigan sahifasi.
 * Mavjud GAS-asosli /admin/f2 (F2Import.tsx) sahifasiga HECH TEGILMAGAN —
 * bu alohida, parallel /admin/test/f2native yo'li (test02 konvensiyasi:
 * Tizim_01 ni buzmasdan Tizim_02 ni sinash).
 *
 * Doirasi (ataylab kichik, ops/handoff/T2_GAS_EXIT_001.md §Remaining):
 *  - Fayl base64 orqali yuboriladi (R2 saqlash YO'Q — hali faqat o'qish/
 *    moslashtirish, canonical fayl saqlash alohida ish).
 *  - LRV (smeta) daraxti hali qo'lda JSON sifatida kiritiladi — buni
 *    Supabase'dan olish ham alohida, hali loyihalanmagan ish.
 *  - Katta fayllar (>15MB) yoki katta LRV (>20 000 qator) rad etiladi —
 *    resumable job modeli hali qo'llanmagan.
 */
import { useState } from 'react';
import { CheckCircle2, FileUp, Loader2, Sparkles, TriangleAlert } from 'lucide-react';
import { Sahifa } from '../umumiy/ui/Sahifa';

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
  mosliklar?: unknown[];
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
  const [ishlayapti, setIshlayapti] = useState(false);
  const [xato, setXato] = useState('');
  const [faylOqiNatija, setFaylOqiNatija] = useState<FaylOqiJavob | null>(null);
  const [lrvJson, setLrvJson] = useState('');
  const [moslashNatija, setMoslashNatija] = useState<MoslashJavob | null>(null);

  async function faylTanlandi(file: File) {
    setIshlayapti(true); setXato(''); setFaylOqiNatija(null); setMoslashNatija(null);
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

  async function moslashniIshga() {
    if (!faylOqiNatija?.tree || !lrvJson.trim()) return;
    setIshlayapti(true); setXato(''); setMoslashNatija(null);
    try {
      const lrvTree = JSON.parse(lrvJson);
      const res = await postF2Moslash<MoslashJavob>({ amal: 'moslash', aktTree: faylOqiNatija.tree, lrvTree });
      setMoslashNatija(res);
    } catch (e) {
      setXato(e instanceof Error ? e.message : String(e));
    }
    setIshlayapti(false);
  }

  const counts = countTreeNodes(faylOqiNatija?.tree);

  return (
    <Sahifa
      sarlavha="F2 — GAS'siz (native)"
      tavsif="Fayl o'qish va moslashtirish endi Cloudflare'da ishlaydi — GAS umuman chaqirilmaydi (T2-GAS-EXIT-001)"
    >
      <div className="space-y-3 max-w-4xl">
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
                <Sparkles size={14} className="text-accent" /> LRV (smeta) daraxti — JSON (sinov uchun qo'lda)
              </label>
              <textarea
                value={lrvJson} onChange={(e) => setLrvJson(e.target.value)}
                placeholder='[{"type":"rz","nom":"...","children":[...]}]'
                rows={4}
                className="w-full bg-[var(--surface-2)] border border-border rounded-lg px-3 py-2
                           text-[11px] font-mono text-text outline-none focus:border-accent/50" />
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
            <div className="flex gap-5 text-[11px] text-text-dim">
              <span><b className="text-ok tabular-nums">{moslashNatija.stat.moslashti}</b> moslashti</span>
              <span><b className="text-warn tabular-nums">{moslashNatija.stat.otkazib}</b> o'tkazib yuborildi</span>
              {moslashNatija.stat.ms != null && <span>{moslashNatija.stat.ms} ms</span>}
            </div>
          </div>
        )}
      </div>
    </Sahifa>
  );
}
