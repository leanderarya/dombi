import { Skeleton } from '@/components/ui/skeleton';

export function AnalyticsDashboardSkeleton() {
    return (
        <div
            className="space-y-6"
            role="status"
            aria-label="Memuat dashboard analitik"
            aria-busy="true"
        >
            <div className="flex flex-wrap gap-2" aria-hidden="true">
                <Skeleton className="h-8 w-20 rounded-full" />
                <Skeleton className="h-8 w-24 rounded-full" />
                <Skeleton className="h-8 w-20 rounded-full" />
            </div>

            <div
                className="grid grid-cols-2 gap-4 lg:grid-cols-4"
                aria-hidden="true"
            >
                {Array.from({ length: 4 }, (_, index) => (
                    <div
                        key={index}
                        className="min-h-32 space-y-2 rounded-2xl border border-border bg-surface p-5"
                    >
                        <div className="flex items-center justify-between">
                            <Skeleton className="h-3 w-20" />
                            <Skeleton className="h-10 w-10 rounded-xl" />
                        </div>
                        <Skeleton className="h-7 w-2/3" />
                        <Skeleton className="h-3 w-1/2" />
                    </div>
                ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2" aria-hidden="true">
                <div className="min-h-64 rounded-2xl border border-border bg-surface p-5">
                    <div className="mb-4 space-y-2">
                        <Skeleton className="h-5 w-2/5" />
                        <Skeleton className="h-3 w-3/5" />
                    </div>
                    <div className="space-y-4">
                        {Array.from({ length: 4 }, (_, index) => (
                            <div key={index} className="space-y-2">
                                <div className="flex justify-between gap-3">
                                    <Skeleton className="h-3 w-1/3" />
                                    <Skeleton className="h-3 w-1/4" />
                                </div>
                                <Skeleton className="h-2 w-full rounded-full" />
                                <Skeleton className="h-3 w-1/5" />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="min-h-64 rounded-2xl border border-border bg-surface p-5">
                    <div className="mb-4 space-y-2">
                        <Skeleton className="h-5 w-2/5" />
                        <Skeleton className="h-3 w-3/5" />
                    </div>
                    <div className="space-y-3">
                        {Array.from({ length: 5 }, (_, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between gap-3 py-1.5"
                            >
                                <div className="flex min-w-0 items-center gap-3">
                                    <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
                                    <div className="min-w-0 space-y-1.5">
                                        <Skeleton className="h-3 w-28 max-w-full" />
                                        <Skeleton className="h-3 w-16" />
                                    </div>
                                </div>
                                <Skeleton className="h-4 w-20 shrink-0" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function AnalyticsAuditSkeleton() {
    return (
        <div
            className="space-y-4"
            role="status"
            aria-label="Memuat audit stok"
            aria-busy="true"
        >
            <div className="flex justify-end" aria-hidden="true">
                <Skeleton className="h-9 w-24 rounded-md" />
            </div>

            <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
                <div className="space-y-1.5" aria-hidden="true">
                    {Array.from({ length: 7 }, (_, index) => (
                        <div
                            key={index}
                            className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2.5 shadow-card"
                        >
                            <Skeleton className="h-4 w-9 shrink-0" />
                            <div className="min-w-0 flex-1 space-y-1.5">
                                <Skeleton className="h-3 w-2/3 max-w-48" />
                                <Skeleton className="h-3 w-1/2 max-w-36" />
                            </div>
                            <div className="shrink-0 space-y-1.5">
                                <Skeleton className="ml-auto h-3 w-16" />
                                <Skeleton className="ml-auto h-3 w-20" />
                            </div>
                        </div>
                    ))}
                </div>

                <div className="hidden lg:block" aria-hidden="true">
                    <div className="sticky top-4 space-y-3">
                        {Array.from({ length: 3 }, (_, index) => (
                            <div
                                key={index}
                                className="rounded-xl bg-surface p-5 shadow-card"
                            >
                                <Skeleton className="h-4 w-2/3" />
                                <Skeleton className="mt-3 h-9 w-1/3" />
                                <Skeleton className="mt-2 h-3 w-3/4" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex gap-1.5 py-2" aria-hidden="true">
                {Array.from({ length: 5 }, (_, index) => (
                    <Skeleton key={index} className="h-8 w-8 rounded-md" />
                ))}
            </div>
        </div>
    );
}

export function AnalyticsIssuesSkeleton() {
    return (
        <div
            className="space-y-4"
            role="status"
            aria-label="Memuat laporan masalah"
            aria-busy="true"
        >
            <div className="flex flex-wrap gap-2" aria-hidden="true">
                <Skeleton className="h-8 w-14 rounded-full" />
                <Skeleton className="h-8 w-24 rounded-full" />
                <Skeleton className="h-8 w-20 rounded-full" />
                <Skeleton className="h-8 w-20 rounded-full" />
                <Skeleton className="h-8 w-16 rounded-full" />
            </div>

            <div className="space-y-2" aria-hidden="true">
                {Array.from({ length: 5 }, (_, index) => (
                    <div
                        key={index}
                        className="rounded-xl bg-surface p-4 shadow-card"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1 space-y-1.5">
                                <Skeleton className="h-4 w-32 max-w-full" />
                                <Skeleton className="h-3 w-24 max-w-full" />
                            </div>
                            <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                            <Skeleton className="h-3 w-28 max-w-1/2" />
                            <Skeleton className="h-3 w-20 shrink-0" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
