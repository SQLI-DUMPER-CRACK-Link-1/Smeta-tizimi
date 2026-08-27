import { useState, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';

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

  return (
    <div className="relative w-full h-screen overflow-hidden bg-bg flex items-center justify-center">
      {/* 3D Background */}
      {uch_D && (
        <div className="absolute inset-0 z-0">
          <Suspense fallback={<div className="w-full h-full bg-gradient-to-br from-bg via-surface to-bg opacity-50" />}>
            <Sahna3D />
          </Suspense>
        </div>
      )}

      {/* Toggle Button */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={() => {
            const newVal = !uch_D;
            setUch_D(newVal);
            localStorage.setItem('uchD', newVal ? 'on' : 'off');
          }}
          className="flex items-center gap-2 px-3 py-2 bg-surface-2/80 backdrop-blur border border-glass-border rounded-lg text-text hover:bg-surface-3 transition-colors"
        >
          {uch_D ? <Eye size={16} /> : <EyeOff size={16} />}
          <span className="text-sm font-medium">3D: {uch_D ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      {/* Foreground */}
      <div className="relative z-10 flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <h1 className="text-5xl font-bold text-white tracking-tight mb-2">SMETA GAS</h1>
          <p className="text-text-dim">Qurilish smetasi boshqaruv tizimi</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="bg-surface-2/80 backdrop-blur-xl border border-glass-border p-6 rounded-2xl w-80 shadow-2xl flex flex-col gap-6"
        >
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <input
                type="text"
                placeholder="Логин..."
                value={login}
                onChange={e => setLogin(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent transition-colors"
                autoFocus
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="Парол..."
                value={parol}
                onChange={e => setParol(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            
            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-red-400 text-sm text-center"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading || !login || !parol}
              className="w-full bg-accent hover:bg-accent-hover text-white rounded-lg py-3 font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Текширилмоқда...' : 'Кириш →'}
            </button>
          </form>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border"></div>
            <span className="text-text-dim text-sm">ёки</span>
            <div className="flex-1 h-px bg-border"></div>
          </div>

          <button
            type="button"
            onClick={handleBossLogin}
            disabled={loading}
            className="w-full bg-surface-2 border border-border hover:bg-surface-3 text-text rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
          >
            Раҳбар кириши (паролсиз)
          </button>
        </motion.div>
      </div>
    </div>
  );
}
