/**
 * FaylBoglash.tsx — OBYEKT SOZLAMASI (eski GAS paneldagi «Файл боғлаш»)
 *
 * Foydalanuvchi (2026-08-16): «hali ham eski paneldagi ko'plab funksiyalar
 * yo'qda... butun tizim haqida aytdim».
 *
 * AUDIT NATIJASI: GAS da 252 ta `api*` funksiya bor, sayt 83 tasini
 * ishlatadi. Eski panelda 12 bo'lim bor edi, saytda 4 tasi yo'q:
 *   1. Файл боғлаш  ← BU SAHIFA (eng muhimi)
 *   2. Ҳужжатлар
 *   3. Шахсий смета
 *   4. Supabase
 *
 * NIMA UCHUN BU ENG MUHIMI: usiz YANGI OBYEKTNI umuman sozlab bo'lmaydi.
 * Dvigatel qaysi fayl SMETA, qaysi fayl SVODKA ekanini, qaysi varaqlarni
 * o'qishni va svodkada narx qaysi ustunda turishini shu yerdan biladi.
 * Sozlanmasa — «svodka yo'q» va narxlash umuman ishlamaydi.
 * GAS API lari BOR edi (apiBoglashSaqla, apiSheetlarOl, apiSvodUstunSaqla),
 * faqat sayt ularni chaqirmasdi va eski GAS panelga qaytish kerak bo'lardi.
 */
import { useState, useMemo, useEffect } from 'react';
import { Save, FileSpreadsheet, AlertTriangle, CheckCircle2, RefreshCw, Search } from 'lucide-react';
import { Sahifa } from '../../umumiy/ui/Sahifa';
import { toast } from '../../umumiy/ui/Toast';
import {
  useObyektlar, useSheetlar, useBoglashSaqla, useSvodUstunSaqla,
  type BoglashYozuv,
} from '../../api/hooks';
import type { PapkaObyekt } from '../../api/types';

/** Svodka ustunlari — nomi va izohi */
const SVOD_USTUN: Array<{ kalit: keyof NonNullable<PapkaObyekt['svodCols']>; nom: string; izoh: string }> = [
  { kalit: 'nom',   nom: 'НОМ',    izoh: 'Resurs nomi turgan ustun' },
  { kalit: 'bir',   nom: 'БИРЛИК', izoh: 'O\'lchov birligi' },
  { kalit: 'narx',  nom: 'НАРХ',   izoh: 'Birlik narxi — ENG MUHIMI' },
  { kalit: 'blok',  nom: 'БЛОК',   izoh: 'Blok/bo\'lim ustuni (ixtiyoriy)' },
  { kalit: 'qty',   nom: 'МИҚДОР', izoh: 'Miqdor (ixtiyoriy)' },
  { kalit: 'summa', nom: 'СУММА',  izoh: 'Jami summa (ixtiyoriy)' },
];

