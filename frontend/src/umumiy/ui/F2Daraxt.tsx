import { useMemo, useState, useEffect, useRef, useCallback, type ReactNode, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, ChevronRight, CheckCircle2, ArrowRight } from 'lucide-react';

export type DaraxtTugun = {
  kalit: string;              // uid (akt) yoki "varaq#row" (smeta)
  type: string;               // rz | bl | rs | mat | ob
  nom: string;
  kod?: string;
  bir?: string;
  hajm?: number;
  summa?: number;
  belgi?: ReactNode;          // o'ng chetdagi qiymat
  /* ⚡ 2026-08-15: oldingi oylarda QO'SHIMCHA/ZAMENA sifatida kiritilgan
   * qatorlar keyingi F2 importda ODDIY smeta qatoriday ko'rinardi —
   * foydalanuvchi: «u smeta obyomi emas qo'shimcha ish ekanligini
   * bildiradigan hech balo yo'q ekan... katta chalkashliklarga olib
   * kelayapti». LRV markeridagi +/~ belgisidan keladi (bl+/rs~). */
  isQosh?: boolean;
  isZamena?: boolean;
  /* ⚡ 2026-08-16 ПЕРЕРАСЧЁТ: manfiy hajm — oldingi oyda ortiqcha
   * yozilgan ishni qaytarish. Foydalanuvchi: «smetasi chiqib pereraschet
   * qilingan obyekt uchun maksimal qulay bo'lishi shart».
   * Bunday qator ODDIY qatorday ko'rinsa, tekshiruvda «nega minus?»
   * degan savol tug'iladi va tushuntirib bo'lmaydi — shuning uchun
   * ochiq belgilanadi. */
  manfiy?: boolean;
  children?: DaraxtTugun[];
};

/* ⚡ 2026-08-15: `rz` (razdel) YETISHMAYOTGAN edi — razdel qatorlari
 * rangsiz va belgisiz chiqardi, ya'ni ierarxiya ko'zga tashlanmasdi.
 * Foydalanuvchi: «eski tizimda rz rs mat ob bl har biri uchun vizual
 * qulay ajrata olish uchun ranglar bilan ajratilgan edi».
 * Palitra `umumiy/turRang.ts` bilan bir xil (indigo/binafsha/ko'k/sariq/moviy). */
/* ⚡⚡⚡ 2026-08-16 TO'LIQ RANG TIZIMI (foydalanuvchi 2-marta so'radi:
 * «avval aytgandim qator turiga qarab ranglashni, lekin hali ham hech
 *  balo ranglanmagan»).
 *
 * NIMA UCHUN ILGARI KO'RINMASDI:
 *   1) rang belgisi `t.type !== 'rz'` blokining ICHIDA edi — RAZDEL
 *      (eng muhim daraja) umuman ranglanmasdi;
 *   2) belgi 10px, opacity-70 — ko'zga tashlanmasdi;
 *   3) qatorning O'ZIDA hech qanday rang yo'q edi, faqat mayda yorliq.
 *
 * ENDI har tur uchun UCHTA belgi: chap chiziq + fon chipi + nom rangi. */
/* ⚡⚡⚡ 2026-08-16: `fon` qo'shildi — BUTUN QATOR bo'yaladi.
 * Foydalanuvchi 3-marta so'radi. Avval faqat chap chiziq + kichik chip
 * bor edi; qatorning o'zi rangsiz qolgani uchun daraxt ierarxiyasi
 * baribir ko'zga tashlanmasdi. Ranglar ATAYLAB juda och (4-8%) —
 * matn o'qilishi buzilmasin, lekin daraja bir qarashda bilinsin. */
