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
import { Sozlamalar } from './admin/sahifalar/Sozlamalar';
 import { F2Import } from './admin/sahifalar/F2Import';
import { F2Tayyorlash } from './admin/sahifalar/F2Tayyorlash';
import { Narxlar } from './admin/sahifalar/Narxlar';
import { Ierarxiya } from './admin/sahifalar/Ierarxiya';
import { Fakturalar } from './admin/sahifalar/Fakturalar';
import { Buxgalteriya } from './admin/sahifalar/Buxgalteriya';
import { CommandPalette } from './umumiy/ui/CommandPalette';
import { AiHelper } from './umumiy/ui/AiHelper';

// Boss pages
const Umumiy = lazy(() => import('./boss/sahifalar/Umumiy'));

// ERP pages
const ErpKadrlar = lazy(() => import('./erp/sahifalar/ErpKadrlar'));
const ErpTexnika = lazy(() => import('./erp/sahifalar/ErpTexnika'));
const ErpTaminot = lazy(() => import('./erp/sahifalar/ErpTaminot'));
const ErpSifat = lazy(() => import('./erp/sahifalar/ErpSifat'));

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
          <Route path="f2" element={<F2Import />} />
          <Route path="f2-tayyorlash" element={<F2Tayyorlash />} />
          <Route path="buxgalteriya" element={<Buxgalteriya />} />
          <Route path="shartnomalar" element={<Shartnoma />} />
          <Route path="fakturalar" element={<Fakturalar />} />
          <Route path="sklad" element={<Sklad />} />
          <Route path="narxlar" element={<Narxlar />} />
          <Route path="ierarxiya" element={<Ierarxiya />} />
          <Route path="monitoring" element={<Monitoring />} />
          <Route path="sozlamalar" element={<Sozlamalar />} />
          {/* ERP routes for Admin */}
          <Route path="kadrlar" element={<ErpKadrlar />} />
          <Route path="texnika" element={<ErpTexnika />} />
          <Route path="taminot" element={<ErpTaminot />} />
          <Route path="sifat" element={<ErpSifat />} />
        </Route>

        {/* Boss shell and routes */}
        <Route path="/boss" element={
          <Suspense fallback={<div className="h-screen bg-bg flex items-center justify-center text-text-dim">Yuklanmoqda...</div>}>
            <BossShell />
          </Suspense>
        }>
          <Route index element={<Umumiy />} />
          <Route path="holat/:id" element={<Holat />} />
          {/* ERP routes for Boss */}
          <Route path="kadrlar" element={<ErpKadrlar />} />
          <Route path="texnika" element={<ErpTexnika />} />
          <Route path="taminot" element={<ErpTaminot />} />
          <Route path="sifat" element={<ErpSifat />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  );
}
