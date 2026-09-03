/**
 * KompaniyaPage.tsx — canonical /admin/kompaniya, the Company Control
 * Center hub (T2-COMPANY-CONTROL-CLOSEOUT Phase A P0 #4).
 *
 * Top section (global, no company needed): identity + memberships + open a
 * new company. Below it, 7 tabs operating on the ACTIVE company (header
 * selector, `useKompaniya().joriy`) — Profil / A'zolar / Rollar va
 * Ruxsatlar / Modullar / Loyiha-Obyekt ruxsatlari / Integratsiyalar /
 * Audit. No fake billing/subscription UI, no simulated (setTimeout) saves —
 * every tab is either wired to a real canonical command/read model, or (for
 * pieces whose write RPC does not exist yet) an HONEST "hali yaratilmagan"
 * empty state, never a fake button.
 * EGALIK: Claude (integration lane).
 */
import { useMemo, useState } from 'react';
import {
  Building2, Crown, ShieldCheck, Loader2, AlertTriangle, Trash2, Users, LogOut,
  User, KeyRound, Layers, FolderKanban, Plug, History, Save, RefreshCw,
} from 'lucide-react';
import { useMen, useOnboardingCommands, useKompaniyaAzolari, useKompaniyaProfil, useProfilYangila, type Azolik, type KompaniyaProfil } from '../../api/t2-men';
import { useSystemControl } from '../../api/t2-control';
import { useKompaniya } from '../../umumiy/kontekst/KompaniyaKontekst';
import { KompaniyaKerak } from '../../umumiy/kontekst/KompaniyaKerak';
import { tizimdanChiq } from '../../umumiy/kontekst/chiqish';
import { PERMISSIONS, ROLE_PERMISSIONS, MEMBERSHIP_ROLES } from '../../lib/company-authorization/effective-authorization';

const AZO_ROLLAR = ['boss', 'rahbar', 'bugalter', 'pto', 'prorab', 'buyurtmachi', 'pudratchi', 'kuzatuvchi'] as const;
const MAVQE_VARIANTLAR = ['zakazchik', 'pudratchi', 'loyihachi'] as const;

function xatoMatn(code?: string): string {
  switch (code) {
    case 'LAST_DIRECTOR': return 'Kompaniyaning oxirgi direktorini o‘chirib/tushirib bo‘lmaydi.';
    case 'ALREADY_MEMBER': return 'Bu foydalanuvchi allaqachon a‘zo.';
    case 'ROLE_INVALID': return 'Bu rolni bu yerdan berib bo‘lmaydi (superadmin — platforma darajasida).';
    case 'INN_INVALID': return 'STIR 9 ta raqamdan iborat bo‘lishi kerak.';
    case 'MAVQE_INVALID': return 'Mavqe noto‘g‘ri.';
    case 'COMPANY_NAME_REQUIRED': return 'Kompaniya nomini kiriting.';
    case 'AUTH_REQUIRED': return 'Sessiya muddati tugagan. Chiqib, qaytadan kiring.';
    case 'AUTHORIZATION_DENIED': return 'Bu amal uchun ruxsatingiz yo‘q.';
    case 'STALE_VERSION': return 'Ma’lumot boshqa joyda yangilangan. Sahifani qayta yuklang.';
    default: return 'Amalni bajarib bo‘lmadi. Birozdan so‘ng qayta urinib ko‘ring.';
  }
}

