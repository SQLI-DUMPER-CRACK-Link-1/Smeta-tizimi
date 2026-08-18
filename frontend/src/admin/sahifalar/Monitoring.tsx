import { useMemo, useState } from 'react';
import { useApiLog, useTolaDiagnostika, useKeshHolat, useTriggerlar,
         useObyektDiagnostika, useObyektlar, useKodVersiya } from '../../api/hooks';
import { Stethoscope, Server } from 'lucide-react';
import { toast } from '../../umumiy/ui/Toast';
import { Sahifa, Holatlar, Jadval, Nishon, KpiKarta, type Ustun } from '../../umumiy/ui/Sahifa';
import type { ApiLogYozuv } from '../../api/types';

/** 10 soniyadan sekin chaqiruv — diqqat talab qiladi (14 §9.2). */
const SEKIN_MS = 10_000;

/**
 * API funksiya nomini odam tiliga o'giradi.
 * Foydalanuvchi `apiPapkaSkan` emas, «Obyektlar ro'yxati o'qildi» ni ko'rishi kerak.
 */
const AMAL: Record<string, string> = {
  apiPapkaSkan: "Obyektlar ro'yxati o'qildi",
  apiBossData: 'Umumiy hisobot yig‘ildi',
  apiBossObyekt: 'Obyekt hisoboti o‘qildi',
  apiHolatOl: 'Smeta daraxti o‘qildi',
  apiHolatOlLokalka: 'Lokalka smetasi o‘qildi',
  apiHolatSaqla: 'Smeta o‘zgarishlari saqlandi',
  apiBlQosh: 'Yangi ish qatori qo‘shildi',
  apiRsQosh: 'Yangi resurs qo‘shildi',
  apiOyQosh: 'Yangi oy ustuni yaratildi',
  apiShartnomaOl: 'Shartnomalar o‘qildi',
  apiShartnomaSaqla: 'Shartnoma saqlandi',
  apiShartnomaOchir: 'Shartnoma o‘chirildi',
  apiShartnomaDashboard: 'Shartnoma jamlanmasi',
  apiSkladQoldiq: 'Sklad qoldig‘i hisoblandi',
  apiSkladOl: 'Sklad ro‘yxati o‘qildi',
  apiTolovOl: 'To‘lovlar o‘qildi',
  apiF2FaylOqi: 'Ф2 fayli o‘qildi',
  apiF2AvtoMoslash: 'Ф2 avto-moslashtirish',
  apiF2QollaNavbatga: 'Ф2 yozuvi navbatga qo‘yildi',
  apiF2JobHolat: 'Ф2 yozuv holati so‘raldi',
  apiTitanAi: 'Jarvis AI savoliga javob',
  apiKirishTekshir: 'Tizimga kirish tekshirildi',
  apiWebApiSalom: 'Ulanish tekshiruvi',
  apiWebApiLog: 'Monitoring o‘qildi',
  apiXatoYoz: 'Xato qayd etildi',
  apiLockOl: 'Bandlik tekshirildi',
  apiLockBos: 'Obyekt band qilindi',
  apiLockOch: 'Obyekt bo‘shatildi',
};

function amalNomi(fn: string): string {
  return AMAL[fn] ?? fn.replace(/^api/, '').replace(/([A-Z])/g, ' $1').trim();
}

const HOLAT_NOMI: Record<string, string> = {
  OK: 'Bajarildi',
  XATO: 'Xato',
  AUTH_FAIL: 'Kirish rad etildi',
  RUXSAT_YOQ: 'Ruxsat yo‘q',
};

/**
 * EKG — kardiogramma uslubidagi jarayon chizig'i.
 * X = vaqt (chapda eng eskisi), Y = davomiylik (log shkala — 20 ms va 20 s
 * bitta grafikka sig'ishi uchun). Har nuqta hover'da tafsilot beradi.
 */
