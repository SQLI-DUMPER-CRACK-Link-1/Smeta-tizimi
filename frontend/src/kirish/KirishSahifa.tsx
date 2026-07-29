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
          className="bg-surface-2/80 backdrop-blur-xl border border-glass-border p-6 rounded-2xl w-80 shadow-2xl flex flex-col gap-6"
        >
          {/* Google Login (Asosiy) */}
          <a
            href="/api/auth/google"
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 rounded-lg py-3 font-medium transition-colors shadow-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google орқали кириш
          </a>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border"></div>
            <span className="text-text-dim text-sm">ёки</span>
            <div className="flex-1 h-px bg-border"></div>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <input
                type="password"
                placeholder="Парол (захира)..."
                value={parol}
                onChange={e => setParol(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            
            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-red-400 text-xs text-center"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading || !parol}
              className="w-full bg-surface-2 border border-border hover:bg-surface-3 text-text rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? '...' : 'Кириш'}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
