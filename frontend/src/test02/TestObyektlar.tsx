import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, RefreshCw, AlertTriangle, Trash2, Edit3, MapPin, X, Briefcase, Save } from 'lucide-react';
import { Sahifa } from '../umumiy/ui/Sahifa';
import { FmtN } from '../lib/format';
import { sbT2ObyektlarOlKomp, sbObyektOchirish, sbObyektTahrirlash, sbObyektLokatsiyaBelgila, type T2Obyekt } from '../api/supabase';
import { toast } from '../umumiy/ui/Toast';
import { useKompaniya } from './KompaniyaTanlov';

// LEAFLET IMPORTS
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, useMapEvents, Popup } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet default icon paths in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

type Qator = T2Obyekt;

function yosh(iso: string | null | undefined): { matn: string; eski: boolean } {
  if (!iso) return { matn: 'noma\'lum', eski: true };
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return { matn: 'hozirgina', eski: false };
  if (m < 60) return { matn: `${m} daq oldin`, eski: m > 10 };
  const h = Math.floor(m / 60);
  if (h < 24) return { matn: `${h} soat oldin`, eski: true };
  return { matn: `${Math.floor(h / 24)} kun oldin`, eski: true };
}

// ----------------------------------------------------------------------------
// KARTA KLIKSINI TUTUVCHI KOMPONENT
// ----------------------------------------------------------------------------
function LocationMarker({ position, setPosition }: { position: L.LatLng | null, setPosition: (p: L.LatLng) => void }) {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  return position === null ? null : (
    <Marker position={position}>
      <Popup>Tanlangan joylashuv</Popup>
    </Marker>
  );
}

