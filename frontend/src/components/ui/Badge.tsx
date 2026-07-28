import { ReactNode } from 'react';

type BadgeVariant = 'default' | 'ok' | 'warn' | 'danger' | 'bl' | 'rs' | 'mat' | 'ob';

export function Badge({ children, variant = 'default', className = '' }: { children: ReactNode; variant?: BadgeVariant; className?: string }) {
  const variants = {
    default: 'bg-surface-2 text-text',
    ok: 'bg-ok/10 text-ok border border-ok/20',
    warn: 'bg-warn/10 text-warn border border-warn/20',
    danger: 'bg-danger/10 text-danger border border-danger/20',
    bl: 'bg-t-bl/10 text-t-bl border border-t-bl/20',
    rs: 'bg-t-rs/10 text-t-rs border border-t-rs/20',
    mat: 'bg-t-mat/10 text-t-mat border border-t-mat/20',
    ob: 'bg-t-ob/10 text-t-ob border border-t-ob/20',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
