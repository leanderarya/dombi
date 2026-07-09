import { router } from '@inertiajs/react';
import { Truck } from 'lucide-react';
import OwnerDetailRow from '@/components/owner/owner-detail-row';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { Button } from '@/components/ui/button';
import DistributionStatusBadge from '@/components/ui/distribution-status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/format';

export default function OwnerDistributionShow({ distribution }: any) {
    if (!distribution) {
        return (
            <OwnerPageShell title="Memuat..." subtitle="Detail distribusi" backHref="/owner/distributions">
                <div className="grid gap-4 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-4">
                        <div className="rounded-lg border border-border p-4 space-y-3">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                        </div>
                        <div className="rounded-lg border border-border p-4 space-y-3">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-6 w-full" />
                            <Skeleton className="h-6 w-3/4" />
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="rounded-lg border border-border p-4 space-y-3">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-6 w-3/4" />
                        </div>
                    </div>
                </div>
            </OwnerPageShell>
        );
    }

    return (
        <OwnerPageShell title={`Distribusi #${distribution.id}`} subtitle={distribution.outlet?.name ?? '-'} backHref="/owner/distributions">
            <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-4">
                    <section className="rounded-lg border border-border p-4" aria-label="Item Distribusi">
                        <div className="mb-3 text-xs font-semibold text-text-subtle">Item</div>
                        {distribution.items.map((item: any) => (
                            <OwnerDetailRow key={item.id} label={item.product?.name ?? item.variant?.name ?? '-'} value={`${item.quantity}`} bold />
                        ))}
                    </section>

                    <section className="rounded-lg border border-border p-4" aria-label="Detail Distribusi">
                        <div className="mb-3 text-xs font-semibold text-text-subtle">Detail</div>
                        <OwnerDetailRow label="Outlet" value={distribution.outlet?.name ?? '-'} />
                        <OwnerDetailRow label="Dikirim" value={formatDate(distribution.sent_at)} />
                        <OwnerDetailRow label="Diterima" value={formatDate(distribution.received_at)} />
                    </section>
                </div>

                <div className="space-y-4">
                    <section className="rounded-lg border border-border p-4" aria-label="Status Distribusi">
                        <div className="mb-3 text-xs font-semibold text-text-subtle">Status</div>
                        <OwnerDetailRow label="Status" value={<DistributionStatusBadge status={distribution.status} />} />
                    </section>

                    {distribution.status === 'preparing' && (
                        <section className="rounded-lg border border-border p-4" aria-label="Aksi Distribusi">
                            <div className="mb-3 text-xs font-semibold text-text-subtle">Aksi</div>
                            <Button className="w-full" onClick={() => router.post(`/owner/distributions/${distribution.id}/mark-shipped`)}>
                                <Truck className="h-4 w-4" aria-hidden="true" />
                                Tandai Dikirim
                            </Button>
                        </section>
                    )}
                </div>
            </div>
        </OwnerPageShell>
    );
}
