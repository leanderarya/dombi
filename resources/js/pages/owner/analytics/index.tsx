import { Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowDownRight,
    ArrowUpRight,
    CheckCircle,
    ChevronDown,
    ClipboardList,
    DollarSign,
    Download,
    TrendingDown,
    TrendingUp,
    Truck,
    X,
    XCircle,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import FilterSheet from '@/components/owner/filter-sheet';
import { HeaderIconButton, FilterIcon } from '@/components/owner/header-icon-utils';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import Pagination from '@/components/pagination';
import EmptyState from '@/components/ui/empty-state';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency, formatDate } from '@/lib/format';

/* ------------------------------------------------------------------ */
/*  Tab configuration                                                  */
/* ------------------------------------------------------------------ */

const TABS = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'audit', label: 'Audit Trail' },
    { key: 'laporan', label: 'Laporan' },
    { key: 'masalah', label: 'Masalah' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

/* ------------------------------------------------------------------ */
/*  Shared types                                                       */
/* ------------------------------------------------------------------ */

interface OutletRevenue {
    outlet_id: number;
    outlet: { id: number; name: string };
    revenue: number;
    orders: number;
}

interface TopProduct {
    product_name: string;
    total_qty: number;
    total_revenue: number;
}

interface TrendData {
    value: number;
    positive: boolean;
}

interface KpiData {
    total_revenue: number;
    total_orders: number;
    active_outlets: number;
    total_revenue_trend?: TrendData;
    total_orders_trend?: TrendData;
    active_outlets_trend?: TrendData;
}

interface ReportSummary {
    totalOrders: number;
    totalRevenue: number;
    completedOrders: number;
    cancelledOrders: number;
    completedDeliveries: number;
    failedDeliveries: number;
}

interface Props {
    /* Dashboard tab */
    kpis?: KpiData;
    outletRevenue?: OutletRevenue[];
    topProducts?: TopProduct[];
    period?: string;
    insight?: string;

    /* Audit Trail tab */
    movements?: any;
    outlets?: any[];
    products?: any[];
    filters?: Record<string, any>;

    /* Laporan tab */
    summary?: ReportSummary;
    ordersByStatus?: Record<string, number>;
    deliveriesByStatus?: Record<string, number>;

    /* Masalah tab */
    reports?: any;
}

/* ------------------------------------------------------------------ */
/*  Main page component                                                */
/* ------------------------------------------------------------------ */

export default function AnalyticsIndex(props: Props) {
    const [activeTab, setActiveTab] = useState<TabKey>('dashboard');

    // Sync tab state with URL search params
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab && TABS.some((t) => t.key === tab)) {
            setActiveTab(tab as TabKey);
        }
    }, []);

    const handleTabChange = (tab: TabKey) => {
        setActiveTab(tab);
        router.get('/owner/analytics', { tab }, { preserveState: true, replace: true });
    };

    return (
        <OwnerPageShell title="Analitik" subtitle="Analitik performa bisnis">
            {/* Tab Pills */}
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => handleTabChange(tab.key)}
                        className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                            activeTab === tab.key
                                ? 'bg-primary text-white shadow-sm shadow-primary/20'
                                : 'bg-surface-muted text-text-muted hover:bg-zinc-200'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'dashboard' && <DashboardTab {...props} />}
            {activeTab === 'audit' && <AuditTrailTab {...props} />}
            {activeTab === 'laporan' && <LaporanTab {...props} />}
            {activeTab === 'masalah' && <MasalahTab {...props} />}
        </OwnerPageShell>
    );
}

/* ================================================================== */
/*  TAB 1: Dashboard                                                   */
/* ================================================================== */

const periods = [
    { key: 'today', label: 'Hari Ini' },
    { key: 'week', label: 'Minggu Ini' },
    { key: 'month', label: 'Bulan Ini' },
];

