import { Head } from '@inertiajs/react';
import { Plus, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import EmptyState from '@/components/ui/empty-state';
import OfflineSaleDialog from '@/components/outlet/offline-sale-dialog';
import OutletLayout from '@/layouts/outlet-layout';
import Pagination from '@/components/pagination';
import { formatCurrency, formatDate } from '@/lib/format';

export default function OfflineSalesIndex({ sales, variants }: any) {
    const [showCreate, setShowCreate] = useState(false);

    return (
        <OutletLayout title="Penjualan Offline" subtitle="Catat penjualan di luar aplikasi">
            <Head title="Penjualan Offline" />

            <div className="mt-4 mb-4 flex justify-end">
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex min-h-11 items-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-bold text-white active:opacity-80"
                >
                    <Plus className="h-4 w-4" />
                    Catat Penjualan
                </button>
            </div>

            {sales.data.length === 0 ? (
                <EmptyState
                    icon={<ShoppingBag className="h-8 w-8 text-text-subtle" />}
                    title="Belum ada penjualan offline"
                    description="Catat penjualan yang terjadi di luar aplikasi (WhatsApp, walk-in)."
                    action={{ label: 'Catat Penjualan', onClick: () => setShowCreate(true) }}
                />
            ) : (
                <div className="space-y-1.5">
                    {sales.data.map((sale: any) => (
                        <div key={sale.id} className="rounded-xl border border-border bg-white px-3.5 py-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-text">{sale.variant?.name ?? '-'}</span>
                                <span className="text-sm font-bold tabular-nums text-text">{formatCurrency(sale.total_amount)}</span>
                            </div>
                            <div className="mt-1 flex items-center justify-between text-xs text-text-muted">
                                <span>{sale.quantity} x {formatCurrency(sale.center_price)}</span>
                                <span>{formatDate(sale.created_at)}</span>
                            </div>
                            {sale.notes && <div className="mt-1 text-xs text-text-subtle">{sale.notes}</div>}
                        </div>
                    ))}
                </div>
            )}

            <Pagination links={sales.links} />

            <OfflineSaleDialog
                open={showCreate}
                onClose={() => setShowCreate(false)}
                variants={variants}
            />
        </OutletLayout>
    );
}
