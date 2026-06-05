import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import InventoryAdjustmentSheet from '@/components/owner/inventory-adjustment-sheet';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import DataTable from '@/components/ui/data-table';
import StatusBadge from '@/components/ui/status-badge';

export default function InventoriesIndex({ outletSections, stats }: any) {
    const [adjustItem, setAdjustItem] = useState<any>(null);

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

            {/* Mobile: outlet sections */}
            <div className="space-y-5 lg:hidden">
                {outletSections.map((section: any) => (
                    <OutletSection key={section.outlet.id} section={section} onAdjust={setAdjustItem} />
                ))}

                {outletSections.length === 0 && (
                    <div className="mt-8 flex flex-col items-center py-10 text-center">
                        <span className="text-3xl">📦</span>
                        <p className="mt-2 text-sm font-semibold text-slate-600">Tidak ada outlet aktif</p>
                    </div>
                )}
            </div>

            {/* Desktop: table */}
            <div className="hidden lg:block">
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
                            key: 'product_name',
                            label: 'Produk',
                            className: 'font-semibold text-slate-900',
                            render: (row: any) => row.product?.name ?? '-',
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
            </div>

            <InventoryAdjustmentSheet item={adjustItem} open={!!adjustItem} onClose={() => setAdjustItem(null)} />
        </OwnerPageShell>
    );
}

function OutletSection({ section, onAdjust }: { section: any; onAdjust?: (item: any) => void }) {
    const healthConfig = {
        healthy: { label: 'Sehat', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
        low_stock: { label: 'Stok Rendah', color: 'text-amber-700 bg-amber-50 border-amber-200' },
        critical: { label: 'Kritis', color: 'text-red-700 bg-red-50 border-red-200' },
    };
    const config = healthConfig[section.health as keyof typeof healthConfig] ?? healthConfig.healthy;

    return (
        <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div>
                    <div className="text-sm font-bold text-slate-900">{section.outlet.name}</div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                        {section.totalSku} SKU · {section.totalReserved} reserved
                        {section.critical > 0 && <span className="ml-1 text-red-600">· {section.critical} kritis</span>}
                    </div>
                </div>
                <StatusBadge variant={section.health === 'critical' ? 'danger' : section.health === 'low_stock' ? 'warning' : 'success'} size="sm">
                    {config.label}
                </StatusBadge>
            </div>

            <div className="divide-y divide-slate-50">
                {section.inventories.map((item: any) => (
                    <SkuRow key={item.id} item={item} onAdjust={onAdjust ? () => onAdjust(item) : undefined} />
                ))}
            </div>

            {section.inventories.length > 0 && (
                <div className="flex gap-2 border-t border-slate-100 px-4 py-2.5">
                    <Link href={`/owner/restocks?outlet_id=${section.outlet.id}`} className="flex-1 rounded-lg border border-slate-200 py-2 text-center text-xs font-semibold text-slate-600 transition-all active:bg-slate-50">
                        Restock
                    </Link>
                    <Link href="/owner/stock-movements" className="flex-1 rounded-lg border border-slate-200 py-2 text-center text-xs font-semibold text-slate-600 transition-all active:bg-slate-50">
                        Pergerakan
                    </Link>
                </div>
            )}
        </div>
    );
}

function SkuRow({ item, onAdjust }: { item: any; onAdjust?: () => void }) {
    const available = item.current_stock - item.reserved_stock;
    const isLow = available <= item.minimum_stock;
    const isCritical = available <= 0;
    const isWarning = item.reserved_stock > item.current_stock * 0.5;

    return (
        <div className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-slate-900">{item.product?.name ?? '-'}</div>
                <div className={`mt-0.5 text-[11px] ${isWarning ? 'text-amber-600' : 'text-slate-400'}`}>
                    {isWarning && '⚠ '}R:{item.reserved_stock} / C:{item.current_stock}
                </div>
            </div>
            <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tersedia</div>
                <div className={`text-lg font-bold tabular-nums ${isCritical ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-900'}`}>
                    {available}
                </div>
            </div>
            {onAdjust ? (
                <button onClick={onAdjust} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-all active:bg-slate-50">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
            ) : (
                <Link href={`/owner/inventories/${item.id}/edit`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-all active:bg-slate-50">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </Link>
            )}
        </div>
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
