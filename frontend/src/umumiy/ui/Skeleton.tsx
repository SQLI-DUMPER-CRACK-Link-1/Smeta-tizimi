export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-surface-2 animate-pulse rounded-md ${className}`} />
  );
}

export function SkeletonText({ lines = 1, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-4 ${i === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}
