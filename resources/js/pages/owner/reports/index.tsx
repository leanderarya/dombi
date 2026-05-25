import { router } from '@inertiajs/react';
import { useState } from 'react';
import FilterSheet from '@/components/owner/filter-sheet';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { HeaderIconButton, FilterIcon } from '@/components/owner/owner-mobile-header';
import { formatCurrency } from '@/lib/format';

const statusLabels: Record<string, string> = { pending: 'Pending', confirmed: 'Confirmed', preparing: 'Preparing', ready_for_pickup: 'Ready', delivering: 'Delivering', completed: 'Completed', cancelled: 'Cancelled', failed: 'Failed', waiting_pickup: 'Waiting', retry_delivery: 'Retry', returned_to_outlet: 'Returned', cancelled_and_released: 'Released' };

export default function ReportsIndex({ summary, ordersByStatus, deliveriesByStatus, outlets, filters }: any) {
    const [filterOpen, setFilterOpen] = useState(false);

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

    return (
        <OwnerPageShell
            title="Reports"
            headerRight={
                <>
                    <button onClick={handleExport} className="flex h-10 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition-all duration-150 active:scale-[0.98] active:bg-slate-50">
                        📥 CSV
                    </button>
                    <HeaderIconButton label="Filter" onClick={() => setFilterOpen(true)}><FilterIcon /></HeaderIconButton>
                </>
            }
        >
            {/* Date filters inline */}
            <div className="flex gap-2">
                <input type="date" className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px]" value={filters.date_from} onChange={(e) => handleFilter('date_from', e.target.value)} />
                <input type="date" className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px]" value={filters.date_to} onChange={(e) => handleFilter('date_to', e.target.value)} />
            </div>

            {/* KPI Grid */}
            <div className="mt-3 grid grid-cols-2 gap-2">
                <Kpi label="Total Orders" value={String(summary.totalOrders)} />
                <Kpi label="Revenue" value={formatCurrency(summary.totalRevenue)} highlight />
                <Kpi label="Completed" value={String(summary.completedOrders)} />
                <Kpi label="Cancelled" value={String(summary.cancelledOrders)} />
                <Kpi label="Delivery OK" value={String(summary.completedDeliveries)} />
                <Kpi label="Delivery Fail" value={String(summary.failedDeliveries)} alert={summary.failedDeliveries > 0} />
            </div>

            {/* Breakdown */}
            <div className="mt-4 space-y-3">
                <BreakdownCard title="Orders by Status" data={ordersByStatus} />
                <BreakdownCard title="Deliveries by Status" data={deliveriesByStatus} />
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
        <div className={`rounded-lg border p-3 ${alert ? 'border-red-200 bg-red-50' : highlight ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
            <div className={`mt-0.5 text-lg font-bold tabular-nums ${highlight ? 'text-emerald-800' : alert ? 'text-red-800' : 'text-slate-900'}`}>{value}</div>
        </div>
    );
}

function BreakdownCard({ title, data }: { title: string; data: Record<string, number> }) {
    const entries = Object.entries(data);
    return (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{title}</div>
            {entries.length === 0 ? <p className="mt-2 text-xs text-slate-400">No data</p> : (
                <div className="mt-2 space-y-1.5">
                    {entries.map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between text-xs">
                            <span className="text-slate-600">{statusLabels[status] ?? status}</span>
                            <span className="font-bold tabular-nums text-slate-900">{count}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
