import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, FileWarning } from 'lucide-react';
import { FmtN } from '../lib/format';
import {
  f2AggregatsiyaQator,
  f2IstisnolarniAniqla,
  type F2ExactManbaTugun,
  type F2Exception,
} from './f2-exact-payload';
import { f2IstisnolarniGuruhla } from './f2-preapproval-audit';

type F2PreapprovalAuditProps = {
  aktBarglar: F2ExactManbaTugun[];
  getSmetaId: (uid: string) => number | null | undefined;
};

const sarlavha: Record<F2Exception['turi'], string> = {
  NEEDS_REVIEW: 'Yozishdan oldin ko\'rib chiqish kerak',
  ARITHMETIC_MISMATCH: 'Arifmetik farq',
  NEGATIVE_HAJM: 'Manfiy hajm',
  CONFLICTING_PRICES: 'Ikki xil narx bir qatorga birlashdi',
};

function IstisnoMatni({ istisno }: { istisno: F2Exception }) {
  if (istisno.turi === 'NEEDS_REVIEW') {
    return <>Narx bor, F2 faylning o'z summasi yo'q — yozish to'xtaydi.</>;
  }
  if (istisno.turi === 'ARITHMETIC_MISMATCH') {
    return <><FmtN val={istisno.hisoblangan} /> ≠ <FmtN val={istisno.hujjatdagi} /> (farq <FmtN val={istisno.farq} />) — hujjat summasi saqlanadi, tuzatilmaydi.</>;
  }
  if (istisno.turi === 'CONFLICTING_PRICES') {
    return <>Bu qatorga birlashgan manba qatorlarida turli narx uchradi: {istisno.narxlar.map((n, i) => <span key={n}>{i > 0 ? ', ' : ''}<FmtN val={n} /></span>)} — bog‘lanish yoki manba davrlarini tekshirmaguncha yozish bloklanadi.</>;
  }
  return <>Manfiy hajm (<FmtN val={istisno.hajm} />) — pererraschyot yoki qaytarilgan ish bo'lishi mumkin, tekshiring.</>;
}

/** F2 tasdiqlashidan oldingi, faqat-istisnolar audit ko'rinishi. Hech narsa yozmaydi. */
export function F2PreapprovalAudit({ aktBarglar, getSmetaId }: F2PreapprovalAuditProps) {
  const qatorlar = useMemo(
    () => f2AggregatsiyaQator(aktBarglar, getSmetaId),
    [aktBarglar, getSmetaId],
  );
  const istisnolar = useMemo(() => f2IstisnolarniAniqla(qatorlar), [qatorlar]);
  const guruhlar = useMemo(() => f2IstisnolarniGuruhla(istisnolar), [istisnolar]);
  const istisnoQatorlari = new Set(istisnolar.map((istisno) => istisno.qatorId));
  const tozaSoni = qatorlar.length - istisnoQatorlari.size;

  if (istisnolar.length === 0) {
    return (
      <section className="karta border-ok/30 bg-ok/5 p-3 text-[12px]" aria-label="F2 tasdiqlashdan oldingi audit">
        <p className="flex items-center gap-2 font-semibold text-ok"><CheckCircle2 size={16} /> Barcha {qatorlar.length} bog'langan qator toza, ko'rib chiqish shart emas.</p>
      </section>
    );
  }

  return (
    <section className="karta border-warn/35 bg-warn/5 p-3 text-[12px] space-y-3" aria-label="F2 tasdiqlashdan oldingi istisnolar">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold text-text"><FileWarning size={16} className="text-warn" /> F2 tasdiqlashdan oldingi istisnolar</p>
        <span className="text-text-dim">{istisnoQatorlari.size} qator e'tibor talab qiladi · {tozaSoni} toza qator yashirildi</span>
      </header>
      {(Object.entries(guruhlar) as Array<[F2Exception['turi'], F2Exception[]]>).map(([turi, qatorlar]) => qatorlar.length > 0 && (
        <div key={turi} className="rounded-lg border border-border/60 bg-black/10 p-2.5 space-y-1.5">
          <p className="font-medium text-text"><AlertTriangle size={13} className="mr-1 inline text-warn" /> {sarlavha[turi]} ({qatorlar.length})</p>
          {qatorlar.map((istisno) => <p key={`${istisno.turi}-${istisno.qatorId}`} className="text-text-dim pl-1">Qator #{istisno.qatorId}: <IstisnoMatni istisno={istisno} /></p>)}
        </div>
      ))}
    </section>
  );
}
