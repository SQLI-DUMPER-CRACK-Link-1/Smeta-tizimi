import { motion, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  CircleX,
  Info,
  Loader2,
} from 'lucide-react';
import { useId, type ComponentType, type ReactNode } from 'react';

export type PtoTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'unknown';

type IconType = ComponentType<{ className?: string; size?: number; 'aria-hidden'?: boolean }>;

const toneIcons: Record<PtoTone, IconType> = {
  neutral: CircleDashed,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: CircleX,
  unknown: CircleDashed,
};

const toneClasses: Record<PtoTone, string> = {
  neutral: 'border-border bg-surface-2/70 text-text-dim',
  info: 'border-accent/30 bg-accent/10 text-accent',
  success: 'border-ok/30 bg-ok/10 text-ok',
  warning: 'border-warn/35 bg-warn/10 text-warn',
  danger: 'border-danger/35 bg-danger/10 text-danger',
  unknown: 'border-warn/30 bg-warn/5 text-warn',
};

/** Small semantic status treatment. Unknown is intentionally distinct from zero/success. */
export function PtoStatusChip({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: PtoTone;
  icon?: IconType;
}) {
  const Icon = icon ?? toneIcons[tone];
  return (
    <span
      role="status"
      aria-label={label}
      className={`pto-status pto-status--${tone} inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none ${toneClasses[tone]}`}
    >
      <Icon size={13} aria-hidden className="shrink-0" />
      <span>{label}</span>
    </span>
  );
}

/** Reveal a bounded section without animating large data collections. */
export function PtoReveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 10 }}
      animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
      transition={reducedMotion ? undefined : { duration: 0.28, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function PtoSection({
  title,
  description,
  icon: Icon,
  tone = 'neutral',
  action,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  icon?: IconType;
  tone?: PtoTone;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className={`pto-section pto-section--${tone} karta overflow-hidden ${className}`}>
      <header className="pto-section__header flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span className="pto-section__icon" aria-hidden>
              <Icon size={16} />
            </span>
          )}
          <div className="min-w-0">
            <h2 id={titleId} className="pto-section__title text-sm font-semibold text-text">{title}</h2>
            {description && <p className="pto-section__description mt-0.5 text-xs text-text-dim">{description}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      {children && <div className="pto-section__body p-4">{children}</div>}
    </section>
  );
}

export function PtoMetric({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: PtoTone;
}) {
  return (
    <div className={`pto-metric pto-metric--${tone} karta min-w-0 px-3 py-3 ${toneClasses[tone]}`}>
      <p className="pto-metric__label text-[10px] font-semibold uppercase tracking-[0.12em] text-text-mute">{label}</p>
      <p className="pto-metric__value mt-1 text-lg font-semibold tabular-nums text-text">{value}</p>
      {hint && <p className="pto-metric__hint mt-1 text-[11px] text-text-dim">{hint}</p>}
    </div>
  );
}

export function PtoProgress({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 1;
  const safeValue = Number.isFinite(value) ? Math.min(Math.max(value, 0), safeMax) : 0;
  const percent = Math.round((safeValue / safeMax) * 100);
  return (
    <div
      className="pto-progress karta space-y-2 px-3 py-3"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={safeValue}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="pto-progress__label text-xs font-medium text-text-dim">{label}</span>
        <span className="pto-progress__value text-xs font-semibold tabular-nums text-text">{percent}%</span>
      </div>
      <div className="pto-progress__track h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div className="pto-progress__fill h-full rounded-full bg-accent transition-[width] duration-300 ease-out" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function PtoEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="pto-empty karta flex flex-col items-center px-5 py-12 text-center" role="status">
      <CircleDashed size={26} aria-hidden className="pto-empty__icon text-text-mute" />
      <p className="pto-empty__title mt-3 text-sm font-medium text-text">{title}</p>
      {description && <p className="pto-empty__description mt-1 max-w-lg text-xs leading-5 text-text-dim">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PtoLoadingState({ label = 'Maʼlumot yuklanmoqda' }: { label?: string }) {
  return (
    <div className="pto-loading karta flex items-center gap-2 px-4 py-4 text-sm text-text-dim" role="status" aria-label={label}>
      <Loader2 size={18} aria-hidden className="animate-spin text-accent" />
      <span>{label}…</span>
    </div>
  );
}
