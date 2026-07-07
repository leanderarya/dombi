import { Link, router } from '@inertiajs/react';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import EmptyState from '@/components/ui/empty-state';
import StatusBadge from '@/components/ui/status-badge';
import { formatDate } from '@/lib/format';

interface Props {
    reports?: any;
    filters?: Record<string, any>;
}

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

export function MasalahTab({ reports, filters = {} }: Props) {
    const [activeFilter, setActiveFilter] = useState(filters.status ?? '');

    const handleFilterChange = (key: string) => {
        setActiveFilter(key);
        router.get('/owner/analytics', { tab: 'masalah', ...(key ? { status: key } : {}) }, { preserveState: true, replace: true });
    };

    if (!reports || reports.data.length === 0) {
        return (
            <div className="space-y-4">
                <FilterChips activeFilter={activeFilter} onChange={handleFilterChange} />
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
            <FilterChips activeFilter={activeFilter} onChange={handleFilterChange} />

            <div className="space-y-2">
                {reports.data.map((report: any) => (
                    <Link
                        key={report.id}
                        href={`/owner/order-reports/${report.id}`}
                        className="block rounded-lg border border-border bg-surface p-4 active:opacity-80"
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

function FilterChips({ activeFilter, onChange }: { activeFilter: string; onChange: (key: string) => void }) {
    const colorMap: Record<string, string> = {
        pending: 'text-amber-600 bg-amber-50 ring-amber-200',
        investigating: 'text-blue-600 bg-blue-50 ring-blue-200',
        resolved: 'text-emerald-600 bg-emerald-50 ring-emerald-200',
        rejected: 'text-red-600 bg-red-50 ring-red-200',
    };

    return (
        <div className="flex flex-wrap gap-2 overflow-x-auto scrollbar-none">
            {reportStatusFilters.map((option) => (
                <button
                    key={option.key}
                    onClick={() => onChange(option.key)}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition-all ${
                        activeFilter === option.key
                            ? colorMap[option.key] ?? 'bg-primary/10 text-primary ring-primary/20'
                            : 'bg-surface text-text-muted ring-border hover:bg-surface-muted'
                    }`}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}
