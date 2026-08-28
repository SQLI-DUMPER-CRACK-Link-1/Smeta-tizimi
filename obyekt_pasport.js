const fs = require('fs');

let code = fs.readFileSync('frontend/src/test02/TestObyektlar.tsx', 'utf8');

// We will inject a completely redesigned Modal into TestObyektlar.tsx

const modalRegex = /\{tahrirObyekt && \([\s\S]*?\}\)/;

const newModal = `
      {tahrirObyekt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-bg border border-border rounded-xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Database className="text-accent" size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{tahrirObyekt.id ? 'Obyekt Pasporti' : 'Yangi Obyekt'}</h3>
                  <p className="text-xs text-text-mute">{tahrirObyekt.nom || 'Yangi nom kiritilmoqda...'}</p>
                </div>
              </div>
              <button onClick={() => setTahrirObyekt(null)} className="p-2 hover:bg-surface-2 rounded-lg transition-colors">
                <X size={20} className="text-text-dim" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-surface-2/20">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Chap tomon: Asosiy ma'lumotlar va Qatnashchilar */}
                <div className="space-y-6">
                  {/* ASOSIY */}
                  <div className="bg-bg border border-border p-5 rounded-xl space-y-4 shadow-sm">
                    <h4 className="font-semibold text-white flex items-center gap-2"><MapPin size={16} className="text-accent"/> Asosiy Ma'lumotlar</h4>
                    <div>
                      <label className="block text-xs font-medium text-text-dim mb-1.5">Obyekt nomi</label>
                      <input
                        type="text"
                        value={tahrirObyekt.nom}
                        onChange={e => setTahrirObyekt({...tahrirObyekt, nom: e.target.value})}
                        className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-white focus:border-accent outline-none transition-colors"
                        placeholder="Masalan: Tashkent City Lot 4"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-dim mb-1.5">Obyekt Turi</label>
                      <select className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-white focus:border-accent outline-none">
                        <option>Turar joy binosi (Jiloy)</option>
                        <option>Noturar joy (Kommersiya)</option>
                        <option>Infratuzilma (Yo'l, ko'prik)</option>
                        <option>Sanoat (Zavod, fabrika)</option>
                      </select>
                    </div>
                  </div>

                  {/* QATNASHCHILAR (MOCK KARKAS) */}
                  <div className="bg-bg border border-border p-5 rounded-xl space-y-4 shadow-sm">
                    <h4 className="font-semibold text-white flex items-center gap-2"><Briefcase size={16} className="text-sky-400"/> Qatnashchilar va Shartnomalar</h4>
                    <p className="text-[11px] text-text-mute leading-tight">Bu yerdagi ma'lumotlar Mindmap (Xarita)da bog'lanish chiziqlari bo'lib chiziladi.</p>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-text-dim mb-1">Buyurtmachi (Zakazchik)</label>
                        <select className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white focus:border-accent outline-none">
                          <option>-- Kontragent tanlang --</option>
                          <option>MChJ "Oltin Bino"</option>
                          <option>Shahar Hokimiyati</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-xs text-text-dim mb-1">Bosh Pudratchi</label>
                        <select className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white focus:border-accent outline-none">
                          <option>-- Kontragent tanlang --</option>
                          <option selected>O'zimizning Kompaniya</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-text-dim mb-1">Asosiy Shartnoma (Moliya)</label>
                        <select className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white focus:border-accent outline-none">
                          <option>-- Shartnomani bog'lash --</option>
                          <option>№ 102/44 (12.5 Mlrd so'm)</option>
                          <option>№ 88-A (Subpudrat)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* O'ng tomon: Xarita Lokatsiyasi */}
                <div className="bg-bg border border-border rounded-xl shadow-sm flex flex-col overflow-hidden h-[500px]">
                  <div className="p-4 border-b border-border flex items-center justify-between bg-surface-2/30">
                    <h4 className="font-semibold text-white flex items-center gap-2"><MapPin size={16} className="text-emerald-400"/> Obyekt Lokatsiyasi</h4>
                    {tahrirObyekt.lat && <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">Belgilangan</span>}
                  </div>
                  <div className="flex-1 relative">
                    <MapContainer 
                      center={tahrirObyekt.lat && tahrirObyekt.lng ? [tahrirObyekt.lat, tahrirObyekt.lng] : [41.311081, 69.240562]} 
                      zoom={tahrirObyekt.lat ? 15 : 12} 
                      style={{ height: '100%', width: '100%', zIndex: 1 }}
                    >
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <LocationPicker 
                        lat={tahrirObyekt.lat} 
                        lng={tahrirObyekt.lng} 
                        onChange={(lat, lng) => setTahrirObyekt({...tahrirObyekt, lat, lng})} 
                      />
                    </MapContainer>
                    <div className="absolute bottom-4 left-4 right-4 z-[400] pointer-events-none text-center">
                      <div className="inline-block bg-black/80 backdrop-blur-md px-4 py-2 rounded-lg border border-white/10 text-xs text-white shadow-xl pointer-events-auto">
                        Xaritani ustiga bosib obyekt joylashuvini belgilang
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="p-4 border-t border-border bg-surface flex justify-end gap-3">
              <button 
                onClick={() => setTahrirObyekt(null)}
                className="px-5 py-2 text-sm font-medium text-text-dim hover:text-white transition-colors"
              >
                Bekor qilish
              </button>
              <button 
                onClick={saqlaObyekt}
                disabled={saqlamoqda}
                className="px-6 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-bold rounded-lg shadow-[0_0_15px_rgba(var(--accent-rgb),0.3)] transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {saqlamoqda ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                Saqlash
              </button>
            </div>
          </div>
        </div>
      )}`;

if (!code.includes('Obyekt Pasporti')) {
  // We need to add lucide-react imports if missing: X, Briefcase
  if (!code.includes('Briefcase')) {
    code = code.replace(/import \{ Database, RefreshCw, AlertTriangle, Trash2, Edit3, MapPin \} from 'lucide-react';/, "import { Database, RefreshCw, AlertTriangle, Trash2, Edit3, MapPin, X, Briefcase, Save } from 'lucide-react';");
  }
  
  // Try replacing the old modal
  code = code.replace(modalRegex, newModal);
}

fs.writeFileSync('frontend/src/test02/TestObyektlar.tsx', code);
console.log('TestObyektlar updated with new Obyekt Pasporti modal');
