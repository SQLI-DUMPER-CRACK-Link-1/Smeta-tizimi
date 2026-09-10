import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Database, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { SmetaTree } from '../../umumiy/daraxt/SmetaTree';
import { Sahifa } from '../../umumiy/ui/Sahifa';
import { FmtN } from '../../lib/format';
import { useKompaniya } from '../../test02/KompaniyaTanlov';
import {
  sbT2DaraxtOl, sbT2ObyektlarOlKomp, sbT2QatorHolatOl, sbT2TreeQur,
  yangiOperationId, type T2Obyekt, type T2Qator, type T2QatorHolat,
} from '../../api/supabase';
import { lrvPlusEksportGate, lrvPlusFaylBaytlari, lrvPlusYuklab, type LrvPlusExportContext, type LrvPlusRejim } from '../../lib/lrv-plus-export';
import { sbFaktBelgilaV2, sbFaktYoz } from '../../api/t2-fakt';
import { t2ObyektNakrutka } from '../../api/t2-nakrutka';
import type { TreeNode } from '../../api/types';
import { priceControlOl, type PriceControlLine } from '../../api/t2-price-control';
import { usePTOWorkspace } from '../../umumiy/kontekst/PTOWorkspaceContext';
import SmetaYuklaNative from './SmetaYuklaNative';
import ResursVedomostNative from './ResursVedomostNative';
import NarxNazoratNative from './NarxNazoratNative';

/**
 * Kundalik ISHCHI SMETA/LRV sahifasi. Bu komponentda Sheet nomi, Drive
 * papkasi, `varaq` yoki `row` biznes identity sifatida ishlatilmaydi.
 * URL va barcha o'qishlar faqat `t2_obyekt.id` hamda `t2_qator.id` bilan.
 */
