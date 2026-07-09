import { router } from '@inertiajs/react';
import { useState, useMemo } from 'react';
import { Package } from 'lucide-react';
import CentralStockTab from './central-stock-tab';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import OwnerKpiStrip from '@/components/owner/owner-kpi-strip';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/empty-state';
import { SkeletonPage } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';

const TABS = [
    { key: 'pusat', label: 'Stok Pusat' },
    { key: 'outlet', label: 'Outlet' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function InventoriesIndex({ tab: initialTab, outletSections, stats, centralStock, centralStats }: any) {
    const [activeTab, setActiveTab] = useState<TabKey>((initialTab as TabKey) ?? 'pusat');

    if (!outletSections && !centralStock) {
        return (
            <OwnerPageShell title="Inventaris" subtitle="Monitor stok seluruh outlet">
                <SkeletonPage />
            </OwnerPageShell>
        );
    }

    const items = useMemo(() =>
        outletSections.flatMap((section: any) =>
            section.inventories.map((item: any) => ({
                ...item,
                outlet_name: section.outlet.name,
                outlet_id: section.outlet.id,
                health: section.health,
            }))
        ), [outletSections]);

    const [search, setSearch] = useState('');
    const [outletFilter, setOutletFilter] = useState<string>('all');

    const outlets = useMemo((): string[] => {
        const unique = [...new Set(items.map((item: any) => item.outlet_name as string))] as string[];
        return unique.sort();
    }, [items]);

    const filteredItems = useMemo(() => {
        let result = [...items];

        if (search) {
            const searchLower = search.toLowerCase();
            result = result.filter((item: any) =>
                item.outlet_name.toLowerCase().includes(searchLower) ||
                (item.variant?.name ?? item.product?.name ?? '').toLowerCase().includes(searchLower) ||
                (item.variant?.family?.name ?? '').toLowerCase().includes(searchLower)
            );
        }

        if (outletFilter !== 'all') {
            result = result.filter((item: any) => item.outlet_name === outletFilter);
        }

        return result;
    }, [items, search, outletFilter]);

    const handleTabChange = (t: TabKey) => {
        setActiveTab(t);
        router.get('/owner/inventories', { tab: t }, { preserveState: true, replace: true });
    };

    return (
        <OwnerPageShell
            title="Inventaris"
            subtitle="Pantau stok semua outlet dan pusat"
        >
            <div className="mb-5 inline-flex rounded-lg bg-surface-muted p-1">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        type="button"
                        onClick={() => handleTabChange(t.key)}
                        className={cn(
                            'relative rounded-lg px-5 py-2 text-sm font-semibold transition-all duration-200',
                            activeTab === t.key
                                ? 'bg-white text-text'
                                : 'text-text-muted hover:text-text',
                        )}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {activeTab === 'pusat' && (
                <CentralStockTab variants={centralStock} stats={centralStats} />
            )}

            {activeTab === 'outlet' && (
                <>
                    <OwnerKpiStrip items={[
                        { label: 'Total SKU', value: stats.totalSku, sublabel: 'Semua outlet', sublabelColor: 'text-text-subtle' },
                        { label: 'Stok Rendah', value: stats.lowStock, sublabel: stats.lowStock > 0 ? 'Perlu restock' : undefined, sublabelColor: 'text-amber-500' },
                        { label: 'Reserved', value: stats.totalReserved, sublabel: 'Dalam pesanan', sublabelColor: 'text-blue-500' },
                        { label: 'Kritis', value: stats.critical, sublabel: stats.critical > 0 ? 'Segera tindak!' : undefined, sublabelColor: 'text-red-500' },
                    ]} />

                    <OwnerFilterCard
                        collapsible
                        defaultExpanded={false}
                        searchPlaceholder="Cari outlet atau produk..."
                        searchValue={search}
                        onSearch={(val) => { setSearch(val); }}
                        outletOptions={outlets.map((outlet: string) => ({ value: outlet, label: outlet }))}
                        outletValue={outletFilter}
                        onOutletChange={(val) => { setOutletFilter(val); }}
                        tambahHref="/owner/inventories/create"
                        tambahLabel="Tambah Stok"
                    />

                    {filteredItems.length === 0 ? (
                        <EmptyState
                            icon={<Package className="h-8 w-8" />}
                            title="Tidak ada inventaris"
                            description={search || outletFilter !== 'all' ? 'Tidak ada item yang cocok dengan filter' : 'Belum ada inventaris tercatat'}
                        />
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-border">
                            <table className="w-full min-w-[600px]">
                                <thead>
                                    <tr className="bg-surface-muted">
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Produk / Outlet</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">Stok</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">Threshold</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Status</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredItems.map((row: any) => {
                                        const familyName = row.variant?.family?.name;
                                        const variantName = row.variant?.name ?? row.product?.name ?? '-';
                                        const available = row.current_stock - row.reserved_stock;
                                        const isCritical = available <= 0;
                                        const isLow = available > 0 && available <= row.minimum_stock;

                                        return (
                                            <tr key={row.id} className="border-t border-border transition-colors hover:bg-surface-muted">
                                                <td className="px-4 py-3">
                                                    {familyName && <span className="text-text-subtle">{familyName} </span>}
                                                    <span className="font-bold text-text">{variantName}</span>
                                                    <span className="ml-1 text-xs text-text-muted">{row.outlet_name}</span>
                                                </td>
                                                <td className="px-4 py-3 text-right font-semibold tabular-nums text-text">{row.current_stock}</td>
                                                <td className="px-4 py-3 text-right tabular-nums text-text-muted">{row.minimum_stock}</td>
                                                <td className="px-4 py-3">
                                                    <StatusBadge variant={isCritical ? 'danger' : isLow ? 'warning' : 'success'} size="sm">
                                                        {isCritical ? 'Kritis' : isLow ? 'Rendah' : 'Sehat'}
                                                    </StatusBadge>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {(isCritical || isLow) && (
                                                            <Button
                                                                size="sm"
                                                                onClick={() => router.visit(`/owner/restocks/create?outlet_id=${row.outlet_id}&product_id=${row.product_id ?? row.variant_id}&return_to=/owner/inventories`)}
                                                            >
                                                                Restock
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => router.visit(`/owner/inventories/${row.id}/edit`)}
                                                        >
                                                            Edit
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </OwnerPageShell>
    );
}
