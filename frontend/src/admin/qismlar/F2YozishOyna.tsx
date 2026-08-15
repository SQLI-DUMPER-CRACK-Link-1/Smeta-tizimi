/**
 * F2YozishOyna.tsx — YOZISH JARAYONI VA YAKUNIY HISOBOT
 *
 * Foydalanuvchi: «avvalgi tizimimizda alohida oynaga o'tilib har bir qadam
 * aytib turar edi nima bo'layapdi nima yozayapdi, oxirida "tugadi" derdi va
 * bu tugaganidan keyin qanchasi kiritildi qanchasi yo'q aniq bo'lar edi».
 *
 * MUHIM — HALOLLIK: yozish GAS tarafida BITTA chaqiruvda bajariladi, ya'ni
 * oraliq qadamlar haqiqatda brauzerga kelmaydi. Shuning uchun bu oyna
 * SOXTA qadam animatsiyasi ko'rsatmaydi («varaq 2/4 yozilmoqda…» deb
 * o'ylab topmaydi). U ikki holatni ko'rsatadi:
 *   1) ISHLAMOQDA — nima yuborilgani (necha qator, necha smeta) + kutish
 *   2) TUGADI      — serverdan kelgan HAQIQIY hisobot, smeta kesimida
 * Oxirida eng muhim raqam: hujjat jami ↔ yozilgan jami ↔ FARQ.
 */
import { CheckCircle2, XCircle, Loader2, AlertTriangle, X } from 'lucide-react';

