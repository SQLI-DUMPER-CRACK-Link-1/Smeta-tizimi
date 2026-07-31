import { useState } from 'react';
import { motion } from 'framer-motion';
import { Truck, Search, Filter, Wrench, Fuel, MapPin, CheckCircle, Clock, Plus } from 'lucide-react';
import { AuroraBackground, GlassCard } from '../../boss/sahifalar/Umumiy';
import { FmtN } from '../../lib/format';
import { useTexnikaData, useTexnikaQosh, useTexnikaTarixQosh } from '../../api/hooks';
import { Skelet } from '../../umumiy/ui/Sahifa';
import { ErpQoshModal } from '../ErpQoshModal';
import { toast } from '../../umumiy/ui/Toast';

export default function ErpTexnika() {
  const { data, isLoading } = useTexnikaData();
  const [qidiruv, setQidiruv] = useState('');
  const [filtir, setFiltir] = useState('barchasi');
  const [qoshOchiq, setQoshOchiq] = useState(false);
  const [tarixOchiq, setTarixOchiq] = useState(false);
  const [tanlanganTexnika, setTanlanganTexnika] = useState('');
  const texnikaQosh = useTexnikaQosh();
  const tarixQosh = useTexnikaTarixQosh();

  if (isLoading || !data) {
    return (
      <AuroraBackground>
        <div className="p-8"><Skelet qatorlar={5} /></div>
      </AuroraBackground>
    );
  }

  const filtrlanganTexnikalar = data.texnikalar.filter((t: any) => {
    const mosKeladi = t.nom.toLowerCase().includes(qidiruv.toLowerCase()) || 
                      t.davlatRaqami.toLowerCase().includes(qidiruv.toLowerCase());
    
    if (filtir === 'ishlayapti') return mosKeladi && t.holat === 'Ishlayapti';
    if (filtir === 'remontda') return mosKeladi && t.holat === 'Remontda';
    if (filtir === 'kutishda') return mosKeladi && t.holat === 'Kutishda';
    return mosKeladi;
  });

  const holatRangi = (holat: string) => {
    switch (holat) {
      case 'Ishlayapti': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Remontda': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'Kutishda': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const holatIkona = (holat: string) => {
    switch (holat) {
      case 'Ishlayapti': return <CheckCircle size={14} />;
      case 'Remontda': return <Wrench size={14} />;
      case 'Kutishda': return <Clock size={14} />;
      default: return null;
    }
  };

  return (
    <AuroraBackground>
      <div className="max-w-[1600px] mx-auto p-6 flex flex-col h-full overflow-hidden relative z-10">
        
        <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-300 tracking-tight flex items-center gap-3">
              <Truck className="text-purple-400" size={32} />
              Texnika va Yoqilg'i (GSM)
            </h1>
            <p className="text-slate-400 mt-2 text-sm">Maxsus texnikalar, ularning holati, yoqilg'i sarfi va motochaslari</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTarixOchiq(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white font-medium hover:bg-white/15 transition-colors"
            >
              <Fuel size={18} /> Zapravka / Smena
            </button>
            <button
              onClick={() => setQoshOchiq(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500 text-white font-medium hover:bg-purple-600 transition-colors shadow-lg"
            >
              <Plus size={18} /> Texnika qo'shish
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <GlassCard className="p-5 flex items-center gap-4 hover:bg-white/5 transition-colors border-purple-500/20">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400">
              <Truck size={24} />
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">Jami Texnika</div>
              <div className="text-2xl font-bold font-mono text-white">{data.jamiTexnika} ta</div>
            </div>
          </GlassCard>
          
          <GlassCard className="p-5 flex items-center gap-4 hover:bg-white/5 transition-colors border-emerald-500/20">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <CheckCircle size={24} />
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">Faol (Obyektda)</div>
              <div className="text-2xl font-bold font-mono text-white">{data.faolTexnika} ta</div>
            </div>
          </GlassCard>

          <GlassCard className="p-5 flex items-center gap-4 hover:bg-white/5 transition-colors border-rose-500/20">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-400">
              <Wrench size={24} />
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">Remontda</div>
              <div className="text-2xl font-bold font-mono text-white">{data.remontda} ta</div>
            </div>
          </GlassCard>

          <GlassCard className="p-5 flex items-center gap-4 hover:bg-white/5 transition-colors border-orange-500/20">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-400">
              <Fuel size={24} />
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">Oylik Yoqilg'i Sarfi</div>
              <div className="text-2xl font-bold font-mono text-white"><FmtN val={data.oylikYoqilgi} /> L</div>
            </div>
          </GlassCard>
        </div>

        <div className="flex-1 bg-[#0B0E14]/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-4 bg-white/5">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Texnika nomi yoki nomerini izlash..."
                value={qidiruv}
                onChange={e => setQidiruv(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50 transition-colors"
              />
            </div>
            
            <div className="flex items-center gap-2 bg-black/40 p-1 rounded-xl border border-white/10">
              <Filter size={16} className="text-slate-400 ml-2 mr-1" />
              {[
                { id: 'barchasi', nom: 'Barchasi' },
                { id: 'ishlayapti', nom: 'Ishlayapti' },
                { id: 'remontda', nom: 'Remontda' },
                { id: 'kutishda', nom: 'Kutishda' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFiltir(f.id)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filtir === f.id ? 'bg-purple-500 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                  {f.nom}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-auto scrollbar-thin">
            <table className="w-full text-left border-collapse">
              <thead className="bg-black/60 sticky top-0 z-20 backdrop-blur-md">
                <tr>
                  <th className="py-4 px-6 text-xs text-slate-400 font-bold uppercase tracking-wider">Texnika va Turi</th>
                  <th className="py-4 px-6 text-xs text-slate-400 font-bold uppercase tracking-wider">Davlat Raqami</th>
                  <th className="py-4 px-6 text-xs text-slate-400 font-bold uppercase tracking-wider">Lokatsiya va Haydovchi</th>
                  <th className="py-4 px-6 text-xs text-slate-400 font-bold uppercase tracking-wider text-center">GSM (Yoqilg'i)</th>
                  <th className="py-4 px-6 text-xs text-slate-400 font-bold uppercase tracking-wider text-center">Holati</th>
                  <th className="py-4 px-6 text-xs text-slate-400 font-bold uppercase tracking-wider text-center">Harakatlar</th>
                </tr>
              </thead>
              <tbody>
                {filtrlanganTexnikalar.map((t: any, idx: number) => (
                  <motion.tr 
                    key={t.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group"
                  >
                    <td className="py-4 px-6">
                      <div className="font-semibold text-white/90 text-sm">{t.nom}</div>
                      <div className="text-xs text-purple-400 mt-1">{t.turi}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="inline-block px-3 py-1 bg-white/10 rounded text-xs font-mono font-bold tracking-widest text-slate-200 border border-white/20">
                        {t.davlatRaqami}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm text-slate-300 flex items-center gap-1.5">
                        <MapPin size={14} className="text-slate-500" />
                        {t.obyekt}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 pl-5">{t.haydovchi}</div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="flex items-center gap-1 text-sm font-mono font-bold text-orange-400">
                          <Fuel size={14} />
                          {t.yoqilgiQoldiq} L
                        </div>
                        <div className="w-16 h-1.5 bg-black/50 rounded-full overflow-hidden shadow-inner">
                           <div className="h-full bg-orange-400" style={{ width: `${Math.min((t.yoqilgiQoldiq / 300) * 100, 100)}%` }}></div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wider ${holatRangi(t.holat)}`}>
                        {holatIkona(t.holat)}
                        {t.holat}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center space-x-2">
                      <button
                        onClick={() => { setTanlanganTexnika(t.id); setTarixOchiq(true); }}
                        className="text-xs bg-white/5 hover:bg-purple-500/20 hover:text-purple-400 text-slate-300 px-3 py-1.5 rounded border border-white/10 transition-colors"
                      >
                        Zapravka
                      </button>
                      <button
                        onClick={() => { setTanlanganTexnika(t.id); setTarixOchiq(true); }}
                        className="text-xs bg-white/5 hover:bg-emerald-500/20 hover:text-emerald-400 text-slate-300 px-3 py-1.5 rounded border border-white/10 transition-colors"
                      >
                        Motochas
                      </button>
                    </td>
                  </motion.tr>
                ))}
                
                {filtrlanganTexnikalar.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      {data.texnikalar.length === 0
                        ? "Hali birorta texnika kiritilmagan — «Texnika qo'shish» tugmasini bosing."
                        : 'Qidiruvga mos texnika topilmadi.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>

      <ErpQoshModal
        isOpen={qoshOchiq}
        title="Yangi texnika qo'shish"
        isSaving={texnikaQosh.isPending}
        onClose={() => setQoshOchiq(false)}
        fields={[
          { key: 'nom', label: 'Nomi', type: 'text', required: true, placeholder: 'Hyundai Ekskavator' },
          { key: 'davlatRaqami', label: 'Davlat raqami', type: 'text', placeholder: '01 A 123 AA' },
          { key: 'turi', label: 'Turi', type: 'select', options: ['Ekskavator', 'Kran', 'Samosval', 'Buldozer', 'Boshqa'] },
          { key: 'holat', label: 'Holati', type: 'select', options: ['Ishlayapti', 'Remontda', 'Kutishda', 'Ijara'] },
          { key: 'obyekt', label: 'Obyekt', type: 'text' },
          { key: 'haydovchi', label: 'Haydovchi', type: 'text' },
          { key: 'soatlikNorma', label: 'Motochasiga yoqilg\'i normasi (litr)', type: 'number', placeholder: '15' },
          { key: 'oldingiQoldiq', label: 'Boshlang\'ich yoqilg\'i qoldig\'i (litr)', type: 'number', placeholder: '0' },
        ]}
        onSubmit={async (v) => {
          try {
            await texnikaQosh.mutateAsync(v as any);
            toast('Texnika qo\'shildi', 'ok');
            setQoshOchiq(false);
          } catch (e: any) { toast('Xato: ' + e.message, 'danger'); }
        }}
      />

      <ErpQoshModal
        isOpen={tarixOchiq}
        title="Zapravka / Smena yozuvi"
        isSaving={tarixQosh.isPending}
        initial={{ texnikaId: tanlanganTexnika, sana: new Date().toISOString().split('T')[0] }}
        onClose={() => { setTarixOchiq(false); setTanlanganTexnika(''); }}
        fields={[
          { key: 'texnikaId', label: 'Texnika', type: 'select', required: true, options: data.texnikalar.map((t: any) => ({ value: t.id, label: `${t.nom}${t.davlatRaqami ? ' · ' + t.davlatRaqami : ''}` })) },
          { key: 'sana', label: 'Sana', type: 'date', required: true },
          { key: 'kirimLitr', label: 'Quyilgan yoqilg\'i (litr)', type: 'number', placeholder: '0' },
          { key: 'chiqimLitr', label: 'Qo\'lda chiqim (litr)', type: 'number', placeholder: '0' },
          { key: 'motochas', label: 'Motochas (soat)', type: 'number', placeholder: '0' },
          { key: 'izoh', label: 'Izoh', type: 'textarea' },
        ]}
        onSubmit={async (v) => {
          try {
            await tarixQosh.mutateAsync(v as any);
            toast('Yozuv qo\'shildi', 'ok');
            setTarixOchiq(false);
            setTanlanganTexnika('');
          } catch (e: any) { toast('Xato: ' + e.message, 'danger'); }
        }}
      />
    </AuroraBackground>
  );
}
