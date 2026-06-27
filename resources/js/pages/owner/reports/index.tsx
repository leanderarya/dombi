import { router } from '@inertiajs/react';
import { ChevronDown, Download } from 'lucide-react';
import { useState } from 'react';
import FilterSheet from '@/components/owner/filter-sheet';
import { HeaderIconButton, FilterIcon } from '@/components/owner/header-icon-utils';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { formatCurrency } from '@/lib/format';

const statusLabels: Record<string, string> = { pending: 'Tertunda', confirmed: 'Dikonfirmasi', preparing: 'Disiapkan', ready_for_pickup: 'Siap', delivering: 'Dikirim', completed: 'Selesai', cancelled: 'Dibatalkan', failed: 'Gagal', waiting_pickup: 'Menunggu', retry_delivery: 'Coba Ulang', returned_to_outlet: 'Dikembalikan', cancelled_and_released: 'Dilepas' };

const periods = [
    { key: 'today', label: 'Hari Ini' },
    { key: 'week', label: 'Minggu Ini' },
    { key: 'month', label: 'Bulan Ini' },
];

export default function ReportsIndex({ summary, ordersByStatus, deliveriesByStatus, outlets, filters }: any) {
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
        router.get(`/owner/reports/${type}/export?period=${period}`, {}, {
            onFinish: () => setExporting(null),
        });
    };

    return (
        <OwnerPageShell
            title="Laporan"
            headerRight={
                <>
                    <button onClick={handleExport} className="flex h-10 items-center gap-1 rounded-xl border border-border bg-white px-2.5 text-[11px] font-semibold text-text-muted transition-all duration-150 active:opacity-80 active:bg-surface-muted">
                        <Download className="h-4 w-4" /> CSV
                    </button>
                    <HeaderIconButton label="Filter" onClick={() => setFilterOpen(true)}><FilterIcon /></HeaderIconButton>
                </>
            }
        >
            {/* Date filters inline */}
            <div className="flex gap-2">
                <input type="date" className="flex-1 rounded-lg border border-border bg-white px-2.5 py-2 text-[11px]" value={filters.date_from} onChange={(e) => handleFilter('date_from', e.target.value)} />
                <input type="date" className="flex-1 rounded-lg border border-border bg-white px-2.5 py-2 text-[11px]" value={filters.date_to} onChange={(e) => handleFilter('date_to', e.target.value)} />
            </div>

            {/* Period Selector */}
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                {periods.map((p) => (
                    <button
                        key={p.key}
                        onClick={() => setPeriod(p.key)}
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

            {/* Desktop 2-column layout */}
            <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-5">
                {/* Left: breakdown cards */}
                <div className="space-y-3">
                    <BreakdownCard title="Pesanan per Status" data={ordersByStatus} />
                    <BreakdownCard title="Pengiriman per Status" data={deliveriesByStatus} />
                </div>

                {/* Right: KPI grid + export actions (sticky) */}
                <div className="space-y-4">
                    {/* Mobile: show inline; Desktop: sticky sidebar */}
                    <div className="lg:sticky lg:top-4 lg:space-y-4">
                        {/* Export Cards (collapsible) */}
                        <div className="rounded-xl border border-border bg-white transition-shadow hover:shadow-sm">
                            <button
                                onClick={() => setExportOpen(!exportOpen)}
                                className="flex w-full items-center justify-between p-4"
                            >
                                <div className="text-sm font-semibold text-text">Download Laporan</div>
                                <ChevronDown className={`h-4 w-4 text-text-muted transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {exportOpen && (
                                <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
                                    <div>
                                        <div className="text-xs font-medium text-text mb-1">Laporan Orders</div>
                                        <p className="text-[11px] text-text-muted mb-2">Download data order completed</p>
                                        <button
                                            onClick={() => handleExportReport('orders')}
                                            disabled={exporting === 'orders'}
                                            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white transition-all duration-150 active:bg-primary/90 hover:bg-primary/90 disabled:opacity-50"
                                        >
                                            {exporting === 'orders' ? 'Mengexport...' : 'Download CSV'}
                                        </button>
                                    </div>
                                    <div>
                                        <div className="text-xs font-medium text-text mb-1">Laporan Settlements</div>
                                        <p className="text-[11px] text-text-muted mb-2">Download data settlement outlet</p>
                                        <button
                                            onClick={() => handleExportReport('settlements')}
                                            disabled={exporting === 'settlements'}
                                            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white transition-all duration-150 active:bg-primary/90 hover:bg-primary/90 disabled:opacity-50"
                                        >
                                            {exporting === 'settlements' ? 'Mengexport...' : 'Download CSV'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* KPI Grid - Primary */}
                        <div className="grid grid-cols-3 gap-2">
                            <Kpi label="Total Pesanan" value={String(summary.totalOrders)} />
                            <Kpi label="Pendapatan" value={formatCurrency(summary.totalRevenue)} highlight />
                            <Kpi label="Selesai" value={String(summary.completedOrders)} />
                        </div>

                        {/* Secondary KPIs (collapsible) */}
                        <div className="rounded-xl border border-border bg-white transition-shadow hover:shadow-sm">
                            <button
                                onClick={() => setSecondaryOpen(!secondaryOpen)}
                                className="flex w-full items-center justify-between p-3"
                            >
                                <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Detail Lainnya</div>
                                <ChevronDown className={`h-3.5 w-3.5 text-text-muted transition-transform ${secondaryOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {secondaryOpen && (
                                <div className="grid grid-cols-3 gap-2 border-t border-border px-3 pb-3 pt-2">
                                    <Kpi label="Dibatalkan" value={String(summary.cancelledOrders)} />
                                    <Kpi label="Pengiriman Berhasil" value={String(summary.completedDeliveries)} />
                                    <Kpi label="Pengiriman Gagal" value={String(summary.failedDeliveries)} alert={summary.failedDeliveries > 0} />
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
                    { key: 'outlet_id', label: 'Outlet', options: outlets.map((o: any) => ({ value: String(o.id), label: o.name })), value: filters.outlet_id ? String(filters.outlet_id) : '' },
                ]}
                onApply={(f) => router.get('/owner/reports', { ...filters, outlet_id: f.outlet_id || undefined }, { preserveState: true, replace: true })}
            />
        </OwnerPageShell>
    );
}

function Kpi({ label, value, highlight, alert }: { label: string; value: string; highlight?: boolean; alert?: boolean }) {
    return (
        <div className={`rounded-lg border p-2.5 transition-all duration-200 hover:shadow-sm ${alert ? 'border-red-200 bg-red-50' : highlight ? 'border-emerald-200 bg-primary-light' : 'border-border bg-white'}`}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-subtle">{label}</div>
            <div className={`mt-0.5 text-sm font-bold tabular-nums ${highlight ? 'text-primary' : alert ? 'text-red-800' : 'text-text'}`}>{value}</div>
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
                    {entries.length === 0 ? <p className="text-xs text-text-subtle">Tidak ada data</p> : (
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
