import { Head, Link, router } from '@inertiajs/react';
import { Pencil, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useState } from 'react';
import OfflineSaleDialog from '@/components/outlet/offline-sale-dialog';
import OutletPageShell from '@/components/outlet/outlet-page-shell';
import BottomSheet from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/empty-state';
import FilterChips from '@/components/ui/filter-chips';
import Pagination from '@/components/ui/pagination';
import OutletLayout from '@/layouts/outlet-layout';
import { formatCurrency, formatDate } from '@/lib/format';

const PERIOD_FILTERS = [
    { key: 'all', label: 'Semua' },
    { key: 'week', label: 'Minggu Ini' },
    { key: 'month', label: 'Bulan Ini' },
];

export default function OfflineSalesIndex({
    sales,
    groupedSales = [],
    variants,
    weekStart,
    weekEnd,
    period = 'all',
}: any) {
    const [showCreate, setShowCreate] = useState(false);
    const [editTarget, setEditTarget] = useState<any>(null);
    const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

    const handleDelete = () => {
        if (deleteTarget !== null) {
            router.delete(`/outlet/offline-sales/${deleteTarget}`, {
                onFinish: () => setDeleteTarget(null),
            });
        }
    };

    const handlePeriodChange = (key: string) => {
        router.get(
            '/outlet/offline-sales',
            { period: key === 'all' ? undefined : key },
            { preserveState: true },
        );
    };

    return (
        <OutletLayout
            title="Penjualan Offline"
            subtitle={
                weekStart && weekEnd
                    ? `Pekan ${formatDate(weekStart)} – ${formatDate(weekEnd)}`
                    : 'Catat penjualan di luar aplikasi'
            }
            headerBelow={
                !weekStart && (
                    <FilterChips
                        options={PERIOD_FILTERS}
                        active={period}
                        onChange={handlePeriodChange}
                    />
                )
            }
        >
            <Head title="Penjualan Offline" />
            <OutletPageShell>
                <div className="flex justify-end">
                    <Button
                        size="lg"
                        onClick={() => setShowCreate(true)}
                        icon={Plus}
                        className="min-h-11"
                    >
                        Catat Penjualan
                    </Button>
                </div>

                {sales.data.length === 0 ? (
                    <EmptyState
                        icon={
                            <ShoppingBag className="h-8 w-8 text-text-subtle" />
                        }
                        title="Belum ada penjualan offline"
                        description="Catat penjualan yang terjadi di luar aplikasi (WhatsApp, walk-in)."
                        action={{
                            label: 'Catat Penjualan',
                            onClick: () => setShowCreate(true),
                        }}
                    />
                ) : (
                    <div className="space-y-4">
                        {groupedSales.map((group: any) => (
                            <div key={group.date}>
                                <div className="mb-1.5 flex items-center justify-between">
                                    <span className="text-xs font-bold tracking-wide text-text-subtle uppercase">
                                        {formatDate(group.date)}
                                    </span>
                                    <span className="text-xs font-semibold text-text-muted tabular-nums">
                                        {group.items.length} jualan ·{' '}
                                        {formatCurrency(group.total)}
                                    </span>
                                </div>
                                <div className="space-y-2">
                                    {group.items.map((sale: any) => (
                                        <Link
                                            key={sale.id}
                                            href={`/outlet/offline-sales/${sale.id}`}
                                            className="block rounded-xl border border-border bg-white px-3.5 py-2.5 active:bg-surface-muted"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-semibold text-text">
                                                    {sale.product?.category
                                                        ?.name
                                                        ? `${sale.product.category.name} - ${sale.product.name}`
                                                        : (sale.product?.name ??
                                                          '-')}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-text tabular-nums">
                                                        {formatCurrency(
                                                            sale.total_amount,
                                                        )}
                                                    </span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setEditTarget(sale);
                                                        }}
                                                        aria-label="Edit penjualan"
                                                        className="flex h-11 w-11 items-center justify-center rounded-lg text-text-subtle active:bg-surface-muted active:text-text"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setDeleteTarget(
                                                                sale.id,
                                                            );
                                                        }}
                                                        aria-label="Hapus penjualan"
                                                        className="flex h-11 w-11 items-center justify-center rounded-lg text-text-subtle active:bg-red-50 active:text-red-600"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="mt-1 flex items-center justify-between text-xs text-text-muted">
                                                <span>
                                                    {sale.quantity} x{' '}
                                                    {formatCurrency(
                                                        sale.center_price,
                                                    )}
                                                    {sale.payment_method ? (
                                                        <span className="ml-2 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-text-muted uppercase">
                                                            {
                                                                sale.payment_method
                                                            }
                                                        </span>
                                                    ) : null}
                                                </span>
                                                <span>
                                                    {formatDate(
                                                        sale.created_at,
                                                    )}
                                                </span>
                                            </div>
                                            {sale.notes && (
                                                <div className="mt-1 text-xs text-text-subtle">
                                                    {sale.notes}
                                                </div>
                                            )}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <Pagination links={sales.links} />
            </OutletPageShell>

            <OfflineSaleDialog
                key={editTarget ? `edit-${editTarget.id}` : 'create'}
                open={showCreate || !!editTarget}
                onClose={() => {
                    setShowCreate(false);
                    setEditTarget(null);
                }}
                variants={variants}
                sale={editTarget}
            />

            {/* Delete Confirmation Sheet */}
            <BottomSheet
                open={deleteTarget !== null}
                onClose={() => setDeleteTarget(null)}
                title="Hapus Penjualan?"
            >
                <p className="text-sm text-text-muted">
                    Penjualan ini akan dihapus dan stok akan dikembalikan.
                </p>
                <div className="mt-4 flex gap-2">
                    <button
                        type="button"
                        onClick={() => setDeleteTarget(null)}
                        className="flex h-12 flex-1 items-center justify-center rounded-xl border border-border text-sm font-semibold text-text active:opacity-80"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        onClick={handleDelete}
                        className="flex h-12 flex-1 items-center justify-center rounded-xl bg-red-600 text-sm font-bold text-white active:opacity-80"
                    >
                        Hapus
                    </button>
                </div>
            </BottomSheet>
        </OutletLayout>
    );
}
