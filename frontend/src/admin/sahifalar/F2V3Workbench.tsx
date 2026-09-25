import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, ChevronDown, Search, Link2, Unlink, Check, SkipForward, ArrowDownToLine, X } from 'lucide-react';
import type { T2Qator } from '../../api/supabase';
import type { F2Akt, F2Tugun } from '../../lib/smeta-anatomiya/f2';
import type { F2MoslashNatija, Nomzod, SmetaQator } from '../../lib/f2-moslash-v3';
import {
  bogla, hisobla, ishniBogla, korinish, oshaQatormi, otkazibYubor, tasdiqla, uz,
  type F2Indeks, type IshJoyi, type KorinishHolat, type SmetaIndeks,
} from '../../lib/f2-moslash-v3/ishJoyi';
import { F2AddReplModal, type DropAction } from './F2AddReplModal';

/**
 * F2 V3 — ikki oynali moslashtirish (docs/architecture/F2_IMPORT_V3.md §3).
 *
 * CHAP  — F2 akt daraxti (fayldan: razdel → ish → resurslar), har qatorda holat:
 *         ✓ bog'langan · ◐ taklif (tasdiqlang) · ✕ topilmadi · – o'tkazildi.
 * O'NG  — obyekt smetasi (t2_qator): smeta hajmi / oldingi F2 / shu F2 / qoldiq.
 *
 * Tizim1 drag-drop qoidalari (chapdan o'ngga torting yoki chapda tanlab o'ngni bosing):
 *   ish → o'sha smeta ishi        : resurslari bilan birga bog'lanadi
 *   ish → boshqa ish              : so'raladi — Bog'lash / ⇄ Zamena (shu ish o'rniga)
 *   ish → razdel                  : ＋ Qo'shimcha ish (resurslari bilan yaratiladi)
 *   resurs → o'sha resurs         : bog'lanadi
 *   resurs → boshqa resurs        : so'raladi — Bog'lash / ⇄ Zamena material
 *   resurs → smeta ishi           : ＋ Qo'shimcha resurs shu ish ostiga
 *   razdel → smeta razdeli        : razdel o'rgatiladi, qayta moslashtiriladi
 */

const fmt = (n: number | null | undefined, max = 3) =>
  n == null ? '—' : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: max }).format(n);

const BELGI: Record<KorinishHolat, { b: string; cls: string; t: string }> = {
  aniq: { b: '✓', cls: 'text-ok', t: 'Aniq bog‘landi' },
  xotira: { b: '✓', cls: 'text-ok', t: 'O‘tgan oylardagi tasdiqlangan bog‘lanish' },
  qolda: { b: '✓', cls: 'text-accent', t: 'Siz bog‘ladingiz' },
  taklif: { b: '◐', cls: 'text-warn', t: 'Taklif — tasdiqlang yoki boshqasini tanlang' },
  topilmadi: { b: '✕', cls: 'text-danger', t: 'Topilmadi — torting: qo‘shimcha / zamena' },
  otkazildi: { b: '–', cls: 'text-text-mute', t: 'Aktga kiritilmaydi' },
};

type Tanlov = { f: F2Tugun; s: SmetaQator; tur: 'ish' | 'resurs' };

export interface F2V3WorkbenchProps {
  akt: F2Akt;
  ind: F2Indeks;
  natija: F2MoslashNatija;
  S: SmetaIndeks;
  raw: Map<number, T2Qator>;
  /** smeta qator id → oldingi (tasdiqlangan) F2 hajmi. */
  oldingi: Map<number, number>;
  ij: IshJoyi;
  onIj: (next: IshJoyi) => void;
  onRzBog: (f2RzUid: string, smetaRzId: number) => void;
  companyId: number;
  objectId: number;
  /** Qo'shimcha/zamena qator yaratilgach: sahifa smetani yangilaydi, ish bo'lsa resurslarini yaratadi va bog'laydi. */
  onYaratildi: (f: F2Tugun, qatorId: number) => Promise<void>;
  disabled?: boolean;
}