const fmt = (n: number) =>
  (Number(n) || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export type YozishNatija = {
  ok: boolean;
  smetalar?: number;
  yozilgan?: number;
  radEtilgan?: number;
  radRoyxat?: unknown[];
  yozilganSumma?: number;
  hujjatJami?: number | null;
  farq?: number | null;
  tafsilot?: Array<{ smeta: string; varaq: string; natija: { ok?: boolean; mos?: { yozilgan?: number }; xabar?: string } }>;
  reestr?: { ok: boolean; f2Id?: string; holat?: string; xabar?: string } | null;
  xabar?: string;
};

export default function F2YozishOyna({
  holat, oyNom, yuborilgan, natija, xato, onYopish,
}: {
  holat: 'ishlamoqda' | 'tugadi' | 'xato';
  oyNom: string;
  yuborilgan: { qatorlar: number; dopps: number; hujjatJami: number | null };
  natija: YozishNatija | null;
  xato?: string;
  onYopish: () => void;
}) {
  const farq = natija?.farq;
  const farqBor = farq !== null && farq !== undefined && Math.abs(farq) > 0.01;

  return (
    <div className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] border border-border rounded-xl w-full max-w-2xl
                      max-h-[85vh] flex flex-col shadow-2xl">

        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            {holat === 'ishlamoqda' && <Loader2 size={18} className="text-accent animate-spin" />}
            {holat === 'tugadi' && <CheckCircle2 size={18} className="text-emerald-400" />}
            {holat === 'xato' && <XCircle size={18} className="text-red-400" />}
            <h3 className="font-medium text-text">
              {holat === 'ishlamoqda' ? `«${oyNom}» smetaga yozilmoqda…`
                : holat === 'tugadi' ? `«${oyNom}» — tugadi` : `«${oyNom}» — xato`}
            </h3>
          </div>
          {holat !== 'ishlamoqda' && (
            <button onClick={onYopish} className="p-1.5 rounded hover:bg-white/10 text-text-mute">
              <X size={18} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3">

          {/* Nima yuborildi */}
          <div className="p-2.5 rounded bg-white/5 border border-white/10 text-[12px] space-y-1">
            <div className="font-medium text-text mb-1">Yuborildi</div>
            <div className="flex justify-between">
              <span className="text-text-mute">Bog'langan qatorlar:</span>
              <span className="text-text">{yuborilgan.qatorlar} ta</span>
            </div>
            {yuborilgan.dopps > 0 && (
              <div className="flex justify-between">
                <span className="text-text-mute">Qo'shimcha (yangi qator):</span>
                <span className="text-text">{yuborilgan.dopps} ta</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-text-mute">Hujjat jami:</span>
              <span className="text-text">
                {yuborilgan.hujjatJami === null ? 'noma\'lum' : `${fmt(yuborilgan.hujjatJami)} so'm`}
              </span>
            </div>
          </div>

          {holat === 'ishlamoqda' && (
            <p className="text-[12px] text-text-mute text-center py-4 leading-relaxed">
              Server smetalarni birma-bir yozmoqda. Katta F2 uchun bu bir necha
              soniya davom etadi.<br />
              <span className="opacity-70">Sahifani yopmang — natija shu yerda chiqadi.</span>
            </p>
          )}

          {holat === 'xato' && (
            <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30 text-[12px] text-red-300">
              {xato || natija?.xabar || 'Noma\'lum xato'}
            </div>
          )}

          {holat === 'tugadi' && natija && (
            <>
              {/* Yakuniy solishtiruv — eng muhim blok */}
              <div className={`p-2.5 rounded border text-[12px] space-y-1 ${
                farqBor ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-emerald-500/10 border-emerald-500/30'}`}>
                <div className="font-medium text-text mb-1">Natija</div>
                <div className="flex justify-between">
                  <span className="text-text-mute">Yozilgan qatorlar:</span>
                  <span className="text-text font-medium">{natija.yozilgan ?? 0} ta</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-mute">Smetalar:</span>
                  <span className="text-text">{natija.smetalar ?? 0} ta</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-mute">Smetaga tushgan summa:</span>
                  <span className="text-text">{fmt(natija.yozilganSumma ?? 0)} so'm</span>
                </div>
                {natija.hujjatJami !== null && natija.hujjatJami !== undefined && (
                  <div className={`flex justify-between border-t pt-1 mt-1 font-medium ${
                    farqBor ? 'border-amber-500/30' : 'border-emerald-500/30'}`}>
                    <span className="text-text-mute">FARQ:</span>
                    <span className={farqBor ? 'text-amber-300' : 'text-emerald-400'}>
                      {fmt(farq ?? 0)} so'm
                    </span>
                  </div>
                )}
                {natija.hujjatJami === null && (
                  <p className="text-[10px] text-text-mute pt-1 leading-snug">
                    Hujjat jami uzatilmagani uchun farq hisoblanmadi.
                  </p>
                )}
              </div>

              {farqBor && (
                <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/30
                                text-[11px] text-amber-200 flex gap-2">
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>
                    Hujjat jami bilan yozilgan summa mos kelmadi. «Qatorlar» tugmasi
                    orqali qaysi qatorda farq borligini ko'ring — u yerda har bir
                    qator joyida tahrirlanadi.
                  </span>
                </div>
              )}

              {/* Smeta kesimi */}
              {!!natija.tafsilot?.length && (
                <div className="rounded border border-white/10 overflow-hidden">
                  <div className="px-2.5 py-1.5 bg-white/5 text-[11px] font-medium text-text">
                    Smetalar kesimi
                  </div>
                  <table className="w-full text-[11px]">
                    <tbody>
                      {natija.tafsilot.map((t, i) => (
                        <tr key={i} className="border-t border-white/5">
                          <td className="px-2.5 py-1.5 text-text-mute">
                            {t.varaq || t.smeta}
                          </td>
                          <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                            {t.natija?.mos?.yozilgan != null ? (
                              <span className="text-emerald-400">{t.natija.mos.yozilgan} qator ✓</span>
                            ) : (
                              <span className="text-amber-300">{t.natija?.xabar || '—'}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {natija.reestr?.ok && (
                <p className="text-[10px] text-text-mute">
                  Reestrga yozildi · holat: <span className="text-text">{natija.reestr.holat}</span>
                </p>
              )}
            </>
          )}
        </div>

        {holat !== 'ishlamoqda' && (
          <div className="px-4 py-3 border-t border-border flex justify-end">
            <button onClick={onYopish}
              className="px-4 py-1.5 rounded-lg bg-accent text-white text-[12px] font-medium
                         hover:bg-accent/90 transition-colors">
              Yopish
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
