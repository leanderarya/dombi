import { router } from '@inertiajs/react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import OwnerDetailRow from '@/components/owner/owner-detail-row';
import DistributionStatusBadge from '@/components/ui/distribution-status-badge';

export default function OwnerDistributionShow({ distribution }: any) {
    return (
        <OwnerPageShell title={`Distribution #${distribution.id}`} subtitle={distribution.outlet?.name ?? '-'} backHref="/owner/distributions">
            <div className="grid gap-3 lg:grid-cols-2">
                {/* Items */}
                <div className="rounded-lg border border-border p-4">
                    <div className="mb-3 text-xs font-bold uppercase tracking-wide text-text-subtle">Item</div>
                    {distribution.items.map((item: any) => (
                        <OwnerDetailRow key={item.id} label={item.product?.name ?? item.variant?.name ?? '-'} value={`${item.quantity}`} bold />
                    ))}
                </div>

                {/* Status */}
                <div className="rounded-lg border border-border p-4">
                    <div className="mb-3 text-xs font-bold uppercase tracking-wide text-text-subtle">Status</div>
                    <OwnerDetailRow label="Status" value={<DistributionStatusBadge status={distribution.status} />} />
                    <OwnerDetailRow label="Dikirim" value={distribution.sent_at ? new Date(distribution.sent_at).toLocaleString('id-ID') : '-'} />
                    <OwnerDetailRow label="Diterima" value={distribution.received_at ? new Date(distribution.received_at).toLocaleString('id-ID') : '-'} />
                    {distribution.status === 'preparing' && (
                        <button
                            onClick={() => router.post(`/owner/distributions/${distribution.id}/mark-shipped`)}
                            className="mt-3 flex h-8 w-full items-center justify-center rounded-lg bg-primary px-3 text-xs font-bold text-white transition-all duration-200"
                        >
                            Tandai Dikirim
                        </button>
                    )}
                </div>
            </div>
        </OwnerPageShell>
    );
}
