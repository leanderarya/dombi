import { Link, router } from '@inertiajs/react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import DataTable from '@/components/ui/data-table';
import StatusBadge from '@/components/ui/status-badge';

export default function InventoriesIndex({ outletSections, stats }: any) {
    // Flatten all inventory items for desktop table
    const allItems = outletSections.flatMap((section: any) =>
        section.inventories.map((item: any) => ({
            ...item,
            outlet_name: section.outlet.name,
            outlet_id: section.outlet.id,
            health: section.health,
        }))
    );

    return (
        <OwnerPageShell
            title="Inventaris"
            headerRight={
                <Link href="/owner/inventories/create" className="flex h-9 items-center rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-800">
                    + Tambah Stok
                </Link>
            }
        >
            {/* KPI Summary */}
            <div className="mb-4 grid grid-cols-4 gap-2">
                <KpiMini label="Total SKU" value={stats.totalSku} />
                <KpiMini label="Stok Rendah" value={stats.lowStock} color="amber" />
                <KpiMini label="Reserved" value={stats.totalReserved} color="blue" />
                <KpiMini label="Kritis" value={stats.critical} color="red" />
            </div>

            <DataTable
                rowKey="id"
                data={allItems}
                columns={[
                    {
                        key: 'outlet_name',
                        label: 'Outlet',
                        className: 'font-medium text-slate-900',
                    },
                    {
                        key: 'variant_name',
                        label: 'Produk',
                        className: 'font-semibold text-slate-900',
                        render: (row: any) => {
                            const familyName = row.variant?.family?.name;
                            const variantName = row.variant?.name ?? row.product?.name ?? '-';
                            return (
                                <div>
                                    {familyName && <div className="text-[11px] text-slate-400">{familyName}</div>}
                                    <div>{variantName}</div>
                                </div>
                            );
                        },
                    },
                    {
                        key: 'current_stock',
                        label: 'Stok Saat Ini',
                        className: 'tabular-nums',
                    },
                    {
                        key: 'reserved_stock',
                        label: 'Reserved',
                        className: 'tabular-nums',
                    },
                    {
                        key: 'available',
                        label: 'Tersedia',
                        className: 'font-bold tabular-nums',
                        render: (row: any) => {
                            const available = row.current_stock - row.reserved_stock;
                            const isCritical = available <= 0;
                            const isLow = available <= row.minimum_stock;
                            return <span className={isCritical ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-900'}>{available}</span>;
                        },
                    },
                    {
                        key: 'status',
                        label: 'Status',
                        render: (row: any) => {
                            const available = row.current_stock - row.reserved_stock;
                            const isCritical = available <= 0;
                            const isLow = available <= row.minimum_stock;
                            return (
                                <StatusBadge variant={isCritical ? 'danger' : isLow ? 'warning' : 'success'} size="sm">
                                    {isCritical ? 'Kritis' : isLow ? 'Rendah' : 'Sehat'}
                                </StatusBadge>
                            );
                        },
                    },
                ]}
                actions={[
                    {
                        label: 'Edit',
                        variant: 'secondary',
                        onClick: (row) => router.visit(`/owner/inventories/${row.id}/edit`),
                    },
                ]}
                emptyMessage="Belum ada inventaris"
                emptyAction={{ label: 'Tambah Stok', href: '/owner/inventories/create' }}
            />
        </OwnerPageShell>
    );
}

function KpiMini({ label, value, color }: { label: string; value: number; color?: string }) {
    const textColor = color === 'red' ? 'text-red-600' : color === 'amber' ? 'text-amber-600' : color === 'blue' ? 'text-blue-600' : 'text-slate-900';
    return (
        <div className="rounded-lg border border-slate-200 bg-white p-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
            <div className={`mt-0.5 text-xl font-bold tabular-nums ${textColor}`}>{value}</div>
        </div>
    );
}
