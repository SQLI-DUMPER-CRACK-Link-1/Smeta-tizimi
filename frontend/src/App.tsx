import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from './umumiy/ui/Toast';
import KirishSahifa from './kirish/KirishSahifa';

const AdminShell = lazy(() => import('./admin/AdminShell'));
const BossShell = lazy(() => import('./boss/BossShell'));

// Admin pages
import { Obyektlar } from './admin/sahifalar/Obyektlar';
import { Holat } from './admin/sahifalar/Holat';
import { Shartnoma } from './admin/sahifalar/Shartnoma';
import { Sklad } from './admin/sahifalar/Sklad';
import { Monitoring } from './admin/sahifalar/Monitoring';
import { CommandPalette } from './umumiy/ui/CommandPalette';
import { AiHelper } from './umumiy/ui/AiHelper';

// Boss pages
const Umumiy = lazy(() => import('./boss/sahifalar/Umumiy'));

export default function App() {
  return (
    <BrowserRouter>
      <CommandPalette />
      <AiHelper />
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
          <Route path="shartnoma" element={<Shartnoma />} />
          <Route path="sklad" element={<Sklad />} />
          <Route path="monitoring" element={<Monitoring />} />
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
