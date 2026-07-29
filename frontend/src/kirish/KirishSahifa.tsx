import { useState, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const Sahna3D = lazy(() => import('./Sahna3D'));

export default function KirishSahifa() {
  const [parol, setParol] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const r = await fetch('/api/kirish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parol }),
      });
      const data = await r.json();

      if (data.ok) {
        if (data.rol === 'admin') navigate('/admin/obyektlar');
        else if (data.rol === 'boss') navigate('/boss');
      } else {
        setError(data.xato || 'Xato yuz berdi');
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
      <div className="absolute inset-0 z-0">
        <Suspense fallback={<div className="w-full h-full bg-gradient-to-br from-bg via-surface to-bg opacity-50" />}>
          <Sahna3D />
        </Suspense>
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
          <p className="text-text-dim">Қурилиш сметаси бошқарув тизими</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="bg-surface-2/80 backdrop-blur-xl border border-glass-border p-6 rounded-2xl w-80 shadow-2xl"
        >
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <input
                type="password"
                placeholder="Парол..."
                value={parol}
                onChange={e => setParol(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent transition-colors"
                autoFocus
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
              disabled={loading}
              className="w-full bg-accent hover:bg-accent-hover text-white rounded-lg py-3 font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Текширилмоқда...' : 'Кириш →'}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