type TurUslub = { chiziq: string; chip: string; matn: string; nom: string; fon: string };
const TUR: Record<string, TurUslub> = {
  rz:  { chiziq:'#818cf8', chip:'bg-indigo-500/20 text-indigo-200 border-indigo-400/40', matn:'text-indigo-100', nom:'РАЗДЕЛ', fon:'rgba(99,102,241,0.13)' },
  bl:  { chiziq:'#c084fc', chip:'bg-purple-500/15 text-purple-200 border-purple-400/30', matn:'text-purple-50',  nom:'ИШ',     fon:'rgba(168,85,247,0.07)' },
  rs:  { chiziq:'#60a5fa', chip:'bg-blue-500/15  text-blue-200  border-blue-400/30',    matn:'text-slate-200',  nom:'РЕС',    fon:'rgba(59,130,246,0.05)' },
  mat: { chiziq:'#facc15', chip:'bg-yellow-500/15 text-yellow-200 border-yellow-400/30', matn:'text-yellow-50', nom:'МАТ',    fon:'rgba(234,179,8,0.05)' },
  ob:  { chiziq:'#2dd4bf', chip:'bg-teal-500/15  text-teal-200  border-teal-400/30',    matn:'text-teal-50',    nom:'ОБ',     fon:'rgba(20,184,166,0.05)' },
};
const TUR_ZAX: TurUslub = { chiziq:'#64748b', chip:'bg-slate-500/15 text-slate-300 border-slate-400/30', matn:'text-slate-300', nom:'?', fon:'transparent' };
const turUslub = (t: string): TurUslub => TUR[t] || TUR_ZAX;

// Gap drop zone — smeta qatorlari orasiga tashlash uchun
const GapZone = memo(function GapZone({
  smetaKalit, daraja, onGapDrop,
}: {
  smetaKalit: string; daraja: number; onGapDrop: (aktKalit: string, smetaKalit: string) => void;
}) {
  const [aktiv, setAktiv] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setAktiv(true); }}
      onDragLeave={() => setAktiv(false)}
      onDrop={(e) => {
        e.preventDefault(); e.stopPropagation(); setAktiv(false);
        const aktKalit = e.dataTransfer.getData('text/plain');
        if (aktKalit) onGapDrop(aktKalit, smetaKalit);
      }}
      style={{
        height: aktiv ? 22 : 5,
        background: aktiv ? 'rgba(16,185,129,0.25)' : 'transparent',
        borderRadius: 3,
        boxShadow: aktiv ? '0 0 0 1px rgba(16,185,129,0.6)' : 'none',
        paddingLeft: 8 + daraja * 18,
        paddingRight: 10,
        margin: aktiv ? '1px 0' : '0',
        transition: 'all 100ms',
        display: 'flex',
        alignItems: 'center',
        cursor: 'copy',
      }}
    >
      {aktiv && (
        <span style={{ color: '#34d399', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', userSelect: 'none' }}>
          ↓ Shu yerga qo'shimcha qilib qo'shish
        </span>
      )}
    </div>
  );
});

