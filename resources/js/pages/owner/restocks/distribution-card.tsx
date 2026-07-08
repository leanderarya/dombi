import { Link, router } from '@inertiajs/react';
import DistributionStatusBadge from '@/components/ui/distribution-status-badge';
import { formatDate } from '@/lib/format';

function Metric({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
    return (
        <div className={`rounded-lg border p-2 ${muted ? 'border-amber-200 bg-amber-50' : 'border-border bg-slate-50'}`}>
            <div className={`text-xs font-semibold uppercase tracking-wide ${muted ? 'text-amber-600' : 'text-text-subtle'}`}>{label}</div>
            <div className={`mt-0.5 truncate text-xs font-bold ${muted ? 'text-amber-800' : 'text-text'}`}>{value}</div>
        </div>
    );
}

export default function DistributionCard({ distribution, restock, totalDistributed }: any) {
    if (!distribution) {
        return (
            <div className="rounded-lg border border-dashed border-border p-4">
                <div className="text-sm font-bold text-text">Status Distribusi</div>
                <p className="mt-1 text-xs text-text-muted">Belum ada distribution. Approve request untuk membuat shipment.</p>
            </div>
        );
    }

    const actionLabels: Record<string, string> = {
        preparing: 'Siap dikirim ke outlet.',
        shipped: 'Menunggu Konfirmasi Outlet',
        completed: 'Distribusi Selesai',
    };
    const actionLabel = actionLabels[distribution.status] ?? 'Monitoring distribution.';

    return (
        <div className="rounded-lg border border-border p-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-text-subtle">Status Distribusi</p>
                    <h2 className="mt-1 text-sm font-bold text-text">Pengiriman #{distribution.id}</h2>
                    <p className="mt-0.5 text-xs text-text-muted">{actionLabel}</p>
                </div>
                <DistributionStatusBadge status={distribution.status} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <Metric label="Outlet" value={restock.outlet.name} />
                <Metric label="Total item" value={`${distribution.items?.length ?? 0} SKU`} />
                <Metric label="Jumlah kirim" value={`${totalDistributed} unit`} />
                <Metric label="Penanggung jawab" value={distribution.sender?.name ?? restock.approver?.name ?? '-'} />
                <Metric label="Tanggal kirim" value={formatDate(distribution.sent_at)} />
                <Metric label="Tanggal terima" value={formatDate(distribution.received_at)} />
            </div>

            <div className="mt-3 rounded-lg border border-border bg-slate-50 p-3">
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-text-subtle">Ringkasan pengiriman</div>
                {distribution.items.map((item: any) => (
                    <div key={item.id} className="flex justify-between border-b border-[#f5f5f5] py-1 text-sm last:border-b-0">
                        <span className="text-text-muted">{item.product?.name ?? item.variant?.name ?? '-'}</span>
                        <span className="font-bold text-text">{item.quantity}</span>
                    </div>
                ))}
            </div>

            {distribution.status === 'preparing' && (
                <button
                    type="button"
                    onClick={() => router.post(`/owner/distributions/${distribution.id}/mark-shipped`)}
                    className="mt-3 flex h-9 w-full items-center justify-center rounded-lg bg-primary px-3 text-xs font-bold text-white transition-all duration-150 active:opacity-80"
                >
                    Tandai Dikirim
                </button>
            )}

            {distribution.status === 'shipped' && (
                <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 p-2 text-xs font-semibold text-indigo-700">
                    Menunggu Konfirmasi Outlet
                </div>
            )}

            {distribution.status === 'completed' && (
                <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs font-semibold text-emerald-700">
                    Distribusi Selesai
                </div>
            )}

            <Link href={`/owner/distributions/${distribution.id}`} className="mt-2 block text-center text-xs font-bold text-primary">
                Lihat detail distribution
            </Link>
        </div>
    );
}
