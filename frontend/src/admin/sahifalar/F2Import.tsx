import { useMemo, useRef, useState } from 'react';
import {
  useObyektlar, useF2Lokalkalar, useF2FaylYukla,
  useF2AvtoMoslash, useF2Yoz, useF2JobHolat, useF2Fayllar, useF2Varaqlar, useF2Ustunlar, useF2Daraxt, useHolat,
} from '../../api/hooks';
import {
  Sahifa, KpiKarta, Nishon, Tugma, Maydon, Kiritma, Tanlov, Juft, XatoHolat,
} from '../../umumiy/ui/Sahifa';
import { FmtN } from '../../lib/format';
import { IkkiPanel } from '../../umumiy/ui/IkkiPanel';
import { F2Daraxt, type DaraxtTugun } from '../../umumiy/ui/F2Daraxt';
import { toast } from '../../umumiy/ui/Toast';
import { Upload, FileSpreadsheet, Wand2, CheckCircle2, AlertTriangle, Send } from 'lucide-react';
import type { AktNode, F2Moslik, F2MoslashNatija } from '../../api/types';

/* Akt daraxtidagi BARCHA barg (leaf) tugunlar — jami summa faqat shulardan.
 * ⚠️ bl summasi bolalarining yig'indisi bo'lgani uchun uni QO'SHSAK ikki marta
 * hisoblanadi (ilgari «akt 171M, yozildi 227M» xatosi shundan chiqqan). */
function barglar(nodes: AktNode[] = []): AktNode[] {
  const out: AktNode[] = [];
  const yur = (ns: AktNode[]) => ns.forEach((n) => {
    const bolalar = n.children ?? [];
    if (n.type !== 'rz' && bolalar.length === 0) out.push(n);
    if (bolalar.length) yur(bolalar);
  });
  yur(nodes);
  return out;
}

const QADAMLAR = ['Fayl', "Moslashtirish va bog'lash", 'Yozish'];

