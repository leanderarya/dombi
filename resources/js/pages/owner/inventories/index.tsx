import { Link, router } from '@inertiajs/react';
import { AlertTriangle, Box, Lock, XCircle } from 'lucide-react';
import OwnerKpiCard from '@/components/owner/owner-kpi-card';
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
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <OwnerKpiCard
                    icon={<Box className="h-5 w-5" />}
                    label="Total SKU"
                    value={stats.totalSku}
                />
                <OwnerKpiCard
                    icon={<AlertTriangle className="h-5 w-5" />}
                    label="Stok Rendah"
                    value={stats.lowStock}
                    color="warning"
                />
                <OwnerKpiCard
                    icon={<Lock className="h-5 w-5" />}
                    label="Reserved"
                    value={stats.totalReserved}
                    color="info"
                />
                <OwnerKpiCard
                    icon={<XCircle className="h-5 w-5" />}
                    label="Kritis"
                    value={stats.critical}
                    color="danger"
                />
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
