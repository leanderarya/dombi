import { Skeleton } from '@/components/ui/skeleton';

export default function OutletDashboardSkeleton() {
    return (
        <div className="space-y-4">
            {/* Hero — stats */}
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                <div className="flex items-center justify-center">
                    <div className="flex items-center gap-6">
                        <div className="space-y-1 text-center">
                            <Skeleton className="mx-auto h-7 w-12 bg-emerald-200" />
                            <Skeleton className="mx-auto h-3 w-14 bg-emerald-200" />
                        </div>
                        <div className="h-6 w-px bg-emerald-200" />
                        <div className="space-y-1 text-center">
                            <Skeleton className="mx-auto h-7 w-12 bg-emerald-200" />
                            <Skeleton className="mx-auto h-3 w-10 bg-emerald-200" />
                        </div>
                    </div>
                </div>
            </div>

            {/* QR Scan button */}
            <Skeleton className="h-12 w-full rounded-xl" />

            {/* Stats grid */}
            <div className="space-y-3 rounded-xl border border-border bg-white p-4">
                <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="space-y-1 text-center">
                            <Skeleton className="mx-auto h-7 w-10" />
                            <Skeleton className="mx-auto h-3 w-12" />
                        </div>
                    ))}
                </div>
                <div className="h-px bg-border" />
                <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="space-y-1 text-center">
                            <Skeleton className="mx-auto h-7 w-10" />
                            <Skeleton className="mx-auto h-3 w-12" />
                        </div>
                    ))}
                </div>
                <Skeleton className="mx-auto h-4 w-32" />
            </div>

            {/* Low stock list */}
            <div className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <div className="divide-y divide-border rounded-xl border border-border bg-white">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div
                            key={i}
                            className="flex items-center justify-between px-4 py-2.5"
                        >
                            <div className="space-y-1">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-3 w-24" />
                            </div>
                            <Skeleton className="h-5 w-14 rounded-full" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
