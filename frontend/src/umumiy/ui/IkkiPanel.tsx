/**
 * IkkiPanel — panel'dagi Ф2 ekranlari kabi yonma-yon ikki oyna.
 * Har panel MUSTAQIL skroll qiladi; 1024px dan kichikda yorliqli bitta panelga
 * aylanadi (17_F2_IKKI_PANEL.md §3).
 */
import { useState, type ReactNode } from 'react';

export function IkkiPanel({
  chapSarlavha, ongSarlavha, chapOng, chap, ong, balandlik = 'calc(100vh - 320px)',
}: {
  chapSarlavha: ReactNode;
  ongSarlavha: ReactNode;
  /** sarlavha o'ngidagi qo'shimcha (filtr, hisob) */
  chapOng?: ReactNode;
  chap: ReactNode;
  ong: ReactNode;
  balandlik?: string;
}) {
  const [yorliq, setYorliq] = useState<'chap' | 'ong'>('chap');

  return (
    <>
      {/* Mobil / tor ekran — yorliqlar */}
      <div className="flex gap-2 mb-3 lg:hidden">
        {(['chap', 'ong'] as const).map((y) => (
          <button
            key={y}
            onClick={() => setYorliq(y)}
            className={`h-9 px-4 rounded-[10px] border text-sm font-medium transition-colors cursor-pointer
              ${yorliq === y ? 'bg-accent text-white border-transparent' : 'karta text-text-dim'}`}
          >
            {y === 'chap' ? chapSarlavha : ongSarlavha}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ height: balandlik }}>
        <Panel sarlavha={chapSarlavha} ong={chapOng} korinadi={yorliq === 'chap'}>{chap}</Panel>
        <Panel sarlavha={ongSarlavha} korinadi={yorliq === 'ong'}>{ong}</Panel>
      </div>
    </>
  );
}

function Panel({ sarlavha, ong, korinadi, children }: {
  sarlavha: ReactNode; ong?: ReactNode; korinadi: boolean; children: ReactNode;
}) {
  return (
    <section className={`karta flex flex-col overflow-hidden min-h-0 ${korinadi ? '' : 'hidden lg:flex'}`}>
      <header className="flex-shrink-0 px-4 py-2.5 bg-[var(--surface-2)]/50 border-b border-border
                         flex items-center justify-between gap-3">
        <span className="text-[11px] uppercase tracking-[0.04em] text-text-dim truncate">{sarlavha}</span>
        {ong}
      </header>
      <div className="flex-1 overflow-y-auto min-h-0">{children}</div>
    </section>
  );
}