function AzolarBoshqaruv({ kompaniyaId, kompaniyaNom, isDirector }: { kompaniyaId: number; kompaniyaNom: string; isDirector: boolean }) {
  const q = useKompaniyaAzolari(kompaniyaId);
  const cmd = useOnboardingCommands();
  const [tahrirId, setTahrirId] = useState<number | null>(null);
  const [yangiRol, setYangiRol] = useState<string>('prorab');
  const [azoLogin, setAzoLogin] = useState('');
  const [azoRol, setAzoRol] = useState<string>('prorab');

  return (
    <div className="karta p-4">
      <div className="text-sm font-semibold flex items-center gap-2"><Users size={14} className="text-accent" /> {kompaniyaNom} — a‘zolar</div>
      {q.isLoading && <div className="mt-2 text-[12px] text-text-dim flex items-center gap-2"><Loader2 className="animate-spin" size={13} /> yuklanmoqda…</div>}
      {q.isError && <div className="mt-2 text-[12px] text-rose-300">A‘zolar ro‘yxatini o‘qib bo‘lmadi.</div>}
      {q.data && (
        <div className="mt-2 divide-y divide-border/60">
          {q.data.filter((a) => a.holat === 'faol').map((a) => (
            <div key={a.azolik_id} className="py-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-medium truncate">{a.ism || a.login} <span className="text-[11px] text-text-mute">@{a.login}</span></div>
                <div className="text-[11px] text-text-dim">{a.email || '—'}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {tahrirId === a.azolik_id ? (
                  <>
                    <select className="input py-0.5 text-[12px]" value={yangiRol} onChange={(e) => setYangiRol(e.target.value)}>
                      {AZO_ROLLAR.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <button className="text-[12px] text-accent" disabled={cmd.azoRol.isPending}
                      onClick={() => cmd.azoRol.mutate({ azolik_id: a.azolik_id, rol: yangiRol }, { onSuccess: () => setTahrirId(null) })}>saqlash</button>
                    <button className="text-[12px] text-text-dim" onClick={() => setTahrirId(null)}>bekor</button>
                  </>
                ) : (
                  <>
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-surface-2 border border-border">{a.rol}</span>
                    {isDirector && <>
                      <button className="text-[12px] text-text-dim hover:text-text" onClick={() => { setTahrirId(a.azolik_id); setYangiRol(a.rol); }}>rol</button>
                      <button className="text-rose-400 hover:text-rose-300" title="A‘zolikni bekor qilish"
                        disabled={cmd.azoOchir.isPending}
                        onClick={() => { if (confirm(`«${a.ism || a.login}» a‘zoligi bekor qilinsinmi? Qilgan ishlari saqlanadi.`)) cmd.azoOchir.mutate({ azolik_id: a.azolik_id }); }}>
                        <Trash2 size={14} />
                      </button>
                    </>}
                  </>
                )}
              </div>
            </div>
          ))}
          {!q.data.some((a) => a.holat === 'faol') && <div className="py-2 text-[12px] text-text-dim">— faol a‘zo yo‘q —</div>}
        </div>
      )}
      {(cmd.azoRol.isError || cmd.azoOchir.isError) && (
        <p className="mt-2 text-[12px] text-rose-300">{xatoMatn(((cmd.azoRol.error || cmd.azoOchir.error) as any)?.code)}</p>
      )}

      {isDirector && (
        <div className="mt-4 pt-3 border-t border-border/60 grid gap-2 sm:grid-cols-3">
          <input className="input" placeholder="login" value={azoLogin} onChange={(e) => setAzoLogin(e.target.value)} />
          <select className="input" value={azoRol} onChange={(e) => setAzoRol(e.target.value)}>
            {AZO_ROLLAR.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button className="tugma-asosiy" disabled={cmd.azoQosh.isPending || !azoLogin.trim()}
            onClick={() => cmd.azoQosh.mutate({ kompaniya_id: kompaniyaId, login: azoLogin.trim(), rol: azoRol }, { onSuccess: () => setAzoLogin('') })}>
            {cmd.azoQosh.isPending ? <Loader2 className="animate-spin" size={15} /> : 'A‘zo qo‘shish'}
          </button>
          {cmd.azoQosh.isError && <p className="col-span-3 text-[12px] text-rose-300">{xatoMatn((cmd.azoQosh.error as any)?.code)}</p>}
          <p className="col-span-3 text-[11px] text-text-mute flex items-center gap-1"><ShieldCheck size={12} /> superadmin roli bu yerdan berilmaydi — platforma darajasida.</p>
        </div>
      )}
    </div>
  );
}

function ProfilTab({ kompaniyaId, isDirector }: { kompaniyaId: number; isDirector: boolean }) {
  const q = useKompaniyaProfil(kompaniyaId);
  const mut = useProfilYangila(kompaniyaId);
  const [draft, setDraft] = useState<Partial<KompaniyaProfil> | null>(null);

  const p = draft ?? q.data ?? null;
  const set = (k: keyof KompaniyaProfil) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDraft({ ...(draft ?? q.data ?? {}), [k]: e.target.value });

  if (q.isLoading) return <div className="p-4 text-[13px] text-text-dim flex items-center gap-2"><Loader2 className="animate-spin" size={14} /> yuklanmoqda…</div>;
  if (q.isError) return <div className="p-4 text-[13px] text-rose-300">{xatoMatn((q.error as any)?.code)}</div>;
  if (!q.data || !p) return null;

  const ozgardi = draft != null;

  return (
    <div className="karta p-4 max-w-2xl">
      {!isDirector && (
        <div className="mb-3 text-[12px] text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2">
          Profilni faqat direktor tahrirlaydi. Quyidagi ma’lumot faqat ko‘rish uchun.
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-[12px] text-text-dim">To‘liq nom
          <input className="input mt-1 w-full" disabled={!isDirector} value={p.toliq_nom ?? ''} onChange={set('toliq_nom')} />
        </label>
        <label className="text-[12px] text-text-dim">STIR (INN)
          <input className="input mt-1 w-full" disabled={!isDirector} value={p.inn ?? ''} onChange={set('inn')} />
        </label>
        <label className="text-[12px] text-text-dim sm:col-span-2">Manzil
          <input className="input mt-1 w-full" disabled={!isDirector} value={p.manzil ?? ''} onChange={set('manzil')} />
        </label>
        <label className="text-[12px] text-text-dim">Rahbar
          <input className="input mt-1 w-full" disabled={!isDirector} value={p.rahbar ?? ''} onChange={set('rahbar')} />
        </label>
        <label className="text-[12px] text-text-dim">Telefon
          <input className="input mt-1 w-full" disabled={!isDirector} value={p.telefon ?? ''} onChange={set('telefon')} />
        </label>
        <label className="text-[12px] text-text-dim">Bank
          <input className="input mt-1 w-full" disabled={!isDirector} value={p.bank ?? ''} onChange={set('bank')} />
        </label>
        <label className="text-[12px] text-text-dim">Hisob raqam
          <input className="input mt-1 w-full" disabled={!isDirector} value={p.hisob_raqam ?? ''} onChange={set('hisob_raqam')} />
        </label>
        <label className="text-[12px] text-text-dim">MFO
          <input className="input mt-1 w-full" disabled={!isDirector} value={p.mfo ?? ''} onChange={set('mfo')} />
        </label>
        <label className="text-[12px] text-text-dim">Mavqe
          <select className="input mt-1 w-full" disabled={!isDirector} value={p.mavqe ?? ''} onChange={set('mavqe')}>
            <option value="">—</option>
            {MAVQE_VARIANTLAR.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
      </div>

      {isDirector && (
        <div className="mt-4 flex items-center gap-2">
          <button className="tugma-asosiy" disabled={!ozgardi || mut.isPending}
            onClick={() => mut.mutate({
              kompaniya_id: kompaniyaId, expected_version: q.data!.versiya,
              toliq_nom: p.toliq_nom ?? undefined, inn: p.inn ?? undefined, manzil: p.manzil ?? undefined,
              rahbar: p.rahbar ?? undefined, telefon: p.telefon ?? undefined, bank: p.bank ?? undefined,
              hisob_raqam: p.hisob_raqam ?? undefined, mfo: p.mfo ?? undefined, mavqe: p.mavqe ?? undefined,
            }, { onSuccess: () => setDraft(null) })}>
            {mut.isPending ? <Loader2 className="animate-spin" size={14} /> : <><Save size={14} className="inline mr-1" /> Saqlash</>}
          </button>
          {ozgardi && <button className="text-[12px] text-text-dim" onClick={() => setDraft(null)}>bekor qilish</button>}
          <span className="text-[11px] text-text-mute">versiya: {q.data.versiya}</span>
        </div>
      )}
      {mut.isError && (
        <div className="mt-2 text-[12px] text-rose-300 flex items-center gap-2">
          {xatoMatn((mut.error as any)?.code)}
          {(mut.error as any)?.code === 'STALE_VERSION' && (
            <button className="underline" onClick={() => q.refetch()}><RefreshCw size={11} className="inline" /> qayta yuklash</button>
          )}
        </div>
      )}
    </div>
  );
}

function RollarTab() {
  return (
    <div className="karta p-4 overflow-x-auto">
      <p className="text-[12px] text-text-dim mb-3">
        Bu — tizimning haqiqiy ruxsat qonuni (<code>t2_effective_authorization_v1</code> /
        <code> effective-authorization.ts</code> bilan bir xil manba). Ruxsatlar shu yerdan
        o‘zgartirilmaydi — rolning o‘zi kompaniya a‘zoligida beriladi (A‘zolar tabi).
      </p>
      <table className="text-[12px] w-full min-w-[720px]">
        <thead>
          <tr className="text-left text-text-dim border-b border-border">
            <th className="py-1.5 pr-3">Rol</th>
            {PERMISSIONS.filter((p) => !p.startsWith('control.global')).map((p) => (
              <th key={p} className="py-1.5 px-1.5 font-normal whitespace-nowrap">{p}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MEMBERSHIP_ROLES.filter((r) => r !== 'superadmin' && r !== 'admin').map((rol) => (
            <tr key={rol} className="border-b border-border/40">
              <td className="py-1.5 pr-3 font-medium">{rol}</td>
              {PERMISSIONS.filter((p) => !p.startsWith('control.global')).map((p) => (
                <td key={p} className="py-1.5 px-1.5 text-center">
                  {ROLE_PERMISSIONS[rol].includes(p) ? <span className="text-emerald-400">✓</span> : <span className="text-text-mute/40">·</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModullarTab({ kompaniyaId }: { kompaniyaId: number }) {
  const q = useSystemControl(kompaniyaId);
  if (q.isLoading) return <div className="p-4 text-[13px] text-text-dim flex items-center gap-2"><Loader2 className="animate-spin" size={14} /> yuklanmoqda…</div>;
  if (q.isError) return <div className="p-4 text-[13px] text-rose-300">Modullar ma’lumotini o‘qib bo‘lmadi.</div>;
  const caps = q.data?.capabilities ?? [];
  if (!caps.length) return <div className="p-4 text-[13px] text-text-dim">— modul ma’lumoti yo‘q —</div>;
  return (
    <div className="karta p-4 divide-y divide-border/60">
      {caps.map((c: any) => (
        <div key={c.id} className="py-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px] font-medium truncate">{c.capability} <span className="text-[11px] text-text-mute">({c.module})</span></div>
            <div className="text-[11px] text-text-dim">scope: {c.scope} · versiya {c.version}</div>
          </div>
          <span className={`text-[11px] px-1.5 py-0.5 rounded border ${c.status === 'healthy' ? 'border-emerald-500/40 text-emerald-300' : 'border-rose-500/40 text-rose-300'}`}>{c.status}</span>
        </div>
      ))}
      <p className="pt-2 text-[11px] text-text-mute">Boshqarish (yoqish/o‘chirish, kill-switch): Tizim boshqaruv markazi.</p>
    </div>
  );
}

function IntegratsiyalarTab({ kompaniyaId }: { kompaniyaId: number }) {
  const q = useSystemControl(kompaniyaId);
  if (q.isLoading) return <div className="p-4 text-[13px] text-text-dim flex items-center gap-2"><Loader2 className="animate-spin" size={14} /> yuklanmoqda…</div>;
  if (q.isError) return <div className="p-4 text-[13px] text-rose-300">Integratsiyalar ma’lumotini o‘qib bo‘lmadi.</div>;
  const ints = q.data?.integrations ?? [];
  if (!ints.length) return <div className="p-4 text-[13px] text-text-dim">— integratsiya sozlanmagan —</div>;
  return (
    <div className="karta p-4 divide-y divide-border/60">
      {ints.map((i: any) => (
        <div key={i.id} className="py-2 flex items-center justify-between gap-3">
          <div className="text-[13px] font-medium">{i.name}</div>
          <span className={`text-[11px] px-1.5 py-0.5 rounded border ${i.status === 'ok' || i.status === 'healthy' ? 'border-emerald-500/40 text-emerald-300' : 'border-amber-500/40 text-amber-300'}`}>{i.status}</span>
        </div>
      ))}
    </div>
  );
}

function AuditTab({ kompaniyaId }: { kompaniyaId: number }) {
  const q = useSystemControl(kompaniyaId);
  if (q.isLoading) return <div className="p-4 text-[13px] text-text-dim flex items-center gap-2"><Loader2 className="animate-spin" size={14} /> yuklanmoqda…</div>;
  if (q.isError) return <div className="p-4 text-[13px] text-rose-300">Audit ma’lumotini o‘qib bo‘lmadi.</div>;
  const events = q.data?.auditEvents ?? [];
  if (!events.length) return <div className="p-4 text-[13px] text-text-dim">— audit yozuvi yo‘q —</div>;
  return (
    <div className="karta p-4 divide-y divide-border/60 max-h-[420px] overflow-y-auto">
      {events.map((e: any) => (
        <div key={e.id} className="py-2 text-[12px]">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">{e.action}</span>
            <span className="text-text-mute">{new Date(e.timestamp).toLocaleString('uz-UZ')}</span>
          </div>
          <div className="text-text-dim">{e.actor} — {e.entity}{e.newValue ? `: ${e.newValue}` : ''}</div>
        </div>
      ))}
    </div>
  );
}

function LoyihaObyektTab() {
  return (
    <div className="karta p-4 max-w-lg text-[13px] text-text-dim">
      <div className="flex items-start gap-2">
        <FolderKanban size={16} className="mt-0.5 shrink-0 text-text-mute" />
        <div>
          Loyiha/obyekt darajasidagi shaxsiy ruxsatlar jadvali (
          <code>t2_loyiha_foydalanuvchi_ruxsat</code>, <code>t2_obyekt_foydalanuvchi_ruxsat</code>)
          bazada bor, lekin ularni BOSHQARADIGAN buyruq (write RPC) hali yaratilmagan —
          bu tab hozircha faqat holatni halol aytadi, soxta tugma ko‘rsatmaydi.
          Kompaniya a’zoligi darajasidagi ruxsatlar «A‘zolar» tabida ishlaydi.
        </div>
      </div>
    </div>
  );
}

const TABS = [
  { key: 'profil', nom: 'Profil', Ikonka: User },
  { key: 'azolar', nom: 'A‘zolar', Ikonka: Users },
  { key: 'rollar', nom: 'Rollar va Ruxsatlar', Ikonka: KeyRound },
  { key: 'modullar', nom: 'Modullar', Ikonka: Layers },
  { key: 'loyiha', nom: 'Loyiha/Obyekt', Ikonka: FolderKanban },
  { key: 'integratsiya', nom: 'Integratsiyalar', Ikonka: Plug },
  { key: 'audit', nom: 'Audit', Ikonka: History },
] as const;
type TabKey = typeof TABS[number]['key'];

function ControlCenterTabs({ kompaniyaId, kompaniyaNom, isDirector }: { kompaniyaId: number; kompaniyaNom: string; isDirector: boolean }) {
  const [tab, setTab] = useState<TabKey>('profil');
  return (
    <div>
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-accent text-text' : 'border-transparent text-text-dim hover:text-text'
            }`}>
            <t.Ikonka size={13} /> {t.nom}
          </button>
        ))}
      </div>
      <div className="mt-3">
        {tab === 'profil' && <ProfilTab kompaniyaId={kompaniyaId} isDirector={isDirector} />}
        {tab === 'azolar' && <AzolarBoshqaruv kompaniyaId={kompaniyaId} kompaniyaNom={kompaniyaNom} isDirector={isDirector} />}
        {tab === 'rollar' && <RollarTab />}
        {tab === 'modullar' && <ModullarTab kompaniyaId={kompaniyaId} />}
        {tab === 'loyiha' && <LoyihaObyektTab />}
        {tab === 'integratsiya' && <IntegratsiyalarTab kompaniyaId={kompaniyaId} />}
        {tab === 'audit' && <AuditTab kompaniyaId={kompaniyaId} />}
      </div>
    </div>
  );
}

export default function KompaniyaPage() {
  const q = useMen();
  const cmd = useOnboardingCommands();
  const k = useKompaniya();
  const [nom, setNom] = useState('');
  const [inn, setInn] = useState('');
  const [telefon, setTelefon] = useState('');

  const direktorKompaniyalar = useMemo(
    () => (q.data?.azoliklar ?? []).filter((a) => a.is_director),
    [q.data],
  );

  if (q.isLoading) return <div className="p-6 text-sm text-text-dim flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> Yuklanmoqda…</div>;
  if (q.isError) {
    const c = (q.error as any)?.code;
    const auth = c === 'AUTH_REQUIRED' || c === 'ACTOR_NOT_FOUND' || c === 'ACTOR_RESOLVE_FAILED';
    const matn = auth ? 'Sessiyani yangilash kerak. Chiqing va qaytadan kiring.'
      : c === 'CONFIG' || c === 'ME_FAILED' ? 'Kompaniya ma‘lumoti serveri sozlamasida nosozlik. Administrator bilan bog‘laning.'
      : 'Kompaniya ma‘lumotini o‘qib bo‘lmadi. Birozdan so‘ng qayta urinib ko‘ring.';
    return (
      <div className="p-6 text-sm">
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-rose-100">
          <div className="flex items-start gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>{matn}</span></div>
          <div className="mt-3">
            {auth
              ? <button onClick={tizimdanChiq} className="inline-flex items-center gap-1.5 rounded-md bg-rose-500/20 hover:bg-rose-500/30 px-3 py-1.5 font-medium"><LogOut size={13} /> Chiqib, qayta kirish</button>
              : <button onClick={() => q.refetch()} className="underline">Qayta urinish</button>}
          </div>
        </div>
      </div>
    );
  }

  const men = q.data!;

  return (
    <div className="p-6 bg-bg min-h-screen text-text max-w-4xl">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="text-accent" /> Kompaniya va a‘zolik</h1>
      <p className="text-sm text-text-dim mt-1">
        {men.foydalanuvchi.login} — {men.jami} ta kompaniyada a‘zo.
      </p>

      {men.onboarding_kerak && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-100 flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          Siz hali hech qaysi kompaniyaga a‘zo emassiz. Yangi kompaniya oching yoki direktordan sizni qo‘shishini so‘rang.
        </div>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-text-dim uppercase tracking-wide">A‘zoliklarim</h2>
        <div className="mt-2 grid gap-2">
          {men.azoliklar.map((a: Azolik) => (
            <div key={a.azolik_id} className="karta p-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium flex items-center gap-2">
                  {a.is_director && <Crown size={14} className="text-amber-400" />} {a.nom}
                  <span className="text-[11px] text-text-mute">({a.kod})</span>
                </div>
                <div className="text-[11px] text-text-dim">Rol: {a.rol}{a.is_director ? ' — direktor' : ''}</div>
              </div>
            </div>
          ))}
          {!men.azoliklar.length && <div className="text-[13px] text-text-dim">— a‘zolik yo‘q —</div>}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-text-dim uppercase tracking-wide flex items-center gap-2"><Building2 size={14} /> Yangi kompaniya ochish</h2>
        <div className="mt-2 karta p-4 grid gap-3 sm:grid-cols-3">
          <input className="input col-span-3 sm:col-span-1" placeholder="Kompaniya nomi *" value={nom} onChange={(e) => setNom(e.target.value)} />
          <input className="input" placeholder="STIR (9 raqam)" value={inn} onChange={(e) => setInn(e.target.value)} />
          <input className="input" placeholder="Telefon" value={telefon} onChange={(e) => setTelefon(e.target.value)} />
          <button
            className="tugma-asosiy col-span-3 sm:col-auto"
            disabled={cmd.yarat.isPending || nom.trim().length < 2}
            onClick={() => cmd.yarat.mutate({ nom: nom.trim(), inn: inn.trim() || undefined, telefon: telefon.trim() || undefined },
              { onSuccess: () => { setNom(''); setInn(''); setTelefon(''); } })}
          >
            {cmd.yarat.isPending ? <Loader2 className="animate-spin" size={15} /> : 'Ochish — men direktor bo‘laman'}
          </button>
        </div>
        {cmd.yarat.isError && <p className="mt-1 text-[12px] text-rose-300">{xatoMatn((cmd.yarat.error as any)?.code)}</p>}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-text-dim uppercase tracking-wide flex items-center gap-2"><ShieldCheck size={14} /> Company Control Center</h2>
        <p className="text-[12px] text-text-dim mt-1 mb-3">
          Yuqoridagi <b className="text-text">«Kontekst»</b> tanlovidagi FAOL kompaniya uchun. Boshqa kompaniyani
          boshqarish uchun avval uni yuqoridan tanlang.
        </p>
        {k.globalRejim || !k.joriyId ? (
          <KompaniyaKerak nima="Company Control Center" />
        ) : (
          <ControlCenterTabs
            kompaniyaId={k.joriyId}
            kompaniyaNom={k.joriy?.nom ?? ''}
            isDirector={direktorKompaniyalar.some((d) => d.kompaniya_id === k.joriyId)}
          />
        )}
      </section>

      <p className="mt-10 text-[11px] text-text-mute">
        Ma‘lumot manbai: <code>t2_men_v1</code> / <code>t2_kompaniya_yangila_v1</code> / <code>t2_azolik_*_v1</code> /
        <code> t2_system_control_v1</code> (kanonik). Obuna/to‘lov modeli bu relizda YO‘Q.
      </p>
    </div>
  );
}
