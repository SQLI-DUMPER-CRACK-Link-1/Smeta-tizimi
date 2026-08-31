/**
 * TestSaqlash.tsx — TIZIM_02: KO'P-KOMPANIYALI FAYL SAQLASH (STOR-001)
 * ═══════════════════════════════════════════════════════════════════════
 * EGALIK: Claude (arxitektura / STOR-001B integratsiya lane).
 *
 * Bitta ekranda butun zanjir ko'rinadi:
 *   KOMPANIYA STORAGE → LOYIHA STORAGE → OBYEKT STORAGE → HUJJAT/F2 YUKLASH
 *
 * Har bosqich holati: sozlanmagan / kutilmoqda / tayyor / xato / legacy.
 * Backend xato kodlari `storageXatoMatn` orqali odam o'qiydigan matnga
 * o'giriladi — «RPC 500» hech qachon asosiy xabar sifatida ko'rsatilmaydi.
 *
 * Global ROOT_FOLDER_ID fallback YO'Q: hamma narsa kanonik
 * kompaniya→loyiha→obyekt ID zanjiri va saqlangan folder ID orqali.
 */
import { useEffect, useState } from 'react';
import {
  HardDrive, FolderTree, Boxes, FileUp, RefreshCw, CheckCircle2, AlertTriangle,
  Clock, ShieldQuestion, Link2, Loader2, Archive,
} from 'lucide-react';
import { useKompaniya } from './KompaniyaTanlov';
import {
  companyStorageOl, companyStorageBind, projectStorageRoyxat, projectStorageProvision,
  objectStorageRoyxat, objectStorageRetry, documentUpload, storageXatoMatn, demoRejimmi,
  type CompanyStorage, type ProjectStorage, type ObjectStorage, type StorageMode,
} from '../api/t2-storage';

/* ───────────────────────── HOLAT BELGISI ───────────────────────── */

type Holat = 'not_configured' | 'pending' | 'verified' | 'ready' | 'failed' | 'legacy' | 'revoked' | 'not_provisioned';

