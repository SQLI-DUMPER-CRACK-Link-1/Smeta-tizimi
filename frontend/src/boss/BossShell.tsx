import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LogOut, LayoutDashboard, HardHat, Truck, ShoppingCart, ShieldAlert, Bot, X, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function BossShell() {
  const navigate = useNavigate();
  const [isAiOpen, setIsAiOpen] = useState(false);

  const handleLogout = () => {
    document.cookie = 'sess=; Max-Age=0; path=/';
    navigate('/');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#09090b] text-slate-200 relative">
      {/* Background will be managed inside components or globally, but base dark is needed here */}
      
      {/* LEFT SIDEBAR */}
      <aside className="w-[260px] flex-shrink-0 flex flex-col bg-[#0c0c0f]/95 border-r border-white/10 backdrop-blur-3xl z-40 relative">
        {/* Brand */}
        <div className="h-20 flex items-center gap-3 px-6 border-b border-white/5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)]">
            <ShieldAlert className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight">SMETA GAS</h1>
            <div className="text-[10px] text-accent font-bold tracking-[0.2em] uppercase">Boshqaruv</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-2 p-4 overflow-y-auto scrollbar-thin">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 mb-2">Asosiy Boshqaruv</div>
          
          <NavLink
            to="/boss"
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive 
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-[inset_4px_0_0_#3b82f6]' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`
            }
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="font-semibold text-sm">Umumiy Tahlil</span>
          </NavLink>
          
          <NavLink
            to="/boss/kadrlar"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[inset_4px_0_0_#10b981]' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`
            }
          >
            <HardHat className="w-5 h-5" />
            <span className="font-semibold text-sm">Kadrlar (Tabel)</span>
          </NavLink>
          
          <NavLink
            to="/boss/texnika"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive 
                  ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-[inset_4px_0_0_#a855f7]' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`
            }
          >
            <Truck className="w-5 h-5" />
            <span className="font-semibold text-sm">Texnika & Logistika</span>
          </NavLink>
          
          <NavLink
            to="/boss/taminot"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive 
                  ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 shadow-[inset_4px_0_0_#eab308]' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`
            }
          >
            <ShoppingCart className="w-5 h-5" />
            <span className="font-semibold text-sm">Ta'minot & Sklad</span>
          </NavLink>
          
          <NavLink
            to="/boss/sifat"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive 
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20 shadow-[inset_4px_0_0_#ef4444]' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`
            }
          >
            <ShieldAlert className="w-5 h-5" />
            <span className="font-semibold text-sm">Sifat Nazorati (QA)</span>
          </NavLink>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/5">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-red-500/20 hover:border-red-500/30 border border-transparent transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span className="font-semibold text-sm">Tizimdan Chiqish</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 relative z-0 h-full overflow-hidden bg-transparent">
        <Outlet />
      </main>

      {/* TITAN AI ORCHESTRATOR */}
      {/* FAB */}
      <button 
        onClick={() => setIsAiOpen(true)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-[0_10px_25px_rgba(59,130,246,0.5)] hover:scale-105 hover:shadow-[0_15px_35px_rgba(59,130,246,0.7)] transition-all z-40 group border border-white/20"
      >
        <Bot className="text-white w-8 h-8 group-hover:animate-bounce" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-[#09090b] animate-pulse"></span>
      </button>

      {/* AI Drawer */}
      <AnimatePresence>
        {isAiOpen && (
          <motion.div 
            initial={{ x: '100%' }} 
            animate={{ x: 0 }} 
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 w-[450px] h-full bg-[#09090b]/95 backdrop-blur-3xl border-l border-white/10 shadow-[-20px_0_50px_rgba(0,0,0,0.5)] z-50 flex flex-col"
          >
            <div className="h-20 border-b border-white/10 flex items-center justify-between px-6 shrink-0 bg-blue-500/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                  <Bot className="text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Titan AI</h2>
                  <div className="text-xs text-blue-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Online
                  </div>
                </div>
              </div>
              <button onClick={() => setIsAiOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
              <div className="bg-white/5 border border-white/10 p-4 rounded-2xl rounded-tl-sm w-[85%]">
                <p className="text-sm text-slate-300">Assalomu alaykum, Rahbar! Men tizimdagi barcha ma'lumotlarni tahlil qilib turibman. Obyektlar, xarajatlar yoki xodimlar bo'yicha qanday savolingiz bor?</p>
              </div>
              {/* Fake user message just for UI mockup */}
              <div className="bg-blue-600 p-4 rounded-2xl rounded-tr-sm w-[85%] self-end shadow-lg shadow-blue-500/20">
                <p className="text-sm text-white">Bugungi eng katta xarajat qayerda bo'ldi?</p>
              </div>
              <div className="bg-white/5 border border-white/10 p-4 rounded-2xl rounded-tl-sm w-[85%] flex flex-col gap-2">
                <p className="text-sm text-slate-300">Bugun eng katta xarajat <strong>"Toshkent City - Lot 4"</strong> obyektida qayd etildi.</p>
                <div className="bg-black/30 p-2 rounded-lg border border-white/5 text-xs text-slate-400 font-mono">
                  Sement M400: 45,000,000 so'm<br/>
                  Armatura (14mm): 120,000,000 so'm
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-white/10 bg-black/40">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="AI ga savol bering..." 
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-blue-500/50"
                />
                <button className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-blue-500 hover:bg-blue-600 rounded-lg flex items-center justify-center text-white transition-colors">
                  <Send size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
