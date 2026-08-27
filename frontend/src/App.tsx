import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from './umumiy/ui/Toast';
import SahifaTopilmadi from './umumiy/ui/SahifaTopilmadi';
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
import FaylBoglash from './admin/sahifalar/FaylBoglash';
import Hujjatlar from './admin/sahifalar/Hujjatlar';
import ShaxsiySmeta from './admin/sahifalar/ShaxsiySmeta';
import SupabaseSozlama from './admin/sahifalar/SupabaseSozlama';
import TezlikSinovi from './admin/sahifalar/TezlikSinovi';
/* TIZIM_02 — Supabase sinov muhiti. Tizim_01 ga TEGMAYDI. */
const TestShell     = lazy(() => import('./test02/TestShell'));
const TestKorzinka  = lazy(() => import('./test02/TestKorzinka'));
const TestXarita    = lazy(() => import('./test02/TestXarita'));
const TestKontragent = lazy(() => import('./test02/TestKontragent'));
const TestObyektlar = lazy(() => import('./test02/TestObyektlar'));
const TestSmetaBirlashgan = lazy(() => import('./test02/TestSmetaBirlashgan'));
const TestNarxlar   = lazy(() => import('./test02/TestNarxlar'));
const TestF2Import  = lazy(() => import('./test02/TestF2Import'));
const TestF2        = lazy(() => import('./test02/TestF2'));
const TestSklad     = lazy(() => import('./test02/TestSklad'));
const TestBirja     = lazy(() => import('./test02/TestBirja'));
const TestInvite    = lazy(() => import('./test02/TestInvite'));
const TestTolov     = lazy(() => import('./test02/TestTolov'));
const TestFaktura   = lazy(() => import('./test02/TestFaktura'));
const TestHujjat    = lazy(() => import('./test02/TestHujjat'));
const TestHisobot   = lazy(() => import('./test02/TestHisobot'));
const TestErp       = lazy(() => import('./test02/TestErp'));
const TestSozlama   = lazy(() => import('./test02/TestSozlama'));
const TestShartnoma = lazy(() => import('./test02/TestShartnoma'));
const TestTizim     = lazy(() => import('./test02/TestTizim'));
const TestAosr      = lazy(() => import('./test02/TestAosr'));
const TestGrafik    = lazy(() => import('./test02/TestGrafik'));
const TestSpravochnik = lazy(() => import('./test02/TestSpravochnik'));
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
          {/* ⚡ 2026-08-27 (Claude, foydalanuvchi ko'rsatmasi bilan):
              TIZIM ALMASHUVI — Tizim_02 endi ASOSIY sahna. Avval bu yerda
              `/admin/obyektlar` (Tizim_01) turardi; endi saytga kirganda
              to'g'ridan-to'g'ri Tizim_02 ochiladi. Tizim_01 ning o'zi
              O'CHIRILMAGAN — barcha marshrutlari joyida, faqat AdminShell
              sidebar'ida "Eski Tizim (Arxiv)" degan yopiq bo'lim ostiga
              yig'ildi (pastga qara). */}
          <Route index element={<Navigate to="/admin/test" replace />} />
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
          {/* ⚡ 2026-08-16: eski GAS paneldagi «Файл боғлаш» tabi */}
          <Route path="fayl-boglash" element={<FaylBoglash />} />
          <Route path="hujjatlar" element={<Hujjatlar />} />
          <Route path="shaxsiy-smeta" element={<ShaxsiySmeta />} />
          <Route path="supabase" element={<SupabaseSozlama />} />
          <Route path="tezlik" element={<TezlikSinovi />} />

          {/* ===== TIZIM_02 (SINOV) — alohida bo’lim =====
              Ma’lumot Supabase’dan o’qiladi. Tizim_01 ning bironta
              marshruti/sahifasi o’zgartirilmagan. */}
          <Route path="test" element={<TestShell />}>
            <Route index element={<Navigate to="/admin/test/obyektlar" replace />} />
            <Route path="korzinka" element={<TestKorzinka />} />
            <Route path="xarita" element={<TestXarita />} />
            <Route path="kontragent" element={<TestKontragent />} />
            <Route path="obyektlar" element={<TestObyektlar />} />
            <Route path="import" element={<TestSmetaBirlashgan />} />
            <Route path="grafik" element={<TestGrafik />} />
            <Route path="spravochnik" element={<TestSpravochnik />} />
            <Route path="narxlar" element={<TestNarxlar />} />
            {/* ⚠️ f2/f2-import endi menyuda YO'Q ("import" ichida
                sub-tab sifatida) — lekin marshrutlar qoladi, Mind Map
                va boshqa joylardan chuqur havolalar buzilmasin. */}
            <Route path="f2" element={<TestF2 />} />
            <Route path="f2-import" element={<TestF2Import />} />
            <Route path="sklad" element={<TestSklad />} />
            <Route path="birja" element={<TestBirja />} />
            <Route path="invite" element={<TestInvite />} />
            <Route path="tolov" element={<TestTolov />} />
            <Route path="faktura" element={<TestFaktura />} />
            <Route path="hujjat" element={<TestHujjat />} />
            <Route path="hisobot" element={<TestHisobot />} />
            <Route path="erp" element={<TestErp />} />
            <Route path="sozlama" element={<TestSozlama />} />
            <Route path="shartnomalar" element={<TestShartnoma />} />
            <Route path="tizim" element={<TestTizim />} />
            <Route path="aosr" element={<TestAosr />} />
          </Route>
          {/* ERP routes for Admin */}
          <Route path="kadrlar" element={<ErpKadrlar />} />
          <Route path="texnika" element={<ErpTexnika />} />
          <Route path="taminot" element={<ErpTaminot />} />
          <Route path="sifat" element={<ErpSifat />} />

          {/* WARN 2026-08-17 — ESKI MANZILLAR UCHUN KO’PRIK.
              Menyudagi `shartnoma` → `shartnomalar` xatosi tuzatilgach ham
              muammo qaytdi, chunki eski manzil FOYDALANUVCHIDA qolgan
              bo’lishi mumkin: xatcho’p, brauzer tarixi, avtoto’ldirish,
              yorliq, boshqaga yuborilgan havola. Ular hammasi eski yo’lga
              boradi. Bitta havolani tuzatish YETMAYDI — eski manzil ham
              ishlashi kerak. */}
          <Route path="shartnoma" element={<Navigate to="/admin/shartnomalar" replace />} />
          <Route path="kalkulyator" element={<Navigate to="/admin/shaxsiy-smeta" replace />} />

          {/* WARN 2026-08-17 — ENG MUHIMI: noma’lum `/admin/...` manzil endi
              QOBIQ ICHIDA ochiladi. Avval u pastdagi `path="*"` ga tushib,
              foydalanuvchini KIRISH SAHIFASIGA otib yuborardi — aynan
              "шартномалар табига кирсам кириш панелига қайтариб юборайапди"
              shikoyatining ildizi shu. Adashgan manzil chiqarib yuborish
              uchun sabab EMAS. */}
          <Route path="*" element={<SahifaTopilmadi />} />
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



