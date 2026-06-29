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

export function SkeletonPageHeader() {
    return (
        <div className="border-b border-border pb-4 mb-6 flex items-center justify-between gap-4">
            <div className="space-y-1.5">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
    );
}

export function SkeletonFilters() {
    return (
        <div className="flex gap-2 mb-4">
            <Skeleton className="h-8 w-16 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-18 rounded-full" />
            <Skeleton className="h-8 w-14 rounded-full" />
        </div>
    );
}

export function SkeletonOrderCard() {
    return (
        <div className="rounded-xl border border-border bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-3 w-40" />
            <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-16" />
            </div>
        </div>
    );
}

export function SkeletonOrderList({ count = 5 }: { count?: number }) {
    return (
        <div className="space-y-2">
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonOrderCard key={i} />
            ))}
        </div>
    );
}

export function SkeletonPage({ showFilters = true }: { showFilters?: boolean }) {
    return (
        <div>
            <SkeletonPageHeader />
            {showFilters && <SkeletonFilters />}
            <SkeletonOrderList />
        </div>
    );
}
