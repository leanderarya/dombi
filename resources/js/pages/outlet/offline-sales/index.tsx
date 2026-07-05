import { Head, router } from '@inertiajs/react';
import { Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useState } from 'react';
import OfflineSaleDialog from '@/components/outlet/offline-sale-dialog';
import OutletPageShell from '@/components/outlet/outlet-page-shell';
import Pagination from '@/components/ui/pagination';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/empty-state';
import OutletLayout from '@/layouts/outlet-layout';
import { formatCurrency, formatDate } from '@/lib/format';

export default function OfflineSalesIndex({ sales, variants }: any) {
    const [showCreate, setShowCreate] = useState(false);

    const handleDelete = (saleId: number) => {
        if (!confirm('Hapus penjualan ini? Stok akan dikembalikan.')) {
return;
}

        router.delete(`/outlet/offline-sales/${saleId}`);
    };

    return (
        <OutletLayout title="Penjualan Offline" subtitle="Catat penjualan di luar aplikasi">
            <Head title="Penjualan Offline" />
            <OutletPageShell>
            <div className="flex justify-end">
                <Button size="lg" onClick={() => setShowCreate(true)} icon={Plus}>
                    Catat Penjualan
                </Button>
            </div>

            {sales.data.length === 0 ? (
                <EmptyState
                    icon={<ShoppingBag className="h-8 w-8 text-text-subtle" />}
                    title="Belum ada penjualan offline"
                    description="Catat penjualan yang terjadi di luar aplikasi (WhatsApp, walk-in)."
                    action={{ label: 'Catat Penjualan', onClick: () => setShowCreate(true) }}
                />
            ) : (
                <div className="space-y-2">
                    {sales.data.map((sale: any) => (
                        <div key={sale.id} className="rounded-xl border border-border bg-white px-3.5 py-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-text">{sale.variant?.family?.name ? `${sale.variant.family.name} - ${sale.variant.name}` : sale.variant?.name ?? '-'}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold tabular-nums text-text">{formatCurrency(sale.total_amount)}</span>
                                    <button
                                        onClick={() => handleDelete(sale.id)}
                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-text-subtle active:bg-red-50 active:text-red-600"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
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
            </OutletPageShell>

            <OfflineSaleDialog
                open={showCreate}
                onClose={() => setShowCreate(false)}
                variants={variants}
            />
        </OutletLayout>
    );
}