export default function TestObyektlar() {
  const navigate = useNavigate();
  const { joriy } = useKompaniya();
  const kompYuklanmoqda = joriy === undefined;

  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [qatorlar, setQatorlar] = useState<Qator[] | null>(null);
  const [xato, setXato] = useState('');
  const [ms, setMs] = useState(0);

  // Edit State
  const [editObj, setEditObj] = useState<Qator | null>(null);
  const [nomi, setNomi] = useState('');
  const [tur, setTur] = useState('');
  const [position, setPosition] = useState<L.LatLng | null>(null);

  const handleOchirish = async (e: any, o: Qator) => {
    e.stopPropagation();
    if(!confirm(`"${o.nom}" obyektini arxivga (korzinka) o'tkazasizmi?`)) return;
    try {
      setYuklanmoqda(true);
      await sbObyektOchirish(o.id, o.nom);
      toast("Obyekt Korzinkaga o'tkazildi", 'ok');
      yukla();
    } catch(err: any) {
      toast('Xatolik: ' + err.message, 'danger');
      setYuklanmoqda(false);
    }
  };

  const handleTahrir = (e: any, o: Qator) => {
    e.stopPropagation();
    setEditObj(o);
    setNomi(o.nom);
    setTur(o.tur || '');
    if (o.lat && o.lng) {
      setPosition(new L.LatLng(o.lat, o.lng));
    } else {
      setPosition(null);
    }
  };

  const saqlashTahrir = async () => {
    if(!editObj) return;
    try {
      setYuklanmoqda(true);
      
      // Agar nom yoki tur o'zgargan bo'lsa
      if (nomi !== editObj.nom || tur !== (editObj.tur || '')) {
        await sbObyektTahrirlash(editObj.id, nomi, tur);
      }
      
      // Agar lokatsiya o'zgargan bo'lsa
      if (position) {
        await sbObyektLokatsiyaBelgila(editObj.id, position.lat, position.lng, editObj.versiya || 0);
      }

      toast('Obyekt tahrirlandi', 'ok');
      setEditObj(null);
      yukla();
    } catch(err: any) {
      toast('Xatolik: ' + err.message, 'danger');
      setYuklanmoqda(false);
    }
  };

  const yukla = async () => {
    if (kompYuklanmoqda) return;
    if (!joriy?.id) { setQatorlar([]); setMs(0); return; }
    setYuklanmoqda(true); setXato('');
    const r = await sbT2ObyektlarOlKomp(joriy.id);
    setMs('ms' in r ? (r.ms || 0) : 0);
    if (!r.ok) { setXato(r.error || "O'qilmadi"); setQatorlar(null); }
    else setQatorlar((r.qatorlar as Qator[]) || []);
    setYuklanmoqda(false);
  };

  useEffect(() => { yukla(); }, [joriy?.id, kompYuklanmoqda]);

  const jami = useMemo(() => {
    const q = qatorlar || [];
    return {
      soni: q.length,
      jami: q.reduce((a, x) => a + (Number(x.jami) || 0), 0),
      qator: q.reduce((a, x) => a + (Number(x.qator_soni) || 0), 0),
      narxsiz: q.reduce((a, x) => a + (Number(x.narxsiz) || 0), 0),
    };
  }, [qatorlar]);

  return (
    <Sahifa
      sarlavha="Obyektlar (Arxitektura va Lokatsiya)"
      tavsif="Obyektlarni tahrirlash va Xaritadan (Geolokatsiya) joyini belgilash."
      amallar={
        <button onClick={yukla} disabled={yuklanmoqda}
          className="h-9 px-3 inline-flex items-center gap-2 rounded-[10px] karta text-sm
                     text-text hover:border-[var(--accent)]/50 transition-colors
                     disabled:opacity-50">
          <RefreshCw size={15} className={yuklanmoqda ? 'animate-spin' : ''} />
          Yangilash
        </button>
      }
    >
      <div className="space-y-3">
        {editObj && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-surface border border-border p-5 rounded-2xl w-[600px] shadow-2xl flex flex-col max-h-[90vh]">
              <h3 className="font-bold text-lg mb-4 text-text flex items-center gap-2">
                <MapPin className="text-accent"/> Obyekt Joylashuvini Belgilash
              </h3>
              
              <div className="flex gap-3 mb-3">
                <input value={nomi} onChange={e=>setNomi(e.target.value)} className="flex-1 bg-bg border border-border rounded-xl p-2.5 text-sm text-text outline-none focus:border-sky-500" placeholder="Yangi nomi..." />
                <input value={tur} onChange={e=>setTur(e.target.value)} className="w-1/3 bg-bg border border-border rounded-xl p-2.5 text-sm text-text outline-none focus:border-sky-500" placeholder="Turi..." />
              </div>

              <p className="text-[12px] text-text-dim mb-2">Kartadan obyekt joylashgan nuqtani bosing:</p>
              
              <div className="flex-1 min-h-[300px] border border-border rounded-xl overflow-hidden mb-4 relative z-0">
                <MapContainer 
                  center={position || [41.2995, 69.2401]} // Default to Tashkent
                  zoom={12} 
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap contributors'
                  />
                  <LocationMarker position={position} setPosition={setPosition} />
                </MapContainer>
              </div>

              <div className="flex gap-2 justify-end mt-auto">
                <button onClick={() => setEditObj(null)} className="px-5 py-2 rounded-xl text-sm font-medium text-text-dim hover:bg-surface-2 transition-colors">Bekor qilish</button>
                <button onClick={saqlashTahrir} className="px-5 py-2 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent/80 transition-colors shadow-lg shadow-accent/20">Saqlash va Joylash</button>
              </div>
            </div>
          </div>
        )}
        
        <div className="karta p-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px]">
          <span className="inline-flex items-center gap-2 text-text">
            <Database size={14} className="text-accent" />
            <b>{jami.soni}</b> obyekt | <b>{ms}</b> ms
          </span>
          <span className="text-text-dim">Jami: <FmtN val={jami.jami} /></span>
          <span className="text-text-dim">{jami.qator} qator</span>
          {jami.narxsiz > 0 && (
            <span className="text-warn inline-flex items-center gap-1.5">
              <AlertTriangle size={13} />
              {jami.narxsiz} qator NARXLANMAGAN
            </span>
          )}
        </div>

        {xato && (
          <div className="karta p-4 border-danger/40 bg-danger/5">
            <p className="text-[13px] text-danger flex items-center gap-2">
              <AlertTriangle size={15} /> {xato}
            </p>
          </div>
        )}

        {yuklanmoqda && !qatorlar && <div className="skel h-40 rounded-xl" />}

        {qatorlar && !qatorlar.length && !xato && (
          <div className="karta p-6 text-center">
            <p className="text-[13px] text-text-dim">Tizim_02 hali BO'SH.</p>
            <p className="text-[12px] text-text-mute mt-1">Obyekt qo'shish uchun smeta faylini import qiling.</p>
          </div>
        )}

        {!!qatorlar?.length && (
          <div className="karta overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-border text-text-dim bg-surface-2/50">
                    <th className="text-left px-4 py-3 font-medium">Obyekt</th>
                    <th className="text-center px-3 py-3 font-medium">Lokatsiya</th>
                    <th className="text-right px-3 py-3 font-medium">Jami Summa</th>
                    <th className="text-right px-3 py-3 font-medium">Razdel</th>
                    <th className="text-right px-3 py-3 font-medium">Narxsiz</th>
                    <th className="text-left px-3 py-3 font-medium">Yangilandi</th>
                    <th className="w-16" />
                  </tr>
                </thead>
                <tbody>
                  {qatorlar.map((o) => {
                    const y = yosh(o.yangilandi);
                    const hasLocation = o.lat && o.lng;
                    return (
                      <tr key={o.id}
                        className="border-b border-border last:border-0 hover:bg-[var(--surface-2)]/60 transition-colors group">
                        <td className="px-4 py-3 text-text cursor-pointer" onClick={() => navigate('/admin/test/daraxt?obyekt=' + encodeURIComponent(o.nom))}>
                          {o.nom}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {hasLocation ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md text-[10px] font-medium border border-emerald-400/20" title={`${o.lat}, ${o.lng}`}>
                              <MapPin size={12}/> Belgilangan
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-text-mute bg-white/5 px-2 py-1 rounded-md text-[10px]">
                              Xaritada yo'q
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-text font-medium">
                          <FmtN val={Number(o.jami) || 0} />
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-text-dim">
                          {o.razdel ?? 0}
                        </td>
                        <td className={'px-3 py-3 text-right tabular-nums ' + ((o.narxsiz ?? 0) > 0 ? 'text-warn font-medium' : 'text-text-mute')}>
                          {o.narxsiz ?? 0}
                        </td>
                        <td className={`px-3 py-3 ${y.eski ? 'text-warn' : 'text-text-mute'}`}>
                          {y.matn}
                        </td>
                        <td className="px-3 py-3">
                           <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={(e) => handleTahrir(e, o)} className="p-2 hover:bg-sky-500/20 text-sky-400 rounded-lg transition-colors title='Lokatsiya / Tahrir'"><MapPin size={16}/></button>
                             <button onClick={(e) => handleOchirish(e, o)} className="p-2 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors"><Trash2 size={16}/></button>
                           </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Sahifa>
  );
}
