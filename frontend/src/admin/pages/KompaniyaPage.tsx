/**
 * KompaniyaPage.tsx — canonical /admin/kompaniya (COMPANY / AUTH / DIRECTOR).
 * TIZIM_02 ning YAGONA kompaniya markazi:
 *   • A'zoliklarim (identity + memberships, t2_men_v1)
 *   • Yangi kompaniya ochish (direktor bo'laman)
 *   • Direktor: a'zolar ro'yxati — qo'shish / rol o'zgartirish / o'chirish
 * Barcha yozuv kanonik /api/company -> t2_kompaniya_yarat_v1 / t2_azolik_*_v1
 * (direktor-qo'riqchili, audit). Eski "Xodimlar va Rollar" sahifasi shu yerga
 * yo'naltiriladi. Demo/obuna/to'lov YO'Q.
 * EGALIK: Claude (integration lane).
 */
import { useMemo, useState } from 'react';
import { Building2, Crown, UserPlus, ShieldCheck, Loader2, AlertTriangle, Trash2, Users } from 'lucide-react';
import { useMen, useOnboardingCommands, useKompaniyaAzolari, type Azolik } from '../../api/t2-men';

const AZO_ROLLAR = ['boss', 'rahbar', 'bugalter', 'pto', 'prorab', 'buyurtmachi', 'pudratchi', 'kuzatuvchi'] as const;

function xatoMatn(code?: string): string {
  switch (code) {
    case 'LAST_DIRECTOR': return 'Kompaniyaning oxirgi direktorini o‘chirib/tushirib bo‘lmaydi.';
    case 'ALREADY_MEMBER': return 'Bu foydalanuvchi allaqachon a‘zo.';
    case 'ROLE_INVALID': return 'Bu rolni bu yerdan berib bo‘lmaydi (superadmin — platforma darajasida).';
    case 'INN_INVALID': return 'STIR 9 ta raqamdan iborat bo‘lishi kerak.';
    case 'COMPANY_NAME_REQUIRED': return 'Kompaniya nomini kiriting.';
    case 'AUTH_REQUIRED': return 'Sessiya muddati tugagan. Chiqib, qaytadan kiring.';
    default: return 'Amalni bajarib bo‘lmadi. Birozdan so‘ng qayta urinib ko‘ring.';
  }
}

function AzolarBoshqaruv({ kompaniyaId, kompaniyaNom }: { kompaniyaId: number; kompaniyaNom: string }) {
  const q = useKompaniyaAzolari(kompaniyaId);
  const cmd = useOnboardingCommands();
  const [tahrirId, setTahrirId] = useState<number | null>(null);
  const [yangiRol, setYangiRol] = useState<string>('prorab');

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
                    <button className="text-[12px] text-text-dim hover:text-text" onClick={() => { setTahrirId(a.azolik_id); setYangiRol(a.rol); }}>rol</button>
                    <button className="text-rose-400 hover:text-rose-300" title="A‘zolikni bekor qilish"
                      disabled={cmd.azoOchir.isPending}
                      onClick={() => { if (confirm(`«${a.ism || a.login}» a‘zoligi bekor qilinsinmi? Qilgan ishlari saqlanadi.`)) cmd.azoOchir.mutate({ azolik_id: a.azolik_id }); }}>
                      <Trash2 size={14} />
                    </button>
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
    </div>
  );
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
          Ma‘lumotni o‘qib bo‘lmadi.{' '}
          {(q.error as any)?.code === 'AUTH_REQUIRED'
            ? <button onClick={() => (window.location.href = '/')} className="underline">Kirish sahifasi</button>
            : <button onClick={() => q.refetch()} className="underline">Qayta urinish</button>}
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

          <div className="mt-4 grid gap-3">
            {direktorKompaniyalar.map((a) => (
              <AzolarBoshqaruv key={a.kompaniya_id} kompaniyaId={a.kompaniya_id} kompaniyaNom={a.nom} />
            ))}
          </div>
        </section>
      )}

      <p className="mt-10 text-[11px] text-text-mute">
        Ma‘lumot manbai: <code>t2_men_v1</code> / <code>t2_kompaniya_yarat_v1</code> / <code>t2_azolik_*_v1</code> (kanonik).
        Obuna/to‘lov modeli bu relizda YO‘Q.
      </p>
    </div>
  );
}
