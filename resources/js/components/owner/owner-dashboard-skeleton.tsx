import { Skeleton, SkeletonKpiGrid } from '@/components/ui/skeleton';

export default function OwnerDashboardSkeleton() {
    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Left Column */}
            <div className="space-y-4">
                {/* Butuh Tindakan */}
                <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
                    <Skeleton className="h-4 w-28" />
                    <div className="space-y-2">
                        <Skeleton className="h-12 w-full rounded-lg" />
                        <Skeleton className="h-12 w-full rounded-lg" />
                        <Skeleton className="h-12 w-full rounded-lg" />
                    </div>
                </div>

                {/* Hero Bar */}
                <div className="rounded-xl bg-emerald-700 p-5 space-y-3">
                    <Skeleton className="h-3 w-24 bg-emerald-600" />
                    <Skeleton className="h-8 w-40 bg-emerald-600" />
                    <Skeleton className="h-4 w-32 bg-emerald-600" />
                </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
                {/* KPI Grid */}
                <SkeletonKpiGrid count={3} />

                {/* Stok Kritis */}
                <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
                    <Skeleton className="h-4 w-24" />
                    <div className="space-y-2">
                        <Skeleton className="h-12 w-full rounded-lg" />
                        <Skeleton className="h-12 w-full rounded-lg" />
                    </div>
                </div>
            </div>
        </div>
    );
}
