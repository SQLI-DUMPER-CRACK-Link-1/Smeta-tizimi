/**
 * TestSaqlash.tsx — TIZIM_02: KO'P-KOMPANIYALI FAYL SAQLASH (STOR-001)
 * ═══════════════════════════════════════════════════════════════════════
 * EGALIK: Claude (arxitektura / STOR-001B integratsiya + yakuniy yig'ish).
 *
 * Bitta ekranda butun zanjir:
 *   KOMPANIYA STORAGE → LOYIHA STORAGE → OBYEKT STORAGE → HUJJAT/F2 YUKLASH
 *
 * UI — Codex'ning qayta ishlatiladigan komponentlari (components/storage):
 *   StorageHealthCard · StorageWorkspaceForm · StorageStatusBadge ·
 *   StorageErrorPanel · DocumentStorageStatus.
 * Ma'lumot — kanonik STOR-001 kontrakti (api/t2-storage.ts). Global
 * ROOT_FOLDER_ID fallback YO'Q: hamma narsa company→loyiha→obyekt ID zanjiri
 * va saqlangan folder ID orqali. Xato bo'lsa eski umumiy papkaga tushmaydi.
 */
import { useEffect, useState } from 'react';
import { HardDrive, FolderTree, Boxes, FileUp, RefreshCw, Archive, Loader2 } from 'lucide-react';
import { useKompaniya } from './KompaniyaTanlov';
import { Badge } from '../umumiy/ui/Badge';
import {
  StorageHealthCard, StorageWorkspaceForm, StorageStatusBadge, StorageErrorPanel,
  DocumentStorageStatus, type StorageFormValue, type DocumentUploadStatus,
} from '../components/storage';
import {
  companyStorageOl, companyStorageBind, projectStorageRoyxat, projectStorageProvision,
  objectStorageRoyxat, objectStorageRetry, documentUpload, storageXatoMatn, demoRejimmi,
  toUiStatus,
  type CompanyStorage, type ProjectStorage, type ObjectStorage,
} from '../api/t2-storage';

