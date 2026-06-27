import { DollarSign, Store, Clock, Search, PartyPopper } from 'lucide-react';
import { useState, useMemo } from 'react';
import FinanceFilterTabs from '@/components/owner/finance/finance-filter-tabs';
import FinanceKpiCard from '@/components/owner/finance/finance-kpi-card';
import FinanceOutletCard from '@/components/owner/finance/finance-outlet-card';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { formatCurrency } from '@/lib/format';

const FILTER_TABS = [
    { key: 'action_needed', label: 'Butuh Tindakan' },
    { key: 'overdue', label: 'Terlambat' },
    { key: 'unpaid', label: 'Belum Bayar' },
    { key: 'paid', label: 'Lunas' },
];

export default function FinanceDashboard({ kpis, outlets }: any) {
    const [filter, setFilter] = useState('action_needed');
    const [search, setSearch] = useState('');

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
        <OwnerPageShell title="Dashboard Tagihan" subtitle="Pantau kewajiban seluruh outlet">
            <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
                {/* Left: Filters + Outlet List */}
                <div>
                    {/* Sticky Filters + Search */}
                    <div className="sticky top-0 z-20 -mx-4 border-b border-border bg-surface/80 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <FinanceFilterTabs tabs={FILTER_TABS} active={filter} onChange={setFilter} />
                            <div className="relative sm:w-56">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Cari outlet..."
                                    className="w-full rounded-full border border-border bg-white py-2 pl-9 pr-8 text-sm placeholder:text-text-subtle focus:border-primary focus:ring-1 focus:ring-primary/30"
                                />
                                {search && (
                                    <button
                                        type="button"
                                        onClick={() => setSearch('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text-muted"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Outlet List */}
                    <section className="mt-4">
                        {filtered.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-border bg-white py-16 text-center">
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
                    <div className="sticky top-20 space-y-4">
                        <FinanceKpiCard
                            label="Total Belum Dibayar"
                            value={formatCurrency(kpis.total_unpaid)}
                            accent="red"
                            icon={<DollarSign className="h-4 w-4" />}
                            subtext={kpis.outlets_unpaid > 0 ? `${kpis.outlets_unpaid} outlet memiliki tagihan` : 'Semua outlet lunas'}
                        />
                        <FinanceKpiCard
                            label="Outlet Belum Bayar"
                            value={`${kpis.outlets_unpaid}`}
                            accent="amber"
                            icon={<Store className="h-4 w-4" />}
                            subtext="Outlet dengan sisa tagihan"
                        />
                        <FinanceKpiCard
                            label="Jatuh Tempo Minggu Ini"
                            value={formatCurrency(kpis.due_this_week)}
                            accent="orange"
                            icon={<Clock className="h-4 w-4" />}
                            subtext={kpis.due_this_week > 0 ? 'Segera tindak lanjuti' : 'Tidak ada jatuh tempo'}
                        />
                    </div>
                </aside>

                {/* Mobile/Tablet: KPI Strip at top */}
                <section className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3 lg:hidden">
                    <FinanceKpiCard
                        label="Total Belum Dibayar"
                        value={formatCurrency(kpis.total_unpaid)}
                        accent="red"
                        icon={<DollarSign className="h-4 w-4" />}
                        subtext={kpis.outlets_unpaid > 0 ? `${kpis.outlets_unpaid} outlet memiliki tagihan` : 'Semua outlet lunas'}
                    />
                    <FinanceKpiCard
                        label="Outlet Belum Bayar"
                        value={`${kpis.outlets_unpaid}`}
                        accent="amber"
                        icon={<Store className="h-4 w-4" />}
                        subtext="Outlet dengan sisa tagihan"
                    />
                    <FinanceKpiCard
                        label="Jatuh Tempo Minggu Ini"
                        value={formatCurrency(kpis.due_this_week)}
                        accent="orange"
                        icon={<Clock className="h-4 w-4" />}
                        subtext={kpis.due_this_week > 0 ? 'Segera tindak lanjuti' : 'Tidak ada jatuh tempo'}
                    />
                </section>
            </div>
        </OwnerPageShell>
    );
}
