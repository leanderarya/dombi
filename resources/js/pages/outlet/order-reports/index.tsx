import { Head, Link, router } from '@inertiajs/react';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import EmptyState from '@/components/ui/empty-state';
import FilterChips from '@/components/ui/filter-chips';
import StatusBadge from '@/components/ui/status-badge';
import OutletLayout from '@/layouts/outlet-layout';
import { formatDate } from '@/lib/format';

const statusFilters = [
    { key: '', label: 'Semua' },
    { key: 'pending', label: 'Menunggu' },
    { key: 'investigating', label: 'Ditinjau' },
    { key: 'resolved', label: 'Selesai' },
    { key: 'rejected', label: 'Ditolak' },
];

const typeLabels: Record<string, string> = {
    not_received: 'Barang tidak diterima',
    wrong_items: 'Barang salah',
    damaged: 'Barang rusak',
    other: 'Lainnya',
};

export default function OutletOrderReportsIndex({ reports, filters }: any) {
    const [activeFilter, setActiveFilter] = useState(filters.status ?? '');

    const handleFilterChange = (key: string) => {
        setActiveFilter(key);
        router.get('/outlet/order-reports', key ? { status: key } : {}, { preserveState: true, replace: true });
    };

    return (
        <OutletLayout
            title="Laporan Masalah"
            headerBelow={<FilterChips options={statusFilters} active={activeFilter} onChange={handleFilterChange} />}
        >
            <Head title="Laporan Masalah" />

            <div className="mt-4 space-y-2">
                {reports.data.length === 0 ? (
                    <EmptyState
                        icon={<AlertTriangle className="h-8 w-8 text-text-subtle" />}
                        title="Belum ada laporan"
                        description="Laporan masalah untuk pesanan outlet Anda akan muncul di sini."
                    />
                ) : (
                    reports.data.map((report: any) => (
                        <Link
                            key={report.id}
                            href={`/outlet/order-reports/${report.id}`}
                            className="block rounded-xl border border-border bg-white p-4 active:opacity-80"
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="text-sm font-semibold text-text">{report.order?.order_code ?? `Order #${report.order_id}`}</div>
                                    <div className="mt-0.5 text-xs text-text-muted">{report.customer?.name}</div>
                                </div>
                                <StatusBadge status={report.status === 'pending' ? 'pending_confirmation' : report.status === 'investigating' ? 'preparing' : report.status} />
                            </div>
                            <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
                                <span>{typeLabels[report.type] ?? report.type}</span>
                                <span>{formatDate(report.created_at)}</span>
                            </div>
                        </Link>
                    ))
                )}
            </div>

            {reports.last_page > 1 && (
                <div className="mt-4 flex justify-center gap-2">
                    {reports.links?.map((link: any, i: number) => (
                        <Link
                            key={i}
                            href={link.url ?? '#'}
                            className={`min-h-11 min-w-11 flex items-center justify-center rounded-lg text-sm ${link.active ? 'bg-primary text-white' : 'bg-surface-muted text-text-muted'}`}
                            dangerouslySetInnerHTML={{ __html: link.label }}
                        />
                    ))}
                </div>
            )}
        </OutletLayout>
    );
}
