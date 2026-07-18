import { router, useForm } from '@inertiajs/react';
import { toast } from 'sonner';
import { Bell, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import OwnerKpiStrip from '@/components/owner/owner-kpi-strip';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import SortableTh from '@/components/owner/sortable-th';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import EmptyState from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { SkeletonPage } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { displayProductName } from '@/lib/display';
import CentralStockTab from './central-stock-tab';

const TABS = [
    { key: 'pusat', label: 'Stok Pusat' },
    { key: 'outlet', label: 'Outlet' },
] as const;
type TabKey = (typeof TABS)[number]['key'];
type SortKey = 'name' | 'total_stock' | 'status';
type SubSortKey = 'outlet_name' | 'current_stock' | 'minimum_stock' | 'status';

function getCsrfToken(): string {
    const el = document.querySelector(
        'meta[name="csrf-token"]',
    ) as HTMLMetaElement;
    return el?.content ?? '';
}

/** Aggregate grouped product data for the table */
function buildProductGroups(outletSections: any[]) {
    const map = new Map<
        number,
        {
            variantId: number;
            variant: any;
            outlets: any[];
            totalStock: number;
            criticalCount: number;
            lowCount: number;
            healthyCount: number;
            overallStatus: 'critical' | 'low' | 'healthy';
        }
    >();

    for (const section of outletSections ?? []) {
        for (const item of section.inventories ?? []) {
            const variantId = item.product_variant_id ?? item.variant?.id;
            if (!variantId) continue;

            const entry = map.get(variantId) ?? {
                variantId,
                variant: item.variant,
                outlets: [] as any[],
                totalStock: 0,
                criticalCount: 0,
                lowCount: 0,
                healthyCount: 0,
                overallStatus: 'healthy' as const,
            };

            const enriched = {
                ...item,
                outlet_name: section.outlet.name,
                outlet_id: section.outlet.id,
            };
            entry.outlets.push(enriched);

            const stock = item.current_stock ?? 0;
            const available = stock - (item.reserved_stock ?? 0);
            entry.totalStock += stock;
            if (available <= 0) entry.criticalCount++;
            else if (available <= (item.minimum_stock ?? 0)) entry.lowCount++;
            else entry.healthyCount++;

            map.set(variantId, entry);
        }
    }

    for (const entry of map.values()) {
        if (entry.criticalCount > 0) entry.overallStatus = 'critical';
        else if (entry.lowCount > 0) entry.overallStatus = 'low';
        else entry.overallStatus = 'healthy';
    }

    return Array.from(map.values());
}

export default function InventoriesIndex({
    tab: initialTab,
    outletSections,
    stats,
    centralStock,
    centralStats,
}: any) {
    const [activeTab, setActiveTab] = useState<TabKey>(
        (initialTab as TabKey) ?? 'pusat',
    );
    const [editItem, setEditItem] = useState<any>(null);
    const [search, setSearch] = useState('');
    const [outletFilter, setOutletFilter] = useState<string>('all');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
    const [remindedIds, setRemindedIds] = useState<Set<string>>(new Set());
    const [subSortKey, setSubSortKey] = useState<SubSortKey>('outlet_name');
    const [subSortDir, setSubSortDir] = useState<'asc' | 'desc'>('asc');
    const editForm = useForm({ current_stock: 0, minimum_stock: 0, notes: '' });

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const toggleSubSort = (key: SubSortKey) => {
        if (subSortKey === key) {
            setSubSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSubSortKey(key);
            setSubSortDir('asc');
        }
    };

    const handleEdit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editItem) return;
        editForm.put(`/owner/inventories/${editItem.id}`, {
            onSuccess: () => {
                setEditItem(null);
                editForm.reset();
            },
        });
    };

    const handleTabChange = (t: TabKey) => {
        setActiveTab(t);
        router.get(
            '/owner/inventories',
            { tab: t },
            { preserveState: true, replace: true },
        );
    };

    if (!outletSections && !centralStock) {
        return (
            <OwnerPageShell
                title="Inventaris"
                subtitle="Pantau stok semua outlet dan pusat"
            >
                <SkeletonPage />
            </OwnerPageShell>
        );
    }

    const outletList = useMemo(
        () =>
            (outletSections ?? []).map((s: any) => ({
                id: s.outlet.id,
                name: s.outlet.name,
            })),
        [outletSections],
    );

    const productGroups = useMemo(
        () => buildProductGroups(outletSections),
        [outletSections],
    );

    const filtered = useMemo(() => {
        let result = [...productGroups];

        if (search) {
            const q = search.toLowerCase();
            result = result.filter((g) => {
                const name = displayProductName(g.variant).toLowerCase();
                return (
                    name.includes(q) ||
                    (g.variant?.sku ?? '').toLowerCase().includes(q) ||
                    g.outlets.some((o: any) =>
                        o.outlet_name.toLowerCase().includes(q),
                    )
                );
            });
        }

        if (outletFilter !== 'all') {
            result = result.filter((g) =>
                g.outlets.some((o: any) => o.outlet_name === outletFilter),
            );
        }

        return result;
    }, [productGroups, search, outletFilter]);

    const sorted = useMemo(
        () =>
            [...filtered].sort((a, b) => {
                let av: any, bv: any;
                const statusToNum = (s: string) =>
                    s === 'critical' ? 0 : s === 'low' ? 1 : 2;

                switch (sortKey) {
                    case 'name':
                        av = displayProductName(a.variant);
                        bv = displayProductName(b.variant);
                        break;
                    case 'total_stock':
                        av = a.totalStock;
                        bv = b.totalStock;
                        break;
                    case 'status':
                        av = statusToNum(a.overallStatus);
                        bv = statusToNum(b.overallStatus);
                        break;
                    default:
                        av = displayProductName(a.variant);
                        bv = displayProductName(b.variant);
                }
                const cmp =
                    typeof av === 'string'
                        ? av.localeCompare(String(bv))
                        : Number(av) - Number(bv);
                return sortDir === 'asc' ? cmp : -cmp;
            }),
        [filtered, sortKey, sortDir],
    );

    const toggleExpand = (variantId: number) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(variantId)) next.delete(variantId);
            else next.add(variantId);
            return next;
        });
    };

    const handleRemind = (
        row: any,
        variantName: string,
        isCritical: boolean,
    ) => {
        const outlet = outletList.find((o: any) => o.id === row.outlet_id);
        const variantId = row.product_variant_id ?? row.variant?.id;

        fetch('/owner/inventories/remind-stock', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': getCsrfToken(),
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify({
                outlet_id: row.outlet_id,
                product_variant_id: variantId,
            }),
        })
            .then((r) => r.json())
            .then(() => {
                const remindKey = `${row.outlet_id}-${variantId}`;
                setRemindedIds((prev) => new Set(prev).add(remindKey));
                toast.success(
                    `Outlet ${outlet?.name ?? row.outlet_name} diingatkan`,
                    {
                        description: `Notifikasi stok ${variantName} ${isCritical ? 'kritis' : 'rendah'} terkirim ke outlet.`,
                        duration: 4000,
                    },
                );
            })
            .catch(() => toast.error('Gagal mengirim pengingat.'));
    };

    return (
        <OwnerPageShell
            title="Inventaris"
            subtitle="Pantau stok semua outlet dan pusat"
        >
            <div
                className="mb-5 inline-flex rounded-lg bg-surface-muted p-1"
                role="tablist"
            >
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === t.key}
                        onClick={() => handleTabChange(t.key)}
                        className={cn(
                            'relative rounded-lg px-5 py-2 text-sm font-semibold transition-all duration-200',
                            activeTab === t.key
                                ? 'bg-surface text-text'
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
                    <OwnerKpiStrip
                        cols={4}
                        items={[
                            { label: 'Total SKU', value: stats.totalSku },
                            {
                                label: 'Stok Kritis',
                                value: stats.critical,
                                sublabel:
                                    stats.critical > 0 ? '≤ 2 pcs' : undefined,
                                sublabelColor: 'text-red-500',
                            },
                            {
                                label: 'Stok Rendah',
                                value: stats.lowStock,
                                sublabel:
                                    stats.lowStock > 0
                                        ? '≤ minimum'
                                        : undefined,
                                sublabelColor: 'text-amber-500',
                            },
                            {
                                label: 'Stok Sehat',
                                value: stats.totalSku - stats.lowStock,
                            },
                        ]}
                    />

                    <OwnerFilterCard
                        collapsible
                        defaultExpanded={false}
                        searchPlaceholder="Cari produk atau outlet..."
                        searchValue={search}
                        onSearch={setSearch}
                    >
                        <select
                            value={outletFilter}
                            onChange={(e) => setOutletFilter(e.target.value)}
                            className="h-8 rounded-md border border-border bg-surface px-2 text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                        >
                            <option value="all">Semua Outlet</option>
                            {outletList.map((o: any) => (
                                <option key={o.id} value={o.name}>
                                    {o.name}
                                </option>
                            ))}
                        </select>
                    </OwnerFilterCard>

                    {sorted.length === 0 ? (
                        <EmptyState
                            title="Tidak ditemukan"
                            description="Coba ubah filter atau kata kunci"
                        />
                    ) : (
                        <div className="overflow-x-auto rounded-xl bg-surface shadow-card">
                            <table
                                className="w-full min-w-[700px]"
                                aria-label="Stok Outlet — Grup per Produk"
                            >
                                <thead>
                                    <tr className="bg-surface-muted/50">
                                        <th className="w-8 px-3 py-2.5" />
                                        <SortableTh
                                            label="Produk"
                                            active={sortKey === 'name'}
                                            dir={sortDir}
                                            onClick={() => toggleSort('name')}
                                        />
                                        <th className="px-3 py-2.5 text-xs font-semibold tracking-wide text-text-muted uppercase">
                                            Status Outlet
                                        </th>
                                        <SortableTh
                                            label="Total Stok"
                                            active={sortKey === 'total_stock'}
                                            dir={sortDir}
                                            align="right"
                                            onClick={() =>
                                                toggleSort('total_stock')
                                            }
                                        />
                                        <SortableTh
                                            label="Status"
                                            active={sortKey === 'status'}
                                            dir={sortDir}
                                            onClick={() => toggleSort('status')}
                                        />
                                    </tr>
                                </thead>
                                <tbody>
                                    {sorted.map((group) => {
                                        const isExpanded = expandedIds.has(
                                            group.variantId,
                                        );
                                        const productName = displayProductName(
                                            group.variant,
                                        );
                                        const statusVariant =
                                            group.overallStatus === 'critical'
                                                ? 'danger'
                                                : group.overallStatus === 'low'
                                                  ? 'warning'
                                                  : 'success';
                                        const statusLabel =
                                            group.overallStatus === 'critical'
                                                ? 'Kritis'
                                                : group.overallStatus === 'low'
                                                  ? 'Rendah'
                                                  : 'Sehat';

                                        const sortedOutlets = [
                                            ...group.outlets,
                                        ].sort((a: any, b: any) => {
                                            let av: any, bv: any;
                                            switch (subSortKey) {
                                                case 'outlet_name':
                                                    av = a.outlet_name;
                                                    bv = b.outlet_name;
                                                    break;
                                                case 'current_stock':
                                                    av = a.current_stock;
                                                    bv = b.current_stock;
                                                    break;
                                                case 'minimum_stock':
                                                    av = a.minimum_stock;
                                                    bv = b.minimum_stock;
                                                    break;
                                                case 'status':
                                                    av =
                                                        a.current_stock <= 2
                                                            ? 0
                                                            : a.current_stock <=
                                                                (a.minimum_stock ??
                                                                    0)
                                                              ? 1
                                                              : 2;
                                                    bv =
                                                        b.current_stock <= 2
                                                            ? 0
                                                            : b.current_stock <=
                                                                (b.minimum_stock ??
                                                                    0)
                                                              ? 1
                                                              : 2;
                                                    break;
                                                default:
                                                    av = a.outlet_name;
                                                    bv = b.outlet_name;
                                            }
                                            const cmp =
                                                typeof av === 'string'
                                                    ? av.localeCompare(
                                                          String(bv),
                                                      )
                                                    : Number(av) - Number(bv);
                                            return subSortDir === 'asc'
                                                ? cmp
                                                : -cmp;
                                        });

                                        return (
                                            <>
                                                <tr
                                                    key={group.variantId}
                                                    className="hover:bg-mint-wash cursor-pointer border-t border-border/20 transition-colors"
                                                    onClick={() =>
                                                        toggleExpand(
                                                            group.variantId,
                                                        )
                                                    }
                                                >
                                                    <td className="px-3 py-3 text-center">
                                                        {isExpanded ? (
                                                            <ChevronDown className="mx-auto h-4 w-4 text-text-muted" />
                                                        ) : (
                                                            <ChevronRight className="mx-auto h-4 w-4 text-text-muted" />
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <span className="font-bold text-text">
                                                            {productName}
                                                        </span>
                                                        {group.variant?.sku && (
                                                            <span className="ml-1 text-xs text-text-muted">
                                                                {
                                                                    group
                                                                        .variant
                                                                        .sku
                                                                }
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="flex gap-0.5">
                                                                {group.outlets.map(
                                                                    (
                                                                        o: any,
                                                                    ) => {
                                                                        const s =
                                                                            o.current_stock <=
                                                                            2
                                                                                ? 'critical'
                                                                                : o.current_stock <=
                                                                                    (o.minimum_stock ??
                                                                                        0)
                                                                                  ? 'low'
                                                                                  : 'healthy';
                                                                        return (
                                                                            <span
                                                                                key={
                                                                                    o.id
                                                                                }
                                                                                className={cn(
                                                                                    'h-2.5 w-2.5 rounded-full',
                                                                                    s ===
                                                                                        'critical'
                                                                                        ? 'bg-red-500'
                                                                                        : s ===
                                                                                            'low'
                                                                                          ? 'bg-amber-400'
                                                                                          : 'bg-emerald-500',
                                                                                )}
                                                                                title={`${o.outlet_name}: ${o.current_stock} pcs`}
                                                                            />
                                                                        );
                                                                    },
                                                                )}
                                                            </div>
                                                            <span className="text-xs text-text-muted">
                                                                {
                                                                    group
                                                                        .outlets
                                                                        .length
                                                                }{' '}
                                                                outlet
                                                                {group.criticalCount >
                                                                    0 &&
                                                                    ` · ${group.criticalCount} kritis`}
                                                                {group.lowCount >
                                                                    0 &&
                                                                    ` · ${group.lowCount} rendah`}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td
                                                        className={cn(
                                                            'px-3 py-3 text-right font-bold tabular-nums',
                                                            group.overallStatus ===
                                                                'critical'
                                                                ? 'text-red-600'
                                                                : group.overallStatus ===
                                                                    'low'
                                                                  ? 'text-amber-600'
                                                                  : 'text-emerald-600',
                                                        )}
                                                    >
                                                        {group.totalStock} pcs
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <StatusBadge
                                                            variant={
                                                                statusVariant
                                                            }
                                                            size="sm"
                                                        >
                                                            {statusLabel}
                                                        </StatusBadge>
                                                    </td>
                                                </tr>

                                                {isExpanded && (
                                                    <tr
                                                        key={`${group.variantId}-sub`}
                                                        className="border-t border-border/50 bg-surface-muted/30"
                                                    >
                                                        <td
                                                            colSpan={5}
                                                            className="px-0 py-0"
                                                        >
                                                            <div className="overflow-x-auto">
                                                                <table
                                                                    className="w-full min-w-[600px]"
                                                                    aria-label={`Detail stok ${productName} per outlet`}
                                                                >
                                                                    <thead>
                                                                        <tr className="border-b border-border/50 bg-surface-muted/50 text-xs">
                                                                            <th className="w-8 px-3 py-2" />
                                                                            <SortableTh
                                                                                label="Outlet"
                                                                                active={
                                                                                    subSortKey ===
                                                                                    'outlet_name'
                                                                                }
                                                                                dir={
                                                                                    subSortDir
                                                                                }
                                                                                onClick={() =>
                                                                                    toggleSubSort(
                                                                                        'outlet_name',
                                                                                    )
                                                                                }
                                                                            />
                                                                            <SortableTh
                                                                                label="Stok"
                                                                                active={
                                                                                    subSortKey ===
                                                                                    'current_stock'
                                                                                }
                                                                                dir={
                                                                                    subSortDir
                                                                                }
                                                                                align="right"
                                                                                onClick={() =>
                                                                                    toggleSubSort(
                                                                                        'current_stock',
                                                                                    )
                                                                                }
                                                                            />
                                                                            <SortableTh
                                                                                label="Min"
                                                                                active={
                                                                                    subSortKey ===
                                                                                    'minimum_stock'
                                                                                }
                                                                                dir={
                                                                                    subSortDir
                                                                                }
                                                                                align="right"
                                                                                onClick={() =>
                                                                                    toggleSubSort(
                                                                                        'minimum_stock',
                                                                                    )
                                                                                }
                                                                            />
                                                                            <SortableTh
                                                                                label="Status"
                                                                                active={
                                                                                    subSortKey ===
                                                                                    'status'
                                                                                }
                                                                                dir={
                                                                                    subSortDir
                                                                                }
                                                                                onClick={() =>
                                                                                    toggleSubSort(
                                                                                        'status',
                                                                                    )
                                                                                }
                                                                            />
                                                                            <th className="w-40 px-3 py-2 text-right">
                                                                                Aksi
                                                                            </th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {sortedOutlets.map(
                                                                            (
                                                                                row: any,
                                                                            ) => {
                                                                                const isCritical =
                                                                                    row.current_stock <=
                                                                                    2;
                                                                                const isLow =
                                                                                    !isCritical &&
                                                                                    row.current_stock <=
                                                                                        (row.minimum_stock ??
                                                                                            0);
                                                                                const variantName =
                                                                                    displayProductName(
                                                                                        row.variant,
                                                                                    );
                                                                                const remindKey = `${row.outlet_id}-${row.product_variant_id ?? row.variant?.id}`;
                                                                                const reminded =
                                                                                    remindedIds.has(
                                                                                        remindKey,
                                                                                    );

                                                                                return (
                                                                                    <tr
                                                                                        key={
                                                                                            row.id
                                                                                        }
                                                                                        className="hover:bg-mint-wash border-t border-border/30 transition-colors"
                                                                                    >
                                                                                        <td className="px-3 py-2.5" />
                                                                                        <td className="px-3 py-2.5 text-sm font-medium text-text">
                                                                                            {
                                                                                                row.outlet_name
                                                                                            }
                                                                                        </td>
                                                                                        <td
                                                                                            className={cn(
                                                                                                'px-3 py-2.5 text-right font-bold tabular-nums',
                                                                                                isCritical
                                                                                                    ? 'text-red-600'
                                                                                                    : isLow
                                                                                                      ? 'text-amber-600'
                                                                                                      : 'text-emerald-600',
                                                                                            )}
                                                                                        >
                                                                                            {
                                                                                                row.current_stock
                                                                                            }
                                                                                        </td>
                                                                                        <td className="px-3 py-2.5 text-right text-text-muted tabular-nums">
                                                                                            {
                                                                                                row.minimum_stock
                                                                                            }
                                                                                        </td>
                                                                                        <td className="px-3 py-2.5">
                                                                                            <StatusBadge
                                                                                                variant={
                                                                                                    isCritical
                                                                                                        ? 'danger'
                                                                                                        : isLow
                                                                                                          ? 'warning'
                                                                                                          : 'success'
                                                                                                }
                                                                                                size="sm"
                                                                                            >
                                                                                                {isCritical
                                                                                                    ? 'Kritis'
                                                                                                    : isLow
                                                                                                      ? 'Rendah'
                                                                                                      : 'Sehat'}
                                                                                            </StatusBadge>
                                                                                        </td>
                                                                                        <td className="px-3 py-2.5 text-right">
                                                                                            <div className="flex items-center justify-end gap-1">
                                                                                                {(isCritical ||
                                                                                                    isLow) &&
                                                                                                    (reminded ? (
                                                                                                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                                                                                                            <Check className="h-3 w-3" />{' '}
                                                                                                            Terkirim
                                                                                                        </span>
                                                                                                    ) : (
                                                                                                        <Button
                                                                                                            size="sm"
                                                                                                            variant="secondary"
                                                                                                            onClick={(
                                                                                                                e,
                                                                                                            ) => {
                                                                                                                e.stopPropagation();
                                                                                                                handleRemind(
                                                                                                                    row,
                                                                                                                    variantName,
                                                                                                                    isCritical,
                                                                                                                );
                                                                                                            }}
                                                                                                        >
                                                                                                            <Bell className="mr-1 h-3 w-3" />
                                                                                                            Ingatkan
                                                                                                        </Button>
                                                                                                    ))}
                                                                                                <Button
                                                                                                    variant="ghost"
                                                                                                    size="sm"
                                                                                                    onClick={(
                                                                                                        e,
                                                                                                    ) => {
                                                                                                        e.stopPropagation();
                                                                                                        setEditItem(
                                                                                                            row,
                                                                                                        );
                                                                                                        editForm.setData(
                                                                                                            {
                                                                                                                current_stock:
                                                                                                                    row.current_stock,
                                                                                                                minimum_stock:
                                                                                                                    row.minimum_stock,
                                                                                                                notes: '',
                                                                                                            },
                                                                                                        );
                                                                                                    }}
                                                                                                >
                                                                                                    Edit
                                                                                                </Button>
                                                                                            </div>
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            },
                                                                        )}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            <Dialog
                open={editItem !== null}
                onOpenChange={() => setEditItem(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Stok</DialogTitle>
                        <DialogDescription>
                            {displayProductName(editItem?.variant)} —{' '}
                            {editItem?.outlet_name}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEdit} className="space-y-4">
                        <Input
                            label="Stok Saat Ini"
                            type="number"
                            min={0}
                            value={editForm.data.current_stock}
                            onChange={(e) =>
                                editForm.setData(
                                    'current_stock',
                                    Number(e.target.value),
                                )
                            }
                            error={editForm.errors.current_stock}
                        />
                        <Input
                            label="Stok Minimum"
                            type="number"
                            min={0}
                            value={editForm.data.minimum_stock}
                            onChange={(e) =>
                                editForm.setData(
                                    'minimum_stock',
                                    Number(e.target.value),
                                )
                            }
                            error={editForm.errors.minimum_stock}
                        />
                        <Textarea
                            label="Catatan"
                            value={editForm.data.notes}
                            onChange={(e) =>
                                editForm.setData('notes', e.target.value)
                            }
                            error={editForm.errors.notes}
                        />
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setEditItem(null)}
                            >
                                Batal
                            </Button>
                            <Button type="submit" loading={editForm.processing}>
                                Update
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </OwnerPageShell>
    );
}
