import { Head, Link } from '@inertiajs/react';
import { AlertTriangle, CheckCircle, Package } from 'lucide-react';
import SectionCard from '@/components/ui/section-card';
import EmptyState from '@/components/ui/empty-state';
import StatusBadge from '@/components/ui/status-badge';
import OutletLayout from '@/layouts/outlet-layout';

export default function OutletInventory({ outlet, inventories }: any) {
    // Group by urgency
    const critical = inventories.filter((i: any) => (i.current_stock - i.reserved_stock) <= 0);
    const lowStock = inventories.filter((i: any) => {
        const available = i.current_stock - i.reserved_stock;
        return available > 0 && available <= i.minimum_stock;
    });
    const healthy = inventories.filter((i: any) => (i.current_stock - i.reserved_stock) > i.minimum_stock);

    return (
        <OutletLayout title="Inventaris" subtitle={outlet.name}>
            <Head title="Inventaris" />

            {/* Summary */}
            <div className="mb-4 grid grid-cols-3 gap-2">
                <SummaryCard label="Kritis" value={critical.length} variant="danger" />
                <SummaryCard label="Rendah" value={lowStock.length} variant="warning" />
                <SummaryCard label="Sehat" value={healthy.length} variant="success" />
            </div>

            {/* Restock CTA */}
            <Link href="/outlet/restocks/create" className="mb-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 text-sm font-semibold text-white active:bg-emerald-800">
                <Package className="h-4 w-4" />
                Request Restock
            </Link>

            {/* Critical */}
            {critical.length > 0 && (
                <SectionCard label="Stok Kritis" className="mb-4">
                    <div className="mt-2 space-y-2">
                        {critical.map((item: any) => (
                            <InventoryRow key={item.id} item={item} variant="danger" />
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* Low Stock */}
            {lowStock.length > 0 && (
                <SectionCard label="Stok Rendah" className="mb-4">
                    <div className="mt-2 space-y-2">
                        {lowStock.map((item: any) => (
                            <InventoryRow key={item.id} item={item} variant="warning" />
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* Healthy */}
            {healthy.length > 0 && (
                <SectionCard label="Stok Sehat" className="mb-4">
                    <div className="mt-2 space-y-2">
                        {healthy.map((item: any) => (
                            <InventoryRow key={item.id} item={item} variant="success" />
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* Empty State */}
            {inventories.length === 0 && (
                <EmptyState
                    icon="📦"
                    title="Belum ada inventaris"
                    description="Inventaris akan muncul setelah produk ditambahkan ke outlet."
                    action={{ label: 'Request Restock', href: '/outlet/restocks/create' }}
                />
            )}
        </OutletLayout>
    );
}

function SummaryCard({ label, value, variant }: { label: string; value: number; variant: 'danger' | 'warning' | 'success' }) {
    const iconMap = {
        danger: <AlertTriangle className="h-4 w-4 text-red-500" />,
        warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
        success: <CheckCircle className="h-4 w-4 text-emerald-500" />,
    };

    return (
        <div className="rounded-lg border border-zinc-200 bg-white p-2.5 text-center">
            <div className="flex items-center justify-center gap-1">
                {iconMap[variant]}
                <span className="text-lg font-bold text-slate-900">{value}</span>
            </div>
            <div className="text-[10px] font-semibold uppercase text-slate-500">{label}</div>
        </div>
    );
}

function InventoryRow({ item, variant }: { item: any; variant: 'danger' | 'warning' | 'success' }) {
    const available = item.current_stock - item.reserved_stock;

    return (
        <div className="flex items-center justify-between rounded-lg border border-zinc-100 bg-white p-3">
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">{item.product?.name ?? '-'}</span>
                    <StatusBadge variant={variant} size="sm">
                        {variant === 'danger' ? 'Kritis' : variant === 'warning' ? 'Rendah' : 'Sehat'}
                    </StatusBadge>
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                    Tersedia: {available} · Min: {item.minimum_stock}
                </div>
            </div>
        </div>
    );
}
