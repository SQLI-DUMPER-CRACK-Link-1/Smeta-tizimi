/**
 * Sahna3DXavfsiz.tsx — BEZAK FON UCHUN XAVFSIZLIK QOBIG'I
 * ═══════════════════════════════════════════════════════════════════
 *
 * MUAMMO (2026-08-17 da topildi). Foydalanuvchi 10 sahifadan 8 tasida
 * qora ekranda «Sahifada xatolik: Cannot read properties of null
 * (reading 'alpha')» ko'rdi.
 *
 * ILDIZ: `three.module.js` da
 *        `_alpha = context.getContextAttributes().alpha;`
 * WebGL spetsifikatsiyasiga ko'ra `getContextAttributes()` kontekst
 * YO'QOLGANDA `null` qaytaradi. `null.alpha` → yiqilish.
 *
 * NEGA KONTEKST YO'QOLADI: brauzerda bir vaqtda yashashi mumkin bo'lgan
 * WebGL kontekstlari soni cheklangan (Chrome'da ~16). Bu tizimda esa
 * HAR SAHIFADA IKKI canvas ochilardi:
 *     1) AdminShell — qobiq foni
 *     2) AuroraBackground — sahifa foni (o'sha `Sahna3D` ning nusxasi)
 * Sahifalar orasida yurganda ular to'planib, brauzer eng eskilarini
 * majburan yo'q qiladi. Keyingi mount'da three.js yo'qolgan kontekstni
 * o'qib yiqiladi — va React butun sahifani xato ekraniga almashtiradi.
 * Shuning uchun xato «bir sahifada» emas, «bir necha sahifa aylangandan
 * keyin deyarli hammasida» ko'rinardi.
 *
 * IKKI QATLAMLI YECHIM:
 *   1) Takroriy canvas OLIB TASHLANDI (AuroraBackground endi o'z
 *      sahnasini yaratmaydi — qobiqdagi bittasi hammaga yetadi).
 *   2) Shu qobiq: BEZAK FON HECH QACHON ISH SAHIFASINI YIQITMASLIGI
 *      kerak. WebGL yiqilsa yoki kontekst yo'qolsa — jim ravishda oddiy
 *      gradient fonga o'tadi, foydalanuvchi ishini davom ettiradi.
 *
 * FALSAFA: chiroylik — ixtiyoriy, ish — majburiy.
 */
import { Component, type ReactNode, lazy, Suspense, useEffect, useState } from 'react';

const Sahna3D = lazy(() => import('./Sahna3D'));

/** Bezak o'rniga qo'yiladigan arzon fon — WebGL'siz, GPU'siz. */
function ZaxiraFon() {
  return (
    <div
      className="absolute inset-0"
      style={{
        background:
          'radial-gradient(1200px circle at 20% 10%, rgba(14,165,233,0.10), transparent 45%),' +
          'radial-gradient(900px circle at 85% 80%, rgba(139,92,246,0.08), transparent 50%),' +
          '#020617',
      }}
    />
  );
}

class WebglQalqon extends Component<{ children: ReactNode }, { yiqildi: boolean }> {
  state = { yiqildi: false };

  static getDerivedStateFromError() {
    return { yiqildi: true };
  }

  componentDidCatch(xato: unknown) {
    /* Jim yutmaymiz — konsolga yozamiz, lekin sahifani buzmaymiz. */
    console.warn('[Sahna3D] bezak fon o\'chirildi (WebGL xatosi):', xato);
  }

  render() {
    if (this.state.yiqildi) return <ZaxiraFon />;
    return this.props.children;
  }
}

export default function Sahna3DXavfsiz() {
  const [webglBor, setWebglBor] = useState<boolean | null>(null);

  useEffect(() => {
    /* Mount'dan OLDIN tekshiramiz: kontekst umuman berilyaptimi?
       Bu three.js ni yiqiladigan holatga qo'ymaslikning eng arzon yo'li.
       Sinov kontekstini darhol bo'shatamiz (limitni yemasin). */
    let bor = false;
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      /* `getContextAttributes()` null bo'lsa — kontekst allaqachon nosoz */
      bor = !!gl && !!(gl as WebGLRenderingContext).getContextAttributes();
      const yoq = gl && (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context');
      if (yoq) yoq.loseContext();
    } catch {
      bor = false;
    }
    setWebglBor(bor);
  }, []);

  /* Tekshiruv tugamaguncha arzon fon — hech narsa "sakramaydi" */
  if (webglBor !== true) return <ZaxiraFon />;

  return (
    <WebglQalqon>
      <Suspense fallback={<ZaxiraFon />}>
        <Sahna3D />
      </Suspense>
    </WebglQalqon>
  );
}
