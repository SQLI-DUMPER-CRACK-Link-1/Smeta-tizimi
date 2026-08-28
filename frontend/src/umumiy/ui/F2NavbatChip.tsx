/**
 * F2NavbatChip.tsx — DOIMIY NAVBAT KO'RSATKICHI
 *
 * Foydalanuvchi (2026-08-16):
 *   «hozir yangi f2 import ni bossam shu bilan bu joriy navbatdagini
 *    ko'ra olmayman nazorat qila olmayman — shuning uchun bu narsani
 *    monitoring tabi ichiga muntazam navbatni ko'rsatib turadigan
 *    qilishing kerak»
 *
 * MUAMMO: yozish ishi SERVERDA fonda bajariladi va soatlab davom
 * etishi mumkin. Lekin uni faqat F2 import sahifasining 3-qadamida
 * ko'rish mumkin edi. «Yangi Ф2 import» bosilsa yoki boshqa sahifaga
 * o'tilsa — jarayon ko'zdan g'oyib bo'lardi. Foydalanuvchi ish
 * tugadimi, qotdimi, xato berdimi — bilolmasdi.
 *
 * YECHIM: bu chip ekranning pastki o'ng burchagida FAOL ish bo'lganda
 * o'z-o'zidan paydo bo'ladi va istalgan sahifada ko'rinib turadi.
 * Ish tugasa yoki xato bersa ham ko'rsatadi (yopilguncha).
 *
 * QOTIB QOLGANDA: 10 daqiqadan beri siljimasa OGOHLANTIRADI va
 * «To'xtatish» tugmasini beradi — avval bu imkoniyat umuman yo'q edi
 * (foydalanuvchi: «1 soatdan beri shu ahvolda qotib turibdi»).
 */
