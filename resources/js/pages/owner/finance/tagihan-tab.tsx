import {
    CalendarClock,
    PartyPopper,
    Receipt,
    Store,
    StoreIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import FinanceOutletCard from '@/components/owner/finance/finance-outlet-card';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import EmptyState from '@/components/ui/empty-state';
import FilterChips from '@/components/ui/filter-chips';
import { SkeletonPage } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/format';

const STATUS_FILTERS = [
    { key: '', label: 'Semua' },
    { key: 'action_needed', label: 'Butuh Tindakan' },
    { key: 'overdue', label: 'Terlambat' },
    { key: 'unpaid', label: 'Belum Bayar' },
    { key: 'paid', label: 'Lunas' },
];

export default function TagihanTab({ kpis, outlets }: any) {
    const [filter, setFilter] = useState('action_needed');
    const [search, setSearch] = useState('');
    const [dueDate, setDueDate] = useState('');

    const filtered = useMemo(() => {
        return (outlets ?? []).filter((o: any) => {
            if (filter === 'action_needed') {
                if (
                    o.display_status !== 'overdue' &&
                    o.display_status !== 'unpaid'
                ) {
                    return false;
                }
            } else if (filter && o.display_status !== filter) {
                return false;
            }

            if (
                search &&
                !o.outlet_name.toLowerCase().includes(search.toLowerCase())
            ) {
                return false;
            }

            if (dueDate && o.nearest_due_date !== dueDate) {
                return false;
            }

            return true;
        });
    }, [outlets, filter, search, dueDate]);

    if (!kpis || !outlets) {
        return <SkeletonPage />;
    }

    return (
        <>
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-text-muted">
                            Belum Dibayar
                        </span>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-600">
                            <Receipt className="h-5 w-5" />
                        </span>
                    </div>
                    <div
                        className={`font-heading text-xl font-bold tabular-nums sm:text-2xl ${kpis.total_unpaid > 0 ? 'text-red-600' : 'text-text'}`}
                    >
                        {formatCurrency(kpis.total_unpaid)}
                    </div>
                </div>
                <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-text-muted">
                            Outlet
                        </span>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563EB]/10 text-[#2563EB]">
                            <StoreIcon className="h-5 w-5" />
                        </span>
                    </div>
                    <div className="font-heading text-xl font-bold text-text tabular-nums sm:text-2xl">
                        {kpis.outlets_unpaid}
                    </div>
                    <p
                        className={`text-[11px] ${kpis.outlets_unpaid > 0 ? 'text-amber-600' : 'text-emerald-600'}`}
                    >
                        {kpis.outlets_unpaid > 0
                            ? 'Memiliki tagihan'
                            : 'Semua lunas'}
                    </p>
                </div>
                <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-text-muted">
                            Jatuh Tempo
                        </span>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                            <CalendarClock className="h-5 w-5" />
                        </span>
                    </div>
                    <div
                        className={`font-heading text-xl font-bold tabular-nums sm:text-2xl ${kpis.due_this_week > 0 ? 'text-orange-600' : 'text-text'}`}
                    >
                        {formatCurrency(kpis.due_this_week)}
                    </div>
                </div>
            </div>

            <div
                className="mb-4 flex flex-wrap items-center gap-2"
                role="group"
                aria-label="Filter status tagihan"
            >
                <FilterChips
                    options={STATUS_FILTERS}
                    active={filter}
                    onChange={setFilter}
                    variant="ring"
                    size="sm"
                />
            </div>

            <OwnerFilterCard
                collapsible
                defaultExpanded={false}
                searchPlaceholder="Cari outlet..."
                searchValue={search}
                onSearch={setSearch}
                dateValue={dueDate}
                onDateChange={setDueDate}
            />

            {filtered.length === 0 ? (
                <EmptyState
                    icon={
                        search ? (
                            <Store className="h-8 w-8" aria-hidden="true" />
                        ) : filter === 'paid' || filter === 'action_needed' ? (
                            <PartyPopper
                                className="h-8 w-8"
                                aria-hidden="true"
                            />
                        ) : (
                            <Store className="h-8 w-8" aria-hidden="true" />
                        )
                    }
                    title={
                        search
                            ? 'Outlet tidak ditemukan'
                            : filter === 'action_needed'
                              ? 'Tidak ada outlet yang butuh tindakan'
                              : filter === 'paid'
                                ? 'Semua outlet sudah lunas'
                                : 'Belum ada outlet dengan status ini'
                    }
                    description={
                        search
                            ? 'Coba kata kunci lain'
                            : filter === 'action_needed'
                              ? 'Semua tagihan sudah tertangani'
                              : filter === 'paid'
                                ? 'Tidak ada tagihan aktif'
                                : 'Coba filter lain untuk melihat outlet'
                    }
                />
            ) : (
                <div className="space-y-2" aria-label="Daftar outlet">
                    {filtered.map((o: any) => (
                        <FinanceOutletCard
                            key={o.outlet_id}
                            outletId={o.outlet_id}
                            outletName={o.outlet_name}
                            totalSales={o.total_sales}
                            totalOutstanding={o.total_outstanding}
                            totalPaid={o.total_paid}
                            netAmount={o.net_amount}
                            direction={o.direction ?? 'outlet_pays_owner'}
                            displayStatus={o.display_status}
                            nearestDueDate={o.nearest_due_date}
                        />
                    ))}
                </div>
            )}
        </>
    );
}
