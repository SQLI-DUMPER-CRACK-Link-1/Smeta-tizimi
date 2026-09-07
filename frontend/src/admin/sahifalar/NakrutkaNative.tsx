import { useEffect, useState } from 'react';
import { RefreshCw, Save } from 'lucide-react';
import { useKompaniya } from '../../umumiy/kontekst/KompaniyaKontekst';
import { sbT2ObyektlarOlKomp, type T2Obyekt } from '../../api/supabase';
import {
  t2NakrutkaKoefOl, t2NakrutkaKoefSaqla, t2ObyektNakrutka,
  NAKRUTKA_KOEF_KODLAR, NAKRUTKA_KOEF_IZOH,
  type NakrutkaKoefKod, type NakrutkaKoeffitsientlar,
  type NakrutkaKaskad, type NakrutkaKategoriyaJadval,
} from '../../api/t2-nakrutka';
import { FmtN } from '../../lib/format';

/**
 * T1->T2 PTO gap-close: NAKRUTKA (markup/overhead) sahifasi -- T1 GAS'ning
 * 80_Shartnoma.js dagi koeffitsient tahrirlash + obyekt nakrutka hisobi UI
 * mantiqining native T2 porti (backend: t2_nakrutka_koef_ol_v1 /
 * t2_nakrutka_koef_saqla_v1 / t2_obyekt_nakrutka_v1, supabase/migrations/
 * 20261014090000_t2_nakrutka_v1.sql). Kompaniya standart koeffitsientlari
 * shu yerda tahrirlanadi; obyekt tanlansa -- o'sha obyektning t2_qator
 * summalaridan kategoriya bo'yicha (ЧЕЛ/МАШ/МАТ/ОБ/М/К/КАБ) hisoblangan
 * to'liq kaskad ko'rsatiladi.
 */

const KASKAD_QATORLAR: { key: keyof NakrutkaKaskad; label: string }[] = [
  { key: 'pryamye', label: 'To\'g\'ridan-to\'g\'ri xarajat (ЧЕЛ+МАШ+МАТ+ОБ)' },
  { key: 'tr_mat', label: 'Transport — material' },
  { key: 'skl_mat', label: 'Склад — material' },
  { key: 'tr_kab', label: 'Transport — kabel' },
  { key: 'itogo1', label: 'ИТОГО-1' },
  { key: 'prochie', label: 'Пудратчининг бошқа харажатлари' },
  { key: 'itogo2', label: 'ИТОГО-2' },
  { key: 'tr_ob', label: 'Transport — uskuna' },
  { key: 'zag_ob', label: 'Tayyorlov-склад — uskuna' },
  { key: 'itogo3', label: 'ИТОГО-3' },
  { key: 'strax', label: 'Sug\'urta' },
  { key: 'risk', label: 'Risk' },
  { key: 'itogo4', label: 'ИТОГО-4' },
  { key: 'nds', label: 'ҚҚС' },
  { key: 'vsego', label: 'ВСЕГО', },
];