export function HolatNative() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { joriy } = useKompaniya();
  const [obyektlar, setObyektlar] = useState<T2Obyekt[]>([]);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [daraxtXom, setDaraxtXom] = useState<T2Qator[]>([]);
  /* Eksport FAKT/OSTATKA/F2 ustunlarini shundan oladi -- daraxt qurish
     uchun allaqachon o'qilyapti, qayta so'rov yo'q. */
  const [holatXom, setHolatXom] = useState<T2QatorHolat[]>([]);
  const [priceControlLines, setPriceControlLines] = useState<PriceControlLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ochiqPanel, setOchiqPanel] = useState<string | null>(null);
  const [eksportBolmoqda, setEksportBolmoqda] = useState(false);

  const obyektId = Number(id);
  const validId = Number.isSafeInteger(obyektId) && obyektId > 0;
  const selected = obyektlar.find((o) => o.id === obyektId) ?? null;
  const workspace = usePTOWorkspace();
  const canonicalScopeObject = workspace.objects.find((o) => o.id === workspace.scope.objectId && o.id === obyektId) ?? null;
  const exportContext = useMemo<Partial<LrvPlusExportContext>>(() => ({
    kompaniyaId: workspace.companyId ?? undefined,
    loyihaId: workspace.scope.projectId ?? undefined,
    obyektId: workspace.scope.objectId ?? undefined,
    davrId: workspace.scope.periodId ?? undefined,
    /* 2026-09-10: `davr` faqat F2 akt reestridan keladi -- yangi obyektda
       hali birorta ham F2 akt bo'lmasa, ro'yxat abadiy bo'sh qoladi va
       foydalanuvchi hech qachon tanlay olmaydi. Davrlar ro'yxati
       yuklanib bo'lib (`!loading.periods`) haqiqatan ham bo'sh ekani
       tasdiqlangandagina davr talabi olib tashlanadi -- hali yuklanayotgan
       paytda emas (aks holda bir lahzalik noto'g'ri "ruxsat" chaqnaydi). */
    periodApplicable: workspace.loading.periods ? undefined : workspace.periods.length > 0,
    sourceDocumentId: workspace.scope.sourceDocumentId ?? undefined,
    revisionId: workspace.scope.revisionId ?? undefined,
    sourceChecksum: workspace.sourceDocuments.find((document) => document.id === workspace.scope.sourceDocumentId)?.sha256 ?? undefined,
    dataComplete: Boolean(canonicalScopeObject && daraxtXom.length > 0 && !loading && !error),
  }), [canonicalScopeObject, daraxtXom.length, error, loading, workspace.companyId, workspace.loading.periods, workspace.periods.length, workspace.scope, workspace.sourceDocuments]);
  const exportGate = lrvPlusEksportGate(exportContext);
  const exportBlockReason = !exportGate.ok ? exportGate.reasons[0] : null;

  useEffect(() => {
    let active = true;
    if (!joriy?.id) { setObyektlar([]); return; }
    void sbT2ObyektlarOlKomp(joriy.id).then((r) => {
      if (!active) return;
      if (!r.ok) { setError('Obyektlar kanonik ro‘yxatdan o‘qilmadi.'); return; }
      setObyektlar((r.qatorlar || []) as T2Obyekt[]);
    }).catch(() => { if (active) setError('Obyektlar kanonik ro‘yxatdan o‘qilmadi.'); });
    return () => { active = false; };
  }, [joriy?.id]);

  /* Owner (2026-09-10): "test obyektim stella chiqmayapdi ... exellni yuklab
   * bo'lmas emish". Sahifa obyektni URL orqali ochadi ("Kanonik obyekt"),
   * lekin eksport gate'i TEPADAGI PTO scope'ning obyektiga qaraydi. Ikkisi
   * sinxron bo'lmagani uchun foydalanuvchi ochgan obyektida eksport
   * OBJECT_CONTEXT_REQUIRED bilan bloklanardi va u AYNAN O'SHA obyektni
   * tepadan qo'lda qayta tanlashi kerak edi. Scope setter'larining o'zi
   * kompaniya/loyiha chegarasini tekshiradi -- bu yerda hech qanday
   * ruxsat kengaytirilmaydi, faqat ochilgan obyekt bilan moslashtiriladi. */
  useEffect(() => {
    if (!validId || workspace.loading.hierarchy) return;
    if (workspace.scope.objectId === obyektId) return;
    const object = workspace.objects.find((row) => row.id === obyektId);
    if (!object) return;
    const objectProject = object.loyiha_id ?? null;
    if (workspace.scope.projectId !== objectProject) {
      workspace.setProjectId(objectProject);
      return;
    }
    workspace.setObjectId(obyektId);
  }, [obyektId, validId, workspace]);

  const yuklash = useCallback(async () => {
    if (!validId) { setTree([]); return; }
    setLoading(true); setError(''); setPriceControlLines([]);
    try {
      const [daraxt, holat, nazorat] = await Promise.all([
        sbT2DaraxtOl(obyektId), sbT2QatorHolatOl(obyektId), priceControlOl(obyektId),
      ]);
      if (!daraxt.ok || !holat.ok) {
        setError(daraxt.error || holat.error || 'Kanonik LRV o‘qilmadi.');
        setTree([]); setDaraxtXom([]); setHolatXom([]);
        return;
      }
      setTree(sbT2TreeQur(daraxt.qatorlar || [], holat.qatorlar || []));
      setDaraxtXom(daraxt.qatorlar || []);
      setHolatXom(holat.qatorlar || []);
      setPriceControlLines(nazorat.ok ? nazorat.qatorlar : []);
    } catch {
      setError('Kanonik LRV o‘qilmadi. Tarmoq yoki ruxsatni tekshiring.');
      setTree([]); setDaraxtXom([]); setHolatXom([]);
    } finally { setLoading(false); }
  }, [obyektId, validId]);

  /* T2-LRV-PLUS-EXPORT-001: owner talabi -- T1'ning LRV_PLUS'idagi kabi,
   * lekin Excelning O'ZIDA ishlaydigan formula bilan: bl'ning ОБЪЁМини
   * o'zgartirsa, ostidagi resurslar va summalar Exceldagi SUMIF/formula
   * orqali avtomatik qayta hisoblanadi -- ilovaga qaytmasdan ham.
   *
   * T2-LRV-PLUS-EXPORT-004: owner "bu nakrutka qatorlari aslida lrv
   * plusda ham bo'lishi hisoblanishi kerak, bo'lmasa butun tizimda
   * summalar faqat primoy zatratda hisoblanib qoladi" -- shuning uchun
   * nakrutka koeffitsientlari HAR IKKI rejimda (`toliq`, `forma2`) ham
   * so'raladi va kaskad jadvali qo'shiladi. Nakrutka o'qish muvaffaqiyatsiz
   * bo'lsa (masalan shartnoma sozlanmagan) -- eksport BLOKLANMAYDI, faqat
   * kaskad jadvalisiz chiqadi (best-effort, hujjatning o'zi muhimroq).
   *
   * HERM-001 WP-1C: bundan tashqari, PTO scope (kompaniya/loyiha/obyekt/
   * davr/source hujjat/revision) va read-model to'liqligi ISBOTLANMASA
   * (`exportGate`), eksport butunlay BLOKLANADI -- nakrutka bilan/siz
   * farqi yo'q, provenance hech qachon ixtiyoriy emas. */
  const eksportQil = useCallback(async (rejim: LrvPlusRejim) => {
    if (!selected || !daraxtXom.length) return;
    if (!exportGate.ok) {
      setError(`Excel eksporti bloklandi: ${exportBlockReason || 'provenance/context yetarli emas'}.`);
      return;
    }
    setEksportBolmoqda(true);
    try {
      const nakr = await t2ObyektNakrutka(obyektId).catch(() => null);
      const bytes = await lrvPlusFaylBaytlari(daraxtXom, selected.nom, holatXom, {
        rejim,
        nakrutka: nakr?.ok ? nakr.koeffitsientlar : undefined,
      }, exportContext as LrvPlusExportContext);
      lrvPlusYuklab(bytes, selected.nom + (rejim === 'forma2' ? '_FORMA2' : ''));
    } catch {
      setError('Excel fayli tuzilmadi. Qayta urinib ko‘ring.');
    } finally { setEksportBolmoqda(false); }
  }, [selected, daraxtXom, holatXom, obyektId, exportContext, exportGate.ok, exportBlockReason]);

  useEffect(() => { void yuklash(); }, [yuklash]);

  const smetaJami = tree.reduce((sum, n) => sum + (n.smeta || 0), 0);
  const faktJami = tree.reduce((sum, n) => sum + (n.stFakt || 0), 0);
  const f2Jami = tree.reduce((sum, n) => sum + (n.stF2 || 0), 0);

  const faktSaqlash = useCallback(async (node: TreeNode, mode: 'qoshish' | 'jami', value: number) => {
    if (!validId || node.id == null) return { ok: false, message: 'Kanonik qator ID topilmadi.' };
    const sana = new Date().toISOString().slice(0, 10);
    const operationId = yangiOperationId();
    if (mode === 'qoshish') {
      const result = await sbFaktYoz({
        obyektId,
        sana,
        operationId,
        qatorlar: [{ qator_id: node.id, hajm: value }],
        izoh: 'LRV ichidan kanonik Fakt qo‘shish',
      });
      if (!result.ok) return { ok: false, message: result.error || result.xabar || 'Fakt qo‘shilmadi.' };
    } else {
      const result = await sbFaktBelgilaV2({
        obyektId,
        qatorId: node.id,
        expectedFaktHajm: Number(node.fakt || 0),
        yangiFaktHajm: value,
        sana,
        operationId,
        izoh: 'LRV ichidan kanonik Fakt jami tahriri',
      });
      if (!result.ok) {
        const conflict = result.code === 'FAKT_CONFLICT';
        return { ok: false, conflict, message: conflict ? 'Qator serverda o‘zgargan. Yangilang va qayta urinib ko‘ring.' : (result.error || result.xabar || 'Fakt saqlanmadi.') };
      }
    }
    await yuklash();
    return { ok: true };
  }, [obyektId, validId, yuklash]);

  return (
    <Sahifa sarlavha="Ishchi smeta / LRV" tavsif="Supabase kanonik qatorlari va tasdiqlangan F2 tarixi">
      <div className="flex h-full min-h-0 flex-col gap-3">
        <section className="karta flex flex-wrap items-end gap-3 p-3">
          <button onClick={() => navigate('/admin/obyektlar')} className="rounded-lg border border-border p-2 text-text-dim hover:text-text" aria-label="Obyektlarga qaytish"><ArrowLeft size={17} /></button>
          <label className="min-w-[260px] flex-1 text-[12px] font-medium text-text">
            Kanonik obyekt
            <select value={validId ? String(obyektId) : ''} onChange={(e) => { const nextId = Number(e.target.value); const object = obyektlar.find((item) => item.id === nextId); if (Number.isSafeInteger(nextId) && nextId > 0) { workspace.setObjectId(nextId); navigate(`/admin/holat/${nextId}?obyekt=${nextId}&obyekt_nomi=${encodeURIComponent(object?.nom || '')}`); } else { workspace.setObjectId(null); navigate('/admin/holat'); } }} className="mt-1.5 block w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-text outline-none focus:border-accent">
              <option value="">-- obyektni tanlang --</option>
              {obyektlar.map((o) => <option key={o.id} value={o.id}>{o.nom}</option>)}
            </select>
          </label>
          <button onClick={() => void yuklash()} disabled={!validId || loading} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[12px] font-medium hover:bg-surface-2 disabled:opacity-40"><RefreshCw size={14} /> Yangilash</button>
          {validId && tree.length > 0 && (<>
            <button onClick={() => void eksportQil('toliq')} disabled={eksportBolmoqda || !exportGate.ok}
              title={exportGate.ok ? "Excel'da: bl ОБЪЁМини o'zgartirsangiz, resurslar va summalar formula orqali avtomatik qayta hisoblanadi. Nakrutka kaskadi ham qo'shiladi." : `Eksport bloklangan: ${exportBlockReason}`}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[12px] font-medium hover:bg-surface-2 disabled:opacity-40">
              <FileSpreadsheet size={14} /> {eksportBolmoqda ? 'Tuzilmoqda…' : 'LRV Excel'}
            </button>
            <button onClick={() => void eksportQil('forma2')} disabled={eksportBolmoqda || !exportGate.ok}
              title={exportGate.ok ? "Forma-2 -- LRV'ning O ustunigacha bo'lgan qismi + nakrutka kaskadi. Buyurtmachiga tasdiqlash uchun yuboriladigan shakl." : `Eksport bloklangan: ${exportBlockReason}`}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[12px] font-medium hover:bg-surface-2 disabled:opacity-40">
              <FileSpreadsheet size={14} /> {eksportBolmoqda ? 'Tuzilmoqda…' : 'Forma-2 Excel'}
            </button>
          </>)}
          {validId && tree.length > 0 && !exportGate.ok && (
            <span role="status" className="max-w-[280px] text-[11px] text-warn">
              Excel eksporti bloklangan: {exportBlockReason}. PTO scope’da loyiha, davr, source hujjat va revisionni tanlang.
            </span>
          )}
          {validId && <button onClick={() => navigate(`/admin/fakt?obyekt=${obyektId}`)} className="rounded-lg bg-accent px-3 py-2 text-[12px] font-medium text-white">Fakt kiritish</button>}
        </section>

        {!validId && (
          <section className="karta border-warn/40 bg-warn/5 p-4 text-[13px] text-text-dim">
            Eski matnli obyekt havolasi kanonik identity emas. Yuqoridan obyektni tanlang — sahifa keyin faqat raqamli `t2_obyekt.id` bilan ishlaydi.
          </section>
        )}
        {error && <section className="karta flex items-center gap-2 border-danger/40 bg-danger/5 p-4 text-[13px] text-danger"><AlertTriangle size={16} />{error}</section>}
        {loading && <div className="skel min-h-[280px] flex-1 rounded-xl" />}
        {selected && !loading && !error && (
          <section className="karta flex flex-wrap gap-x-6 gap-y-1 p-3 text-[12px]">
            <span><Database size={13} className="mr-1 inline text-accent" />{selected.nom}</span>
            <span className="text-text-dim">Smeta: <b className="text-text"><FmtN val={smetaJami} /></b></span>
            <span className="text-text-dim">Fakt: <b className="text-text"><FmtN val={faktJami} /></b></span>
            <span className="text-text-dim">Tasdiqlangan F2: <b className="text-text"><FmtN val={f2Jami} /></b></span>
          </section>
        )}
        {validId && !loading && !error && tree.length === 0 && <section className="karta p-5 text-[13px] text-text-dim">Bu obyektda kanonik smeta qatorlari yo‘q.</section>}
        {/* Ikki xil tahrir bir-birini to'ldiradi: `onFaktSave` — bajarilgan
            hajm (Fakt) uchun, `onQatorTahrirlandi` — smeta qatorining o'z
            maydonlari (nom/hajm/narx/birlik/kat) tahriridan keyin daraxtni
            qayta yuklash uchun. */}
        {tree.length > 0 && !loading && <div className="min-h-0 flex-1"><SmetaTree data={tree} priceControlLines={priceControlLines} onFaktSave={faktSaqlash} onQatorTahrirlandi={yuklash} /></div>}
        {selected && !loading && !error && (
          <div className="shrink-0 space-y-3" aria-label="LRV kundalik boshqaruv panellari">
            <details className="karta group p-3" open={ochiqPanel === 'smeta'} onToggle={(e) => setOchiqPanel(e.currentTarget.open ? 'smeta' : null)}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-semibold text-text">
                <span>Smeta XLSX yuklash</span><span className="text-[11px] font-normal text-text-mute group-open:hidden">ochish ▾</span><span className="hidden text-[11px] font-normal text-text-mute group-open:inline">yopish ▴</span>
              </summary>
              {ochiqPanel === 'smeta' && <div className="mt-3 max-h-[360px] overflow-auto"><SmetaYuklaNative obyektId={obyektId} onImportlandi={yuklash} /></div>}
            </details>
            <details className="karta group p-3" open={ochiqPanel === 'resurs'} onToggle={(e) => setOchiqPanel(e.currentTarget.open ? 'resurs' : null)}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-semibold text-text">
                <span>Resurs vedomosti</span><span className="text-[11px] font-normal text-text-mute group-open:hidden">ochish ▾</span><span className="hidden text-[11px] font-normal text-text-mute group-open:inline">yopish ▴</span>
              </summary>
              {ochiqPanel === 'resurs' && <div className="mt-3 max-h-[520px] overflow-auto"><ResursVedomostNative obyektId={obyektId} /></div>}
            </details>
            <details className="karta group p-3" open={ochiqPanel === 'narx'} onToggle={(e) => setOchiqPanel(e.currentTarget.open ? 'narx' : null)}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-semibold text-text">
                <span>Narx nazorati</span><span className="text-[11px] font-normal text-text-mute group-open:hidden">ochish ▾</span><span className="hidden text-[11px] font-normal text-text-mute group-open:inline">yopish ▴</span>
              </summary>
              {ochiqPanel === 'narx' && <div className="mt-3 max-h-[520px] overflow-auto"><NarxNazoratNative obyektId={obyektId} /></div>}
            </details>
          </div>
        )}
      </div>
    </Sahifa>
  );
}

export default HolatNative;
