import { DollarSign, Store, Clock, PartyPopper, AlertCircle, CheckCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import FinanceFilterTabs from '@/components/owner/finance/finance-filter-tabs';
import FinanceOutletCard from '@/components/owner/finance/finance-outlet-card';
import { SkeletonKpiGrid, SkeletonFilters, SkeletonOrderList } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/format';

const TAGIHAN_FILTER_TABS = [
    { key: 'action_needed', label: 'Butuh Tindakan' },
    { key: 'overdue', label: 'Terlambat' },
    { key: 'unpaid', label: 'Belum Bayar' },
    { key: 'paid', label: 'Lunas' },
];

export default function TagihanTab({ kpis, outlets }: any) {
    const [filter, setFilter] = useState('action_needed');
    const [search, setSearch] = useState('');

    if (!kpis || !outlets) {
        return (
            <div className="space-y-4">
                <SkeletonKpiGrid count={4} />
                <SkeletonFilters />
                <SkeletonOrderList />
            </div>
        );
    }

    const filtered = useMemo(() => {
        return outlets.filter((o: any) => {
            if (filter === 'action_needed') {
                if (o.display_status !== 'overdue' && o.display_status !== 'unpaid') {
                    return false;
                }
            } else if (filter !== 'all' && o.display_status !== filter) {
                return false;
            }

            if (search) {
                return o.outlet_name.toLowerCase().includes(search.toLowerCase());
            }

            return true;
        });
    }, [outlets, filter, search]);

    return (
        <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
            {/* Left: Filters + Outlet List */}
            <div>
                {/* Sticky Filters + Search */}
                <div className="sticky top-0 z-20 -mx-4 px-4 py-3 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <FinanceFilterTabs tabs={TAGIHAN_FILTER_TABS} active={filter} onChange={setFilter} />
                        <div className="flex items-center rounded-lg border border-border bg-surface px-2.5 py-1.5 min-w-[140px]">
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Cari outlet..."
                                className="w-full bg-transparent text-xs text-text placeholder:text-text-subtle outline-none"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    className="shrink-0 text-text-subtle hover:text-text-muted text-xs"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Mobile KPI Strip */}
                <div className="mb-4 grid grid-cols-3 gap-2 lg:hidden">
                    <div className="rounded-lg border border-border bg-white p-3 text-center">
                        <div className="text-xs font-medium text-text-muted">Belum Dibayar</div>
                        <div className="mt-1 text-lg font-bold tabular-nums text-text">{formatCurrency(kpis.total_unpaid)}</div>
                    </div>
                    <div className="rounded-lg border border-border bg-white p-3 text-center">
                        <div className="text-xs font-medium text-text-muted">Outlet</div>
                        <div className="mt-1 text-lg font-bold tabular-nums text-text">{kpis.outlets_unpaid}</div>
                    </div>
                    <div className="rounded-lg border border-border bg-white p-3 text-center">
                        <div className="text-xs font-medium text-text-muted">Jatuh Tempo</div>
                        <div className="mt-1 text-lg font-bold tabular-nums text-text">{formatCurrency(kpis.due_this_week)}</div>
                    </div>
                </div>

                {/* Outlet List */}
                <section className="mt-4">
                    {filtered.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border bg-white py-16 text-center">
                            {search ? (
                                <>
                                    <Store className="mx-auto h-10 w-10 text-text-subtle" />
                                    <p className="mt-3 text-sm font-medium text-text-muted">Outlet tidak ditemukan</p>
                                    <p className="mt-1 text-xs text-text-subtle">Coba kata kunci lain</p>
                                </>
                            ) : filter === 'action_needed' ? (
                                <>
                                    <PartyPopper className="mx-auto h-10 w-10 text-emerald-400" />
                                    <p className="mt-3 text-sm font-medium text-text">Tidak ada outlet yang butuh tindakan</p>
                                    <p className="mt-1 text-xs text-text-subtle">Semua tagihan sudah tertangani</p>
                                </>
                            ) : filter === 'paid' ? (
                                <>
                                    <PartyPopper className="mx-auto h-10 w-10 text-emerald-400" />
                                    <p className="mt-3 text-sm font-medium text-text">Semua outlet sudah lunas</p>
                                    <p className="mt-1 text-xs text-text-subtle">Tidak ada tagihan aktif</p>
                                </>
                            ) : (
                                <>
                                    <Store className="mx-auto h-10 w-10 text-text-subtle" />
                                    <p className="mt-3 text-sm font-medium text-text-muted">Belum ada outlet dengan status ini</p>
                                    <p className="mt-1 text-xs text-text-subtle">Coba filter lain untuk melihat outlet</p>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filtered.map((o: any) => (
                                <FinanceOutletCard
                                    key={o.outlet_id}
                                    outletId={o.outlet_id}
                                    outletName={o.outlet_name}
                                    totalSales={o.total_sales}
                                    totalOutstanding={o.total_outstanding}
                                    totalPaid={o.total_paid}
                                    displayStatus={o.display_status}
                                    nearestDueDate={o.nearest_due_date}
                                />
                            ))}
                        </div>
                    )}
                </section>
            </div>

            {/* Right: KPI Cards (desktop sidebar) */}
            <aside className="hidden lg:block">
                <div className="sticky top-20 space-y-3">
                    <div className="rounded-lg border border-border bg-white p-5">
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                            <DollarSign className="h-4 w-4 text-red-500" />
                            Total Belum Dibayar
                        </div>
                        <div className="mt-2 text-3xl font-bold text-text">{formatCurrency(kpis.total_unpaid)}</div>
                        <div className="mt-1 flex items-center gap-1 text-xs font-medium text-red-500">
                            {kpis.outlets_unpaid > 0 ? (
                                <>
                                    <AlertCircle className="h-3 w-3" />
                                    {kpis.outlets_unpaid} outlet memiliki tagihan
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="h-3 w-3 text-emerald-500" />
                                    <span className="text-emerald-500">Semua outlet lunas</span>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="rounded-lg border border-border bg-white p-5">
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                            <Store className="h-4 w-4 text-amber-500" />
                            Outlet Belum Bayar
                        </div>
                        <div className="mt-2 text-3xl font-bold text-text">{kpis.outlets_unpaid}</div>
                        <div className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-500">
                            <AlertCircle className="h-3 w-3" />
                            Outlet dengan sisa tagihan
                        </div>
                    </div>
                    <div className="rounded-lg border border-border bg-white p-5">
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                            <Clock className="h-4 w-4 text-orange-500" />
                            Jatuh Tempo Minggu Ini
                        </div>
                        <div className="mt-2 text-3xl font-bold text-text">{formatCurrency(kpis.due_this_week)}</div>
                        <div className="mt-1 flex items-center gap-1 text-xs font-medium text-orange-500">
                            {kpis.due_this_week > 0 ? (
                                <>
                                    <AlertCircle className="h-3 w-3" />
                                    Segera tindak lanjuti
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="h-3 w-3 text-emerald-500" />
                                    <span className="text-emerald-500">Tidak ada jatuh tempo</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </aside>
        </div>
    );
}