function KoefTahrirchi({ companyId }: { companyId: number }) {
  const [koef, setKoef] = useState<NakrutkaKoeffitsientlar | null>(null);
  const [dirty, setDirty] = useState<Partial<Record<NakrutkaKoefKod, string>>>({});
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState<NakrutkaKoefKod | null>(null);
  const [xato, setXato] = useState('');

  const yukla = async () => {
    setBusy(true); setXato('');
    try {
      const r = await t2NakrutkaKoefOl(companyId);
      if (!r.ok) { setXato(r.error || 'Koeffitsientlar yuklanmadi'); return; }
      setKoef(r.koeffitsientlar); setDirty({});
    } finally { setBusy(false); }
  };

  useEffect(() => { void yukla(); }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const saqla = async (kod: NakrutkaKoefKod) => {
    const raw = dirty[kod];
    if (raw == null) return;
    const qiymat = Number(raw.replace(',', '.'));
    if (!Number.isFinite(qiymat)) { setXato('Qiymat noto\'g\'ri: ' + kod); return; }
    setSaving(kod); setXato('');
    try {
      const r = await t2NakrutkaKoefSaqla({ kompaniyaId: companyId, koefKod: kod, qiymat });
      if (!r.ok) { setXato(r.error || r.code || 'Saqlanmadi'); return; }
      await yukla();
    } finally { setSaving(null); }
  };

  if (busy && !koef) return <p className="text-text-mute text-sm">Koeffitsientlar yuklanmoqda…</p>;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">Kompaniya standart koeffitsientlari</h3>
        <button type="button" onClick={() => void yukla()} disabled={busy}
          className="text-[12px] flex items-center gap-1 px-2 py-1 border rounded disabled:opacity-40">
          <RefreshCw size={12} className={busy ? 'animate-spin' : ''} /> Yangilash
        </button>
      </div>
      {xato && <p className="text-danger text-sm">{xato}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] border-collapse">
          <tbody>
            {NAKRUTKA_KOEF_KODLAR.map(kod => {
              const saqlangan = koef?.[kod] ?? 0;
              const qiymat = dirty[kod] ?? String(saqlangan);
              const ozgargan = dirty[kod] != null && dirty[kod] !== String(saqlangan);
              return (
                <tr key={kod} className="border-t border-border/60">
                  <td className="px-2 py-1.5 text-text-mute" title={kod}>{NAKRUTKA_KOEF_IZOH[kod]}</td>
                  <td className="px-2 py-1.5 w-28">
                    <input aria-label={kod} className="w-full border rounded px-2 py-1 text-right tabular-nums"
                      value={qiymat} onChange={e => setDirty(d => ({ ...d, [kod]: e.target.value }))} />
                  </td>
                  <td className="px-2 py-1.5 w-10 text-center">%</td>
                  <td className="px-2 py-1.5 w-24">
                    <button type="button" disabled={!ozgargan || saving === kod}
                      onClick={() => void saqla(kod)}
                      className="text-[12px] flex items-center gap-1 px-2 py-1 border rounded disabled:opacity-30">
                      <Save size={12} /> {saving === kod ? 'Saqlanmoqda…' : 'Saqlash'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ObyektKaskad({ obyektId }: { obyektId: number }) {
  const [busy, setBusy] = useState(false);
  const [xato, setXato] = useState('');
  const [cats, setCats] = useState<{ chel: number; mash: number; mat: number; ob: number; mk: number; kab: number; bez: number } | null>(null);
  const [kaskad, setKaskad] = useState<NakrutkaKaskad | null>(null);
  const [jadval, setJadval] = useState<NakrutkaKategoriyaJadval | null>(null);

  useEffect(() => {
    let active = true;
    setBusy(true); setXato('');
    void t2ObyektNakrutka(obyektId).then(r => {
      if (!active) return;
      if (!r.ok) { setXato(r.error || r.code || 'Hisoblanmadi'); setCats(null); setKaskad(null); setJadval(null); return; }
      setCats(r.cats ?? null); setKaskad(r.nakrutka ?? null); setJadval(r.jadval ?? null);
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [obyektId]);

  if (busy) return <p className="text-text-mute text-sm">Hisoblanmoqda…</p>;
  if (xato) return <p className="text-danger text-sm">{xato}</p>;
  if (!kaskad || !cats) return null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 text-[12px]">
        {([['ЧЕЛ', cats.chel], ['МАШ', cats.mash], ['МАТ', cats.mat], ['ОБ', cats.ob], ['М/К', cats.mk], ['КАБ', cats.kab], ['БЕЗСКЛАД', cats.bez]] as const).map(([label, val]) => (
          <div key={label} className="border rounded px-2 py-1.5">
            <div className="text-text-mute">{label}</div>
            <div className="tabular-nums font-medium"><FmtN val={val} /></div>
          </div>
        ))}
      </div>
      <table className="w-full text-[13px] border-collapse">
        <tbody>
          {KASKAD_QATORLAR.map(({ key, label }) => {
            const isItogo = key.startsWith('itogo') || key === 'vsego';
            return (
              <tr key={key} className={'border-t border-border/60' + (isItogo ? ' font-semibold bg-surface-2/40' : '')}>
                <td className="px-2 py-1.5 text-text-mute">{label}</td>
                <td className="px-2 py-1.5 text-right tabular-nums"><FmtN val={kaskad[key]} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {jadval && (
        <div>
          <h4 className="text-sm font-semibold text-text mb-1">Kategoriya bo'yicha yakuniy koeffitsient jadvali</h4>
          <table className="w-full text-[13px] border-collapse">
            <tbody>
              {Object.entries(jadval).map(([kat, k]) => (
                <tr key={kat} className="border-t border-border/60">
                  <td className="px-2 py-1.5 text-text-mute">{kat}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{(k * 100).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Sessiya({ companyId }: { companyId: number }) {
  const [objects, setObjects] = useState<T2Obyekt[]>([]);
  const [objectId, setObjectId] = useState('');

  useEffect(() => {
    let active = true;
    void sbT2ObyektlarOlKomp(companyId).then(r => { if (active && r.ok) setObjects((r.qatorlar || []) as T2Obyekt[]); });
    return () => { active = false; };
  }, [companyId]);

  return (
    <div className="space-y-6 p-1">
      <KoefTahrirchi companyId={companyId} />
      <div className="space-y-2">
        <label className="block text-sm">Obyekt (nakrutka hisobini ko'rish uchun)
          <select aria-label="Obyekt" className="ml-2 border rounded px-2 py-1"
            value={objectId} onChange={e => setObjectId(e.target.value)}>
            <option value="">Tanlang</option>
            {objects.map(o => <option key={o.id} value={o.id}>{o.nom}</option>)}
          </select>
        </label>
        {objectId && <ObyektKaskad key={objectId} obyektId={Number(objectId)} />}
      </div>
    </div>
  );
}

export default function NakrutkaNative() {
  const { joriy, yuklanmoqda } = useKompaniya();
  if (yuklanmoqda) return <p>Kompaniya yuklanmoqda…</p>;
  if (!joriy?.id) return <p>Kompaniyani tanlang.</p>;
  return <Sessiya key={joriy.id} companyId={joriy.id} />;
}
