interface SkeletonProps {
    className?: string;
    count?: number;
}

export function Skeleton({ className = '', count = 1 }: SkeletonProps) {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    className={`animate-pulse rounded-lg bg-border ${className}`}
                />
            ))}
        </>
    );
}

export function SkeletonCard() {
    return (
        <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
        </div>
    );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
    return (
        <div className="space-y-3">
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonCard key={i} />
            ))}
        </div>
    );
}

export function SkeletonKpi() {
    return (
        <div className="rounded-xl border border-border bg-surface p-4">
            <Skeleton className="h-3 w-1/4 mb-2" />
            <Skeleton className="h-6 w-1/2" />
        </div>
    );
}

export function SkeletonKpiGrid({ count = 3 }: { count?: number }) {
    return (
        <div className={`grid gap-3 ${count === 2 ? 'grid-cols-2' : count === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonKpi key={i} />
            ))}
        </div>
    );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
    return (
        <div className="space-y-2">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-border">
                    <div className="space-y-1.5">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-2.5 w-20" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                </div>
            ))}
        </div>
    );
}