function Ekg({ yozuvlar }: { yozuvlar: ApiLogYozuv[] }) {
  const W = 1000, H = 120, P = 8;
  const nuqtalar = [...yozuvlar].reverse();          // chapda eskisi
  const maxMs = Math.max(1000, ...nuqtalar.map((y) => y.ms || 0));
  const lg = (ms: number) => Math.log10(Math.max(1, ms) + 1) / Math.log10(maxMs + 1);

  const dx = nuqtalar.length > 1 ? (W - P * 2) / (nuqtalar.length - 1) : 0;
  const xy = nuqtalar.map((y, i) => {
    const x = P + i * dx;
    const h = lg(y.ms || 0) * (H - P * 2);
    return { x, y: H - P - h, d: y };
  });

  /* Kardiogramma ko'rinishi: har nuqtaga tik ko'tarilib, tik tushadi */
  const yol = xy.map((p, i) => {
    const bazaY = H - P;
    const oldingi = i === 0 ? `M ${P} ${bazaY}` : '';
    return `${oldingi} L ${p.x - dx * 0.25} ${bazaY} L ${p.x} ${p.y} L ${p.x + dx * 0.25} ${bazaY}`;
  }).join(' ');

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[120px]" preserveAspectRatio="none">
        <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="var(--border)" strokeWidth="1" />
        <path d={yol} fill="none" stroke="var(--accent)" strokeWidth="1.5"
              strokeLinejoin="round" opacity="0.75" vectorEffect="non-scaling-stroke" />
        {xy.map((p, i) => {
          const xato = p.d.h !== 'OK';
          const sekin = (p.d.ms || 0) > SEKIN_MS;
          const rang = xato ? 'var(--danger)' : sekin ? 'var(--warn)' : 'var(--ok)';
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={xato || sekin ? 3.5 : 2.5} fill={rang}
                      vectorEffect="non-scaling-stroke" />
              <title>
                {`${amalNomi(p.d.fn)}\n${p.d.ms >= 1000 ? (p.d.ms / 1000).toFixed(1) + ' s' : p.d.ms + ' ms'}\n${HOLAT_NOMI[p.d.h] ?? p.d.h}\n${p.d.t}`}
              </title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function Monitoring() {
  const soragan = useApiLog();
  /* ⚡ 2026-08-16: tizim tashxisi — eski paneldan yetishmayotgan qism */
  const tashxis = useTolaDiagnostika();
  const kesh    = useKeshHolat();
  const trig    = useTriggerlar();
  /* ⚡ 2026-08-17 (audit): obyekt bo'yicha tashxis — ulanmagan edi */
  const obDiag  = useObyektDiagnostika();
  const obyektlar = useObyektlar();
  const [obTashxis, setObTashxis] = useState('');
  /* ⚡ 2026-08-17: deploy versiyasi — probe qurilgan edi, lekin
     foydalanuvchi unga yetib bora olmasdi */
  const ver = useKodVersiya();
  const yozuvlar = soragan.data ?? [];

  const stat = useMemo(() => {
    const n = yozuvlar.length;
    const xato = yozuvlar.filter((y) => y.h !== 'OK').length;
    const sekin = yozuvlar.filter((y) => (y.ms || 0) > SEKIN_MS).length;
    const oqMs = yozuvlar.filter((y) => y.h === 'OK').map((y) => y.ms || 0);
    const ortacha = oqMs.length ? Math.round(oqMs.reduce((a, b) => a + b, 0) / oqMs.length) : 0;
    return { n, xato, sekin, ortacha };
  }, [yozuvlar]);

  const ustunlar: Ustun<ApiLogYozuv>[] = [
    {
      kalit: 't',
      nom: 'Vaqt',
      en: '160px',
      chiz: (y) => {
        const d = new Date(y.t);
        const ok = !isNaN(d.getTime());
        return (
          <span className="text-text-dim tabular-nums">
            {ok ? d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : y.t}
          </span>
        );
      },
    },
    {
      kalit: 'fn',
      nom: 'Nima bo‘ldi',
      chiz: (y) => (
        <div className="min-w-0">
          <div className="text-text truncate">{amalNomi(y.fn)}</div>
          <div className="text-[11px] text-text-mute font-mono truncate">{y.fn}</div>
        </div>
      ),
    },
    {
      kalit: 'h',
      nom: 'Natija',
      en: '150px',
      chiz: (y) =>
        y.h === 'OK' ? <Nishon matn={HOLAT_NOMI.OK} tur="ok" />
        : y.h === 'XATO' ? <Nishon matn={HOLAT_NOMI.XATO} tur="danger" />
        : <Nishon matn={HOLAT_NOMI[y.h] ?? y.h} tur="warn" />,
    },
    {
      kalit: 'ms',
      nom: 'Davomiylik',
      raqam: true,
      en: '130px',
      chiz: (y) => {
        const ms = y.ms || 0;
        const rang = ms > SEKIN_MS ? 'text-warn font-medium' : 'text-text-dim';
        return <span className={rang}>{ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`}</span>;
      },
    },
  ];

  return (
    <Sahifa
      sarlavha="Monitoring"
      tavsif="Tizimda oxirgi 50 ta amal — nima bo'ldi, qancha vaqt oldi, xato bormi"
      yangilangan={soragan.dataUpdatedAt}
      onYangila={() => soragan.refetch()}
      yangilanmoqda={soragan.isFetching}
    >
      {/* ⚡⚡⚡ 2026-08-17 DEPLOY VERSIYASI — «sayt yangi kodni ishlatyaptimi?»
          GAS da 21 ta aktiv deployment bor. `clasp push` muvaffaqiyatli
          chiqsa ham, deployment'lar yangi versiyaga ko'chirilmasa sayt ESKI
          KODNI ishlatadi — buni tashqaridan bilishning yo'li YO'Q edi va
          «tuzatdim, lekin tuzalmadi» holatida vaqt kodni qayta o'qishga
          ketardi. Endi raqam SHU YERDA turadi: xato haqida gapirishdan
          oldin shuni ko'rish kerak. */}
      <div className="karta p-3 mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Server size={15} className="text-accent flex-shrink-0" />
          <div className="min-w-0">
            <span className="text-[12px] text-text">Server kodi versiyasi</span>
            <p className="text-[11px] text-text-mute leading-snug">
              «Tuzatdim, lekin tuzalmadi» holatida avval shu raqamni tekshiring —
              kutilganidan kichik bo'lsa muammo koddа emas, deploy'da.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {ver.isLoading && <span className="text-[12px] text-text-mute">o'qilmoqda…</span>}
          {ver.isError && (
            <span className="text-[12px] text-danger">
              versiya o'qilmadi — server javob bermayapti
            </span>
          )}
          {ver.data && (
            <>
              <span className="text-[18px] font-semibold text-text tabular-nums">
                v{ver.data.versiya}
              </span>
              <span className="text-[11px] text-text-mute tabular-nums">{ver.data.vaqt}</span>
            </>
          )}
          <button
            onClick={() => ver.refetch()}
            disabled={ver.isFetching}
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-border
                       text-[11px] text-text-mute hover:text-text transition-colors disabled:opacity-50">
            {ver.isFetching ? '…' : 'Tekshirish'}
          </button>
        </div>
      </div>

      {/* ⚡⚡⚡ 2026-08-16 TIZIM TASHXISI — eski paneldan yetishmayotgan qism.
          GAS da `apiTolaDiagnostika`, `apiKeshHolat`, `apiTriggerlarRoyxat`
          BOR edi, lekin saytdan chaqirilmasdi. Nimadir buzilganda sababni
          faqat GAS logidan ko'rish mumkin edi. Endi shu yerda. */}
      <div className="karta p-4 mb-4">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div>
            <h3 className="text-[14px] font-semibold text-text flex items-center gap-2">
              <Stethoscope size={16} className="text-accent" /> Tizim tashxisi
            </h3>
            <p className="text-[11px] text-text-mute mt-0.5">
              Sozlamalar, papkalar, kesh va triggerlar joyidami — bir bosishda tekshiradi
            </p>
          </div>
          <button
            onClick={() => tashxis.mutate(undefined, {
              onError: (e: Error) => toast(e.message, 'danger', undefined, 9000),
            })}
            disabled={tashxis.isPending}
            className="px-3 py-1.5 rounded-lg bg-accent/15 text-accent hover:bg-accent/25
                       text-[12px] font-medium transition-colors disabled:opacity-50">
            {tashxis.isPending ? 'Tekshirilmoqda…' : '🩺 Tashxis o‘tkazish'}
          </button>
        </div>

        {tashxis.data != null && <TashxisKorinish malumot={tashxis.data} />}

        {/* ⚡⚡⚡ 2026-08-17 (audit): OBYEKT TASHXISI — yuqoridagi tugma butun
            TIZIMNI tekshiradi (sozlama/papka/kesh/trigger). Bitta obyekt
            ichida nima bo'layotganini ko'rsatadigan `apiObyektDiagnostika`
            esa GAS da bor va hook'i ham yozilgan edi, lekin hech qayerda
            chaqirilmasdi. «Bu obyektning summasi nega bunday?» degan savol
            aynan shu yerda hal bo'ladi. */}
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-[11px] uppercase tracking-wide text-text-dim mb-2">
            Bitta obyekt bo'yicha tashxis
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={obTashxis}
              onChange={(e) => setObTashxis(e.target.value)}
              aria-label="Obyekt tanlash"
              className="bg-[var(--surface-2)] border border-border rounded-lg px-2 py-1.5
                         text-[12px] text-text outline-none focus:border-accent/50 max-w-[280px]">
              <option value="">— obyekt tanlang —</option>
              {(obyektlar.data ?? []).map((o) => (
                <option key={o.obyekt} value={o.obyekt}>{o.obyekt}</option>
              ))}
            </select>
            <button
              onClick={() => {
                if (!obTashxis) { toast('Avval obyekt tanlang', 'warn'); return; }
                obDiag.mutate({ obyekt: obTashxis }, {
                  onError: (e: Error) => toast(e.message, 'danger', undefined, 9000),
                });
              }}
              disabled={obDiag.isPending || !obTashxis}
              className="px-3 py-1.5 rounded-lg bg-accent/15 text-accent hover:bg-accent/25
                         text-[12px] font-medium transition-colors disabled:opacity-50">
              {obDiag.isPending ? 'Tekshirilmoqda…' : 'Tekshirish'}
            </button>
          </div>
          {obDiag.data != null && <TashxisKorinish malumot={obDiag.data} />}
        </div>

        {/* Kesh va triggerlar — doim ko'rinadi, tugma bosish shart emas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <div className="rounded-lg border border-border bg-[var(--surface-2)]/30 p-2.5">
            <p className="text-[11px] uppercase tracking-wide text-text-dim mb-1.5">Kesh holati</p>
            {kesh.isLoading && <div className="skel h-10 rounded" />}
            {kesh.isError && <p className="text-[11px] text-danger">O‘qilmadi</p>}
            {/* ⚠️ 2026-08-17: avval xom `JSON.stringify` chiqarilardi — ekranda
                `{"skan":{"ts":"2026-08-17T11:41:25.294Z","ageSek":542,…}}` turardi.
                Bu ma'lumot emas, chiqindi: foydalanuvchiga ISO sana ham,
                sekundlar ham, `manba` degan ichki maydon ham kerak emas.
                Kerak bo'lgani: qaysi kesh, qancha vaqt oldin, yangimi.
                Xom JSON faqat «batafsil» ochilganda ko'rinadi. */}
            {kesh.data != null && <KeshJadval malumot={kesh.data} />}
          </div>

          <div className="rounded-lg border border-border bg-[var(--surface-2)]/30 p-2.5">
            <p className="text-[11px] uppercase tracking-wide text-text-dim mb-1.5">
              Triggerlar {Array.isArray(trig.data) ? `(${trig.data.length})` : ''}
            </p>
            {trig.isLoading && <div className="skel h-10 rounded" />}
            {trig.isError && <p className="text-[11px] text-danger">O‘qilmadi</p>}
            {Array.isArray(trig.data) && (
              trig.data.length
                ? <div className="space-y-0.5 max-h-28 overflow-auto">
                    {/* WARN 2026-08-17: element SATR ham bo'lishi mumkin
                        ("nom (tur)") - GAS ikki manbadan yig'adi. Avval faqat
                        obyekt deb hisoblanardi va satr kelganda `t.fn`
                        undefined bo'lib, ekranga JSON.stringify bilan
                        qo'shtirnoqli chiqindi tushardi. */}
                    {trig.data.map((t, i) => (
                      <div key={i} className="text-[10px] text-text-dim font-mono truncate">
                        {typeof t === 'string'
                          ? t
                          : (t?.fn || t?.handler || JSON.stringify(t))}
                      </div>
                    ))}
                  </div>
                : <p className="text-[11px] text-text-mute italic">Trigger yo‘q</p>
            )}
          </div>
        </div>
      </div>

      {/* ⚡ EKG — vaqt bo'yicha jarayon. Har chaqiruv bitta cho'qqi:
          balandligi = davomiylik, rangi = natija. Sekinlari darhol ko'zga tashlanadi. */}
      {yozuvlar.length > 1 && (
        <div className="karta p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] uppercase tracking-[0.04em] text-text-dim">Jarayon (oxirgidan eskisiga)</span>
            <div className="flex items-center gap-3 text-[11px] text-text-mute">
              <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-ok inline-block" /> tez</span>
              <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-warn inline-block" /> sekin</span>
              <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-danger inline-block" /> xato</span>
            </div>
          </div>
          <Ekg yozuvlar={yozuvlar} />
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <KpiKarta nom="Chaqiruvlar" qiymat={stat.n} />
        <KpiKarta nom="Xatolar" qiymat={stat.xato} ost={stat.xato ? 'tekshirish kerak' : 'muammo yo‘q'} />
        <KpiKarta nom="Sekin (>10s)" qiymat={stat.sekin} />
        <KpiKarta nom="O'rtacha" qiymat={stat.ortacha >= 1000 ? `${(stat.ortacha / 1000).toFixed(1)} s` : `${stat.ortacha} ms`} ost="muvaffaqiyatlilar bo'yicha" />
      </div>

      <Holatlar
        soragan={soragan}
        bosh={{ matn: 'Log bo‘sh', izoh: 'Hali chaqiruv qayd etilmagan yoki kesh muddati tugagan (6 soat).' }}
      >
        {() => <Jadval ustunlar={ustunlar} satrlar={yozuvlar} kalit={(y, i) => `${y.t}|${i}`} />}
      </Holatlar>
    </Sahifa>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * KeshJadval — kesh holatini ODAM O'QIY OLADIGAN ko'rinishda
 *
 * ⚠️ 2026-08-17: bu blokda avval xom JSON turardi. Foydalanuvchi:
 * «мониторингда кеш ҳолати деган жойида json чиқиб кетаяпди шекилли».
 * To'g'ri — ekranda ichki maydon nomlari (`ts`, `ageSek`, `manba`) va
 * ISO sanalar ko'rinardi. Ular ishlab chiquvchi uchun, foydalanuvchi
 * uchun emas.
 *
 * Endi har kesh kaliti bitta qator: NOMI · qancha vaqt oldin · holat.
 * Xom JSON «batafsil» ostida qoladi — kerak bo'lganda ochiladi.
 * ══════════════════════════════════════════════════════════════════ */
function _yoshMatn(sek: number): string {
  if (!Number.isFinite(sek) || sek < 0) return '—';
  if (sek < 60) return `${Math.round(sek)} sek oldin`;
  const daq = Math.floor(sek / 60);
  if (daq < 60) return `${daq} daqiqa oldin`;
  const soat = Math.floor(daq / 60);
  if (soat < 24) return `${soat} soat ${daq % 60} daq oldin`;
  return `${Math.floor(soat / 24)} kun oldin`;
}

/* ══════════════════════════════════════════════════════════════════
 * TashxisKorinish — tashxis natijasini o'qiladigan qilib chizadi
 *
 * ⚠️ 2026-08-17: tashxis natijalari ham xom `JSON.stringify` bilan
 * chiqarilardi — ya'ni tugmani bosgan foydalanuvchi javob o'rniga
 * qavslar va maydon nomlarini ko'rardi.
 *
 * Bu chizuvchi SHAKLGA BOG'LIQ EMAS (GAS javobi o'zgarsa ham ishlaydi):
 * ichma-ich obyektlarni bo'limlarga ajratadi, `true/false` ni belgi
 * (badge) ga, ro'yxatlarni sanoqqa aylantiradi. Xom ma'lumot pastda
 * «batafsil» ostida qoladi — tekshirish uchun kerak bo'lganda.
 * ══════════════════════════════════════════════════════════════════ */
function _sarlavhaMatn(kalit: string): string {
  /* `narxTayyor` → «Narx tayyor», `kesh_holati` → «Kesh holati» */
  const s = kalit.replace(/[_-]+/g, ' ').replace(/([a-z\d])([A-Z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function TashxisQator({ kalit, qiymat }: { kalit: string; qiymat: unknown }) {
  const nom = _sarlavhaMatn(kalit);

  if (typeof qiymat === 'boolean') {
    return (
      <div className="flex items-center justify-between gap-2 text-[11px] py-0.5">
        <span className="text-text-dim truncate">{nom}</span>
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium flex-shrink-0 ${
          qiymat ? 'bg-ok/15 text-ok' : 'bg-danger/15 text-danger'
        }`}>
          {qiymat ? 'ha' : 'yo‘q'}
        </span>
      </div>
    );
  }

  if (qiymat == null || qiymat === '') {
    return (
      <div className="flex items-center justify-between gap-2 text-[11px] py-0.5">
        <span className="text-text-dim truncate">{nom}</span>
        <span className="text-text-mute italic flex-shrink-0">yo‘q</span>
      </div>
    );
  }

  if (Array.isArray(qiymat)) {
    if (!qiymat.length) {
      return (
        <div className="flex items-center justify-between gap-2 text-[11px] py-0.5">
          <span className="text-text-dim truncate">{nom}</span>
          <span className="text-text-mute italic flex-shrink-0">bo‘sh</span>
        </div>
      );
    }
    return (
      <div className="py-0.5">
        <p className="text-[11px] text-text-dim mb-0.5">{nom} ({qiymat.length})</p>
        <div className="pl-3 space-y-0.5 max-h-32 overflow-auto">
          {qiymat.slice(0, 40).map((x, i) => (
            <div key={i} className="text-[10px] text-text-mute font-mono truncate">
              {typeof x === 'object' ? JSON.stringify(x) : String(x)}
            </div>
          ))}
          {qiymat.length > 40 && (
            <div className="text-[10px] text-text-mute italic">
              … va yana {qiymat.length - 40} ta
            </div>
          )}
        </div>
      </div>
    );
  }

  if (typeof qiymat === 'object') {
    return (
      <div className="py-1">
        <p className="text-[11px] font-medium text-text mb-0.5">{nom}</p>
        <div className="pl-3 border-l border-border">
          {Object.entries(qiymat as Record<string, unknown>).map(([k, v]) => (
            <TashxisQator key={k} kalit={k} qiymat={v} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 text-[11px] py-0.5">
      <span className="text-text-dim truncate">{nom}</span>
      <span className="text-text font-mono flex-shrink-0 truncate max-w-[55%]">{String(qiymat)}</span>
    </div>
  );
}

function TashxisKorinish({ malumot }: { malumot: unknown }) {
  if (malumot == null || typeof malumot !== 'object') {
    return (
      <p className="text-[11px] text-text-dim mt-2">
        {malumot == null ? 'Natija bo‘sh' : String(malumot)}
      </p>
    );
  }
  return (
    <div className="bg-[var(--surface-2)]/50 rounded p-3 mt-2 max-h-64 overflow-auto">
      {Object.entries(malumot as Record<string, unknown>).map(([k, v]) => (
        <TashxisQator key={k} kalit={k} qiymat={v} />
      ))}
      <details className="mt-2 pt-2 border-t border-border">
        <summary className="text-[10px] text-text-mute cursor-pointer hover:text-text-dim">
          batafsil (xom ma'lumot)
        </summary>
        <pre className="text-[9px] text-text-mute overflow-auto max-h-40 leading-relaxed mt-1">
{JSON.stringify(malumot, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function KeshJadval({ malumot }: { malumot: unknown }) {
  if (!malumot || typeof malumot !== 'object') {
    return <p className="text-[11px] text-text-mute italic">Ma'lumot yo'q</p>;
  }
  const kirishlar = Object.entries(malumot as Record<string, any>);
  if (!kirishlar.length) {
    return <p className="text-[11px] text-text-mute italic">Kesh bo'sh</p>;
  }

  return (
    <div className="space-y-1">
      {kirishlar.map(([nom, q]) => {
        /* Qiymat obyekt bo'lmasa — oddiy ko'rsatamiz (kelajakda shakl
           o'zgarsa ham hech narsa yiqilmasin). */
        if (!q || typeof q !== 'object') {
          return (
            <div key={nom} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-text font-medium truncate">{nom}</span>
              <span className="text-text-dim font-mono">{String(q)}</span>
            </div>
          );
        }
        const eskirgan = q.eskirgan === true;
        const bor = q.ts != null || q.ageSek != null;
        return (
          <div key={nom} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-text font-medium truncate">{nom}</span>
            <span className="flex items-center gap-2 flex-shrink-0">
              <span className="text-text-dim">
                {bor ? _yoshMatn(Number(q.ageSek)) : 'yozilmagan'}
              </span>
              {bor && (
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                  eskirgan ? 'bg-warn/15 text-warn' : 'bg-ok/15 text-ok'
                }`}>
                  {eskirgan ? 'eskirgan' : 'yangi'}
                </span>
              )}
            </span>
          </div>
        );
      })}
      <details className="mt-1.5">
        <summary className="text-[10px] text-text-mute cursor-pointer hover:text-text-dim">
          batafsil (xom ma'lumot)
        </summary>
        <pre className="text-[9px] text-text-mute overflow-auto max-h-24 leading-relaxed mt-1">
{JSON.stringify(malumot, null, 1)}
        </pre>
      </details>
    </div>
  );
}

export default Monitoring;
