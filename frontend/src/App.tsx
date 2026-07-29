import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from './umumiy/ui/Toast';
import KirishSahifa from './kirish/KirishSahifa';

const AdminShell = lazy(() => import('./admin/AdminShell'));
const BossShell = lazy(() => import('./boss/BossShell'));

// Admin pages
import { Obyektlar } from './admin/sahifalar/Obyektlar';
import { Holat } from './admin/sahifalar/Holat';

// Boss pages
const Umumiy = lazy(() => import('./boss/sahifalar/Umumiy'));

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<KirishSahifa />} />
        
        {/* Admin shell and routes */}
        <Route path="/admin" element={
          <Suspense fallback={<div className="h-screen bg-bg flex items-center justify-center text-text-dim">Yuklanmoqda...</div>}>
            <AdminShell />
          </Suspense>
        }>
          <Route index element={<Navigate to="/admin/obyektlar" replace />} />
          <Route path="obyektlar" element={<Obyektlar />} />
          <Route path="holat/:id" element={<Holat />} />
        </Route>

        {/* Boss shell and routes */}
        <Route path="/boss" element={
          <Suspense fallback={<div className="h-screen bg-bg flex items-center justify-center text-text-dim">Yuklanmoqda...</div>}>
            <BossShell />
          </Suspense>
        }>
          <Route index element={<Umumiy />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  );
}
