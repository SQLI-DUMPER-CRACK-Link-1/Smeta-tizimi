/**
 * TestSmetaBirlashgan.tsx — 2026-08-27
 * ═══════════════════════════════════════════════════════════════════
 * Foydalanuvchi: "smeta yuklash, f2 fakt, f2 import kabilar bitta
 * tabda bo'lishi kerak".
 *
 * Uchta mustaqil, murakkab sahifa (TestImport/TestF2/TestF2Import)
 * BIR faylga QAYTA YOZILMAYDI — bu xavfli (ayniqsa F2 import mantiqi
 * juda nozik). Buning o'rniga ICHKI sub-tab bilan bittasi ko'rsatiladi,
 * uchalasining o'z kodi teginilmagan holda qoladi.
 */
import { useState } from 'react';
import { Upload, TrendingUp, FileInput, ShieldAlert } from 'lucide-react';
import TestImport from './TestImport';
import TestF2 from './TestF2';
import TestF2Import from './TestF2Import';
import TestNarxNazorati from './TestNarxNazorati';

const ICHKI_TAB = [
  { kalit: 'yuklash', nom: 'Smeta yuklash', Ikonka: Upload, Komponent: TestImport },
  { kalit: 'f2fakt',  nom: 'F2 / Fakt',     Ikonka: TrendingUp, Komponent: TestF2 },
  { kalit: 'import',  nom: 'F2 import',     Ikonka: FileInput, Komponent: TestF2Import },
  /* T2-REAL-PARK-LRV-VERTICAL-SLICE-004: real Price Control panel, wired
     to t2_price_control_v1 (source-only, not yet applied) via /api/sb. */
  { kalit: 'narx',    nom: 'Narx nazorati', Ikonka: ShieldAlert, Komponent: TestNarxNazorati },
] as const;

export default function TestSmetaBirlashgan() {
  const [tab, setTab] = useState<typeof ICHKI_TAB[number]['kalit']>('yuklash');
  const Aktiv = ICHKI_TAB.find((t) => t.kalit === tab)!.Komponent;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-shrink-0 flex items-center gap-1 px-4 py-2 border-b border-border bg-surface">
        {ICHKI_TAB.map((t) => (
          <button key={t.kalit} onClick={() => setTab(t.kalit)}
            className={"inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors " +
              (tab === t.kalit ? 'bg-[var(--accent)]/15 text-accent' : 'text-text-dim hover:bg-surface-2 hover:text-text')}>
            <t.Ikonka size={14} /> {t.nom}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        <Aktiv />
      </div>
    </div>
  );
}