export default function FaylBoglash() {
  const obyektlar = useObyektlar();
  const saqla = useBoglashSaqla();
  const svodSaqla = useSvodUstunSaqla();

  const [tanlangan, setTanlangan] = useState<string>('');
  const [qidiruv, setQidiruv] = useState('');
  /** Tahrirlanayotgan nusxa — saqlanmaguncha serverga tegilmaydi */
  const [ozgarish, setOzgarish] = useState<Record<string, Partial<BoglashYozuv>>>({});

  const royxat = useMemo(() => {
    const q = qidiruv.trim().toLowerCase();
    const b = obyektlar.data ?? [];
    return q ? b.filter((o) => o.obyekt.toLowerCase().includes(q)) : b;
  }, [obyektlar.data, qidiruv]);

  /* Birinchi obyektni avtomatik tanlaymiz */
  useEffect(() => {
    if (!tanlangan && royxat.length) setTanlangan(royxat[0].obyekt);
  }, [royxat, tanlangan]);

  const joriy = useMemo(
    () => (obyektlar.data ?? []).find((o) => o.obyekt === tanlangan),
    [obyektlar.data, tanlangan]);

  /** Joriy qiymat: tahrirlangan bo'lsa o'sha, aks holda serverdagi */
  const q = <K extends keyof BoglashYozuv>(kalit: K): BoglashYozuv[K] => {
    const oz = ozgarish[tanlangan];
    if (oz && oz[kalit] !== undefined) return oz[kalit] as BoglashYozuv[K];
    return (joriy as unknown as BoglashYozuv)?.[kalit];
  };
  const yoz = <K extends keyof BoglashYozuv>(kalit: K, qiymat: BoglashYozuv[K]) =>
    setOzgarish((p) => ({ ...p, [tanlangan]: { ...(p[tanlangan] || {}), [kalit]: qiymat } }));

  const lokVaraqlar = useSheetlar(String(q('lokId') || joriy?.lokId || ''));
  const svodVaraqlar = useSheetlar(String(q('svodId') || joriy?.svodId || ''));

  const ozgarganSoni = Object.keys(ozgarish).length;

  /** Saqlash: server BUTUN varaqni qayta yozadi — barcha obyekt yuboriladi */
  const saqlash = () => {
    if (!obyektlar.data?.length) return;
    const pairs: BoglashYozuv[] = obyektlar.data.map((o) => {
      const oz = ozgarish[o.obyekt] || {};
      return {
        obyekt: o.obyekt,
        lokId: oz.lokId ?? o.lokId,
        lokName: oz.lokName ?? o.lokName,
        svodId: oz.svodId ?? o.svodId,
        svodName: oz.svodName ?? o.svodName,
        format: oz.format ?? o.format,
        lokSheets: oz.lokSheets ?? o.lokSheets,
        svodSheets: oz.svodSheets ?? o.svodSheets,
        svodCols: oz.svodCols ?? o.svodCols,
        narxTayyor: oz.narxTayyor ?? o.narxTayyor,
      };
    });
    saqla.mutate(pairs, {
      onSuccess: () => {
        toast(`${ozgarganSoni} ta obyekt sozlamasi saqlandi`, 'ok', undefined, 7000);
        setOzgarish({});
      },
      onError: (e: Error) => toast(e.message, 'danger', undefined, 9000),
    });
  };

  const varaqTanlov = (
    barchasi: string[] | undefined, tanlanganlar: string[] | undefined,
    ozgart: (v: string[]) => void, bosh: string,
  ) => {
    const t = tanlanganlar ?? [];
    if (!barchasi?.length) {
      return <p className="text-[11px] text-text-mute italic">{bosh}</p>;
    }
    return (
      <div className="max-h-40 overflow-y-auto scrollbar-thin space-y-0.5 rounded
                      border border-border bg-[var(--surface-2)]/30 p-1.5">
        {barchasi.map((v) => {
          const bor = t.includes(v);
          return (
            <label key={v}
              className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-[12px]
                          transition-colors ${bor ? 'bg-accent/15 text-text' : 'hover:bg-white/5 text-text-dim'}`}>
              <input type="checkbox" checked={bor} className="accent-[var(--accent)] cursor-pointer"
                onChange={() => ozgart(bor ? t.filter((x) => x !== v) : [...t, v])} />
              <span className="truncate" title={v}>{v}</span>
            </label>
          );
        })}
        <p className="text-[10px] text-text-mute px-2 pt-1">
          Hech biri belgilanmasa — <b>barcha varaqlar</b> o'qiladi.
        </p>
      </div>
    );
  };

  return (
    <Sahifa
      sarlavha="Fayl bog'lash"
      tavsif="Obyekt sozlamasi — qaysi fayl smeta, qaysi fayl svodka, qaysi varaqlar va ustunlar"
    >
      <div className="flex gap-4 h-full min-h-0">
        {/* ── CHAP: obyektlar ro'yxati ────────────────────────────── */}
        <div className="w-[300px] flex-shrink-0 flex flex-col gap-2 min-h-0">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-mute" />
            <input value={qidiruv} onChange={(e) => setQidiruv(e.target.value)}
              placeholder="Obyekt qidirish…"
              className="w-full pl-8 pr-2 py-2 rounded-lg bg-[var(--surface-2)] border border-border
                         text-[13px] text-text outline-none focus:border-accent/50" />
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin space-y-1 min-h-0">
            {obyektlar.isLoading && <div className="skel h-10 rounded" />}
            {royxat.map((o) => {
              const svodYoq = !o.svodName || o.svodName === "(yo'q)";
              const lokYoq = !o.lokName || o.lokName === "(yo'q)";
              const ozgargan = !!ozgarish[o.obyekt];
              return (
                <button key={o.obyekt} onClick={() => setTanlangan(o.obyekt)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg border transition-colors
                    ${tanlangan === o.obyekt
                      ? 'bg-accent/15 border-accent/40'
                      : 'bg-[var(--surface-2)]/40 border-border hover:bg-white/5'}`}>
                  <div className="flex items-start gap-1.5">
                    <span className="flex-1 text-[12px] text-text leading-tight break-words">
                      {o.obyekt}
                    </span>
                    {ozgargan && <span className="text-[9px] text-amber-400 flex-shrink-0">●</span>}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    {lokYoq
                      ? <span className="text-[9px] px-1 rounded bg-danger/20 text-danger">smeta yo'q</span>
                      : <span className="text-[9px] px-1 rounded bg-emerald-500/15 text-emerald-400">smeta ✓</span>}
                    {svodYoq
                      ? <span className="text-[9px] px-1 rounded bg-warn/20 text-warn">svodka yo'q</span>
                      : <span className="text-[9px] px-1 rounded bg-emerald-500/15 text-emerald-400">svodka ✓</span>}
                    <span className="text-[9px] px-1 rounded bg-white/5 text-text-mute">{o.format || 'TN'}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {ozgarganSoni > 0 && (
            <button onClick={saqlash} disabled={saqla.isPending}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg
                         bg-accent text-white text-[13px] font-medium hover:bg-accent/90
                         transition-colors disabled:opacity-50">
              <Save size={15} />
              {saqla.isPending ? 'Saqlanmoqda…' : `${ozgarganSoni} ta o'zgarishni saqlash`}
            </button>
          )}
        </div>

        {/* ── O'NG: sozlama ──────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0 pr-1">
          {!joriy ? (
            <div className="karta p-6 text-center text-text-mute text-sm">
              Chapdan obyekt tanlang
            </div>
          ) : (
            <div className="space-y-4">
              <div className="karta p-4">
                <h3 className="text-[15px] font-semibold text-text mb-3 flex items-center gap-2">
                  <FileSpreadsheet size={17} className="text-accent" />
                  {joriy.obyekt}
                </h3>

                {/* Fayllar */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[12px] font-medium text-text block mb-1.5">
                      Smeta fayli (лок)
                    </label>
                    <select value={String(q('lokId') || '')}
                      onChange={(e) => {
                        const c = joriy.candidates?.find((x) => x.id === e.target.value);
                        yoz('lokId', e.target.value);
                        yoz('lokName', c?.name || '');
                        yoz('lokSheets', []);
                      }}
                      className="w-full bg-[var(--surface-2)] border border-border rounded
                                 px-2 py-1.5 text-[12px] text-text">
                      <option value="">— tanlanmagan —</option>
                      {(joriy.candidates ?? []).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                      {joriy.lokId && !joriy.candidates?.some((c) => c.id === joriy.lokId) && (
                        <option value={joriy.lokId}>{joriy.lokName} (joriy)</option>
                      )}
                    </select>
                    <div className="mt-2">
                      <p className="text-[11px] text-text-mute mb-1">O'qiladigan varaqlar:</p>
                      {varaqTanlov(lokVaraqlar.data, q('lokSheets') as string[],
                        (v) => yoz('lokSheets', v),
                        lokVaraqlar.isLoading ? 'Varaqlar o\'qilmoqda…' : 'Avval faylni tanlang')}
                    </div>
                  </div>

                  <div>
                    <label className="text-[12px] font-medium text-text block mb-1.5">
                      Svodka fayli (нарх манбаи)
                    </label>
                    <select value={String(q('svodId') || '')}
                      onChange={(e) => {
                        const c = joriy.candidates?.find((x) => x.id === e.target.value);
                        yoz('svodId', e.target.value);
                        yoz('svodName', c?.name || '');
                        yoz('svodSheets', []);
                      }}
                      className="w-full bg-[var(--surface-2)] border border-border rounded
                                 px-2 py-1.5 text-[12px] text-text">
                      <option value="">— tanlanmagan —</option>
                      {(joriy.candidates ?? []).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                      {joriy.svodId && !joriy.candidates?.some((c) => c.id === joriy.svodId) && (
                        <option value={joriy.svodId}>{joriy.svodName} (joriy)</option>
                      )}
                    </select>
                    <div className="mt-2">
                      <p className="text-[11px] text-text-mute mb-1">O'qiladigan varaqlar:</p>
                      {varaqTanlov(svodVaraqlar.data, q('svodSheets') as string[],
                        (v) => yoz('svodSheets', v),
                        svodVaraqlar.isLoading ? 'Varaqlar o\'qilmoqda…' : 'Avval faylni tanlang')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Format + narxTayyor */}
              <div className="karta p-4 space-y-3">
                <div className="flex items-center gap-4 flex-wrap">
                  <div>
                    <label className="text-[12px] font-medium text-text block mb-1.5">Format</label>
                    <select value={String(q('format') || 'TN')}
                      onChange={(e) => yoz('format', e.target.value)}
                      className="bg-[var(--surface-2)] border border-border rounded
                                 px-3 py-1.5 text-[12px] text-text">
                      <option value="TN">TN</option>
                      <option value="ABC">ABC</option>
                    </select>
                  </div>

                  {/* ⚡ narxTayyor — smeta ichida narx allaqachon bor bo'lsa,
                      svodka TALAB QILINMAYDI (dvigatel uni o'tkazib yuboradi) */}
                  <label className="flex items-start gap-2 cursor-pointer mt-5">
                    <input type="checkbox" checked={!!q('narxTayyor')}
                      onChange={(e) => yoz('narxTayyor', e.target.checked)}
                      className="accent-[var(--accent)] cursor-pointer mt-0.5" />
                    <span className="text-[12px] text-text leading-snug">
                      Narx tayyor
                      <span className="block text-[10px] text-text-mute">
                        Smetada narx allaqachon bor — svodka talab qilinmaydi
                      </span>
                    </span>
                  </label>
                </div>

                {!q('svodId') && !q('narxTayyor') && (
                  <div className="flex items-start gap-2 p-2 rounded bg-warn/10 border border-warn/30">
                    <AlertTriangle size={14} className="text-warn flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-warn leading-snug">
                      Svodka tanlanmagan va «Narx tayyor» ham belgilanmagan —
                      <b> narxlash ishlamaydi</b> va obyekt hisoblanmaydi.
                    </p>
                  </div>
                )}
              </div>

              {/* Svodka ustunlari */}
              <div className="karta p-4">
                <h4 className="text-[13px] font-semibold text-text mb-1">Svodka ustunlari</h4>
                <p className="text-[11px] text-text-mute mb-3">
                  Svodka faylida qaysi ma'lumot qaysi ustunda turishi (raqam bilan: A=1, B=2…).
                  Bo'sh qoldirilsa tizim o'zi topishga urinadi.
                  <b className="text-text"> Papkadagi barcha lokalkaga tarqaladi.</b>
                </p>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {SVOD_USTUN.map((u) => (
                    <div key={u.kalit}>
                      <label className="text-[11px] font-medium text-text block mb-1">
                        {u.nom}
                        {u.kalit === 'narx' && <span className="text-danger"> *</span>}
                      </label>
                      <input type="number" min={1}
                        value={String((q('svodCols') as Record<string, number>)?.[u.kalit] ?? '')}
                        onChange={(e) => yoz('svodCols', {
                          ...((q('svodCols') as Record<string, number>) || {}),
                          [u.kalit]: e.target.value ? Number(e.target.value) : undefined,
                        } as BoglashYozuv['svodCols'])}
                        placeholder="—"
                        className="w-full bg-[var(--surface-2)] border border-border rounded
                                   px-2 py-1.5 text-[12px] text-text outline-none focus:border-accent/50" />
                      <p className="text-[10px] text-text-mute mt-0.5 leading-tight">{u.izoh}</p>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => {
                    const sc = (q('svodCols') as Record<string, number>) || {};
                    svodSaqla.mutate({ obyekt: tanlangan, svodCols: sc }, {
                      onSuccess: () => toast('Svodka ustunlari saqlandi (papkadagi barcha lokalkaga)', 'ok', undefined, 7000),
                      onError: (e: Error) => toast(e.message, 'danger'),
                    });
                  }}
                  disabled={svodSaqla.isPending}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-border
                             text-[12px] text-text transition-colors disabled:opacity-50">
                  {svodSaqla.isPending ? 'Saqlanmoqda…' : 'Faqat ustunlarni saqlash'}
                </button>
              </div>

              {ozgarish[tanlangan] && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <RefreshCw size={14} className="text-amber-400 flex-shrink-0" />
                  <p className="text-[12px] text-amber-300 flex-1">
                    Bu obyektda saqlanmagan o'zgarish bor. Chapdagi tugma bilan saqlang.
                  </p>
                  <button
                    onClick={() => setOzgarish((p) => {
                      const n = { ...p }; delete n[tanlangan]; return n;
                    })}
                    className="text-[11px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-text-mute">
                    Bekor qilish
                  </button>
                </div>
              )}

              {!ozgarish[tanlangan] && joriy.svodId && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
                  <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
                  <p className="text-[12px] text-emerald-300">
                    Sozlama to'liq — bu obyekt hisoblanishga tayyor.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Sahifa>
  );
}
