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
          <Suspense fallback={<div className=\"h-screen bg-bg flex items-center justify-center text-text-dim\">Yuklanmoqda...</div>}>
            <AdminShell />
          </Suspense>
        }>
          <Route index element={<Navigate to=\"/admin/obyektlar\" replace />} />
          <Route path=\"obyektlar\" element={<Obyektlar />} />
          <Route path=\"holat/:id\" element={<Holat />} />
          <Route path=\"f2\" element={<F2Import />} />
          <Route path=\"f2-tayyorlash\" element={<F2Tayyorlash />} />
          <Route path=\"buxgalteriya\" element={<Buxgalteriya />} />
          <Route path=\"shartnomalar\" element={<Shartnoma />} />
          <Route path=\"fakturalar\" element={<Fakturalar />} />
          <Route path=\"sklad\" element={<Sklad />} />
          <Route path=\"narxlar\" element={<Narxlar />} />
          <Route path=\"ierarxiya\" element={<Ierarxiya />} />
          <Route path=\"monitoring\" element={<Monitoring />} />
          <Route path=\"sozlamalar\" element={<Sozlamalar />} />
          {/* eski GAS paneldagi  */}
          <Route path=\"fayl-boglash\" element={<FaylBoglash />} />
          <Route path=\"hujjatlar\" element={<Hujjatlar />} />
          <Route path=\"shaxsiy-smeta\" element={<ShaxsiySmeta />} />
          <Route path=\"supabase\" element={<SupabaseSozlama />} />
          <Route path=\"tezlik\" element={<TezlikSinovi />} />

          {/* ===== TIZIM_02 (SINOV) ===== */}
          <Route path=\"test\" element={<TestShell />}>
            <Route index element={<Navigate to=\"/admin/test/obyektlar\" replace />} />
            <Route path=\"obyektlar\" element={<TestObyektlar />} />
            <Route path=\"daraxt\" element={<TestDaraxt />} />
            <Route path=\"import\" element={<TestImport />} />
            <Route path=\"narxlar\" element={<TestNarxlar />} />
            <Route path=\"f2\" element={<TestF2 />} />
            <Route path=\"f2-import\" element={<TestF2Import />} />
            <Route path=\"oqish\" element={<TestOqishOlchov />} />
            
            {/* Tizim 02 Qo'shimcha Integratsiyalar */}
            <Route path=\"sklad\" element={ <Suspense fallback={<div>Yuklanmoqda...</div>}><TestSklad /></Suspense> } />
            <Route path=\"birja\" element={ <Suspense fallback={<div>Yuklanmoqda...</div>}><TestBirja /></Suspense> } />
            <Route path=\"invite\" element={ <Suspense fallback={<div>Yuklanmoqda...</div>}><TestInvite /></Suspense> } />
            <Route path=\"tolov\" element={ <Suspense fallback={<div>Yuklanmoqda...</div>}><TestTolov /></Suspense> } />
            <Route path=\"faktura\" element={ <Suspense fallback={<div>Yuklanmoqda...</div>}><TestFaktura /></Suspense> } />
            <Route path=\"hujjat\" element={ <Suspense fallback={<div>Yuklanmoqda...</div>}><TestHujjat /></Suspense> } />
            <Route path=\"hisobot\" element={ <Suspense fallback={<div>Yuklanmoqda...</div>}><TestHisobot /></Suspense> } />
            <Route path=\"erp\" element={ <Suspense fallback={<div>Yuklanmoqda...</div>}><TestErp /></Suspense> } />
            <Route path=\"sozlama\" element={ <Suspense fallback={<div>Yuklanmoqda...</div>}><TestSozlama /></Suspense> } />
            <Route path=\"tizim\" element={ <Suspense fallback={<div>Yuklanmoqda...</div>}><TestTizim /></Suspense> } />
          </Route>
        </Route>

        <Route path=\"/erp\" element={<ErpLayout />} >
          <Route index element={<Navigate to=\"/erp/kadrlar\" replace />} />
          <Route path=\"kadrlar\" element={<ErpKadrlar />} />
          <Route path=\"texnika\" element={<ErpTexnika />} />
          <Route path=\"taminot\" element={<ErpTaminot />} />
          <Route path=\"sifat\" element={<ErpSifat />} />
        </Route>

        {/* Boss panel */}
        <Route path=\"/boss\" element={
          <Suspense fallback={<div className=\"h-screen bg-bg flex items-center justify-center text-text-dim\">Yuklanmoqda...</div>}>
            <BossShell />
          </Suspense>
        }>
          <Route index element={<Navigate to=\"/boss/umumiy\" replace />} />
          <Route path=\"umumiy\" element={<Umumiy />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
