/**
 * KompaniyaPage.tsx — canonical /admin/kompaniya.
 * COMPANY / AUTH / DIRECTOR: current-user identity + memberships (t2_men_v1),
 * self-service company creation, and director-guarded member management.
 * All through /api/company -> Supabase RPC. No demo data, no fake subscription.
 * EGALIK: Claude (integration lane).
 */
import { useMemo, useState } from 'react';
import { Building2, Crown, UserPlus, ShieldCheck, Loader2, AlertTriangle } from 'lucide-react';
import { useMen, useOnboardingCommands, type Azolik } from '../../api/t2-men';

const AZO_ROLLAR = ['boss', 'rahbar', 'bugalter', 'pto', 'prorab', 'buyurtmachi', 'pudratchi', 'kuzatuvchi'] as const;

function xatoMatn(code?: string): string {
  switch (code) {
    case 'LAST_DIRECTOR': return 'Kompaniyaning oxirgi direktorini o‘chirib/tushirib bo‘lmaydi.';
    case 'ALREADY_MEMBER': return 'Bu foydalanuvchi allaqachon a‘zo.';
    case 'ROLE_INVALID': return 'Bu rolni bu yerdan berib bo‘lmaydi (superadmin platforma darajasida).';
    case 'INN_INVALID': return 'STIR 9 ta raqamdan iborat bo‘lishi kerak.';
    case 'COMPANY_NAME_REQUIRED': return 'Kompaniya nomini kiriting.';
    default: return code || 'Xatolik';
  }
}

export default function KompaniyaPage() {
  const q = useMen();
  const cmd = useOnboardingCommands();
  const [nom, setNom] = useState('');
  const [inn, setInn] = useState('');
  const [telefon, setTelefon] = useState('');
  const [azoKompaniya, setAzoKompaniya] = useState<number | null>(null);
  const [azoLogin, setAzoLogin] = useState('');
  const [azoRol, setAzoRol] = useState<string>('prorab');

  const direktorKompaniyalar = useMemo(
    () => (q.data?.azoliklar ?? []).filter((a) => a.is_director),
    [q.data],
  );

  if (q.isLoading) return <div className="p-6 text-sm text-text-dim flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> Yuklanmoqda…</div>;
  if (q.isError) {
    return (
      <div className="p-6 text-sm">
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-rose-100">
          Ma‘lumotni o‘qib bo‘lmadi: {(q.error as any)?.code}.{' '}
          {(q.error as any)?.code === 'ME_FAILED' && 'COMPANY onboarding migratsiyasi (20260905120000) hali productionga qo‘llanmagan bo‘lishi mumkin.'}
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

      {/* memberships */}
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

      {/* create company */}
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

      {/* add member (directors only) */}
      {direktorKompaniyalar.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-text-dim uppercase tracking-wide flex items-center gap-2"><UserPlus size={14} /> A‘zo qo‘shish (direktor huquqi)</h2>
          <div className="mt-2 karta p-4 grid gap-3 sm:grid-cols-4">
            <select className="input" value={azoKompaniya ?? direktorKompaniyalar[0].kompaniya_id}
              onChange={(e) => setAzoKompaniya(Number(e.target.value))}>
              {direktorKompaniyalar.map((a) => <option key={a.kompaniya_id} value={a.kompaniya_id}>{a.nom}</option>)}
            </select>
            <input className="input" placeholder="login" value={azoLogin} onChange={(e) => setAzoLogin(e.target.value)} />
            <select className="input" value={azoRol} onChange={(e) => setAzoRol(e.target.value)}>
              {AZO_ROLLAR.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <button className="tugma-asosiy" disabled={cmd.azoQosh.isPending || !azoLogin.trim()}
              onClick={() => cmd.azoQosh.mutate(
                { kompaniya_id: azoKompaniya ?? direktorKompaniyalar[0].kompaniya_id, login: azoLogin.trim(), rol: azoRol },
                { onSuccess: () => setAzoLogin('') })}>
              {cmd.azoQosh.isPending ? <Loader2 className="animate-spin" size={15} /> : 'Qo‘shish'}
            </button>
          </div>
          {cmd.azoQosh.isError && <p className="mt-1 text-[12px] text-rose-300">{xatoMatn((cmd.azoQosh.error as any)?.code)}</p>}
          <p className="mt-2 text-[11px] text-text-mute flex items-center gap-1"><ShieldCheck size={12} /> superadmin roli bu yerdan berilmaydi — platforma darajasida.</p>
        </section>
      )}

      <p className="mt-10 text-[11px] text-text-mute">
        Ma‘lumot manbai: <code>t2_men_v1</code> / <code>t2_kompaniya_yarat_v1</code> / <code>t2_azolik_*_v1</code> (kanonik).
        Obuna/to‘lov modeli bu relizda YO‘Q.
      </p>
    </div>
  );
}
