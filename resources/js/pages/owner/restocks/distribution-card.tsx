import { Link, router } from '@inertiajs/react';
import OwnerDetailRow from '@/components/owner/owner-detail-row';
import { Button } from '@/components/ui/button';
import DistributionStatusBadge from '@/components/ui/distribution-status-badge';
import { formatDate } from '@/lib/format';

export default function DistributionCard({ distribution, restock, totalDistributed }: any) {
    if (!distribution) {
        return (
            <section className="rounded-lg border border-dashed border-border p-4" aria-label="Status Distribusi">
                <div className="text-sm font-bold text-text">Status Distribusi</div>
                <p className="mt-1 text-xs text-text-muted">Belum ada distribution. Approve request untuk membuat shipment.</p>
            </section>
        );
    }

    const actionLabels: Record<string, string> = {
        preparing: 'Siap dikirim ke outlet.',
        shipped: 'Menunggu Konfirmasi Outlet',
        completed: 'Distribusi Selesai',
    };
    const actionLabel = actionLabels[distribution.status] ?? 'Monitoring distribution.';

    return (
        <section className="rounded-lg border border-border p-4" aria-label="Detail Distribusi">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold text-text-subtle">Status Distribusi</p>
                    <h2 className="mt-1 text-sm font-bold text-text">Pengiriman #{distribution.id}</h2>
                    <p className="mt-0.5 text-xs text-text-muted">{actionLabel}</p>
                </div>
                <DistributionStatusBadge status={distribution.status} />
            </div>

            <div className="mt-3">
                <OwnerDetailRow label="Outlet" value={restock.outlet.name} />
                <OwnerDetailRow label="Total item" value={`${distribution.items?.length ?? 0} SKU`} />
                <OwnerDetailRow label="Jumlah kirim" value={`${totalDistributed} unit`} />
                <OwnerDetailRow label="Penanggung jawab" value={distribution.sender?.name ?? restock.approver?.name ?? '-'} />
                <OwnerDetailRow label="Tanggal kirim" value={formatDate(distribution.sent_at)} />
                <OwnerDetailRow label="Tanggal terima" value={formatDate(distribution.received_at)} />
            </div>

            <div className="mt-3 rounded-lg border border-border bg-slate-50 p-3">
                <div className="mb-2 text-xs font-semibold text-text-subtle">Ringkasan pengiriman</div>
                {distribution.items.map((item: any) => (
                    <OwnerDetailRow key={item.id} label={item.product?.name ?? item.variant?.name ?? '-'} value={`${item.quantity}`} bold />
                ))}
            </div>

            {distribution.status === 'preparing' && (
                <Button className="mt-3 w-full" onClick={() => router.post(`/owner/distributions/${distribution.id}/mark-shipped`)}>
                    Tandai Dikirim
                </Button>
            )}

            {distribution.status === 'shipped' && (
                <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 p-2 text-center text-xs font-semibold text-indigo-700">
                    Menunggu Konfirmasi Outlet
                </div>
            )}

            {distribution.status === 'completed' && (
                <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-center text-xs font-semibold text-emerald-700">
                    Distribusi Selesai
                </div>
            )}

            <Link href={`/owner/distributions/${distribution.id}`} className="mt-2 block text-center text-xs font-bold text-primary">
                Lihat detail distribution
            </Link>
        </section>
    );
}