export function F2Import() {
  const obyektlar = useObyektlar();
  const [obyekt, setObyekt] = useState('');
  const [oyNom, setOyNom] = useState(() => {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  });
  const [lokalka, setLokalka] = useState('');
  const [qadam, setQadam] = useState(0);
  const [aktTree, setAktTree] = useState<AktNode[] | null>(null);
  const [natija, setNatija] = useState<F2MoslashNatija | null>(null);
  const [yozishBoshlandi, setYozishBoshlandi] = useState(false);
  const [fid, setFid] = useState('');
  const [faylNomi, setFaylNomi] = useState('');
  const [varaq, setVaraq] = useState('');
  const [cfg, setCfg] = useState<{kod:number;nom:number;bir:number;norma:number;obyom:number;narx:number;sum:number} | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [filtr, setFiltr] = useState<'hammasi' | 'boglanmagan' | 'boglangan'>('hammasi');
  const [qolBekor, setQolBekor] = useState<Set<string>>(new Set());
  const [qolBog, setQolBog] = useState<Record<string, F2Moslik>>({});
  const faylRef = useRef<HTMLInputElement>(null);

  const loklar = useF2Lokalkalar(obyekt);
  const fayllar = useF2Fayllar(obyekt);
  const yukla = useF2FaylYukla();
  const varaqlar = useF2Varaqlar(fid);
  const ustun = useF2Ustunlar();
  const daraxt = useF2Daraxt();
  const moslash = useF2AvtoMoslash();
  const yoz = useF2Yoz();
  const job = useF2JobHolat(yozishBoshlandi);
  const lrv = useHolat(obyekt);

  const obNomlari = useMemo(
    () => Array.from(new Set((obyektlar.data ?? []).map((o) => o.obyekt.split(' - ')[0]))),
    [obyektlar.data],
  );

  const aktBarglar = useMemo(() => barglar(aktTree ?? []), [aktTree]);
  const aktJami = useMemo(() => aktBarglar.reduce((a, n) => a + (n.summa || 0), 0), [aktBarglar]);
  /** Akt daraxtidagi BARCHA tugun (bl ham) — qo'lda bog'lashda izlash uchun */
  const aktBarchaTugun = useMemo(() => {
    const out: AktNode[] = [];
    const yur = (ns: AktNode[]) => (ns ?? []).forEach((n) => { if (n.type !== 'rz') out.push(n); if (n.children?.length) yur(n.children); });
    yur(aktTree ?? []);
    return out;
  }, [aktTree]);

  /** Barg uid'lari — solishtiruv FAQAT shular bo'yicha */
  const bargUidlar = useMemo(() => new Set(aktBarglar.map((n) => n.uid)), [aktBarglar]);

  /**
   * Bog'langan summa — FAQAT BARG mosliklaridan.
   * ⚠️ `mosliklar` ichida ish (bl) qatorlari HAM bor, va `bl.summa` o'z
   * bolalarining yig'indisi. Hammasini qo'shsak bir pul IKKI MARTA sanaladi —
   * shuning uchun «Bog'langan» akt jamisidan katta chiqib, farq manfiy bo'lardi
   * (1.96 mlrd > 1.44 mlrd, farq −714 mln). aktJami barglardan olinadi, demak
   * bog'langan ham barglardan olinishi shart.
   */
  /* Bog'lanishlar: uid -> {varaq,row} va teskarisi. Qo'lda bekor qilinganlar chiqariladi. */
  const moslikMap = useMemo(() => {
    const m = new Map<string, F2Moslik>();
    (natija?.mosliklar ?? []).forEach((x) => { if (!qolBekor.has(x.uid)) m.set(x.uid, x); });
    Object.values(qolBog).forEach((x) => m.set(x.uid, x));   // qo'lda bog'langanlar ustuvor
    return m;
  }, [natija, qolBekor, qolBog]);
  const joyMap = useMemo(() => {
    const m = new Map<string, string>();
    moslikMap.forEach((v, uid) => m.set(`${v.varaq}#${v.row}`, uid));
    return m;
  }, [moslikMap]);
  const boglanganJoylar = useMemo(() => new Set(joyMap.keys()), [joyMap]);
  const boglanganJami = useMemo(
    () => [...moslikMap.values()].filter((m) => bargUidlar.has(m.uid)).reduce((a, m) => a + (m.summa || 0), 0),
    [moslikMap, bargUidlar],
  );

  /** Ish (bl) darajasida bog'langanlar — alohida ko'rsatiladi, summaga QO'SHILMAYDI */
  const ishMosliklari = useMemo(
    () => [...moslikMap.values()].filter((m) => !bargUidlar.has(m.uid)).length,
    [moslikMap, bargUidlar],
  );
  /** Bog'lanmagan barglar — ular ➕ qo'shimcha bo'lib ketadi */
  const boglanmagan = useMemo(() => {
    return aktBarglar.filter((n) => !moslikMap.has(n.uid));
  }, [aktBarglar, moslikMap]);
  const dopJami = useMemo(() => boglanmagan.reduce((a, n) => a + (n.summa || 0), 0), [boglanmagan]);



  function bogBekor(uid: string) {
    setQolBekor((p) => new Set(p).add(uid));
    setQolBog((p) => { const n = { ...p }; delete n[uid]; return n; });
  }

  /** Sudrab tashlash: akt qatori → smeta qatori. «varaq#row» dan ajratamiz. */
  function qolBogla(aktKalit: string, smetaKalit: string) {
    const i = smetaKalit.lastIndexOf('#');
    if (i < 0) return;
    const varaqNom = smetaKalit.slice(0, i);
    const row = Number(smetaKalit.slice(i + 1));
    if (!row) return;
    if (joyMap.has(smetaKalit)) { toast('Bu smeta qatori allaqachon band'); return; }
    const n = aktBarglar.find((x) => x.uid === aktKalit)
      ?? aktBarchaTugun.find((x) => x.uid === aktKalit);
    if (!n) { toast('Akt qatori topilmadi'); return; }
    setQolBekor((p) => { const s = new Set(p); s.delete(aktKalit); return s; });
    setQolBog((p) => ({
      ...p,
      [aktKalit]: {
        uid: aktKalit, varaq: varaqNom, row,
        kod: n.kod ?? '', hajm: n.hajm ?? 0, narx: n.narx ?? 0, summa: n.summa ?? 0,
      },
    }));
    toast(`Bog'landi: ${String(n.nom).slice(0, 34)} → ${row}-qator`);
  }

  /* ---------- Daraxtlar (ikki panel uchun) ---------- */

  /** AKT daraxti — razdel → ish → resurs, bog'lanish belgilari bilan */
  const aktDaraxt = useMemo((): DaraxtTugun[] => {
    const map = (ns: AktNode[]): DaraxtTugun[] => (ns ?? []).map((n) => ({
      kalit: n.uid,
      type: n.type,
      nom: n.nom,
      kod: n.kod,
      bir: n.bir,
      summa: n.summa,
      belgi: n.type === 'rz' ? undefined : <FmtN val={n.summa} />,
      children: n.children?.length ? map(n.children) : undefined,
    }));
    return map(aktTree ?? []);
  }, [aktTree]);

  /** SMETA daraxti — LRV_PLUS ierarxiyasi */
  const smetaDaraxt = useMemo((): DaraxtTugun[] => {
    const map = (ns: any[]): DaraxtTugun[] => (ns ?? []).map((n) => ({
      kalit: n.type === 'rz' ? `rz:${n.nom}:${n.row ?? ''}` : `${n.varaq}#${n.row}`,
      type: n.type,
      nom: n.nom,
      kod: n.kod,
      bir: n.birlik,
      belgi: n.type === 'rz' ? undefined : <span className="text-text-mute">{n.row}</span>,
      children: n.children?.length ? map(n.children) : undefined,
    }));
    return map(lrv.data?.tree ?? []);
  }, [lrv.data]);

  const farq = aktJami - (boglanganJami + dopJami);
  const constOk = Math.abs(farq) < 1;

  /* ---------- 1a. Faylni tanlash — varaq bosqichiga o'tadi ----------
   * ⚠️ apiF2FaylOqi IKKI BOSQICHLI. Avval bir marta chaqirib `tree` kutilgani
   * uchun har doim «fayl o'qilmadi» chiqardi (u `mode:'config'` qaytaradi). */
  function faylTanla(fileId: string, nom: string) {
    setFid(fileId);
    setFaylNomi(nom);
    setVaraq('');
    setCfg(null);
  }

  /** Varaq tanlandi → ustunlarni tahlil qilamiz */
  async function varaqTanla(v: string) {
    setVaraq(v);
    setCfg(null);
    try {
      const r = await ustun.mutateAsync({ fileId: fid, varaq: v });
      if (!r.ok) { toast(r.xabar || "Varaq o'qilmadi"); return; }
      if (r.tree) { setAktTree(r.tree); setQadam(1); return; }   // config kerak emas
      if (r.cols) setCfg(r.cols);
      else toast('Ustunlar aniqlanmadi');
    } catch (e: any) { toast(`Xato: ${e.message}`); }
  }

  /** Ustunlar tasdiqlandi → daraxt quriladi */
  async function daraxtQur() {
    if (!cfg) return;
    try {
      const r = await daraxt.mutateAsync({ fileId: fid, varaq, colConfig: cfg });
      if (!r.ok || !r.tree) { toast(r.xabar || "Daraxt qurilmadi"); return; }
      setAktTree(r.tree);
      setQadam(1);
      toast(`${faylNomi}: ${barglar(r.tree).length} ta qator o'qildi`);
    } catch (e: any) { toast(`Xato: ${e.message}`); }
  }

  /* ---------- 1b. Kompyuterdan yuklash ---------- */
  async function faylTanlandi(f: File) {
    if (!obyekt) { toast('Avval obyektni tanlang'); return; }
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(',')[1] ?? '');
        r.onerror = rej;
        r.readAsDataURL(f);
      });
      const u = await yukla.mutateAsync({
        obyekt, base64, mimeType: f.type || 'application/vnd.ms-excel', filename: f.name, oyNom,
      });
      if (!u.ok || !u.fileId) { toast(u.xabar || 'Fayl yuklanmadi'); return; }
      fayllar.refetch();
      faylTanla(u.fileId, u.name || f.name);
      toast('Yuklandi — endi varaqni tanlang');
    } catch (e: any) { toast(`Xato: ${e.message}`); }
  }

  /* ---------- 2. Moslashtirish ---------- */
  async function moslashtir() {
    if (!aktTree) return;
    try {
      const r = await moslash.mutateAsync({ aktTree, obyekt, lokalka });
      setNatija(r);
    } catch (e: any) { toast(`Moslashtirishda xato: ${e.message}`); }
  }

  /* ---------- 4. Yozish ---------- */
  async function yozish() {
    if (!natija) return;
    const dopps = boglanmagan.map((n) => ({
      uid: n.uid, nom: n.nom, kod: n.kod || '', bir: n.bir || '',
      hajm: n.hajm || 0, narx: n.narx || 0, summa: n.summa || 0,
      type: n.type, tur: n.type === 'bl' ? 'bl' : n.type, kat: '', action: 'dop',
    }));
    try {
      const r = await yoz.mutateAsync({
        obyekt, oyNom, edits: [...moslikMap.values()] as F2Moslik[], dopps, aktJami,
      });
      if (!r.ok) { toast(r.xabar || 'Navbatga qo\'shilmadi'); return; }
      setYozishBoshlandi(true);
      setQadam(2);
    } catch (e: any) { toast(`Xato: ${e.message}`); }
  }

  const j = job.data?.job;
  const foiz = j?.total ? Math.round(((j.done || 0) / j.total) * 100) : 0;

  return (
    <Sahifa
      sarlavha="Ф2 импорт"
      tavsif="Akt faylini smetaga bog'lash — summa tiyingacha mos tushishi shart"
    >
      {/* Qadamlar */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {QADAMLAR.map((nom, i) => (
          <div key={nom} className="flex items-center gap-2">
            <span className={`h-7 px-3 inline-flex items-center gap-2 rounded-full text-[12px] font-medium border
              ${i === qadam ? 'bg-accent text-white border-transparent'
                : i < qadam ? 'bg-ok/10 text-ok border-ok/25'
                : 'karta text-text-mute'}`}>
              {i < qadam ? <CheckCircle2 size={13} /> : <span className="tabular-nums">{i + 1}</span>}
              {nom}
            </span>
            {i < QADAMLAR.length - 1 && <span className="text-text-mute">→</span>}
          </div>
        ))}
      </div>

      {/* ---------- QADAM 1 ---------- */}
      {qadam === 0 && (
        <div className="karta p-5 space-y-4 max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Maydon nom="Obyekt">
              <Tanlov
                qiymat={obyekt}
                ozgardi={(v) => { setObyekt(v); setLokalka(''); }}
                variantlar={['', ...obNomlari]}
              />
            </Maydon>
            <Maydon nom="Oy" izoh="MM.YYYY">
              <Kiritma qiymat={oyNom} ozgardi={setOyNom} placeholder="07.2026" />
            </Maydon>
          </div>

          {loklar.data?.kop && (
            <Maydon nom="Lokalka" izoh="Bo'sh qoldirsangiz tizim o'zi aniqlaydi — tavsiya etiladi">
              <Tanlov qiymat={lokalka} ozgardi={setLokalka} variantlar={['', ...(loklar.data.lokalkalar || [])]} />
            </Maydon>
          )}

          {/* ⭐ Drive'dagi TAYYOR Ф2 fayllar — asosiy yo'l.
              Har safar kompyuterdan tashlash shart emas. */}
          {obyekt && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[11px] uppercase tracking-[0.04em] text-text-dim">
                  Drive papkasidagi Ф2 fayllar
                </h4>
                {fayllar.isFetching && <span className="text-[11px] text-text-mute">qidirilmoqda…</span>}
              </div>

              {fayllar.isLoading ? (
                <div className="karta divide-y divide-border">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="px-4 py-3"><div className="skel h-3 rounded w-2/3" /></div>
                  ))}
                </div>
              ) : (fayllar.data?.fayllar ?? []).length === 0 ? (
                <div className="karta p-4 text-sm text-text-dim">
                  Bu obyekt papkasida Ф2 fayl topilmadi.
                  {fayllar.data?.xabar && <span className="text-text-mute"> ({fayllar.data.xabar})</span>}
                  <span className="block mt-1">Pastdan kompyuterdan yuklashingiz mumkin.</span>
                </div>
              ) : (
                <div className="karta divide-y divide-border max-h-64 overflow-y-auto">
                  {(fayllar.data?.fayllar ?? []).map((f) => (
                    <button
                      key={f.id}
                      onClick={() => faylTanla(f.id, f.name)}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 text-sm
                                 transition-colors duration-[120ms] cursor-pointer
                                 ${fid === f.id ? 'bg-[var(--accent)]/10' : 'hover:bg-[var(--surface-2)]/60'}`}
                    >
                      <FileSpreadsheet size={16} className={fid === f.id ? 'text-accent' : 'text-text-dim'} />
                      <span className={`truncate flex-1 ${fid === f.id ? 'text-accent' : 'text-text'}`} title={f.name}>
                        {f.name}
                      </span>
                      <span className="text-[11px] text-text-mute">{fid === f.id ? '✓ tanlandi' : 'tanlash →'}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Muqobil yo'l — kompyuterdan */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] uppercase tracking-[0.04em] text-text-mute">yoki kompyuterdan</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div
            onClick={() => obyekt && faylRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) faylTanlandi(f); }}
            className={`rounded-[10px] border-2 border-dashed p-8 text-center transition-colors
              ${obyekt ? 'border-border hover:border-[var(--accent)]/60 cursor-pointer' : 'border-border opacity-50 cursor-not-allowed'}`}
          >
            <Upload size={28} className="mx-auto text-text-mute mb-2" strokeWidth={1.5} />
            <p className="text-text text-sm font-medium">
              {yukla.isPending ? 'Yuklanmoqda…' : 'Faylni bu yerga tashlang'}
            </p>
            <p className="text-[12px] text-text-dim mt-1">
              {obyekt ? '.xlsx, .xls, Google Sheets — Drive papkasiga ham saqlanadi' : 'Avval obyektni tanlang'}
            </p>
          </div>
          <input
            ref={faylRef} type="file" hidden
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) faylTanlandi(f); e.target.value = ''; }}
          />

          {/* ---- Varaq tanlash ---- */}
          {fid && (
            <section className="pt-2 border-t border-border">
              <h4 className="text-[11px] uppercase tracking-[0.04em] text-text-dim mb-2">
                Varaq — «{faylNomi}»
              </h4>
              {varaqlar.isLoading ? (
                <div className="skel h-9 rounded" />
              ) : !varaqlar.data?.ok ? (
                <p className="text-sm text-danger">{varaqlar.data?.xabar || "Varaqlar o'qilmadi"}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(varaqlar.data.varaqlar ?? []).map((v) => (
                    <button
                      key={v.nom}
                      onClick={() => varaqTanla(v.nom)}
                      disabled={ustun.isPending}
                      className={`h-9 px-3 rounded-[10px] border text-sm transition-colors cursor-pointer
                        ${varaq === v.nom ? 'bg-accent text-white border-transparent' : 'karta text-text hover:border-[var(--accent)]/50'}
                        disabled:opacity-50`}
                    >
                      {v.nom}
                      <span className="ml-2 text-[11px] opacity-70 tabular-nums">{v.qatorlar}</span>
                    </button>
                  ))}
                </div>
              )}
              {ustun.isPending && <p className="text-sm text-text-dim mt-2">Tuzilishi tahlil qilinmoqda…</p>}
            </section>
          )}

          {/* ---- Ustunlarni tasdiqlash ---- */}
          {cfg && (
            <section className="pt-2 border-t border-border space-y-3">
              <div>
                <h4 className="text-[11px] uppercase tracking-[0.04em] text-text-dim">Ustunlar</h4>
                <p className="text-sm text-text-dim mt-1">
                  Tizim avtomat aniqladi. Noto'g'ri bo'lsa raqamni o'zgartiring (1 = A ustun).
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {([
                  ['kod', 'Shifr'], ['nom', 'Nomi'], ['bir', 'Birlik'], ['norma', 'Norma'],
                  ['obyom', "Hajm"], ['narx', 'Narx'], ['sum', 'Summa'],
                ] as const).map(([k, nom]) => (
                  <Maydon key={k} nom={nom}>
                    <Kiritma
                      tur="number"
                      qiymat={cfg[k] ?? 0}
                      ozgardi={(v) => setCfg({ ...cfg, [k]: Number(v) || 0 })}
                    />
                  </Maydon>
                ))}
              </div>
              <Tugma tur="primary" onBos={daraxtQur} band={daraxt.isPending}>
                {daraxt.isPending ? 'Daraxt qurilmoqda…' : 'Davom etish'}
              </Tugma>
            </section>
          )}
        </div>
      )}

      {/* ---------- QADAM 2: moslashtirish va qo'lda bog'lash ---------- */}
      {qadam === 1 && aktTree && (
        <div className="space-y-4">
          {/* Avto-moslashtirish — daraxtlar ustida */}
          <div className="karta p-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <Tugma tur="primary" onBos={moslashtir} band={moslash.isPending} ikonka={<Wand2 size={16} />}>
                {moslash.isPending ? 'Moslashtirilmoqda…' : natija ? 'Qayta moslashtirish' : 'Avto-moslashtirish'}
              </Tugma>
              <p className="text-[12px] text-text-dim mt-2">
                {natija
                  ? "Aniq mosliklar bog'landi. Qolganini quyida AKT'dan SMETA'ga sudrab bog'lang."
                  : `Akt: ${aktBarglar.length} qator · ${aktTree.filter((n) => n.type === 'rz').length} razdel. Moslashtirish serverda bajariladi.`}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <Tugma onBos={() => { setQadam(0); setNatija(null); }}>Orqaga</Tugma>
              {natija && (
                <Tugma tur="primary" onBos={yozish} band={yoz.isPending || !constOk} ikonka={<Send size={16} />}>
                  Smetaga yozish
                </Tugma>
              )}
            </div>
          </div>

          {natija && <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiKarta nom="Bog'landi" qiymat={natija.stat.moslashti} ost={`${natija.stat.scopeHit} ta razdel ichida`} />
            <KpiKarta nom="Qo'shimcha bo'ladi" qiymat={boglanmagan.length} ost="smetada topilmadi" />
            <KpiKarta nom="Razdel mosligi" qiymat={`${natija.stat.rzMos}/${natija.stat.rzJami}`} />
            <KpiKarta nom="Vaqt" qiymat={`${(natija.stat.ms / 1000).toFixed(1)} s`} />
          </div>}

          {/* CONSTANTA nazorati */}
          {natija && <div className={`karta p-5 ${constOk ? '' : 'border-danger/40'}`}>
            <h4 className="text-[11px] uppercase tracking-[0.04em] text-text-dim mb-3">Solishtiruv</h4>
            <Juft nom="Akt jami" qiymat={<FmtN val={aktJami} />} />
            <Juft
              nom="Bog'langan"
              qiymat={
                <>
                  <FmtN val={boglanganJami} />
                  {ishMosliklari > 0 && (
                    <span className="text-text-mute text-[11px] ml-2">
                      (+{ishMosliklari} ta ish qatori — summasi bolalarida)
                    </span>
                  )}
                </>
              }
            />
            <Juft nom="Qo'shimcha" qiymat={<FmtN val={dopJami} />} />
            <Juft
              nom="Farq"
              qiymat={
                <span className={constOk ? 'text-ok' : 'text-danger'}>
                  <FmtN val={farq} /> {constOk ? '✅' : '⛔'}
                </span>
              }
            />
            {!constOk && (
              <p className="text-sm text-danger mt-3">
                Farq nolga teng emas — yozish bloklandi. Akt fayli noto'g'ri o'qilgan bo'lishi mumkin.
              </p>
            )}
          </div>}

          {/* Himoyalar */}
          {natija && (natija.stat.birlikBlok > 0 || natija.stat.zamenaShubha > 0) && (
            <div className="rounded-[10px] border border-warn/25 bg-warn/[.08] p-4 space-y-2">
              <div className="flex gap-2 items-center">
                <AlertTriangle size={16} className="text-warn" />
                <span className="text-sm font-medium text-text">Qo'lda tekshirish tavsiya etiladi</span>
              </div>
              {natija.stat.birlikBlok > 0 && (
                <p className="text-sm text-text-dim">
                  <Nishon matn={`${natija.stat.birlikBlok} ta`} tur="warn" /> birlik farqli (Т↔КГ kabi) —
                  1000 barobar xato xavfi bo'lgani uchun avtomat bog'lanmadi.
                </p>
              )}
              {natija.stat.zamenaShubha > 0 && (
                <p className="text-sm text-text-dim">
                  <Nishon matn={`${natija.stat.zamenaShubha} ta`} tur="warn" /> marka farqli (ПК↔ПБ kabi) —
                  ehtimoliy zamena, qo'lda hal qiling.
                </p>
              )}
            </div>
          )}

          {/* ⭐ IKKI PANEL — panel'dagi kabi: chapda AKT, o'ngda SMETA */}
          <IkkiPanel
            chapSarlavha={`AKT (fayldan) — ${aktBarglar.length} qator`}
            ongSarlavha={`SMETA (LRV) — ${boglanganJoylar.size} qator band`}
            chapOng={
              <div className="flex gap-1 flex-shrink-0">
                {(['hammasi', 'boglanmagan', 'boglangan'] as const).map((f) => (
                  <button key={f} onClick={() => setFiltr(f)}
                    className={`h-6 px-2 rounded-md text-[11px] transition-colors cursor-pointer
                      ${filtr === f ? 'bg-accent text-white' : 'text-text-mute hover:text-text'}`}>
                    {f === 'hammasi' ? 'Hammasi' : f === 'boglangan' ? '● bog‘langan' : '○ bog‘lanmagan'}
                  </button>
                ))}
              </div>
            }
            chap={
              <F2Daraxt
                tugunlar={aktDaraxt}
                bogMi={(k) => moslikMap.has(k)}
                hover={hover}
                setHover={setHover}
                onBogBekor={bogBekor}
                sudraladi
                bosh="Akt daraxti bo‘sh"
              />
            }
            ong={
              <F2Daraxt
                tugunlar={smetaDaraxt}
                bogMi={(k) => boglanganJoylar.has(k)}
                hover={hover}
                setHover={setHover}
                tashlanadi
                onTashla={qolBogla}
                bosh={lrv.isLoading ? "Smeta o‘qilmoqda…" : "Smeta daraxti bo‘sh"}
              />
            }
          />

          <p className="text-[11px] text-text-mute">
            ● bog'langan · ○ bog'lanmagan · bir tomonga kursor kelsa ikkinchisi ham yoritiladi ·
            ● ni bosish bog'lanishni bekor qiladi
          </p>

          {/* Yozish tugmasi yuqorida — daraxtlar uzun bo'lgani uchun pastda ko'rinmaydi */}
        </div>
      )}

      {/* ---------- QADAM 4 ---------- */}
      {qadam === 2 && (
        <div className="karta p-6 max-w-2xl space-y-4">
          <div className="flex items-center gap-3">
            <FileSpreadsheet size={20} className="text-accent" />
            <h3 className="text-[17px] font-semibold text-text">
              {j?.status === 'tugadi' ? 'Yozildi' : j?.status === 'xato' ? 'Xato' : 'Yozilmoqda'}
            </h3>
          </div>

          <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${j?.status === 'tugadi' ? 100 : foiz}%` }}
            />
          </div>

          <p className="text-sm text-text-dim tabular-nums">
            {j?.done ?? 0} / {j?.total ?? 0} qator{j?.xabar ? ` · ${j.xabar}` : ''}
          </p>

          <div className="rounded-[10px] bg-ok/[.08] border border-ok/25 p-3 text-sm text-text-dim">
            ✅ Kompyuterni o'chirsangiz ham yozuv davom etadi. Keyin qaytib kelib shu sahifadan kuzatasiz.
          </div>

          {job.error && <XatoHolat xato={job.error} qayta={() => job.refetch()} />}

          {(j?.status === 'tugadi' || j?.status === 'xato') && (
            <Tugma
              tur="primary"
              onBos={() => {
                setYozishBoshlandi(false); setQadam(0);
                setAktTree(null); setNatija(null);
              }}
            >
              Yangi Ф2 import
            </Tugma>
          )}
        </div>
      )}
    </Sahifa>
  );
}

export default F2Import;