export function F2V3Workbench(p: F2V3WorkbenchProps) {
  const { ind, S, ij } = p;
  const [tanlangan, setTanlangan] = useState<string | null>(null);
  const [ochiqS, setOchiqS] = useState<Set<number>>(new Set());
  const [yopiqF, setYopiqF] = useState<Set<string>>(new Set());
  const [filtr, setFiltr] = useState<'hammasi' | 'hal'>('hal');
  const [q, setQ] = useState('');
  const [dropKey, setDropKey] = useState<string | null>(null);
  const [tanlov, setTanlov] = useState<Tanlov | null>(null);
  const [modal, setModal] = useState<{ f: F2Tugun; action: DropAction } | null>(null);
  const [xabar, setXabar] = useState<string | null>(null);
  const smetaQuti = useRef<HTMLDivElement>(null);

  const h = useMemo(() => hisobla(ind, ij), [ind, ij]);
  const shuF2 = useMemo(() => {
    const m = new Map<number, { hajm: number; uidlar: string[] }>();
    for (const [uid, b] of ij.bog) {
      const t = ind.byUid.get(uid);
      if (!t || ij.otkaz.has(uid)) continue;
      const x = m.get(b.qatorId) ?? { hajm: 0, uidlar: [] };
      x.hajm += t.hajm ?? 0; x.uidlar.push(uid);
      m.set(b.qatorId, x);
    }
    return m;
  }, [ij, ind]);
  const rzDiag = useMemo(() => new Map(p.natija.rzDiag.map((d) => [d.f2Uid, d])), [p.natija]);
  const tTugun = tanlangan ? ind.byUid.get(tanlangan) ?? null : null;

  /** Tanlangan F2 qatori uchun nomzodlar: dvigateldan; resurs uchun — bog'langan smeta ishi ichidagilar. */
  const nomzodlar = useMemo<Nomzod[]>(() => {
    if (!tTugun) return [];
    const n = p.natija.natijalar.get(tTugun.uid)?.nomzodlar ?? [];
    if (n.length || tTugun.tur !== 'rs') return n;
    const ota = ind.ota.get(tTugun.uid);
    const otaBog = ota ? ij.bog.get(ota.uid) : undefined;
    if (!otaBog) return [];
    return (S.bolalar.get(otaBog.qatorId) ?? []).filter((s) => s.tur !== 'rz').map((s) => ({
      qatorId: s.id, ball: oshaQatormi(tTugun, s) ? 50 : 0, yol: '', qavatlar: [], sabab: [oshaQatormi(tTugun, s) ? 'kod/nom ✓' : 'ish ichidagi resurs'],
    })).sort((a, b) => b.ball - a.ball);
  }, [tTugun, p.natija, ind, ij, S]);
  const nomzodBall = useMemo(() => new Map(nomzodlar.map((n) => [n.qatorId, n.ball])), [nomzodlar]);

  // Tanlanganda: bog'langan qator (yoki eng yaxshi nomzodlar) o'ngda ochiladi va ko'rinadi.
  useEffect(() => {
    if (!tTugun) return;
    const b = ij.bog.get(tTugun.uid);
    const ids = [b?.qatorId, ...nomzodlar.slice(0, 3).map((n) => n.qatorId)].filter((x): x is number => x != null);
    if (!ids.length) return;
    setOchiqS((old) => {
      const s = new Set(old);
      for (const id of ids) for (let t = S.byId.get(id); t && t.otaId != null; t = S.byId.get(t.otaId)) s.add(t.otaId);
      return s;
    });
    const fokus = ids[0];
    requestAnimationFrame(() => {
      const el = smetaQuti.current?.querySelector(`[data-sid="${fokus}"]`);
      if (el && 'scrollIntoView' in el) (el as HTMLElement).scrollIntoView({ block: 'center' });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tanlangan]);

  // ── Amallar ──
  function xab(m: string) { setXabar(m); }
  function ishBogla(f: F2Tugun, sId: number) {
    const r = ishniBogla(ij, f, sId, S);
    p.onIj(r.ij);
    xab(f.bolalar.length
      ? `«${f.nom.slice(0, 50)}» bog‘landi, resurslar: ${r.boglandi} ta ✓${r.qoldi ? `, ${r.qoldi} tasi mos kelmadi (✕ — zamena material yoki qo‘shimcha resurs)` : ''}.`
      : `«${f.nom.slice(0, 50)}» bog‘landi.`);
  }
  /** Tashlash (yoki tanlab bosish) — Tizim1 qoidalari. */
  function tashla(fUid: string, sId: number) {
    if (p.disabled) return;
    const f = ind.byUid.get(fUid);
    const s = S.byId.get(sId);
    if (!f || !s) return;
    const sRes = s.tur !== 'rz' && s.tur !== 'bl';
    if (f.tur === 'rz') {
      if (s.tur !== 'rz') { xab('Razdelni smeta RAZDELIGA torting — shu razdel ichidan qidiriladi.'); return; }
      p.onRzBog(f.uid, s.id);
      xab(`«${f.nom.slice(0, 50)}» → «${(s.nom ?? '').slice(0, 50)}» razdeliga o‘rgatildi, qayta moslashtirildi.`);
      return;
    }
    if (f.tur === 'bl') {
      if (s.tur === 'rz') { ochModal(f, { kind: 'additional', parent: p.raw.get(s.id)! }); return; }
      if (sRes) { xab('Ishni smeta ISHIGA (bog‘lash/zamena) yoki RAZDELGA (qo‘shimcha ish) torting.'); return; }
      if (oshaQatormi(f, s) || (nomzodBallOf(f.uid, s.id) ?? -1) >= 45) { ishBogla(f, s.id); return; }
      setTanlov({ f, s, tur: 'ish' });
      return;
    }
    // resurs
    if (s.tur === 'bl') { ochModal(f, { kind: 'resource', parent: p.raw.get(s.id)! }); return; }
    if (s.tur === 'rz') { xab('Resursni smeta RESURSIGA (bog‘lash/zamena) yoki smeta ISHIGA (qo‘shimcha resurs) torting.'); return; }
    if (oshaQatormi(f, s)) { p.onIj(bogla(ij, f.uid, s.id)); xab(`«${f.nom.slice(0, 50)}» bog‘landi.`); return; }
    setTanlov({ f, s, tur: 'resurs' });
  }
  function nomzodBallOf(uid: string, sId: number) {
    const n = p.natija.natijalar.get(uid)?.nomzodlar.find((x) => x.qatorId === sId);
    return n && !n.qavatlar.some((qv) => (qv.nom === 'birlik' || qv.nom === 'marka') && qv.ball < 0) ? n.ball : undefined;
  }
  function ochModal(f: F2Tugun, action: DropAction) {
    if (!action.parent) { xab('Smeta qatori topilmadi — sahifani yangilang.'); return; }
    setModal({ f, action });
  }
  function zamena(f: F2Tugun, s: SmetaQator) {
    const oldRow = p.raw.get(s.id);
    const parent = s.otaId != null ? p.raw.get(s.otaId) : undefined;
    if (!oldRow || !parent) { xab('Zamena uchun smeta qatorining otasi topilmadi.'); return; }
    ochModal(f, { kind: 'replacement', oldRow, parent });
  }
  function keyingiHal() {
    const list = ind.qatorlar;
    const bosh = tanlangan ? list.findIndex((t) => t.uid === tanlangan) + 1 : 0;
    for (let i = 0; i < list.length; i++) {
      const t = list[(bosh + i) % list.length];
      const k = korinish(ij, t.uid);
      if (k === 'topilmadi' || k === 'taklif') {
        setTanlangan(t.uid);
        const ota = ind.ota.get(t.uid);
        if (ota) setYopiqF((s) => { const n = new Set(s); n.delete(ota.uid); return n; });
        requestAnimationFrame(() => document.querySelector(`[data-fuid="${CSS.escape(t.uid)}"]`)?.scrollIntoView({ block: 'center' }));
        return;
      }
    }
    xab('Hal qilinmagan qator qolmadi.');
  }
  function hammaTakliflar() {
    const uidlar = ind.qatorlar.filter((t) => korinish(ij, t.uid) === 'taklif').map((t) => t.uid);
    if (!uidlar.length) return;
    if (!window.confirm(`${uidlar.length} ta ◐ taklifni ko‘rib chiqdingizmi? Hammasi tasdiqlanadi.`)) return;
    p.onIj(tasdiqla(ij, uidlar));
  }

  // ── Chap: F2 daraxti ──
  const halmi = (t: F2Tugun): boolean => {
    const k = korinish(ij, t.uid);
    return k === 'topilmadi' || k === 'taklif' || t.bolalar.some(halmi);
  };
  function f2Qator(t: F2Tugun, depth: number): React.ReactNode {
    if (t.tur === 'rz') {
      const bolalar = t.bolalar.map((c) => f2Qator(c, depth + 1)).filter(Boolean);
      if (!bolalar.length) return null;
      const d = rzDiag.get(t.uid);
      const sNom = d?.smetaRzIdlar.map((id) => S.byId.get(id)?.nom).filter(Boolean).join(' | ');
      return (
        <div key={t.uid}>
          <div draggable={!p.disabled} onDragStart={(e) => { e.dataTransfer.setData('text/plain', t.uid); e.dataTransfer.effectAllowed = 'link'; }}
            style={{ paddingLeft: depth * 12 }} className="flex items-center gap-1.5 rounded px-1.5 py-1 text-[12px] font-semibold text-text cursor-grab"
            title="Razdelni o‘ngdagi smeta razdeliga tortsangiz — shu razdel ichidan qidiriladi">
            <span className="truncate">{t.nom}</span>
            <span className={`ml-auto shrink-0 text-[10px] font-normal ${d?.ok ? 'text-text-mute' : 'text-warn'}`} title={sNom || undefined}>
              {d?.ok ? `→ ${d.usul === 'qolda' ? 'o‘rgatilgan' : 'smeta razdeli'}` : 'razdel topilmadi — torting'}
            </span>
          </div>
          {bolalar}
        </div>
      );
    }
    if (filtr === 'hal' && !halmi(t)) return null;
    const k = korinish(ij, t.uid);
    const B = BELGI[k];
    const b = ij.bog.get(t.uid);
    const s = b ? S.byId.get(b.qatorId) : undefined;
    const ochiq = t.bolalar.length > 0 && !yopiqF.has(t.uid);
    const sel = tanlangan === t.uid;
    return (
      <div key={t.uid}>
        <div data-fuid={t.uid} role="button" tabIndex={0} aria-pressed={sel}
          draggable={!p.disabled}
          onDragStart={(e) => { e.dataTransfer.setData('text/plain', t.uid); e.dataTransfer.effectAllowed = 'link'; setTanlangan(t.uid); }}
          onClick={() => setTanlangan(sel ? null : t.uid)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTanlangan(sel ? null : t.uid); } }}
          style={{ paddingLeft: depth * 12 }}
          className={'group grid cursor-grab grid-cols-[14px_16px_1fr_auto] items-center gap-1 rounded border px-1.5 py-[3px] text-[12px] '
            + (sel ? 'border-accent bg-accent/10' : 'border-transparent hover:bg-surface-2/60')
            + (t.tur === 'rs' ? ' text-text-dim' : ' text-text')}>
          {t.bolalar.length ? (
            <button type="button" aria-label={ochiq ? 'Yopish' : 'Ochish'} className="text-text-mute"
              onClick={(e) => { e.stopPropagation(); setYopiqF((x) => { const n = new Set(x); if (n.has(t.uid)) n.delete(t.uid); else n.add(t.uid); return n; }); }}>
              {ochiq ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          ) : <span />}
          <span className={`text-center font-bold ${B.cls}`} title={B.t}>{B.b}</span>
          <span className="min-w-0">
            <span className="block truncate" title={t.nom}>
              {t.kod && <span className="mr-1 font-mono text-[11px] text-text-mute">{t.kod}</span>}{t.nom}
            </span>
            {s && k !== 'otkazildi' && (
              <span className="block truncate text-[10.5px] text-text-mute" title={s.nom ?? ''}>
                → {s.kod ? s.kod + ' ' : ''}{s.nom}
              </span>
            )}
            {t.ogohlantirish?.length ? <span className="block text-[10.5px] text-danger">{t.ogohlantirish.join('; ')}</span> : null}
          </span>
          <span className="text-right tabular-nums text-[11px] text-text-dim whitespace-nowrap">
            {fmt(t.hajm)} {t.birlik ?? ''}
            {t.barg && t.summa != null && <span className="block text-[10.5px] text-text-mute">{fmt(t.summa, 2)}</span>}
          </span>
        </div>
        {ochiq && t.bolalar.map((c) => f2Qator(c, depth + 1))}
      </div>
    );
  }

  // ── O'ng: smeta daraxti ──
  const qidir = q.trim().toUpperCase();
  const qidiruvNatija = useMemo(() => {
    if (qidir.length < 2) return null;
    const out: SmetaQator[] = [];
    for (const s of S.byId.values()) {
      if (s.tur === 'rz') continue;
      if (((s.kod ?? '') + ' ' + (s.nom ?? '')).toUpperCase().includes(qidir)) { out.push(s); if (out.length >= 150) break; }
    }
    return out;
  }, [qidir, S]);

  function dropProps(s: SmetaQator) {
    const key = 's' + s.id;
    return {
      onDragOver: (e: React.DragEvent) => { if (p.disabled) return; e.preventDefault(); e.dataTransfer.dropEffect = 'link'; if (dropKey !== key) setDropKey(key); },
      onDragLeave: () => { if (dropKey === key) setDropKey(null); },
      onDrop: (e: React.DragEvent) => { e.preventDefault(); setDropKey(null); const uid = e.dataTransfer.getData('text/plain'); if (uid) tashla(uid, s.id); },
    };
  }
  function smetaQator(s: SmetaQator, depth: number, tekis = false): React.ReactNode {
    const bolalar = S.bolalar.get(s.id) ?? [];
    const ochiq = !tekis && ochiqS.has(s.id);
    const nb = nomzodBall.get(s.id);
    const band = shuF2.get(s.id);
    const tBog = tTugun ? ij.bog.get(tTugun.uid)?.qatorId === s.id : false;
    const drop = dropKey === 's' + s.id;
    const toggle = () => setOchiqS((x) => { const n = new Set(x); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; });
    if (s.tur === 'rz') {
      return (
        <div key={s.id}>
          <div data-sid={s.id} {...dropProps(s)} role="button" tabIndex={0}
            onClick={() => (tTugun && tTugun.tur !== 'rs' && tTugun.tur !== 'bl' ? tashla(tTugun.uid, s.id) : toggle())}
            onKeyDown={(e) => { if (e.key === 'Enter') toggle(); }}
            style={{ paddingLeft: depth * 12 }}
            className={'flex items-center gap-1 rounded border px-1.5 py-1 text-[12px] font-semibold '
              + (drop ? 'border-amber-500 bg-amber-500/10' : 'border-transparent hover:bg-surface-2/60')}>
            <button type="button" aria-label={ochiq ? 'Yopish' : 'Ochish'} onClick={(e) => { e.stopPropagation(); toggle(); }} className="text-text-mute">
              {ochiq ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
            <span className="truncate">{s.nom}</span>
            <span className="ml-auto shrink-0 text-[10px] font-normal text-text-mute">{bolalar.length}</span>
            {tTugun?.tur === 'bl' && <button type="button" className="shrink-0 rounded px-1 text-[10px] font-normal text-accent hover:bg-accent/10"
              onClick={(e) => { e.stopPropagation(); tashla(tTugun.uid, s.id); }} title="Tanlangan F2 ishini shu razdelga qo‘shimcha ish sifatida qo‘shish">＋ qo‘shimcha</button>}
          </div>
          {ochiq && bolalar.map((c) => smetaQator(c, depth + 1))}
        </div>
      );
    }
    const old = p.oldingi.get(s.id) ?? 0;
    const qoldiq = s.hajm != null ? s.hajm - old - (band?.hajm ?? 0) : null;
    const yangi = p.raw.get(s.id);
    return (
      <div key={s.id}>
        <div data-sid={s.id} {...dropProps(s)} role="button" tabIndex={0}
          onClick={() => { if (tTugun) tashla(tTugun.uid, s.id); else if (bolalar.length) toggle(); }}
          onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && tTugun) { e.preventDefault(); tashla(tTugun.uid, s.id); } }}
          style={{ paddingLeft: depth * 12 }}
          title={tTugun ? 'Bosing (yoki torting) — tanlangan F2 qatorini shu yerga' : undefined}
          className={'grid grid-cols-[14px_1fr_auto] items-center gap-1 rounded border px-1.5 py-[3px] text-[12px] '
            + (drop ? 'border-amber-500 bg-amber-500/10'
              : tBog ? 'border-accent bg-accent/10'
                : nb != null ? 'border-warn/40 bg-warn/5' : 'border-transparent hover:bg-surface-2/60')
            + (s.tur === 'bl' ? ' text-text' : ' text-text-dim')}>
          {bolalar.length ? (
            <button type="button" aria-label={ochiq ? 'Yopish' : 'Ochish'} onClick={(e) => { e.stopPropagation(); toggle(); }} className="text-text-mute">
              {ochiq ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          ) : <span />}
          <span className="min-w-0">
            <span className="block truncate" title={s.nom ?? ''}>
              {s.kod && <span className="mr-1 font-mono text-[11px] text-text-mute">{s.kod}</span>}{s.nom}
              {(yangi?.qoshimcha || yangi?.zamena) && <span className="ml-1 rounded bg-accent/15 px-1 text-[10px] text-accent">{yangi.zamena ? 'zamena' : 'qo‘shimcha'}</span>}
            </span>
            {tekis && <span className="block truncate text-[10.5px] text-text-mute">{yolMatn(s)}</span>}
          </span>
          <span className="text-right tabular-nums text-[11px] whitespace-nowrap">
            {nb != null && <span className="mr-1.5 rounded bg-warn/15 px-1 text-[10px] text-warn" title="Nomzod bali">{nb}</span>}
            <span className="text-text-dim">{fmt(s.hajm)} {s.birlik ?? ''}</span>
            {(old > 0 || band) && (
              <span className="block text-[10.5px]">
                <span className="text-text-mute">oldin {fmt(old)}</span>
                {band && <span className="ml-1 text-accent">+shu {fmt(band.hajm)}{band.uidlar.length > 1 ? ` (${band.uidlar.length}×)` : ''}</span>}
                {qoldiq != null && <span className={`ml-1 ${qoldiq < -1e-9 ? 'text-danger font-semibold' : 'text-text-mute'}`}>qoldiq {fmt(qoldiq)}</span>}
              </span>
            )}
          </span>
        </div>
        {ochiq && bolalar.map((c) => smetaQator(c, depth + 1))}
      </div>
    );
  }
  function yolMatn(s: SmetaQator) {
    const y: string[] = [];
    for (let t = s.otaId != null ? S.byId.get(s.otaId) : undefined; t; t = t.otaId != null ? S.byId.get(t.otaId) : undefined) y.unshift(t.nom ?? '');
    return y.join(' › ');
  }

  // ── Tanlangan qator paneli ──
  function Panel() {
    if (!tTugun) {
      return <p className="text-[12px] text-text-dim">Chapdan qatorni tanlang (yoki <b>Keyingi hal qilinmagan</b>). Keyin o‘ngdagi smeta qatoriga torting yoki bosing.</p>;
    }
    const k = korinish(ij, tTugun.uid);
    const r = p.natija.natijalar.get(tTugun.uid);
    const b = ij.bog.get(tTugun.uid);
    const s = b ? S.byId.get(b.qatorId) : undefined;
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-start gap-2">
          <span className={`text-lg font-bold leading-none ${BELGI[k].cls}`}>{BELGI[k].b}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-text">{tTugun.kod && <span className="mr-1 font-mono text-text-mute">{tTugun.kod}</span>}{tTugun.nom}</p>
            <p className="text-[11px] text-text-dim">
              {tTugun.tur === 'bl' ? 'Ish' : 'Resurs'} · {fmt(tTugun.hajm)} {tTugun.birlik ?? ''}{tTugun.narx != null ? ` × ${fmt(tTugun.narx, 2)}` : ''}{tTugun.summa != null ? ` = ${fmt(tTugun.summa, 2)}` : ''}
              {' · '}{tTugun.manzil.varaq}!{tTugun.manzil.qator}
            </p>
            {s && <p className="text-[11px] text-accent">→ {s.kod ? s.kod + ' ' : ''}{s.nom} ({s.birlik ?? '—'}) <span className="text-text-mute">[{b!.usul}]</span></p>}
            {r?.sabab && k !== 'qolda' && <p className="text-[11px] text-text-mute">{r.sabab}</p>}
          </div>
          <div className="flex flex-wrap gap-1">
            {k === 'taklif' && <button type="button" className="tugma tugma-asosiy h-7 px-2 text-[12px]" onClick={() => p.onIj(tasdiqla(ij, [tTugun.uid]))}><Check size={13} /> Tasdiqlash</button>}
            {b && <button type="button" className="tugma h-7 px-2 text-[12px]" onClick={() => p.onIj(uz(ij, tTugun))}><Unlink size={13} /> Uzish</button>}
            <button type="button" className="tugma h-7 px-2 text-[12px]" onClick={() => p.onIj(otkazibYubor(ij, tTugun, k !== 'otkazildi'))}>
              <SkipForward size={13} /> {k === 'otkazildi' ? 'Aktga qaytarish' : 'Aktga kiritmaslik'}
            </button>
          </div>
        </div>
        {nomzodlar.length > 0 && (
          <div className="max-h-48 overflow-auto rounded border border-border/60">
            {nomzodlar.slice(0, 8).map((n) => {
              const ns = S.byId.get(n.qatorId);
              if (!ns) return null;
              return (
                <div key={n.qatorId} className="flex items-center gap-2 border-b border-border/40 px-2 py-1 text-[11.5px] last:border-0">
                  <span className="w-8 shrink-0 text-right font-semibold tabular-nums text-warn">{n.ball}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-text">{ns.kod && <span className="mr-1 font-mono text-text-mute">{ns.kod}</span>}{ns.nom} <span className="text-text-mute">({ns.birlik ?? '—'}, {fmt(ns.hajm)})</span></span>
                    <span className="block truncate text-[10.5px] text-text-mute">
                      {n.qavatlar.length ? n.qavatlar.map((qv) => `${qv.izoh} ${qv.ball > 0 ? '+' : ''}${qv.ball}`).join(' · ') : n.sabab.join(', ')}
                      {n.yol ? ` — ${n.yol}` : ''}
                    </span>
                  </span>
                  <button type="button" className="tugma h-6 shrink-0 px-1.5 text-[11px]" onClick={() => (tTugun.tur === 'bl' ? ishBogla(tTugun, ns.id) : (p.onIj(bogla(ij, tTugun.uid, ns.id)), xab('Bog‘landi.')))}>
                    <Link2 size={12} /> Bog‘lash
                  </button>
                  <button type="button" className="tugma h-6 shrink-0 px-1.5 text-[11px]" onClick={() => zamena(tTugun, ns)} title="F2 qatori shu smeta qatori o‘rniga bajarilgan (zamena)">⇄ Zamena</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const halSoni = h.topilmadi + h.taklif;
  return (
    <div className="space-y-2">
      <div className="karta flex flex-wrap items-center gap-x-4 gap-y-1.5 p-2 text-[12px]">
        <span><b className="text-ok">✓ {h.tayyor}</b> bog‘langan</span>
        <span><b className="text-warn">◐ {h.taklif}</b> taklif</span>
        <span><b className="text-danger">✕ {h.topilmadi}</b> topilmadi</span>
        <span><b className="text-text-mute">– {h.otkazildi}</b> kiritilmaydi</span>
        <span className="text-text-dim">Pul: <b className="tabular-nums text-text">{fmt(h.boglanganSumma, 2)}</b> / {fmt(h.hujjatSumma - h.otkazilganSumma, 2)}</span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <button type="button" className="tugma h-7 px-2 text-[12px]" onClick={() => setFiltr(filtr === 'hal' ? 'hammasi' : 'hal')}>
            {filtr === 'hal' ? 'Hammasini ko‘rsatish' : 'Faqat hal qilinmaganlar'}
          </button>
          <button type="button" className="tugma tugma-asosiy h-7 px-2 text-[12px]" disabled={!halSoni} onClick={keyingiHal}>
            <ArrowDownToLine size={13} /> Keyingi hal qilinmagan
          </button>
          {h.taklif > 0 && <button type="button" className="tugma h-7 px-2 text-[12px]" onClick={hammaTakliflar}>◐ Hammasini tasdiqlash ({h.taklif})</button>}
        </div>
      </div>

      <div className="karta p-2"><Panel /></div>
      {xabar && (
        <p role="status" className="flex items-start gap-2 text-[12px] text-text-dim">
          <span className="flex-1">{xabar}</span>
          <button type="button" aria-label="Yopish" onClick={() => setXabar(null)}><X size={13} /></button>
        </p>
      )}

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <section className="karta flex min-h-0 flex-col overflow-hidden" aria-label="F2 akt">
          <header className="border-b border-border bg-surface-2/60 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-dim">
            F2 akt — {p.akt.varaq} {filtr === 'hal' && halSoni === 0 ? '· hammasi hal qilingan' : ''}
          </header>
          <div className="max-h-[62vh] overflow-auto p-1">
            {p.akt.daraxt.map((t) => f2Qator(t, 0))}
            {filtr === 'hal' && halSoni === 0 && <p className="p-3 text-center text-[12px] text-ok">Barcha qatorlar hal qilingan. „Hammasini ko‘rsatish“ bilan tekshirishingiz mumkin.</p>}
          </div>
        </section>
        <section className="karta flex min-h-0 flex-col overflow-hidden" aria-label="Smeta">
          <header className="flex items-center gap-2 border-b border-border bg-surface-2/60 px-2 py-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim">Smeta (LRV)</span>
            <div className="relative flex-1">
              <Search size={12} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-text-mute" />
              <input aria-label="Smetadan qidirish" value={q} onChange={(e) => setQ(e.target.value)} placeholder="shifr yoki nom…"
                className="input h-7 w-full pl-5 pr-1.5 text-[12px]" />
            </div>
          </header>
          <div ref={smetaQuti} className="max-h-[62vh] overflow-auto p-1">
            {qidiruvNatija
              ? (qidiruvNatija.length ? qidiruvNatija.map((s) => smetaQator(s, 0, true)) : <p className="p-2 text-[12px] text-text-mute">Topilmadi.</p>)
              : (S.bolalar.get(null) ?? []).map((s) => smetaQator(s, 0))}
          </div>
        </section>
      </div>

      {tanlov && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setTanlov(null)}>
          <div className="karta w-full max-w-lg space-y-3 p-4" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Bog‘lash turi">
            <h3 className="text-[14px] font-semibold text-text">Bu qanday bog‘lanish?</h3>
            <div className="grid gap-1 text-[12px]">
              <p><span className="text-text-mute">F2:</span> {tanlov.f.kod} {tanlov.f.nom} <span className="text-text-mute">({tanlov.f.birlik ?? '—'}, {fmt(tanlov.f.hajm)})</span></p>
              <p><span className="text-text-mute">Smeta:</span> {tanlov.s.kod} {tanlov.s.nom} <span className="text-text-mute">({tanlov.s.birlik ?? '—'}, {fmt(tanlov.s.hajm)})</span></p>
            </div>
            <div className="grid gap-2">
              <button type="button" className="tugma justify-start text-left" onClick={() => {
                const { f, s } = tanlov; setTanlov(null);
                if (f.tur === 'bl') ishBogla(f, s.id); else { p.onIj(bogla(ij, f.uid, s.id)); xab('Bog‘landi.'); }
              }}>
                <Link2 size={14} /> <span><b>Bog‘lash</b> — bu o‘sha {tanlov.tur === 'ish' ? 'ish' : 'resurs'} (nomi/shifri boshqacha yozilgan)</span>
              </button>
              <button type="button" className="tugma justify-start text-left" onClick={() => { const { f, s } = tanlov; setTanlov(null); zamena(f, s); }}>
                <span>⇄</span> <span><b>{tanlov.tur === 'ish' ? 'Zamena ish' : 'Zamena material'}</b> — smetadagi qator o‘rniga F2 dagisi bajarilgan (yangi qator, eskisi o‘zgarmaydi)</span>
              </button>
              {tanlov.tur === 'ish' && tanlov.s.otaId != null && (
                <button type="button" className="tugma justify-start text-left" onClick={() => { const { f, s } = tanlov; setTanlov(null); ochModal(f, { kind: 'additional', parent: p.raw.get(s.otaId!)! }); }}>
                  <span>＋</span> <span><b>Qo‘shimcha ish</b> — smetada yo‘q ish, shu razdelga qo‘shiladi</span>
                </button>
              )}
              <button type="button" className="tugma" onClick={() => setTanlov(null)}>Bekor qilish</button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <F2AddReplModal
          action={modal.action}
          companyId={p.companyId}
          objectId={p.objectId}
          initialNom={modal.f.nom}
          initialKod={modal.f.kod ?? undefined}
          initialBirlik={modal.f.birlik ?? undefined}
          initialHajm={modal.f.hajm ?? undefined}
          onClose={() => setModal(null)}
          onCreated={(id) => { const f = modal.f; setModal(null); void p.onYaratildi(f, id); }}
        />
      )}
    </div>
  );
}