const DEMO_SENARIY: { id: number; nom: string }[] = [
  { id: 4, nom: 'READY' },
  { id: 1, nom: 'PENDING' },
  { id: 2, nom: 'FAILED' },
  { id: 3, nom: 'LEGACY' },
  { id: 5, nom: 'NOT CONFIGURED' }, // 5 % 5 === 0
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
  const [ish, setIsh] = useState<string | null>(null);
  const [form, setForm] = useState<StorageFormValue>({ folderInput: '', mode: 'shared_drive' });

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

  useEffect(() => {
    setCompany(null); setProjects([]); setObjects([]); setTanlanganLoyiha(null);
    yukla(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [kompaniyaId]);

  useEffect(() => {
    if (tanlanganLoyiha == null || !kompaniyaId) { setObjects([]); return; }
    objectStorageRoyxat(kompaniyaId, tanlanganLoyiha).then((r) => setObjects(r.ok ? r.data : []));
  }, [tanlanganLoyiha, kompaniyaId, ish]);

  const bind = async (v: StorageFormValue) => {
    setIsh('bind');
    const r = await companyStorageBind({
      kompaniyaId, folderUrl: v.folderInput.trim(), mode: v.mode,
      expectedVersion: company?.versiya ?? 0,
    });
    setIsh(null);
    if (r.ok) { setCompany(r.data); setForm({ folderInput: '', mode: v.mode }); setCompanyXato(null); }
    else setCompanyXato({ code: r.code, xabar: r.xabar });
  };

  const provision = async (loyihaId: number, versiya: number) => {
    setIsh('provision:' + loyihaId);
    const r = await projectStorageProvision({ kompaniyaId, loyihaId, expectedVersion: versiya });
    if (r.ok) {
      const fresh = await projectStorageRoyxat(kompaniyaId);
      if (fresh.ok) setProjects(fresh.data);
    } else {
      setProjects((prev) => prev.map((p) => p.loyiha_id === loyihaId
        ? { ...p, provisioning_status: 'failed', storage_error: storageXatoMatn(r.code, r.xabar) } : p));
    }
    setIsh(null);
  };

  const retryObject = async (o: ObjectStorage) => {
    if (tanlanganLoyiha == null) return;
    setIsh('object:' + o.obyekt_id);
    const r = await objectStorageRetry({
      kompaniyaId, loyihaId: tanlanganLoyiha, obyektId: o.obyekt_id,
      obyektNom: o.obyekt_nom, expectedVersion: o.versiya,
    });
    if (r.ok) {
      const fresh = await objectStorageRoyxat(kompaniyaId, tanlanganLoyiha);
      if (fresh.ok) setObjects(fresh.data);
    } else {
      setObjects((prev) => prev.map((x) => x.obyekt_id === o.obyekt_id
        ? { ...x, storage_status: 'failed', storage_error: storageXatoMatn(r.code, r.xabar) } : x));
    }
    setIsh(null);
  };

  const companyTayyor = company?.status === 'verified' || company?.status === 'legacy';
  const companyUi = company ? toUiStatus(company.status)
    : (companyXato ? 'FAILED' : 'NOT_CONFIGURED') as ReturnType<typeof toUiStatus>;

  return (
    <div className="p-6 bg-bg min-h-screen text-text overflow-y-auto">
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
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-2.5 text-[12px] text-amber-200">
          <Archive size={14} />
          <span>
            DEMO — backend hali productionga qo‘llanmagan. Ekran kanonik kontrakt
            shakli bilan ishlaydi; jonli ulanish uchun manzilga{' '}
            <code className="px-1 rounded bg-black/30">?demo=0</code>.
          </span>
          <span className="ml-auto flex items-center gap-1">
            <span className="text-amber-300/70">Holat:</span>
            {DEMO_SENARIY.map((s) => (
              <button key={s.id} onClick={() => setDemoKompaniyaId(s.id)}
                className={'px-2 py-0.5 rounded text-[11px] border font-medium ' +
                  (demoKompaniyaId === s.id
                    ? 'bg-amber-400/30 border-amber-400/60 text-amber-50'
                    : 'border-amber-500/25 hover:bg-amber-500/10')}>
                {s.nom}
              </button>
            ))}
          </span>
        </div>
      )}

      {!kompaniyaId && <div className="text-text-dim text-sm">Avval yuqoridan kompaniya tanlang.</div>}

      {kompaniyaId > 0 && (
        <div className="grid gap-5 lg:grid-cols-2 items-start">
          {/* ── 1. KOMPANIYA STORAGE ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <StorageHealthCard
                className="w-full"
                provider={company?.provider === 'google_drive' ? 'Google Drive' : 'Google Drive'}
                mode={company?.mode ?? null}
                folderName={company?.root_folder_name ?? null}
                status={companyUi}
                lastVerifiedAt={company?.verified_at ?? null}
                errorCode={!companyTayyor ? companyXato?.code : null}
                error={!companyTayyor ? (companyXato?.xabar ? storageXatoMatn(companyXato.code, companyXato.xabar) : null) : null}
                loading={yuklanmoqda && !company}
                onRetry={company?.status === 'failed' ? () => bind(form) : undefined}
              />
            </div>
            {company?.legacy && (
              <div className="flex items-center gap-2 text-[12px] text-sky-200">
                <Badge variant="bl" className="gap-1"><Archive size={12} /> ESKI (LEGACY)</Badge>
                Bu kompaniya legacy ruxsatnomasida — yangi T2 yozuv oqimi legacy workspace’ga yozmaydi.
              </div>
            )}
            {!companyTayyor && (
              <StorageWorkspaceForm
                value={form}
                onChange={setForm}
                onBind={bind}
                loading={ish === 'bind'}
                error={companyXato ? storageXatoMatn(companyXato.code, companyXato.xabar) : null}
              />
            )}
          </div>

          {/* ── 2. LOYIHA STORAGE ── */}
          <section className="karta p-4">
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
                    <StorageStatusBadge status={toUiStatus(p.provisioning_status)} />
                  </div>
                  {p.storage_error && <StorageErrorPanel message={p.storage_error} className="mt-2" />}
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
          <section className="karta p-4">
            <h2 className="font-semibold flex items-center gap-2 mb-3"><Boxes size={16} className="text-accent" /> Obyekt storage</h2>
            {tanlanganLoyiha == null && <div className="text-[12px] text-text-dim">Chapdan loyiha tanlang.</div>}
            {tanlanganLoyiha != null && objects.length === 0 && <div className="text-[12px] text-text-dim">Bu loyihada obyekt yo‘q.</div>}
            <ul className="space-y-2">
              {objects.map((o) => (
                <li key={o.obyekt_id} className="rounded-lg border border-border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium truncate">{o.obyekt_nom}</span>
                    <StorageStatusBadge status={toUiStatus(o.storage_status)} />
                  </div>
                  <div className="text-[10px] text-text-mute font-mono mt-0.5">{o.folder_id ? 'folder: ' + o.folder_id : 'papka biriktirilmagan'}</div>
                  {o.storage_error && <StorageErrorPanel message={o.storage_error} className="mt-2" />}
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

/* ───────────────────────── HUJJAT YUKLASH ───────────────────────── */

function HujjatYuklash({ kompaniyaId, loyihaId, obyekt }: {
  kompaniyaId: number; loyihaId: number | null; obyekt: ObjectStorage | null;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [tur, setTur] = useState('hujjat');
  const [holat, setHolat] = useState<DocumentUploadStatus>('IDLE');
  const [natija, setNatija] = useState<string>('');

  const tayyor = kompaniyaId > 0 && loyihaId != null && obyekt != null;

  const yukla = async () => {
    if (!file || !tayyor || !obyekt || loyihaId == null) return;
    setHolat('UPLOADING'); setNatija('');
    const r = await documentUpload({
      kompaniyaId, loyihaId, obyektId: obyekt.obyekt_id, file, documentType: tur,
    });
    if (r.ok) { setHolat('SUCCESS'); setNatija('Hujjat #' + r.document_id + ' — ' + obyekt.obyekt_nom + ' obyekt papkasiga (kanonik folder_id) yozildi va reyestrga qayd etildi.'); }
    else { setHolat('FAILED'); setNatija(storageXatoMatn(r.code, r.xabar)); }
  };

  return (
    <section className="karta p-4">
      <h2 className="font-semibold flex items-center gap-2 mb-3"><FileUp size={16} className="text-accent" /> Hujjat / F2 yuklash</h2>
      {!tayyor && (
        <div className="text-[12px] text-text-dim">
          Yuklash uchun kompaniya, loyiha va storage‑i <b>TAYYOR</b> obyekt tanlang.
        </div>
      )}
      {tayyor && obyekt && (
        <>
          <div className="text-[12px] text-text-dim mb-2">Manzil: <span className="text-text">{obyekt.obyekt_nom}</span> → kanonik obyekt papkasi</div>
          <div className="flex flex-wrap items-center gap-2">
            <input type="file" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setHolat('IDLE'); }}
              className="text-[12px] file:mr-2 file:rounded file:border-0 file:bg-surface-2 file:px-2 file:py-1 file:text-text" />
            <select value={tur} onChange={(e) => setTur(e.target.value)}
              className="input px-2 py-1.5 text-[12px]">
              <option value="hujjat">Hujjat</option>
              <option value="f2">F2 / Bajarilgan ish dalolatnomasi</option>
              <option value="loyiha">Loyiha chizmasi</option>
              <option value="aosr">AOSR / yashirin ishlar</option>
            </select>
            <button onClick={yukla} disabled={!file || holat === 'UPLOADING'}
              className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent/90 text-white font-medium text-[12px] px-3 py-1.5 rounded disabled:opacity-40">
              <FileUp size={13} /> Yuklash
            </button>
          </div>
          {holat !== 'IDLE' && (
            <DocumentStorageStatus
              className="mt-3"
              status={holat}
              progress={holat === 'UPLOADING' ? 60 : null}
              message={natija || undefined}
            />
          )}
          {holat === 'FAILED' && (
            <button onClick={yukla} className="mt-2 inline-flex items-center gap-1.5 text-[11px] border border-border rounded px-2 py-1 hover:bg-surface-2">
              <RefreshCw size={12} /> Qayta urinish
            </button>
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
