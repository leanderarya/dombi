import { router } from '@inertiajs/react';
import { CheckCircle, ChevronDown, ClipboardList, DollarSign, Download, Truck, XCircle } from 'lucide-react';
import { useState } from 'react';
import FilterSheet from '@/components/owner/filter-sheet';
import { HeaderIconButton, FilterIcon } from '@/components/owner/header-icon-utils';
import EmptyState from '@/components/ui/empty-state';
import { formatCurrency } from '@/lib/format';

interface ReportSummary {
    totalOrders: number;
    totalRevenue: number;
    completedOrders: number;
    cancelledOrders: number;
    completedDeliveries: number;
    failedDeliveries: number;
}

interface Props {
    summary?: ReportSummary;
    ordersByStatus?: Record<string, number>;
    deliveriesByStatus?: Record<string, number>;
    outlets?: any[];
    filters?: Record<string, any>;
}

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

const periods = [
    { key: 'today', label: 'Hari Ini' },
    { key: 'week', label: 'Minggu Ini' },
    { key: 'month', label: 'Bulan Ini' },
];

export function LaporanTab({ summary, ordersByStatus = {}, deliveriesByStatus = {}, outlets = [], filters = {} }: Props) {
    const [filterOpen, setFilterOpen] = useState(false);
    const [period, setPeriod] = useState('month');
    const [exporting, setExporting] = useState<string | null>(null);
    const [exportOpen, setExportOpen] = useState(false);
    const [secondaryOpen, setSecondaryOpen] = useState(false);

    function handleFilter(key: string, value: string) {
        router.get('/owner/analytics', { tab: 'laporan', ...filters, [key]: value || undefined }, { preserveState: true, replace: true });
    }

    function handleExport() {
        const params = new URLSearchParams();

        if (filters.date_from) {
            params.set('date_from', filters.date_from);
        }

        if (filters.date_to) {
            params.set('date_to', filters.date_to);
        }

        if (filters.outlet_id) {
            params.set('outlet_id', String(filters.outlet_id));
        }

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
            <div className="flex gap-2">
                <input
                    type="date"
                    className="flex-1 rounded-lg border border-border bg-white px-2.5 py-2 text-xs"
                    value={filters.date_from ?? ''}
                    onChange={(e) => handleFilter('date_from', e.target.value)}
                />
                <input
                    type="date"
                    className="flex-1 rounded-lg border border-border bg-white px-2.5 py-2 text-xs"
                    value={filters.date_to ?? ''}
                    onChange={(e) => handleFilter('date_to', e.target.value)}
                />
                <button
                    onClick={handleExport}
                    className="flex h-10 items-center gap-1 rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-text-muted transition-all duration-150 active:bg-surface-muted active:opacity-80"
                >
                    <Download className="h-4 w-4" /> CSV
                </button>
                <div className="relative">
                    <HeaderIconButton label="Filter" onClick={() => setFilterOpen(true)}>
                        <FilterIcon />
                    </HeaderIconButton>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 overflow-x-auto scrollbar-none">
                {periods.map((p) => (
                    <button
                        key={p.key}
                        onClick={() => setPeriod(p.key)}
                        className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition-all ${
                            period === p.key
                                ? 'bg-primary/10 text-primary ring-primary/20'
                                : 'bg-surface text-text-muted ring-border hover:bg-surface-muted'
                        }`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
                <div className="space-y-3">
                    <BreakdownCard title="Pesanan per Status" data={ordersByStatus} />
                    <BreakdownCard title="Pengiriman per Status" data={deliveriesByStatus} />
                </div>

                <div className="space-y-4">
                    <div className="lg:sticky lg:top-4 lg:space-y-4">
                        <div className="rounded-lg border border-border bg-white transition-shadow">
                            <button onClick={() => setExportOpen(!exportOpen)} className="flex w-full items-center justify-between p-4">
                                <div className="text-sm font-semibold text-text">Download Laporan</div>
                                <ChevronDown className={`h-4 w-4 text-text-muted transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {exportOpen && (
                                <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
                                    <div>
                                        <div className="text-xs font-medium text-text mb-1">Laporan Orders</div>
                                        <p className="mb-2 text-xs text-text-muted">Download data order completed</p>
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
                                        <p className="mb-2 text-xs text-text-muted">Download data settlement outlet</p>
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

                        <div className="space-y-2">
                            <div className="rounded-lg border border-border bg-white p-5">
                                <div className="flex items-center gap-2 text-xs text-text-muted">
                                    <ClipboardList className="h-4 w-4 text-text-subtle" />
                                    Total Pesanan
                                </div>
                                <div className="mt-2 text-3xl font-bold text-text">{summary.totalOrders}</div>
                                <div className="mt-1 flex items-center gap-1 text-xs font-medium text-text-subtle">Pesanan</div>
                            </div>
                            <div className="rounded-lg border border-border bg-white p-5">
                                <div className="flex items-center gap-2 text-xs text-text-muted">
                                    <DollarSign className="h-4 w-4 text-emerald-500" />
                                    Pendapatan
                                </div>
                                <div className="mt-2 text-3xl font-bold text-text">{formatCurrency(summary.totalRevenue)}</div>
                                <div className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-500">Total pendapatan</div>
                            </div>
                            <div className="rounded-lg border border-border bg-white p-5">
                                <div className="flex items-center gap-2 text-xs text-text-muted">
                                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                                    Selesai
                                </div>
                                <div className="mt-2 text-3xl font-bold text-text">{summary.completedOrders}</div>
                                <div className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-500">Pesanan selesai</div>
                            </div>
                        </div>

                        <div className="rounded-lg border border-border bg-white transition-shadow">
                            <button onClick={() => setSecondaryOpen(!secondaryOpen)} className="flex w-full items-center justify-between p-3">
                                <div className="text-xs font-bold uppercase tracking-wider text-text-muted">Detail Lainnya</div>
                                <ChevronDown className={`h-3.5 w-3.5 text-text-muted transition-transform ${secondaryOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {secondaryOpen && (
                                <div className="space-y-2 border-t border-border px-3 pb-3 pt-2">
                                    <div className="rounded-lg border border-border bg-white p-5">
                                        <div className="flex items-center gap-2 text-xs text-text-muted">
                                            <XCircle className="h-4 w-4 text-red-500" />
                                            Dibatalkan
                                        </div>
                                        <div className="mt-2 text-3xl font-bold text-text">{summary.cancelledOrders}</div>
                                        <div className="mt-1 flex items-center gap-1 text-xs font-medium text-red-500">Dibatalkan</div>
                                    </div>
                                    <div className="rounded-lg border border-border bg-white p-5">
                                        <div className="flex items-center gap-2 text-xs text-text-muted">
                                            <Truck className="h-4 w-4 text-emerald-500" />
                                            Pengiriman Berhasil
                                        </div>
                                        <div className="mt-2 text-3xl font-bold text-text">{summary.completedDeliveries}</div>
                                        <div className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-500">Pengiriman selesai</div>
                                    </div>
                                    <div className="rounded-lg border border-border bg-white p-5">
                                        <div className="flex items-center gap-2 text-xs text-text-muted">
                                            <XCircle className="h-4 w-4 text-red-500" />
                                            Pengiriman Gagal
                                        </div>
                                        <div className="mt-2 text-3xl font-bold text-text">{summary.failedDeliveries}</div>
                                        {summary.failedDeliveries > 0 && (
                                            <div className="mt-1 flex items-center gap-1 text-xs font-medium text-red-500">
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
                    router.get('/owner/analytics', { tab: 'laporan', ...filters, outlet_id: f.outlet_id || undefined }, { preserveState: true, replace: true })
                }
            />
        </div>
    );
}

function BreakdownCard({ title, data }: { title: string; data: Record<string, number> }) {
    const [open, setOpen] = useState(false);
    const entries = Object.entries(data);

    return (
        <div className="rounded-lg border border-border bg-white transition-shadow">
            <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between p-3">
                <div className="text-xs font-bold uppercase tracking-wider text-text-subtle">{title}</div>
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
