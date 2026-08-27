import { useState, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, ShieldCheck, Lock, User, ArrowRight, Building2, FlaskConical } from 'lucide-react';

const Sahna3D = lazy(() => import('./Sahna3D'));

export default function KirishSahifa() {
  const [login, setLogin] = useState('');
  const [parol, setParol] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [uch_D, setUch_D] = useState(() => localStorage.getItem('uchD') !== 'off');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const r = await fetch('/api/kirish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, parol }),
      });
      const data = await r.json();

      if (data.ok) {
        if (['admin', 'superadmin', 'bugalter', 'pto', 'prorab'].includes(data.rol)) {
          navigate('/admin/obyektlar');
        } else if (['boss', 'rahbar'].includes(data.rol)) {
          navigate('/boss');
        }
      } else {
        setError(data.xato || 'Xato yuz berdi');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBossLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const r = await fetch('/api/kirish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isBoss: true }),
      });
      const data = await r.json();
      if (data.ok && data.rol === 'boss') {
        navigate('/boss');
      } else {
        setError('Xato yuz berdi');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSuperadminLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const r = await fetch('/api/kirish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isSuperadmin: true }),
      });
      const data = await r.json();
      if (data.ok && data.rol === 'superadmin') {
        navigate('/admin/test/obyektlar'); // Tizim_02 ga olib kiramiz
      } else {
        setError('Xato yuz berdi');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex w-full h-screen overflow-hidden bg-[#020617] text-white">
      
      {/* LEFT SIDE: Visual & Branding */}
      <div className="relative hidden lg:flex flex-1 items-center justify-center overflow-hidden border-r border-white/10">
        
        {/* 3D Background */}
        {uch_D && (
          <div className="absolute inset-0 z-0">
            <Suspense fallback={<div className="w-full h-full bg-gradient-to-br from-[#020617] to-indigo-950 opacity-50" />}>
              <Sahna3D />
            </Suspense>
          </div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 via-black/40 to-[#020617]/80 z-10 pointer-events-none" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10 z-10 pointer-events-none" />

        <div className="relative z-20 flex flex-col p-12 w-full h-full justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.3)]">
              <Building2 className="text-indigo-400" size={24} />
            </div>
            <span className="text-xl font-bold tracking-widest text-white">SMETA OS<span className="text-indigo-500">.</span></span>
          </div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-xl"
          >
            <h1 className="text-5xl font-extrabold text-white leading-tight mb-6 tracking-tight">
              Qurilishni <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Raqamli Boshqaring</span>
            </h1>
            <p className="text-zinc-400 text-lg leading-relaxed mb-8">
              Barcha loyihalar, smetalar, va pudratchilarni bir joyda nazorat qiling. Kriptografik xavfsizlik va zamonaviy arxitektura.
            </p>
            
            <div className="flex items-center gap-4 text-sm font-medium text-zinc-300">
              <div className="flex items-center gap-2 bg-white/5 rounded-full px-4 py-2 border border-white/10 backdrop-blur-md">
                <ShieldCheck size={16} className="text-emerald-400" />
                Bitcoin-level himoya
              </div>
              <div className="flex items-center gap-2 bg-white/5 rounded-full px-4 py-2 border border-white/10 backdrop-blur-md">
                <FlaskConical size={16} className="text-indigo-400" />
                Tizim_02 Yadro
              </div>
            </div>
          </motion.div>
          
          <div className="text-zinc-500 text-sm font-medium flex justify-between items-center w-full pr-12">
            <span>© 2026 O'zbekiston. Barcha huquqlar himoyalangan.</span>
            
            <button
              onClick={() => {
                const newVal = !uch_D;
                setUch_D(newVal);
                localStorage.setItem('uchD', newVal ? 'on' : 'off');
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 backdrop-blur border border-white/10 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              {uch_D ? <Eye size={14} /> : <EyeOff size={14} />}
              <span>3D Fon: {uch_D ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Login Form */}
      <div className="w-full lg:w-[480px] xl:w-[560px] flex flex-col justify-center items-center p-8 sm:p-12 xl:p-16 bg-[#020617] relative z-20">
        
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <Building2 className="text-indigo-400" size={24} />
            </div>
            <span className="text-xl font-bold tracking-widest text-white">SMETA OS<span className="text-indigo-500">.</span></span>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h2 className="text-2xl font-bold text-white mb-2">Tizimga kirish</h2>
            <p className="text-zinc-400 text-sm mb-8">O'z hisob ma'lumotlaringizni kiriting</p>

            <form onSubmit={handleLogin} className="flex flex-col gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-300">Логин</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                  <input
                    type="text"
                    value={login}
                    onChange={e => setLogin(e.target.value)}
                    className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-zinc-600"
                    placeholder="foydalanuvchi_nomi"
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-300">Парол</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                  <input
                    type="password"
                    value={parol}
                    onChange={e => setParol(e.target.value)}
                    className="w-full bg-[#0a0f1d] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-zinc-600"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-sm">
                      {error}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={loading || !login || !parol}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2 shadow-[0_4px_14px_0_rgba(79,70,229,0.39)]"
              >
                {loading ? 'Текширилмоқда...' : (
                  <>Kirish <ArrowRight size={18} /></>
                )}
              </button>
            </form>

            <div className="flex items-center gap-4 my-8">
              <div className="flex-1 h-px bg-white/10"></div>
              <span className="text-zinc-500 text-xs font-medium uppercase tracking-widest">Tezkor</span>
              <div className="flex-1 h-px bg-white/10"></div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleSuperadminLogin}
                disabled={loading}
                className="w-full bg-indigo-600/10 border border-indigo-500/30 hover:bg-indigo-600/20 text-indigo-400 rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-50 flex justify-center items-center gap-2 group"
              >
                <ShieldCheck size={18} className="group-hover:scale-110 transition-transform" />
                Anvar (Superadmin)
              </button>

              <button
                type="button"
                onClick={handleBossLogin}
                disabled={loading}
                className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-zinc-300 rounded-xl py-3 text-sm font-medium transition-all disabled:opacity-50"
              >
                Раҳбар кириши (Сводка)
              </button>
            </div>

          </motion.div>
        </div>
      </div>
    </div>
  );
}