const HOLAT_BELGI: Record<Holat, { nom: string; rang: string; Ikon: typeof CheckCircle2 }> = {
  verified:        { nom: 'TAYYOR',          rang: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30', Ikon: CheckCircle2 },
  ready:           { nom: 'TAYYOR',          rang: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30', Ikon: CheckCircle2 },
  pending:         { nom: 'KUTILMOQDA',      rang: 'text-amber-300 bg-amber-500/10 border-amber-500/30',       Ikon: Clock },
  failed:          { nom: 'XATO',            rang: 'text-rose-300 bg-rose-500/10 border-rose-500/30',          Ikon: AlertTriangle },
  not_configured:  { nom: 'SOZLANMAGAN',     rang: 'text-zinc-300 bg-zinc-500/10 border-zinc-500/30',          Ikon: ShieldQuestion },
  not_provisioned: { nom: 'TAYYORLANMAGAN',  rang: 'text-zinc-300 bg-zinc-500/10 border-zinc-500/30',          Ikon: ShieldQuestion },
  legacy:          { nom: 'ESKI (LEGACY)',   rang: 'text-sky-300 bg-sky-500/10 border-sky-500/30',             Ikon: Archive },
  revoked:         { nom: 'BEKOR QILINGAN',  rang: 'text-rose-300 bg-rose-500/10 border-rose-500/30',          Ikon: AlertTriangle },
};

function Belgi({ holat }: { holat: Holat }) {
  const b = HOLAT_BELGI[holat] ?? HOLAT_BELGI.not_configured;
  const I = b.Ikon;
  return (
    <span className={'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-bold tracking-wide ' + b.rang}>
      <I size={12} /> {b.nom}
    </span>
  );
}

function XatoQator({ code, xabar }: { code?: string | null; xabar?: string | null }) {
  if (!code && !xabar) return null;
  return (
    <div className="mt-2 flex items-start gap-2 rounded-md bg-rose-500/8 border border-rose-500/25 px-3 py-2 text-[12px] text-rose-200">
      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
      <span>{storageXatoMatn(code, xabar || undefined)}</span>
    </div>
  );
}

/* ───────────────────────── ASOSIY EKRAN ───────────────────────── */

const DEMO_SENARIY: { id: number; nom: string }[] = [
  { id: 4, nom: 'Tayyor' },
  { id: 1, nom: 'Kutilmoqda' },
  { id: 2, nom: 'Xato' },
  { id: 3, nom: 'Legacy' },
  { id: 5, nom: 'Sozlanmagan' }, // 5 % 5 === 0
];

export default function TestSaqlash() {
  const { joriy } = useKompaniya();
  const demo = demoRejimmi();
  const [demoKompaniyaId, setDemoKompaniyaId] = useState(4);
  const kompaniyaId = demo ? demoKompaniyaId : (joriy?.id ?? 0);

  const [company, setCompany] = useState<CompanyStorage | null>(null);
  const [companyXato, setCompanyXato] = useState<{ code?: string; xabar?: string } | null>(null);
  const [projects, setProjects] = useState<ProjectStorage[]>([]);
  const [tanlanganLoyiha, setTanlanganLoyiha] = useState<number | null>(null);
  const [objects, setObjects] = useState<ObjectStorage[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [ish, setIsh] = useState<string | null>(null); // qaysi amal bajarilmoqda

  const yukla = async () => {
    if (!kompaniyaId) return;
    setYuklanmoqda(true);
    setCompanyXato(null);
    const c = await companyStorageOl(kompaniyaId);
    if (c.ok) setCompany(c.data);
    else { setCompany(null); setCompanyXato({ code: c.code, xabar: c.xabar }); }
    const p = await projectStorageRoyxat(kompaniyaId);
    setProjects(p.ok ? p.data : []);
    setYuklanmoqda(false);
  };

  useEffect(() => { setCompany(null); setProjects([]); setObjects([]); setTanlanganLoyiha(null); yukla(); /* eslint-disable-next-line */ }, [kompaniyaId]);

  useEffect(() => {
    if (tanlanganLoyiha == null || !kompaniyaId) { setObjects([]); return; }
    objectStorageRoyxat(kompaniyaId, tanlanganLoyiha).then((r) => setObjects(r.ok ? r.data : []));
  }, [tanlanganLoyiha, kompaniyaId, ish]);

  /* ── amallar ── */
  const [rootUrl, setRootUrl] = useState('');
  const [mode, setMode] = useState<StorageMode>('shared_drive');

  const bind = async () => {
    if (!company && !companyXato) return;
    setIsh('bind');
    const r = await companyStorageBind({
      kompaniyaId, folderUrl: rootUrl.trim(), mode,
      expectedVersion: company?.versiya ?? 0,
    });
    setIsh(null);
    if (r.ok) { setCompany(r.data); setRootUrl(''); }
    else setCompanyXato({ code: r.code, xabar: r.xabar });
  };

  const provision = async (loyihaId: number, versiya: number) => {
    setIsh('provision:' + loyihaId);
    const r = await projectStorageProvision({ kompaniyaId, loyihaId, expectedVersion: versiya });
    setIsh(null);
    setProjects((prev) => prev.map((p) => p.loyiha_id === loyihaId
      ? (r.ok ? { ...p, ...r.data } : { ...p, provisioning_status: 'failed', storage_error: storageXatoMatn(r.code, r.xabar) })
      : p));
  };

  const retryObject = async (o: ObjectStorage) => {
    if (tanlanganLoyiha == null) return;
    setIsh('object:' + o.obyekt_id);
    const r = await objectStorageRetry({
      kompaniyaId, loyihaId: tanlanganLoyiha, obyektId: o.obyekt_id,
      obyektNom: o.obyekt_nom, expectedVersion: o.versiya,
    });
    setIsh(null);
    setObjects((prev) => prev.map((x) => x.obyekt_id === o.obyekt_id
      ? (r.ok ? { ...x, ...r.data } : { ...x, storage_status: 'failed', storage_error: storageXatoMatn(r.code, r.xabar) })
      : x));
  };

  const companyHolat: Holat = (company?.status as Holat) ?? (companyXato?.code === 'STORAGE_WORKSPACE_NOT_CONFIGURED' ? 'not_configured' : 'not_configured');
  const companyTayyor = company?.status === 'verified' || company?.status === 'legacy';

  return (
    <div className="p-6 bg-bg min-h-screen text-text">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HardDrive className="text-accent" /> Fayl saqlash (Storage)
          </h1>
          <p className="text-sm text-text-dim max-w-3xl mt-1">
            Kompaniya → Loyiha → Obyekt → Hujjat zanjiri. Har bir daraja o‘zining
            tekshirilgan Google Drive papkasiga ega. Global umumiy papka
            («TIZIM_01 ildizi») YO‘Q — hamma narsa kanonik ID orqali.
          </p>
        </div>
        <button onClick={yukla} className="bg-surface border border-border hover:bg-surface-2 px-4 py-2 flex items-center gap-2 rounded-lg text-sm font-medium">
          <RefreshCw size={14} className={yuklanmoqda ? 'animate-spin text-accent' : ''} /> Yangilash
        </button>
      </div>

      {demo && (
        <div className="mb-5 flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-2 text-[12px] text-amber-200">
          <AlertTriangle size={14} />
          DEMO rejim — backend hali productionga qo‘llanmagan. Ekran kanonik
          kontrakt shakli bilan ishlaydi; jonli ulanish uchun manzilga
          <code className="mx-1 px-1 rounded bg-black/30">?demo=0</code> qo‘shing.
          Senariy:
          <span className="ml-1 inline-flex gap-1">
            {DEMO_SENARIY.map((s) => (
              <button key={s.id} onClick={() => setDemoKompaniyaId(s.id)}
                className={'px-1.5 py-0.5 rounded text-[11px] border ' +
                  (demoKompaniyaId === s.id ? 'bg-amber-400/30 border-amber-400/50 text-amber-100' : 'border-amber-500/25 hover:bg-amber-500/10')}>
                {s.nom}
              </button>
            ))}
          </span>
        </div>
      )}

      {!kompaniyaId && <div className="text-text-dim text-sm">Avval yuqoridan kompaniya tanlang.</div>}

      {kompaniyaId > 0 && (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* ── 1. KOMPANIYA STORAGE ── */}
          <section className="bg-surface border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold flex items-center gap-2"><HardDrive size={16} className="text-accent" /> Kompaniya storage</h2>
              <Belgi holat={companyHolat} />
            </div>
            <dl className="text-[13px] space-y-1.5">
              <Row k="Provayder" v={company?.provider === 'google_drive' ? 'Google Drive' : '—'} />
              <Row k="Rejim" v={company?.mode === 'shared_drive' ? 'Umumiy Drive (Shared)' : company?.mode === 'my_drive' ? 'Mening Drive' : '—'} />
              <Row k="Ildiz papka" v={company?.root_folder_name || '—'} mono />
              <Row k="Folder ID" v={company?.root_folder_id || '—'} mono dim />
              <Row k="Versiya" v={company ? '#' + company.versiya : '—'} />
            </dl>
            {companyXato && !companyTayyor && <XatoQator code={companyXato.code} xabar={companyXato.xabar} />}

            {!companyTayyor && (
              <div className="mt-3 rounded-lg bg-bg/60 border border-border p-3">
                <div className="text-[11px] text-text-dim mb-2 flex items-center gap-1.5"><Link2 size={12} /> Google Drive papka havolasi / ID</div>
                <input value={rootUrl} onChange={(e) => setRootUrl(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="w-full bg-surface-2 border border-border rounded px-2 py-1.5 text-[12px] outline-none focus:border-accent/50" />
                <div className="flex items-center gap-2 mt-2">
                  <select value={mode} onChange={(e) => setMode(e.target.value as StorageMode)}
                    className="bg-surface-2 border border-border rounded px-2 py-1.5 text-[12px]">
                    <option value="shared_drive">Umumiy Drive</option>
                    <option value="my_drive">Mening Drive</option>
                  </select>
                  <button onClick={bind} disabled={!rootUrl.trim() || ish === 'bind'}
                    className="ml-auto inline-flex items-center gap-1.5 bg-accent/90 hover:bg-accent text-black font-semibold text-[12px] px-3 py-1.5 rounded disabled:opacity-40">
                    {ish === 'bind' ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    Biriktirish va tasdiqlash
                  </button>
                </div>
              </div>
            )}
            {company?.status === 'failed' && (
              <button onClick={bind} disabled={ish === 'bind'} className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-rose-200 border border-rose-500/30 rounded px-3 py-1.5 hover:bg-rose-500/10">
                <RefreshCw size={13} /> Qayta urinish
              </button>
            )}
          </section>

          {/* ── 2. LOYIHA STORAGE ── */}
          <section className="bg-surface border border-border rounded-xl p-4">
            <h2 className="font-semibold flex items-center gap-2 mb-3"><FolderTree size={16} className="text-accent" /> Loyiha storage</h2>
            {!companyTayyor && <div className="text-[12px] text-text-dim">Avval kompaniya storage tayyor bo‘lishi kerak.</div>}
            {companyTayyor && projects.length === 0 && <div className="text-[12px] text-text-dim">Loyiha topilmadi.</div>}
            <ul className="space-y-2">
              {companyTayyor && projects.map((p) => (
                <li key={p.loyiha_id}
                  className={'rounded-lg border px-3 py-2 cursor-pointer transition-colors ' +
                    (tanlanganLoyiha === p.loyiha_id ? 'border-accent/50 bg-accent/5' : 'border-border hover:bg-surface-2')}
                  onClick={() => setTanlanganLoyiha(p.loyiha_id)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium truncate">{p.loyiha_nom}</span>
                    <Belgi holat={p.provisioning_status as Holat} />
                  </div>
                  {p.storage_error && <XatoQator xabar={p.storage_error} />}
                  {p.provisioning_status !== 'verified' && (
                    <button onClick={(e) => { e.stopPropagation(); provision(p.loyiha_id, p.versiya); }}
                      disabled={ish === 'provision:' + p.loyiha_id}
                      className="mt-2 inline-flex items-center gap-1.5 text-[11px] border border-border rounded px-2 py-1 hover:bg-surface-2 disabled:opacity-40">
                      {ish === 'provision:' + p.loyiha_id ? <Loader2 size={12} className="animate-spin" /> : <FolderTree size={12} />}
                      Papkani tayyorlash
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {/* ── 3. OBYEKT STORAGE ── */}
          <section className="bg-surface border border-border rounded-xl p-4">
            <h2 className="font-semibold flex items-center gap-2 mb-3"><Boxes size={16} className="text-accent" /> Obyekt storage</h2>
            {tanlanganLoyiha == null && <div className="text-[12px] text-text-dim">Chapdan loyiha tanlang.</div>}
            {tanlanganLoyiha != null && objects.length === 0 && <div className="text-[12px] text-text-dim">Bu loyihada obyekt yo‘q.</div>}
            <ul className="space-y-2">
              {objects.map((o) => (
                <li key={o.obyekt_id} className="rounded-lg border border-border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium truncate">{o.obyekt_nom}</span>
                    <Belgi holat={o.storage_status as Holat} />
                  </div>
                  <div className="text-[10px] text-text-mute font-mono mt-0.5">{o.folder_id ? 'folder: ' + o.folder_id : 'papka biriktirilmagan'}</div>
                  {o.storage_error && <XatoQator xabar={o.storage_error} />}
                  {o.storage_status !== 'ready' && (
                    <button onClick={() => retryObject(o)} disabled={ish === 'object:' + o.obyekt_id}
                      className="mt-2 inline-flex items-center gap-1.5 text-[11px] border border-border rounded px-2 py-1 hover:bg-surface-2 disabled:opacity-40">
                      {ish === 'object:' + o.obyekt_id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      Papkani tayyorlash / qayta urinish
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {/* ── 4. HUJJAT / F2 YUKLASH ── */}
          <HujjatYuklash
            kompaniyaId={kompaniyaId}
            loyihaId={tanlanganLoyiha}
            obyekt={objects.find((o) => o.storage_status === 'ready') ?? null}
          />
        </div>
      )}
    </div>
  );
}

function Row({ k, v, mono, dim }: { k: string; v: string; mono?: boolean; dim?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-text-dim shrink-0">{k}</dt>
      <dd className={'text-right truncate ' + (mono ? 'font-mono ' : '') + (dim ? 'text-text-mute text-[11px]' : 'text-text')}>{v}</dd>
    </div>
  );
}

/* ───────────────────────── HUJJAT YUKLASH ───────────────────────── */

function HujjatYuklash({ kompaniyaId, loyihaId, obyekt }: {
  kompaniyaId: number; loyihaId: number | null; obyekt: ObjectStorage | null;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [tur, setTur] = useState('hujjat');
  const [holat, setHolat] = useState<'bosh' | 'yuklanmoqda' | 'muvaffaqiyat' | 'xato'>('bosh');
  const [natija, setNatija] = useState<string>('');

  const tayyor = kompaniyaId > 0 && loyihaId != null && obyekt != null;

  const yukla = async () => {
    if (!file || !tayyor || !obyekt || loyihaId == null) return;
    setHolat('yuklanmoqda'); setNatija('');
    const r = await documentUpload({
      kompaniyaId, loyihaId, obyektId: obyekt.obyekt_id,
      file, documentType: tur,
    });
    if (r.ok) { setHolat('muvaffaqiyat'); setNatija('Hujjat #' + r.document_id + ' — ' + obyekt.obyekt_nom + ' obyekt papkasiga yozildi.'); }
    else { setHolat('xato'); setNatija(storageXatoMatn(r.code, r.xabar)); }
  };

  return (
    <section className="bg-surface border border-border rounded-xl p-4">
      <h2 className="font-semibold flex items-center gap-2 mb-3"><FileUp size={16} className="text-accent" /> Hujjat / F2 yuklash</h2>
      {!tayyor && (
        <div className="text-[12px] text-text-dim">
          Yuklash uchun kompaniya, loyiha va storage‑i TAYYOR obyekt tanlang.
        </div>
      )}
      {tayyor && obyekt && (
        <>
          <div className="text-[12px] text-text-dim mb-2">Manzil: <span className="text-text">{obyekt.obyekt_nom}</span> → kanonik obyekt papkasi</div>
          <div className="flex flex-wrap items-center gap-2">
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-[12px] file:mr-2 file:rounded file:border-0 file:bg-surface-2 file:px-2 file:py-1 file:text-text" />
            <select value={tur} onChange={(e) => setTur(e.target.value)}
              className="bg-surface-2 border border-border rounded px-2 py-1.5 text-[12px]">
              <option value="hujjat">Hujjat</option>
              <option value="f2">F2 / Bajarilgan ish dalolatnomasi</option>
              <option value="loyiha">Loyiha chizmasi</option>
              <option value="aosr">AOSR / yashirin ishlar</option>
            </select>
            <button onClick={yukla} disabled={!file || holat === 'yuklanmoqda'}
              className="inline-flex items-center gap-1.5 bg-accent/90 hover:bg-accent text-black font-semibold text-[12px] px-3 py-1.5 rounded disabled:opacity-40">
              {holat === 'yuklanmoqda' ? <Loader2 size={13} className="animate-spin" /> : <FileUp size={13} />}
              Yuklash
            </button>
          </div>
          {holat === 'muvaffaqiyat' && (
            <div className="mt-3 flex items-start gap-2 rounded-md bg-emerald-500/8 border border-emerald-500/25 px-3 py-2 text-[12px] text-emerald-200">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> {natija}
            </div>
          )}
          {holat === 'xato' && (
            <div className="mt-3">
              <div className="flex items-start gap-2 rounded-md bg-rose-500/8 border border-rose-500/25 px-3 py-2 text-[12px] text-rose-200">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {natija}
              </div>
              <button onClick={yukla} className="mt-2 inline-flex items-center gap-1.5 text-[11px] border border-border rounded px-2 py-1 hover:bg-surface-2">
                <RefreshCw size={12} /> Qayta urinish
              </button>
            </div>
          )}
          <p className="mt-3 text-[10px] text-text-mute">
            Fayl faqat obyektning saqlangan <code>folder_id</code>‑siga yoziladi va
            <code> t2_document_registry</code> ga qayd etiladi. Nom bo‘yicha Drive
            qidiruvi yo‘q; xato bo‘lsa eski umumiy papkaga tushmaydi.
          </p>
        </>
      )}
    </section>
  );
}
