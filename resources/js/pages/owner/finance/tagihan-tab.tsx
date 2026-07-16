import { DollarSign, Store, PartyPopper } from 'lucide-react';
import { useMemo, useState } from 'react';
import FinanceOutletCard from '@/components/owner/finance/finance-outlet-card';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import OwnerKpiStrip from '@/components/owner/owner-kpi-strip';
import EmptyState from '@/components/ui/empty-state';
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

    if (!kpis || !outlets) {
        return <SkeletonPage />;
    }

    const filtered = useMemo(() => {
        return outlets.filter((o: any) => {
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

            if (search) {
                return o.outlet_name
                    .toLowerCase()
                    .includes(search.toLowerCase());
            }

            return true;
        });
    }, [outlets, filter, search]);

    return (
        <>
            <OwnerKpiStrip
                items={[
                    {
                        label: 'Belum Dibayar',
                        value: formatCurrency(kpis.total_unpaid),
                        valueClassName:
                            kpis.total_unpaid > 0
                                ? 'text-red-600'
                                : 'text-text',
                    },
                    {
                        label: 'Outlet',
                        value: kpis.outlets_unpaid,
                        sublabel:
                            kpis.outlets_unpaid > 0
                                ? 'Memiliki tagihan'
                                : 'Semua lunas',
                        sublabelColor:
                            kpis.outlets_unpaid > 0
                                ? 'text-amber-600'
                                : 'text-emerald-600',
                    },
                    {
                        label: 'Jatuh Tempo',
                        value: formatCurrency(kpis.due_this_week),
                        valueClassName:
                            kpis.due_this_week > 0
                                ? 'text-orange-600'
                                : 'text-text',
                    },
                ]}
            />

            <div
                className="mb-4 flex flex-wrap items-center gap-2"
                role="group"
                aria-label="Filter status tagihan"
            >
                {STATUS_FILTERS.map((sf) => {
                    const isActive = filter === sf.key;
                    const colorMap: Record<string, string> = {
                        '': 'text-text bg-surface-muted ring-border',
                        action_needed:
                            'text-amber-600 bg-amber-50 ring-amber-200',
                        overdue: 'text-red-600 bg-red-50 ring-red-200',
                        unpaid: 'text-blue-600 bg-blue-50 ring-blue-200',
                        paid: 'text-emerald-600 bg-emerald-50 ring-emerald-200',
                    };

                    return (
                        <button
                            key={sf.key}
                            type="button"
                            onClick={() => setFilter(sf.key)}
                            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-all ${
                                isActive
                                    ? (colorMap[sf.key] ??
                                      'bg-primary/10 text-primary ring-primary/20')
                                    : 'hover:bg-mint-wash bg-surface text-text-muted ring-border'
                            }`}
                        >
                            {sf.label}
                        </button>
                    );
                })}
            </div>

            <OwnerFilterCard
                collapsible
                defaultExpanded={false}
                searchPlaceholder="Cari outlet..."
                searchValue={search}
                onSearch={setSearch}
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
                            displayStatus={o.display_status}
                            nearestDueDate={o.nearest_due_date}
                        />
                    ))}
                </div>
            )}
        </>
    );
}