function DashboardTab({ kpis, outletRevenue = [], topProducts = [], period = 'today', insight }: Props) {
    const [insightDismissed, setInsightDismissed] = useState(false);

    const handlePeriodChange = (newPeriod: string) => {
        router.get('/owner/analytics', { period: newPeriod, tab: 'dashboard' }, { preserveState: true });
    };

    const periodLabel = period === 'today' ? 'hari ini' : period === 'week' ? 'minggu lalu' : 'bulan lalu';

    return (
        <div className="space-y-4">
            {/* Period selector */}
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                {periods.map((p) => (
                    <button
                        key={p.key}
                        onClick={() => handlePeriodChange(p.key)}
                        className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                            period === p.key
                                ? 'bg-primary text-white'
                                : 'bg-surface-muted text-text-muted active:bg-surface-muted'
                        }`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* Insight banner */}
            {insight && !insightDismissed && (
                <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary-light p-3">
                    <TrendingUp className="h-4 w-4 shrink-0 text-primary" />
                    <p className="flex-1 text-xs font-medium text-primary">{insight}</p>
                    <button onClick={() => setInsightDismissed(true)} className="shrink-0 text-primary/60 hover:text-primary">
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}

            {/* Mobile KPI grid */}
            {kpis && (
                <div className="grid grid-cols-3 gap-3 lg:hidden">
                    <KpiCard label="Total Revenue" value={formatCurrency(kpis.total_revenue)} trend={kpis.total_revenue_trend} periodLabel={periodLabel} />
                    <KpiCard label="Total Orders" value={String(kpis.total_orders)} trend={kpis.total_orders_trend} periodLabel={periodLabel} />
                    <KpiCard label="Active Outlets" value={String(kpis.active_outlets)} trend={kpis.active_outlets_trend} periodLabel={periodLabel} />
                </div>
            )}

            {/* Desktop 2-column layout */}
            <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
                {/* Left: outlet comparison + top products */}
                <div className="space-y-4">
                    <div className="rounded-xl border border-border bg-white p-4 transition-shadow hover:shadow-sm">
                        <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-text-muted">Perbandingan Outlet</div>
                        {outletRevenue.length === 0 ? (
                            <p className="py-4 text-center text-sm text-text-muted">Belum ada data</p>
                        ) : (
                            <div className="space-y-3">
                                {outletRevenue.map((item) => (
                                    <Link
                                        key={item.outlet_id}
                                        href={`/owner/outlets/${item.outlet_id}`}
                                        className="-m-1.5 flex items-center justify-between rounded-lg p-1.5 transition-colors hover:bg-surface-muted"
                                    >
                                        <div>
                                            <div className="text-sm font-medium text-text">{item.outlet.name}</div>
                                            <div className="text-[11px] text-text-muted">{item.orders} orders</div>
                                        </div>
                                        <div className="text-sm font-semibold tabular-nums text-text">{formatCurrency(item.revenue)}</div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="rounded-xl border border-border bg-white p-4 transition-shadow hover:shadow-sm">
                        <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-text-muted">Produk Terlaris</div>
                        {topProducts.length === 0 ? (
                            <p className="py-4 text-center text-sm text-text-muted">Belum ada data</p>
                        ) : (
                            <div className="space-y-3">
                                {topProducts.map((product, index) => (
                                    <Link
                                        key={product.product_name}
                                        href={`/owner/inventories?product=${encodeURIComponent(product.product_name)}`}
                                        className="-m-1.5 flex items-center justify-between rounded-lg p-1.5 transition-colors hover:bg-surface-muted"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-muted text-[11px] font-bold text-text-muted">
                                                {index + 1}
                                            </span>
                                            <div>
                                                <div className="text-sm font-medium text-text">{product.product_name}</div>
                                                <div className="text-[11px] text-text-muted">{product.total_qty} unit</div>
                                            </div>
                                        </div>
                                        <div className="text-sm font-semibold tabular-nums text-text">{formatCurrency(product.total_revenue)}</div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: KPI sidebar (desktop only, sticky) */}
                {kpis && (
                    <div className="hidden lg:block">
                        <div className="sticky top-4 space-y-3">
                            <KpiCard label="Total Revenue" value={formatCurrency(kpis.total_revenue)} trend={kpis.total_revenue_trend} periodLabel={periodLabel} />
                            <KpiCard label="Total Orders" value={String(kpis.total_orders)} trend={kpis.total_orders_trend} periodLabel={periodLabel} />
                            <KpiCard label="Active Outlets" value={String(kpis.active_outlets)} trend={kpis.active_outlets_trend} periodLabel={periodLabel} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function KpiCard({ label, value, trend, periodLabel }: { label: string; value: string; trend?: TrendData; periodLabel: string }) {
    return (
        <div className="rounded-xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-sm hover:border-border/60">
            <div className="text-[11px] font-medium text-text-muted">{label}</div>
            <div className="mt-1 text-lg font-bold tabular-nums text-text">{value}</div>
            {trend && (
                <div className="mt-1.5 flex items-center gap-1">
                    {trend.positive ? (
                        <TrendingUp className="h-3 w-3 text-emerald-600" />
                    ) : (
                        <TrendingDown className="h-3 w-3 text-red-500" />
                    )}
                    <span className={`text-[10px] font-semibold ${trend.positive ? 'text-emerald-600' : 'text-red-500'}`}>
                        {trend.positive ? '+' : ''}
                        {trend.value}%
                    </span>
                    <span className="text-[10px] text-text-muted">vs {periodLabel}</span>
                </div>
            )}
        </div>
    );
}

/* ================================================================== */
/*  TAB 2: Audit Trail (from stock-movements)                          */
/* ================================================================== */

const typeLabels: Record<string, string> = {
    initial_stock: 'Stok Awal',
    stock_adjustment: 'Penyesuaian',
    order_reserved: 'Direservasi',
    order_completed: 'Selesai',
    order_cancelled: 'Dibatalkan',
    restock_in: 'Restock Masuk',
    delivery_returned: 'Dikembalikan',
};
const typeColors: Record<string, string> = {
    initial_stock: 'text-text-muted',
    stock_adjustment: 'text-amber-700',
    order_reserved: 'text-blue-700',
    order_completed: 'text-emerald-700',
    order_cancelled: 'text-red-700',
    restock_in: 'text-emerald-700',
    delivery_returned: 'text-purple-700',
};
const typeOptions = Object.entries(typeLabels).map(([k, v]) => ({ value: k, label: v }));

function AuditTrailTab({ movements, outlets = [], products = [], filters = {} }: Props) {
    const [filterOpen, setFilterOpen] = useState(false);
    const activeFilterCount = [filters.outlet_id, filters.product_id, filters.type].filter(Boolean).length;

    const handleFilterApply = (f: Record<string, string>) => {
        router.get(
            '/owner/stock-movements',
            {
                outlet_id: f.outlet_id || undefined,
                product_id: f.product_id || undefined,
                type: f.type || undefined,
                date_from: filters.date_from,
                date_to: filters.date_to,
            },
            { preserveState: true, replace: true },
        );
    };

    if (!movements || movements.data.length === 0) {
        return (
            <EmptyState
                icon={<ClipboardList className="h-8 w-8 text-text-subtle" />}
                title="Belum ada movement"
                description="Perubahan stok akan tercatat di sini."
            />
        );
    }

    return (
        <div className="space-y-4">
            {/* Filter button */}
            <div className="flex justify-end">
                <div className="relative">
                    <HeaderIconButton label="Filter" onClick={() => setFilterOpen(true)}>
                        <FilterIcon />
                    </HeaderIconButton>
                    {activeFilterCount > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 text-[11px] font-bold text-white">
                            {activeFilterCount}
                        </span>
                    )}
                </div>
            </div>

            <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
                {/* Left: movement list */}
                <div className="space-y-1.5">
                    {movements.data.map((m: any) => (
                        <div
                            key={m.id}
                            className="flex items-center gap-3 rounded-xl border border-border bg-white px-3 py-2.5 transition-all duration-200 hover:shadow-sm"
                        >
                            <div className={`shrink-0 text-xs font-bold tabular-nums ${m.quantity >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                {m.quantity >= 0 ? '+' : ''}
                                {m.quantity}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-xs font-semibold text-text">{m.product?.name ?? '-'}</div>
                                <div className="mt-0.5 text-[11px] text-text-subtle">
                                    {m.outlet?.name} &middot;{' '}
                                    <span className={typeColors[m.type] ?? 'text-text-muted'}>{typeLabels[m.type] ?? m.type}</span>
                                </div>
                            </div>
                            <div className="shrink-0 text-right">
                                <div className="text-[11px] tabular-nums text-text-muted">
                                    {m.before_stock}&rarr;{m.after_stock}
                                </div>
                                <div className="text-[11px] tabular-nums text-text-subtle">{formatDate(m.created_at)}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Right: stats sidebar (desktop only) */}
                <div className="hidden lg:block">
                    <div className="sticky top-4 space-y-3">
                        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                            <div className="flex items-center gap-2 text-xs text-text-muted">
                                <ClipboardList className="h-4 w-4 text-text-subtle" />
                                Total Movement
                            </div>
                            <div className="mt-2 text-3xl font-bold text-text">{movements.data.length}</div>
                            <div className="mt-1 text-[11px] font-medium text-text-muted">Semua movement</div>
                        </div>
                        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                            <div className="flex items-center gap-2 text-xs text-text-muted">
                                <ArrowDownRight className="h-4 w-4 text-emerald-500" />
                                Stok Masuk
                            </div>
                            <div className="mt-2 text-3xl font-bold text-text">{movements.data.filter((m: any) => m.quantity > 0).length}</div>
                            <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-500">
                                <ArrowDownRight className="h-3 w-3" />
                                Restock & penyesuaian
                            </div>
                        </div>
                        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                            <div className="flex items-center gap-2 text-xs text-text-muted">
                                <ArrowUpRight className="h-4 w-4 text-red-500" />
                                Stok Keluar
                            </div>
                            <div className="mt-2 text-3xl font-bold text-text">{movements.data.filter((m: any) => m.quantity < 0).length}</div>
                            <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-red-500">
                                <ArrowUpRight className="h-3 w-3" />
                                Pesanan & pembatalan
                            </div>
                        </div>

                        {/* Active filters */}
                        {activeFilterCount > 0 && (
                            <div className="rounded-xl border border-border bg-white p-4 transition-shadow hover:shadow-sm">
                                <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-text-muted">Filter Aktif</div>
                                <div className="space-y-1.5">
                                    {filters.outlet_id && (
                                        <div className="text-xs text-text">
                                            Outlet: {outlets.find((o: any) => String(o.id) === String(filters.outlet_id))?.name ?? filters.outlet_id}
                                        </div>
                                    )}
                                    {filters.product_id && (
                                        <div className="text-xs text-text">
                                            Produk: {products.find((p: any) => String(p.id) === String(filters.product_id))?.name ?? filters.product_id}
                                        </div>
                                    )}
                                    {filters.type && (
                                        <div className="text-xs text-text">
                                            Tipe: <span className={typeColors[filters.type]}>{typeLabels[filters.type] ?? filters.type}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {movements.links && <Pagination links={movements.links} />}

            <FilterSheet
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                sections={[
                    {
                        key: 'outlet_id',
                        label: 'Outlet',
                        options: outlets.map((o: any) => ({ value: String(o.id), label: o.name })),
                        value: filters.outlet_id ? String(filters.outlet_id) : '',
                    },
                    {
                        key: 'product_id',
                        label: 'Produk',
                        options: products.map((p: any) => ({ value: String(p.id), label: p.name })),
                        value: filters.product_id ? String(filters.product_id) : '',
                    },
                    { key: 'type', label: 'Tipe', options: typeOptions, value: filters.type ?? '' },
                ]}
                onApply={handleFilterApply}
            />
        </div>
    );
}

/* ================================================================== */
/*  TAB 3: Laporan (from reports)                                      */
/* ================================================================== */

const statusLabels: Record<string, string> = {
    pending: 'Tertunda',
    confirmed: 'Dikonfirmasi',
    preparing: 'Disiapkan',
    ready_for_pickup: 'Siap',
    delivering: 'Dikirim',
    completed: 'Selesai',
    cancelled: 'Dibatalkan',
    failed: 'Gagal',
    waiting_pickup: 'Menunggu',
    retry_delivery: 'Coba Ulang',
    returned_to_outlet: 'Dikembalikan',
    cancelled_and_released: 'Dilepas',
};

function LaporanTab({ summary, ordersByStatus = {}, deliveriesByStatus = {}, outlets = [], filters = {} }: Props) {
    const [filterOpen, setFilterOpen] = useState(false);
    const [period, setPeriod] = useState('month');
    const [exporting, setExporting] = useState<string | null>(null);
    const [exportOpen, setExportOpen] = useState(false);
    const [secondaryOpen, setSecondaryOpen] = useState(false);

    function handleFilter(key: string, value: string) {
        router.get('/owner/reports', { ...filters, [key]: value || undefined }, { preserveState: true, replace: true });
    }

    function handleExport() {
        const params = new URLSearchParams();
        if (filters.date_from) params.set('date_from', filters.date_from);
        if (filters.date_to) params.set('date_to', filters.date_to);
        if (filters.outlet_id) params.set('outlet_id', String(filters.outlet_id));
        window.location.href = `/owner/reports/export-csv?${params.toString()}`;
    }

    const handleExportReport = (type: string) => {
        setExporting(type);
        router.get(`/owner/reports/${type}/export?period=${period}`, {}, { onFinish: () => setExporting(null) });
    };

    if (!summary) {
        return (
            <EmptyState
                icon={<ClipboardList className="h-8 w-8 text-text-subtle" />}
                title="Belum ada data"
                description="Laporan akan muncul di sini."
            />
        );
    }

    return (
        <div className="space-y-4">
            {/* Action bar */}
            <div className="flex gap-2">
                <input
                    type="date"
                    className="flex-1 rounded-lg border border-border bg-white px-2.5 py-2 text-[11px]"
                    value={filters.date_from ?? ''}
                    onChange={(e) => handleFilter('date_from', e.target.value)}
                />
                <input
                    type="date"
                    className="flex-1 rounded-lg border border-border bg-white px-2.5 py-2 text-[11px]"
                    value={filters.date_to ?? ''}
                    onChange={(e) => handleFilter('date_to', e.target.value)}
                />
                <button
                    onClick={handleExport}
                    className="flex h-10 items-center gap-1 rounded-xl border border-border bg-white px-2.5 text-[11px] font-semibold text-text-muted transition-all duration-150 active:bg-surface-muted active:opacity-80"
                >
                    <Download className="h-4 w-4" /> CSV
                </button>
                <div className="relative">
                    <HeaderIconButton label="Filter" onClick={() => setFilterOpen(true)}>
                        <FilterIcon />
                    </HeaderIconButton>
                </div>
            </div>

            {/* Period selector */}
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                {periods.map((p) => (
                    <button
                        key={p.key}
                        onClick={() => setPeriod(p.key)}
                        className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                            period === p.key ? 'bg-primary text-white' : 'bg-surface-muted text-text-muted active:bg-surface-muted'
                        }`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* Desktop 2-column layout */}
            <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
                {/* Left: breakdown cards */}
                <div className="space-y-3">
                    <BreakdownCard title="Pesanan per Status" data={ordersByStatus} />
                    <BreakdownCard title="Pengiriman per Status" data={deliveriesByStatus} />
                </div>

                {/* Right: KPI + export sidebar */}
                <div className="space-y-4">
                    <div className="lg:sticky lg:top-4 lg:space-y-4">
                        {/* Export cards (collapsible) */}
                        <div className="rounded-xl border border-border bg-white transition-shadow hover:shadow-sm">
                            <button onClick={() => setExportOpen(!exportOpen)} className="flex w-full items-center justify-between p-4">
                                <div className="text-sm font-semibold text-text">Download Laporan</div>
                                <ChevronDown className={`h-4 w-4 text-text-muted transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {exportOpen && (
                                <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
                                    <div>
                                        <div className="text-xs font-medium text-text mb-1">Laporan Orders</div>
                                        <p className="mb-2 text-[11px] text-text-muted">Download data order completed</p>
                                        <button
                                            onClick={() => handleExportReport('orders')}
                                            disabled={exporting === 'orders'}
                                            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white transition-all duration-150 hover:bg-primary/90 active:bg-primary/90 disabled:opacity-50"
                                        >
                                            {exporting === 'orders' ? 'Mengexport...' : 'Download CSV'}
                                        </button>
                                    </div>
                                    <div>
                                        <div className="text-xs font-medium text-text mb-1">Laporan Settlements</div>
                                        <p className="mb-2 text-[11px] text-text-muted">Download data settlement outlet</p>
                                        <button
                                            onClick={() => handleExportReport('settlements')}
                                            disabled={exporting === 'settlements'}
                                            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white transition-all duration-150 hover:bg-primary/90 active:bg-primary/90 disabled:opacity-50"
                                        >
                                            {exporting === 'settlements' ? 'Mengexport...' : 'Download CSV'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* KPI Cards */}
                        <div className="space-y-2">
                            <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                                <div className="flex items-center gap-2 text-xs text-text-muted">
                                    <ClipboardList className="h-4 w-4 text-text-subtle" />
                                    Total Pesanan
                                </div>
                                <div className="mt-2 text-3xl font-bold text-text">{summary.totalOrders}</div>
                                <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-text-subtle">Pesanan</div>
                            </div>
                            <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                                <div className="flex items-center gap-2 text-xs text-text-muted">
                                    <DollarSign className="h-4 w-4 text-emerald-500" />
                                    Pendapatan
                                </div>
                                <div className="mt-2 text-3xl font-bold text-text">{formatCurrency(summary.totalRevenue)}</div>
                                <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-500">Total pendapatan</div>
                            </div>
                            <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                                <div className="flex items-center gap-2 text-xs text-text-muted">
                                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                                    Selesai
                                </div>
                                <div className="mt-2 text-3xl font-bold text-text">{summary.completedOrders}</div>
                                <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-500">Pesanan selesai</div>
                            </div>
                        </div>

                        {/* Secondary KPIs (collapsible) */}
                        <div className="rounded-xl border border-border bg-white transition-shadow hover:shadow-sm">
                            <button onClick={() => setSecondaryOpen(!secondaryOpen)} className="flex w-full items-center justify-between p-3">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Detail Lainnya</div>
                                <ChevronDown className={`h-3.5 w-3.5 text-text-muted transition-transform ${secondaryOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {secondaryOpen && (
                                <div className="space-y-2 border-t border-border px-3 pb-3 pt-2">
                                    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                                        <div className="flex items-center gap-2 text-xs text-text-muted">
                                            <XCircle className="h-4 w-4 text-red-500" />
                                            Dibatalkan
                                        </div>
                                        <div className="mt-2 text-3xl font-bold text-text">{summary.cancelledOrders}</div>
                                        <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-red-500">Dibatalkan</div>
                                    </div>
                                    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                                        <div className="flex items-center gap-2 text-xs text-text-muted">
                                            <Truck className="h-4 w-4 text-emerald-500" />
                                            Pengiriman Berhasil
                                        </div>
                                        <div className="mt-2 text-3xl font-bold text-text">{summary.completedDeliveries}</div>
                                        <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-500">Pengiriman selesai</div>
                                    </div>
                                    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                                        <div className="flex items-center gap-2 text-xs text-text-muted">
                                            <XCircle className="h-4 w-4 text-red-500" />
                                            Pengiriman Gagal
                                        </div>
                                        <div className="mt-2 text-3xl font-bold text-text">{summary.failedDeliveries}</div>
                                        {summary.failedDeliveries > 0 && (
                                            <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-red-500">
                                                <ArrowDownRight className="h-3 w-3" />
                                                Perlu ditinjau
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <FilterSheet
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                sections={[
                    {
                        key: 'outlet_id',
                        label: 'Outlet',
                        options: outlets.map((o: any) => ({ value: String(o.id), label: o.name })),
                        value: filters.outlet_id ? String(filters.outlet_id) : '',
                    },
                ]}
                onApply={(f) =>
                    router.get('/owner/reports', { ...filters, outlet_id: f.outlet_id || undefined }, { preserveState: true, replace: true })
                }
            />
        </div>
    );
}

function BreakdownCard({ title, data }: { title: string; data: Record<string, number> }) {
    const [open, setOpen] = useState(false);
    const entries = Object.entries(data);

    return (
        <div className="rounded-lg border border-border bg-white transition-shadow hover:shadow-sm">
            <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between p-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">{title}</div>
                <ChevronDown className={`h-3.5 w-3.5 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="border-t border-border px-3 pb-3 pt-2">
                    {entries.length === 0 ? (
                        <p className="text-xs text-text-subtle">Tidak ada data</p>
                    ) : (
                        <div className="space-y-1.5">
                            {entries.map(([status, count]) => (
                                <div key={status} className="flex items-center justify-between text-xs">
                                    <span className="text-text-muted">{statusLabels[status] ?? status}</span>
                                    <span className="font-bold tabular-nums text-text">{count}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ================================================================== */
/*  TAB 4: Masalah (from order-reports)                                */
/* ================================================================== */

const reportStatusFilters = [
    { key: '', label: 'Semua' },
    { key: 'pending', label: 'Menunggu' },
    { key: 'investigating', label: 'Ditinjau' },
    { key: 'resolved', label: 'Selesai' },
    { key: 'rejected', label: 'Ditolak' },
];

const reportTypeLabels: Record<string, string> = {
    not_received: 'Barang tidak diterima',
    wrong_items: 'Barang salah',
    damaged: 'Barang rusak',
    other: 'Lainnya',
};

function MasalahTab({ reports, filters = {} }: Props) {
    const [activeFilter, setActiveFilter] = useState(filters.status ?? '');

    const handleFilterChange = (key: string) => {
        setActiveFilter(key);
        router.get('/owner/order-reports', key ? { status: key } : {}, { preserveState: true, replace: true });
    };

    if (!reports || reports.data.length === 0) {
        return (
            <div className="space-y-4">
                {/* Filter chips */}
                <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                    {reportStatusFilters.map((option) => {
                        const isActive = activeFilter === option.key;
                        return (
                            <button
                                key={option.key}
                                onClick={() => handleFilterChange(option.key)}
                                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                                    isActive
                                        ? 'bg-primary text-white shadow-sm shadow-primary/20'
                                        : 'bg-surface-muted text-text-muted hover:bg-zinc-200'
                                }`}
                            >
                                {option.label}
                            </button>
                        );
                    })}
                </div>
                <EmptyState
                    icon={<AlertTriangle className="h-8 w-8 text-text-subtle" />}
                    title="Belum ada laporan"
                    description="Laporan masalah dari customer akan muncul di sini."
                />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Filter chips */}
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                {reportStatusFilters.map((option) => {
                    const isActive = activeFilter === option.key;
                    return (
                        <button
                            key={option.key}
                            onClick={() => handleFilterChange(option.key)}
                            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                                isActive
                                    ? 'bg-primary text-white shadow-sm shadow-primary/20'
                                    : 'bg-surface-muted text-text-muted hover:bg-zinc-200'
                            }`}
                        >
                            {option.label}
                        </button>
                    );
                })}
            </div>

            {/* Report list */}
            <div className="space-y-2">
                {reports.data.map((report: any) => (
                    <Link
                        key={report.id}
                        href={`/owner/order-reports/${report.id}`}
                        className="block rounded-xl border border-border bg-surface p-4 active:opacity-80"
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="text-sm font-semibold text-text">{report.order?.order_code ?? `Order #${report.order_id}`}</div>
                                <div className="mt-0.5 text-xs text-text-muted">{report.customer?.name}</div>
                            </div>
                            <StatusBadge status={report.status === 'pending' ? 'pending_confirmation' : report.status === 'investigating' ? 'preparing' : report.status} />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
                            <span>{reportTypeLabels[report.type] ?? report.type}</span>
                            <span>{formatDate(report.created_at)}</span>
                        </div>
                    </Link>
                ))}
            </div>

            {/* Pagination */}
            {reports.last_page > 1 && (
                <div className="mt-4 flex justify-center gap-2">
                    {reports.links?.map((link: any, i: number) => (
                        <Link
                            key={i}
                            href={link.url ?? '#'}
                            className={`flex min-h-11 min-w-11 items-center justify-center rounded-lg text-sm ${
                                link.active ? 'bg-primary text-white' : 'bg-surface-muted text-text-muted'
                            }`}
                            dangerouslySetInnerHTML={{ __html: link.label }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