const DaraxtQator = memo(function DaraxtQator({
  t, daraja, bolalari, bog, yoritilgan, drop, yopiqHas,
  sudraladi, tashlanadi, onTashla, setUstida, toggle, onBogBekor,
  onDopClick, onOtishClick, takliflar, onTaklifTanlandi, scrollRef, onQatorQosh,
}: {
  t: DaraxtTugun; daraja: number; bolalari: boolean; bog: boolean; yoritilgan: boolean; drop: boolean; yopiqHas: boolean;
  sudraladi?: boolean; tashlanadi?: boolean;
  onTashla?: (aktKalit: string, smetaKalit: string) => void;
  setUstida: (k: string | null) => void;
  toggle: (k: string) => void; onBogBekor?: (kalit: string) => void;
  onDopClick?: (kalit: string) => void;
  onOtishClick?: (kalit: string) => void;
  takliflar?: Record<string, any[]>;
  onTaklifTanlandi?: (uid: string, cand: any) => void;
  scrollRef?: (el: HTMLDivElement | null) => void;
  /** SMETA tomonida: shu qatordan KEYIN yangi qator qo'shish (rz/bl/rs) */
  onQatorQosh?: (smetaKalit: string) => void;
}) {
  return (
    <div
      ref={scrollRef}
      draggable={sudraladi && t.type !== 'rz'}
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', t.kalit); e.dataTransfer.effectAllowed = 'link'; }}
      onDragOver={tashlanadi ? (e) => { e.preventDefault(); setUstida(t.kalit); } : undefined}
      onDragLeave={tashlanadi ? () => setUstida(null) : undefined}
      onDrop={tashlanadi ? (e) => {
        e.preventDefault();
        setUstida(null);
        const aktKalit = e.dataTransfer.getData('text/plain');
        if (aktKalit && onTashla) onTashla(aktKalit, t.kalit);
      } : undefined}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        if (bolalari) toggle(t.kalit);
      }}
      className={`flex items-center gap-2 border-b border-border/60 text-[13px]
                  transition-colors duration-[120ms] min-h-[32px] group
                  ${drop ? 'bg-emerald-500/20 ring-1 ring-emerald-500'
                    : yoritilgan ? 'bg-[var(--accent)]/[.15] ring-1 ring-[var(--accent)]/30'
                    : bog ? 'bg-emerald-500/10'
                    : t.type === 'rz' ? 'bg-[var(--surface-2)]/60'
                    : 'hover:bg-[var(--surface-2)]/40'}
                  ${sudraladi && t.type !== 'rz' ? 'cursor-grab active:cursor-grabbing' : bolalari ? 'cursor-pointer' : ''}`}
      /* ⚡ 2026-08-16: chap chiziq endi TUR RANGIDA — daraxtga bir qarashda
         qaysi daraja qayerda ekani ko'rinadi. Bog'langan qator yashil
         qoladi (bu holat rangi turdan muhimroq). */
      style={{ paddingLeft: 8 + daraja * 18, paddingRight: 10,
               paddingTop: t.type === 'rz' ? 6 : undefined,
               paddingBottom: t.type === 'rz' ? 6 : undefined,
               borderLeft: `4px solid ${bog ? '#10b981' : turUslub(t.type).chiziq}`,
               /* ⚡ 2026-08-16 BUTUN QATOR FONI. Ustuvorlik:
                  bog'langan/drop/yoritilgan (holat rangi) → manfiy →
                  razdel gradienti → tur foni. */
               background: (bog || drop || yoritilgan) ? undefined
                 : t.manfiy ? 'rgba(244,63,94,0.09)'
                 : t.type === 'rz'
                   ? `linear-gradient(90deg, ${turUslub('rz').fon} 0%, rgba(99,102,241,0.03) 70%, transparent 100%)`
                   : turUslub(t.type).fon }}
    >
      <span className="w-5 flex-shrink-0 text-text-mute flex items-center justify-center">
        {bolalari && (
          <button onClick={(e) => { e.stopPropagation(); toggle(t.kalit); }} className="cursor-pointer hover:text-white transition-colors p-1 rounded hover:bg-white/10">
            {yopiqHas ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
      </span>

      {/* ⚡ 2026-08-15: oldin kiritilgan QO'SHIMCHA/ZAMENA endi belgili —
          «u smeta obyomi emas qo'shimcha ish ekanligini bildiradigan
          hech balo yo'q ekan» muammosi. LRV marker +/~ dan keladi. */}
      {t.manfiy && (
        <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold
                         tracking-wide border bg-orange-500/20 text-orange-300 border-orange-400/50"
              title="Манфий ҳажм — олдинги ойдаги ортиқча ишни қайтариш (перерасчёт)">
          − ПЕРЕРАСЧЁТ
        </span>
      )}
      {(t.isZamena || t.isQosh) && (
        <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide border ${
          t.isZamena ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                     : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'}`}>
          {t.isZamena ? '~ ЗАМЕНА' : '+ ҚЎШИМЧА'}
        </span>
      )}
      {t.type !== 'rz' && (
        <div className="flex-shrink-0 flex items-center gap-1" style={{ width: 88 }}>
           {bog ? (
             <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform" title="Bog'langan — bosib bekor qilish">
               {onBogBekor ? (
                 <button onClick={(e) => { e.stopPropagation(); onBogBekor(t.kalit); }} className="cursor-pointer hover:text-red-400 transition-colors" title="Bekor qilish">
                   <CheckCircle2 size={16} />
                 </button>
               ) : <CheckCircle2 size={16} />}
             </span>
           ) : (
             <span className="w-6 h-6 flex items-center justify-center text-text-mute opacity-30">—</span>
           )}
           
           {/* → tugmasi: akt tarafida bog'langan bo'lsa smeta tarafiga o'tish */}
           {bog && onOtishClick && (
             <button
               onClick={(e) => { e.stopPropagation(); onOtishClick(t.kalit); }}
               className="w-6 h-6 flex items-center justify-center rounded bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/25 hover:scale-110 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
               title="Bog'langan smeta qatorini ko'rsatish →"
             >
               <ArrowRight size={13} />
             </button>
           )}

           {/* + tugmasi: bog'lanmagan bo'lsa dop qilish */}
           {!bog && sudraladi && t.type !== 'rz' && onDopClick && (
             <button onClick={(e) => { e.stopPropagation(); onDopClick(t.kalit); }} className="w-6 h-6 ml-0.5 flex items-center justify-center rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:scale-110 transition-all cursor-pointer" title="Smetaga qo'shimcha ish qilib qo'shish (Dop)">
               <span className="text-[14px] font-bold leading-none">+</span>
             </button>
           )}

           {/* ⚡ 2026-08-13 SMETA tomoni: SHU QATORDAN KEYIN yangi qator qo'shish.
               Avval bu faqat panel tepasidagi bitta tugma edi va qator raqamini
               qo'lda yozish kerak bo'lardi. Endi har qatorda o'z tugmasi bor. */}
           {onQatorQosh && (
             <button
               onClick={(e) => { e.stopPropagation(); onQatorQosh(t.kalit); }}
               className="w-6 h-6 ml-0.5 flex items-center justify-center rounded bg-accent/15 text-accent hover:bg-accent hover:text-white hover:scale-110 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
               title="Shu qatordan KEYIN yangi qator qo'shish (Razdel / Ish turi / Resurs)"
             >
               <span className="text-[13px] font-bold leading-none">＋</span>
             </button>
           )}

           {/* Takliflar (faqat chap taraf uchun) */}
           {!bog && takliflar && takliflar[t.kalit] && takliflar[t.kalit].length > 0 && onTaklifTanlandi && (
             <div className="relative group/taklif">
               <button onClick={(e) => e.stopPropagation()} className="w-6 h-6 ml-0.5 flex items-center justify-center rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 hover:scale-110 transition-all cursor-pointer" title="Taklif qilingan variantlar">
                 <span className="text-[12px] font-bold">🎯</span>
               </button>
               <div className="absolute left-full top-0 ml-2 bg-slate-800 border border-slate-700 rounded shadow-xl p-2 z-50 hidden group-hover/taklif:block w-[400px]">
                 <div className="text-[11px] text-slate-400 mb-2 font-semibold">Takliflar ({takliflar[t.kalit].length}):</div>
                 <div className="max-h-[300px] overflow-y-auto flex flex-col gap-1">
                   {takliflar[t.kalit].map((c: any, i: number) => (
                     <div key={i} onClick={(e) => { e.stopPropagation(); onTaklifTanlandi(t.kalit, c.varaq+'#'+c.row); }} className="bg-slate-700/50 hover:bg-emerald-500/20 border border-slate-600 hover:border-emerald-500/40 rounded p-1.5 cursor-pointer transition-colors text-[11px]">
                       <div className="font-semibold text-emerald-400 mb-1">{c.nom}</div>
                       <div className="flex justify-between text-[10px] text-slate-400">
                         <span>Varaq: {c.varaq}</span>
                         <span>Qator: {c.row}</span>
                         <span>Kod: {c.kod}</span>
                       </div>
                     </div>
                   ))}
                 </div>
               </div>
             </div>
           )}

        </div>
      )}

      {/* ⚡⚡⚡ 2026-08-16 TUR CHIPI — HAR qator uchun (rz ham!).
          Avval bu belgi `t.type !== 'rz'` blokining ichida edi, ya'ni
          RAZDEL umuman belgilanmasdi; ustiga 10px/opacity-70 bo'lgani
          uchun ko'zga ham tashlanmasdi. Endi fonli, chegarali chip. */}
      <span className={`flex-shrink-0 px-1.5 py-0.5 rounded border text-[10px]
                        font-bold tracking-wider ${turUslub(t.type).chip}`}
            title={turUslub(t.type).nom}>
        {turUslub(t.type).nom}
      </span>

      <div className={`min-w-0 flex-1 py-1.5 ${bog ? 'opacity-100' : 'opacity-80'}`}>
        <div className={`whitespace-normal leading-tight break-words ${
            t.type === 'rz' ? 'text-white font-bold tracking-wide text-[14px]'
            : bog ? 'text-emerald-50 font-medium'
            : turUslub(t.type).matn}`} title={t.nom}>
          {t.nom}
        </div>
        {(t.kod || t.bir) && (
          <div className={`text-[11px] mt-0.5 whitespace-normal ${bog ? 'text-emerald-400/60' : 'text-slate-400'}`}>
            {t.kod && <span className="mr-2 font-mono bg-black/20 px-1.5 py-0.5 rounded">{t.kod}</span>}
            <span className="italic">{t.bir}</span>
          </div>
        )}
      </div>

      <span className={`flex-shrink-0 tabular-nums text-[13px] max-w-[240px] ${bog ? 'text-emerald-400 font-bold' : 'text-slate-400 font-medium'}`}>{t.belgi}</span>
    </div>
  );
}, (a, b) =>
  /* ⚡ 2026-08-15: sahifa har render'da callback'larni qayta yaratadi va
   * oddiy memo hech qachon ishlamasdi — ekrandagi ~40 qator har safar
   * qayta chizilardi. Endi faqat KO'RINISHGA ta'sir qiluvchi proplar
   * solishtiriladi. Daraxt o'zgarsa `t` yangi obyekt bo'ladi va qator
   * yangi callback'lar bilan qayta chiziladi — eskirgan closure xavfi yo'q. */
  a.t === b.t && a.daraja === b.daraja && a.bolalari === b.bolalari &&
  a.bog === b.bog && a.yoritilgan === b.yoritilgan && a.drop === b.drop &&
  a.yopiqHas === b.yopiqHas && a.sudraladi === b.sudraladi &&
  a.tashlanadi === b.tashlanadi && a.takliflar === b.takliflar);

export function F2Daraxt({
  tugunlar, bogMi, dopMi, onBogBekor,
  sudraladi, tashlanadi, onTashla, onGapDrop, bosh,
  filtr = 'hammasi',
  ochiqYopiqSignal = 0,
  onDopClick,
  onOtishClick,
  onQatorQosh,
  scrollToKey, takliflar, onTaklifTanlandi,
}: {
  tugunlar: DaraxtTugun[];
  bogMi: (kalit: string) => boolean;
  dopMi?: (kalit: string) => boolean;
  /* ⚡ 2026-08-15 OLIB TASHLANDI: hover sahifa store'ida saqlanardi —
   * HAR sichqoncha harakati BUTUN sahifani (ikkala 15k-tugunli daraxtni)
   * qayta chizardi. Bu doimiy og'irlikning asosiy manbai edi.
   * Endi hover faqat CSS (:hover) — hech qanday state yo'q. */
  hover?: string | null;
  setHover?: (k: string | null) => void;
  onBogBekor?: (kalit: string) => void;
  sudraladi?: boolean;
  tashlanadi?: boolean;
  onTashla?: (aktKalit: string, smetaKalit: string) => void;
  onGapDrop?: (aktKalit: string, smetaKalit: string) => void;
  bosh?: string;
  /* ⚡ 2026-08-16 'manfiy' qo'shildi — ПЕРЕРАСЧЁТ rejimi.
   * Korrektirovka oyida faqat manfiy (qaytariladigan) qatorlarni
   * ko'rish kerak bo'ladi; ular butun ro'yxat ichida yo'qolib ketardi. */
  filtr?: 'hammasi' | 'boglanmagan' | 'boglangan' | 'qolDop' | 'manfiy';
  ochiqYopiqSignal?: number;
  onDopClick?: (kalit: string) => void;
  onOtishClick?: (kalit: string) => void;
  /** SMETA tomoni: shu qatordan keyin yangi qator qo'shish (har qatorda «＋») */
  onQatorQosh?: (smetaKalit: string) => void;
  scrollToKey?: string | null; takliflar?: Record<string, any[]>; onTaklifTanlandi?: (uid: string, cand: any) => void;
}) {
  const [yopiq, setYopiq] = useState<Set<string>>(new Set());
  const [ustida, setUstida] = useState<string | null>(null);
  const [yoritilganKey, setYoritilganKey] = useState<string | null>(null);
  const lastSignal = useRef(ochiqYopiqSignal);
  const scrollRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (ochiqYopiqSignal === lastSignal.current) return;
    lastSignal.current = ochiqYopiqSignal;
    
    if (ochiqYopiqSignal && ochiqYopiqSignal > 0) {
      setYopiq(new Set());
    } else if (ochiqYopiqSignal && ochiqYopiqSignal < 0) {
      const rzs = new Set<string>();
      const yur = (ns: DaraxtTugun[]) => ns.forEach(n => {
        if (n.type === 'rz' || n.children?.length) {
          rzs.add(n.kalit);
          if (n.children) yur(n.children);
        }
      });
      yur(tugunlar);
      setYopiq(rzs);
    }
  }, [ochiqYopiqSignal, tugunlar]);

  /* ⚡⚡⚡ 2026-08-14 KATTA DARAXT MUZLASHI TUZATILDI (foydalanuvchi: «2000
   * qatorlik F2 ni ochgandim qotib qolayapdi, umuman ishlab bo'lmaydigan
   * darajada — 4 ta katta smeta ko'tara olmayapdi»).
   * O'lchov: 2 ta katta smeta = 6710 tugun / 2.9 MB. 4 tasi ≈ 13 000 tugun,
   * ustiga F2 tarafda 2000 — brauzer 15 000 DOM elementini birdan chiza
   * olmaydi va sahifa muzlab qoladi.
   * YECHIM: daraxt katta bo'lsa DASTLAB YOPIQ chiziladi — faqat razdel
   * sarlavhalari (bir necha yuz element). Foydalanuvchi kerakligini ochadi.
   * Kichik daraxtlarda (eski xatti-harakat) hammasi ochiq qoladi. */
  const KATTA_CHEGARA = 600;
  /* ⚡⚡⚡ 2026-08-15 «HAR TASHLAGANIMDA HAMMA RZ OCHILIB KETADI» TUZATILDI.
   * Avval bu effekt daraxt MASSIVI yangilanganda (har bog'lashda smetaDaraxt
   * qayta quriladi — bu normal) QAYTA ISHLAB, yopiq to'plamni O'Z holatiga
   * qayta yozardi: 1-daraja razdellar OCHIQ, ichi yopiq. Foydalanuvchi
   * atay bittagina rz ochib ishlayotgan bo'lsa — har drop'da hammasi
   * ochilib, ish joyi yo'qolardi («mani ham adashtirayapdida»).
   * ENDI: daraxtning IMZOSI (tugun soni + birinchi kalit) o'zgarmagan
   * bo'lsa — foydalanuvchining ochiq/yopiq holatiga TEGILMAYDI. Imzo
   * faqat haqiqatan boshqa daraxt kelganda (boshqa smeta, boshqa akt)
   * o'zgaradi va faqat o'shanda dastlabki yig'ish ishlaydi. */
  const dastlabImzo = useRef('');
  useEffect(() => {
    let jami = 0;
    const sana = (ns: DaraxtTugun[]) => ns.forEach(n => {
      jami++; if (n.children?.length) sana(n.children);
    });
    sana(tugunlar);
    if (jami === 0) return;
    const imzo = jami + '|' + (tugunlar[0]?.kalit ?? '') + '|' + tugunlar.length;
    if (imzo === dastlabImzo.current) return;   // shu daraxt — holat saqlanadi
    dastlabImzo.current = imzo;
    if (jami <= KATTA_CHEGARA) return;    // kichik — hammasi ochiq qolsin

    const yigi = new Set<string>();
    const yur = (ns: DaraxtTugun[], daraja: number) => ns.forEach(n => {
      // 1-daraja razdellar OCHIQ qoladi (ular ko'rinib tursin),
      // ichkarisi yopiladi — shunda ekranda faqat sarlavhalar bo'ladi
      if (n.children?.length) {
        if (daraja >= 1) yigi.add(n.kalit);
        yur(n.children, daraja + 1);
      }
    });
    yur(tugunlar, 0);
    setYopiq(yigi);
  }, [tugunlar]);

  const parentRef = useRef<HTMLDivElement>(null);
  const lastScrolled = useRef<string | null>(null);

  // scrollToKey o'zgarganda — shu qatorni ochib scroll qilamiz
  useEffect(() => {
    if (!scrollToKey) {
      lastScrolled.current = null;
      return;
    }
    if (scrollToKey === lastScrolled.current) return;
    
    // Shu kalitning ota-bobolari bo'lgan yopiq daraxtni ochamiz
    const ochishKerak = new Set<string>();
    const topOta = (ns: DaraxtTugun[], targetKey: string, path: string[]): boolean => {
      for (const n of ns) {
        if (n.kalit === targetKey) {
          path.forEach(k => ochishKerak.add(k));
          return true;
        }
        if (n.children && topOta(n.children, targetKey, [...path, n.kalit])) return true;
      }
      return false;
    };
    topOta(tugunlar, scrollToKey, []);
    
    if (ochishKerak.size > 0) {
      setYopiq(p => {
        const yangi = new Set(p);
        ochishKerak.forEach(k => yangi.delete(k));
        return yangi;
      });
    }
    
    const timer = setTimeout(() => {
      const el = scrollRefs.current.get(scrollToKey);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setYoritilganKey(scrollToKey);
        lastScrolled.current = scrollToKey;
        setTimeout(() => setYoritilganKey(null), 2500);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [scrollToKey, tugunlar]);

  const toggle = (k: string) =>
    setYopiq((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const setScrollRef = useCallback((kalit: string) => (el: HTMLDivElement | null) => {
    if (el) scrollRefs.current.set(kalit, el);
    else scrollRefs.current.delete(kalit);
  }, []);

  const qatorlar = useMemo(() => {
    const out: { t: DaraxtTugun; daraja: number }[] = [];
    
    const filtrla = (ns: DaraxtTugun[]): DaraxtTugun[] => {
      const res: DaraxtTugun[] = [];
      for (const n of ns) {
        if (n.type === 'rz') {
          const fBolalar = filtrla(n.children ?? []);
          if (fBolalar.length > 0 || filtr === 'hammasi') {
            res.push({ ...n, children: fBolalar });
          }
        } else {
          const bog = bogMi(n.kalit);
          const dop = dopMi ? dopMi(n.kalit) : n.kalit.startsWith('dop_');
          
          let matches = false;
          if (filtr === 'hammasi') matches = true;
          else if (filtr === 'boglangan') matches = bog && !dop;
          else if (filtr === 'boglanmagan') matches = !bog && !dop;
          else if (filtr === 'qolDop') matches = dop;
          else if (filtr === 'manfiy') matches = !!n.manfiy;

          let fBolalar: DaraxtTugun[] = [];
          if (n.children?.length) fBolalar = filtrla(n.children);
          if (matches || fBolalar.length > 0) res.push({ ...n, children: fBolalar });
        }
      }
      return res;
    };

    /* ⚡⚡⚡ 2026-08-16 «ҚАТОРЛАРНИ ОЧИБ-ЁПГАНДА ЖУДА СЕКИН» ТУЗАТИШИ.
     *
     * `filtrla` har tugun uchun `{...n, children: fBolalar}` — YANGI
     * OBYEKT yasaydi. Filtr «hammasi» bo'lganda (eng ko'p uchraydigan
     * holat) u hech narsani filtrlamaydi, faqat BUTUN DARAXTNI
     * NUSXALAYDI: 15 000 obyekt allokatsiyasi HAR ochib-yopishda.
     *
     * Ustiga bu memoizatsiyani ham buzardi — `DaraxtQator` `a.t === b.t`
     * bo'yicha solishtiradi, nusxa esa har safar yangi havola, ya'ni
     * ekrandagi HAR qator qayta chizilardi.
     *
     * ENDI: filtr yo'q bo'lsa asl massiv O'ZI ishlatiladi — nusxa yo'q,
     * havolalar barqaror, memo ishlaydi. */
    const filtrlanganTugunlar = filtr === 'hammasi' ? tugunlar : filtrla(tugunlar);
    const yur = (ns: DaraxtTugun[], d: number) => {
      ns.forEach((t) => {
        out.push({ t, daraja: d });
        if (t.children?.length && !yopiq.has(t.kalit)) yur(t.children, d + 1);
      });
    };
    yur(filtrlanganTugunlar, 0);
    return out;
  }, [tugunlar, yopiq, bogMi, filtr]);

  /* ⚡⚡⚡ 2026-08-15 «RASVO BO'LIB YOTIBDI» — QATORLAR USTMA-UST TUSHISHI.
   *
   * SABAB: virtualizator har qatorni QAT'IY 32px deb hisoblardi
   * (`estimateSize: () => 32`) va o'ram div ga `height: 32px` QOTIRIB
   * qo'yilgandi. Lekin qator ichidagi nom uzun bo'lsa (ruscha smeta
   * nomlari odatda 100-200 belgi) matn 3-4 QATORGA o'raladi va haqiqiy
   * balandlik 60-100px bo'ladi.
   * Qatorlar `translateY(index × 32)` bilan joylashtirilgani uchun
   * 4-qatorlik matn keyingi 2-3 qatorning ustiga chiqib ketardi —
   * skrinshotdagi aralashib ketgan ko'rinish aynan shundan.
   *
   * YECHIM: haqiqiy balandlikni O'LCHAYMIZ. `measureElement` har qator
   * DOM ga tushgach uning `getBoundingClientRect().height` ini oladi va
   * virtualizator keyingi qatorlarni to'g'ri joyga qo'yadi.
   * O'ram div dan qat'iy `height` OLIB TASHLANDI (pastga qara) — aks
   * holda o'lchov baribir 32 chiqardi. */
  const rowVirtualizer = useVirtualizer({
    count: qatorlar.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 10,
    measureElement: (el) => (el as HTMLElement)?.getBoundingClientRect().height ?? 32,
    /* ⚡⚡⚡ 2026-08-16 «ОЧИБ-ЁПГАНДА МАТНЛАР ЧАЛКАШИБ КЕТАДИ» ТУЗАТИШИ.
     * Virtualizator o'lchangan balandliklarni INDEKS bo'yicha keshlaydi.
     * Razdel ochilganda/yopilganda ro'yxat uzayadi-qisqaradi va barcha
     * keyingi qatorlarning indeksi SURILADI — 5-indeksdagi eski o'lchov
     * endi butunlay boshqa qatorga tegishli bo'lib qoladi. Natija:
     * qator o'z balandligidan qisqa/uzun joyga tushadi va matnlar
     * bir-birining ustiga chiqadi.
     * `getItemKey` bilan o'lchov QATOR KALITIGA bog'lanadi — indeks
     * surilsa ham har qator o'z balandligini olib yuradi. */
    getItemKey: (index) => qatorlar[index]?.t.kalit ?? index,
  });

  if (!tugunlar.length) {
    return <div className="p-6 text-center text-text-mute text-sm">{bosh ?? 'Bo\'sh'}</div>;
  }

  return (
    <div ref={parentRef} className="text-[13px] overflow-y-auto h-full w-full">
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const idx = virtualRow.index;
          const { t, daraja } = qatorlar[idx];
          const bog = bogMi(t.kalit);
          const drop = ustida === t.kalit;
          const yoritilgan = yoritilganKey === t.kalit;
          const bolalari = !!(t.children?.length);
          const yopiqHas = yopiq.has(t.kalit);
          const prevType = idx > 0 ? qatorlar[idx - 1].t.type : null;
          
          return (
            <div
              key={t.kalit}
              /* ⚡ 2026-08-15: `data-index` + `measureElement` — virtualizator
               * shu ikkisi orqali qatorning HAQIQIY balandligini biladi.
               * `height` ATAYLAB YO'Q: qotirilgan balandlik o'lchovni buzadi
               * va uzun nomlar keyingi qatorlar ustiga chiqib ketadi. */
              data-index={idx}
              ref={rowVirtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {/* Gap drop zone — faqat smeta tarafida, qatorlar orasida */}
              {tashlanadi && onGapDrop && t.type !== 'rz' && prevType && prevType !== 'rz' && (
                <GapZone
                  smetaKalit={t.kalit}
                  daraja={daraja}
                  onGapDrop={onGapDrop}
                />
              )}
              
              <DaraxtQator
                t={t}
                daraja={daraja}
                bolalari={bolalari}
                bog={bog}
                yoritilgan={yoritilgan}
                drop={drop}
                yopiqHas={yopiqHas}
                sudraladi={sudraladi}
                tashlanadi={tashlanadi}
                onTashla={onTashla}
                setUstida={setUstida}
                toggle={toggle}
                onBogBekor={onBogBekor}
                onDopClick={onDopClick}
                onOtishClick={bog ? onOtishClick : undefined}
                onQatorQosh={onQatorQosh}
                scrollRef={setScrollRef(t.kalit)} takliflar={takliflar} onTaklifTanlandi={onTaklifTanlandi}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
