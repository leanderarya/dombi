import { Skeleton, SkeletonKpiGrid } from '@/components/ui/skeleton';

export default function OwnerDashboardSkeleton() {
    return (
        <div className="space-y-4">
            {/* Hero Bar */}
            <div className="rounded-lg bg-primary p-5 space-y-3">
                <Skeleton className="h-3 w-24 bg-primary-hover" />
                <Skeleton className="h-8 w-40 bg-primary-hover" />
                <Skeleton className="h-4 w-32 bg-primary-hover" />
            </div>

            {/* KPI Strip */}
            <SkeletonKpiGrid count={3} />

            {/* 2-column grid: Actions + Stok Kritis */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-10">
                {/* Butuh Tindakan */}
                <div className="lg:col-span-7 rounded-xl bg-surface p-4 shadow-card space-y-3">
                    <Skeleton className="h-4 w-28" />
                    <div className="space-y-2">
                        <Skeleton className="h-12 w-full rounded-lg" />
                        <Skeleton className="h-12 w-full rounded-lg" />
                        <Skeleton className="h-12 w-full rounded-lg" />
                    </div>
                </div>

                {/* Stok Kritis */}
                <div className="lg:col-span-3 rounded-xl bg-surface p-4 shadow-card space-y-3">
                    <Skeleton className="h-4 w-24" />
                    <div className="space-y-2">
                        <Skeleton className="h-12 w-full rounded-lg" />
                        <Skeleton className="h-12 w-full rounded-lg" />
                    </div>
                </div>
            </div>

            {/* Settlement Alerts */}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
            </div>
        </div>
    );
}
