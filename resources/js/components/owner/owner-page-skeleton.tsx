import { Skeleton } from '@/components/ui/skeleton';

export default function OwnerPageSkeleton() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="border-b border-border pb-4 mb-6 flex items-center justify-between gap-4">
                <div className="space-y-1.5">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-48" />
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
                <Skeleton className="h-8 w-20 rounded-lg" />
                <Skeleton className="h-8 w-16 rounded-lg" />
                <Skeleton className="h-8 w-24 rounded-lg" />
                <Skeleton className="h-8 w-18 rounded-lg" />
            </div>

            {/* Content cards */}
            <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="rounded-xl bg-surface p-4 shadow-card space-y-3">
                        <div className="flex items-center justify-between">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-5 w-16 rounded-full" />
                        </div>
                        <Skeleton className="h-3 w-full" />
                        <div className="flex items-center justify-between">
                            <Skeleton className="h-3 w-24" />
                            <Skeleton className="h-4 w-20" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