import { useState } from 'react';
import { X, Loader2, CheckCircle2, AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react';
import { useF2JobHolat, useF2JobTozala } from '../../api/hooks';
import { toast } from './Toast';

/** Siljimay turgan ish shu vaqtdan oshsa — qotgan deb ogohlantiramiz */
const QOTDI_MS = 10 * 60 * 1000;

export default function F2NavbatChip() {
  const job = useF2JobHolat(true);
  const tozala = useF2JobTozala();
  const [yigilgan, setYigilgan] = useState(false);
  const [yopilgan, setYopilgan] = useState<string | null>(() => sessionStorage.getItem("f2_chip_yopiq"));

  const j = job.data?.job;
  if (!j || !j.status) return null;

  const kalit = `${j.obyekt || ''}|${j.oyNom || ''}|${j.boshlandi || ''}`;
  if (yopilgan === kalit) return null;

  const ishlayapti = j.status === 'navbat' || j.status === 'ishlayapti';
  const xato = j.status === 'xato';
  const tugadi = j.status === 'tugadi';

  const jami = j.total || 0;
  const bajarildi = j.done || 0;
  const foiz = jami ? Math.min(100, Math.round((bajarildi / jami) * 100)) : (tugadi ? 100 : 0);

  /* Qotib qolganini aniqlash — server `yangilandi` ni har qadamda yangilaydi */
  const jim = j.yangilandi ? Date.now() - Number(j.yangilandi) : 0;
  const qotdi = ishlayapti && jim > QOTDI_MS;

  // F5 (reload) qilganda tugagan yoki xato qotib qolgan eski ishlarni yashiramiz
  if ((tugadi || xato || qotdi) && jim > 60_000) return null;


  const ramka = xato || qotdi ? 'border-danger/50 bg-danger/10'
    : tugadi ? 'border-ok/40 bg-ok/10'
    : 'border-accent/40 bg-[var(--surface-1)]';

  return (
    /* ⚡ 2026-08-16: avval `bottom-4 right-4` edi va AI tugmasining
       USTIGA tushardi (foydalanuvchi skrinshoti). Endi undan yuqorida. */
    <div className={`fixed bottom-24 right-4 z-[60] w-[330px] rounded-xl border shadow-2xl
                     backdrop-blur-md ${ramka}`}>
      {/* Sarlavha — bosilsa yig'iladi/ochiladi */}
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer"
           onClick={() => setYigilgan((p) => !p)}>
        {xato || qotdi ? <AlertTriangle size={16} className="text-danger flex-shrink-0" />
          : tugadi ? <CheckCircle2 size={16} className="text-ok flex-shrink-0" />
          : <Loader2 size={16} className="text-accent flex-shrink-0 animate-spin" />}

        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium text-text truncate">
            {qotdi ? 'Ф2 yozish — QOTGAN'
              : xato ? 'Ф2 yozish — xato'
              : tugadi ? 'Ф2 yozish tugadi'
              : `Ф2 yozilmoqda… ${foiz}%`}
          </p>
          <p className="text-[10px] text-text-mute truncate">
            {j.oyNom || ''}{j.obyekt ? ` · ${j.obyekt}` : ''}
          </p>
        </div>

        {yigilgan ? <ChevronUp size={14} className="text-text-mute" />
                  : <ChevronDown size={14} className="text-text-mute" />}
        <button
          onClick={(e) => { e.stopPropagation(); setYopilgan(kalit); sessionStorage.setItem("f2_chip_yopiq", kalit); }}
          className="text-text-mute hover:text-text p-0.5 rounded hover:bg-white/10"
          title="Yashirish">
          <X size={13} />
        </button>
      </div>

      {/* Progress chizig'i — yig'ilganda ham ko'rinadi */}
      <div className="h-1 bg-[var(--surface-2)] overflow-hidden">
        <div className={`h-full transition-all duration-500 ${
          xato || qotdi ? 'bg-danger' : tugadi ? 'bg-ok' : 'bg-accent'}`}
          style={{ width: `${xato ? 100 : foiz}%` }} />
      </div>

      {!yigilgan && (
        <div className="px-3 py-2 space-y-1.5">
          <p className="text-[11px] text-text-dim tabular-nums">
            {bajarildi} / {jami} qator
            {jim > 60_000 && ishlayapti && (
              <span className="text-text-mute"> · {Math.round(jim / 60000)} daq. jim</span>
            )}
          </p>

          {job.data?.hozir && (
            <p className="text-[11px] text-text leading-snug line-clamp-3">
              {String(job.data.hozir)}
            </p>
          )}

          {/* ⚡ 2026-08-16: TO'XTATISH endi DOIM ko'rinadi.
              Avval faqat «qotgan» deb aniqlangandan keyin (10 daqiqa)
              chiqardi — foydalanuvchi: «san aytgan to'xtatish degan narsa
              yo'q bunda». Qotmagan bo'lsa ham to'xtatish huquqi bo'lishi
              kerak: xato F2 yuborilgan bo'lishi mumkin. */}
          {(ishlayapti || xato) && (
            <div className={`rounded-lg border p-2 ${qotdi
              ? 'border-danger/40 bg-danger/10' : 'border-border bg-white/[.03]'}`}>
              {qotdi && (
                <p className="text-[11px] text-danger leading-snug mb-1.5">
                  {Math.round(jim / 60000)} daqiqadan beri siljimadi. Server ishni
                  tashlab yuborgan bo'lishi mumkin.
                </p>
              )}
              <button
                onClick={() => {
                  if (!window.confirm(
                    'Qotib qolgan yozish ishi to\'xtatiladi va tozalanadi.\n\n' +
                    'Smetaga ALLAQACHON yozilgan qatorlar JOYIDA QOLADI — ' +
                    'ular o\'chmaydi.\n\nDavom etamizmi?')) return;
                  tozala.mutate(undefined, {
                    onSuccess: (r) => toast(r.xabar || 'Tozalandi', 'ok', undefined, 8000),
                    onError: (e: Error) => toast(e.message, 'danger'),
                  });
                }}
                disabled={tozala.isPending}
                className={`w-full px-2 py-1 rounded text-[11px] font-medium
                            transition-colors disabled:opacity-50 ${qotdi
                  ? 'bg-danger/20 hover:bg-danger/30 text-danger'
                  : 'bg-white/5 hover:bg-white/10 text-text-mute hover:text-danger'}`}>
                {tozala.isPending ? 'To\'xtatilmoqda…' : '⏹ To\'xtatish va tozalash'}
              </button>
            </div>
          )}

          {xato && j.xabar && (
            <p className="text-[11px] text-danger leading-snug">{j.xabar}</p>
          )}
          {ishlayapti && !qotdi && (
            <p className="text-[10px] text-text-mute">
              Brauzerni yopsangiz ham davom etadi.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
