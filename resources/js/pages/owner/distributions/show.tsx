import { router } from '@inertiajs/react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import DistributionStatusBadge from '@/components/ui/distribution-status-badge';

export default function OwnerDistributionShow({ distribution }: any) {
    return (
        <OwnerPageShell title={`Distribution #${distribution.id}`} subtitle={distribution.outlet?.name ?? '-'} backHref="/owner/distributions">
            <div className="grid gap-3 lg:grid-cols-2">
                {/* Items */}
                <div className="rounded-lg border border-border p-4">
                    <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-text-subtle">Item</div>
                    {distribution.items.map((item: any) => (
                        <div key={item.id} className="flex justify-between border-b border-[#f5f5f5] py-1 text-xs last:border-b-0">
                            <span className="text-text-muted">{item.product?.name ?? item.variant?.name ?? '-'}</span>
                            <span className="font-semibold text-text">{item.quantity}</span>
                        </div>
                    ))}
                </div>

                {/* Status */}
                <div className="rounded-lg border border-border p-4">
                    <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-text-subtle">Status</div>
                    <div className="flex justify-between border-b border-[#f5f5f5] py-1 text-xs last:border-b-0">
                        <span className="text-text-muted">Status</span>
                        <DistributionStatusBadge status={distribution.status} />
                    </div>
                    <div className="flex justify-between border-b border-[#f5f5f5] py-1 text-xs last:border-b-0">
                        <span className="text-text-muted">Dikirim</span>
                        <span className="text-text">{distribution.sent_at ? new Date(distribution.sent_at).toLocaleString('id-ID') : '-'}</span>
                    </div>
                    <div className="flex justify-between border-b border-[#f5f5f5] py-1 text-xs last:border-b-0">
                        <span className="text-text-muted">Diterima</span>
                        <span className="text-text">{distribution.received_at ? new Date(distribution.received_at).toLocaleString('id-ID') : '-'}</span>
                    </div>
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
