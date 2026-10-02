import { Link, router } from '@inertiajs/react';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import EmptyState from '@/components/ui/empty-state';
import Pagination from '@/components/ui/pagination';
import { SkeletonPage } from '@/components/ui/skeleton';
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
        router.get(
            '/owner/analytics',
            { tab: 'masalah', ...(key ? { status: key } : {}) },
            { preserveState: true, replace: true },
        );
    };

    if (!reports) {
        return <SkeletonPage />;
    }

    if (reports.data.length === 0) {
        return (
            <div className="space-y-4">
                <ColorFilterChips
                    activeFilter={activeFilter}
                    onChange={handleFilterChange}
                />
                <EmptyState
                    icon={
                        <AlertTriangle
                            className="h-8 w-8 text-text-subtle"
                            aria-hidden="true"
                        />
                    }
                    title="Belum ada laporan"
                    description="Laporan masalah dari customer akan muncul di sini."
                />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <ColorFilterChips
                activeFilter={activeFilter}
                onChange={handleFilterChange}
            />

            <div className="space-y-2" aria-label="Daftar laporan masalah">
                {reports.data.map((report: any) => (
                    <Link
                        key={report.id}
                        href={`/owner/order-reports/${report.id}`}
                        className="block rounded-xl bg-surface p-4 shadow-card active:opacity-80"
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="text-sm font-semibold text-text">
                                    {report.order?.order_code ??
                                        `Order #${report.order_id}`}
                                </div>
                                <div className="mt-0.5 text-xs text-text-muted">
                                    {report.customer?.name}
                                </div>
                            </div>
                            <StatusBadge
                                status={
                                    report.status === 'pending'
                                        ? 'pending_confirmation'
                                        : report.status
                                }
                            />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
                            <span>
                                {reportTypeLabels[report.type] ?? report.type}
                            </span>
                            <span>{formatDate(report.created_at)}</span>
                        </div>
                    </Link>
                ))}
            </div>

            {reports.links && <Pagination links={reports.links} />}
        </div>
    );
}

function ColorFilterChips({
    activeFilter,
    onChange,
}: {
    activeFilter: string;
    onChange: (key: string) => void;
}) {
    /*
     * These four are the *selected* state, so they read as a wash with a ring,
     * not a solid fill. Every one of them was `text-X-text` on the solid `bg-X`
     * — the dark ink token sitting on its own fill, which is the pair the
     * tokens are not designed for and measured 1.00:1 to 1.58:1:
     *
     *   rejected      text-danger       on bg-danger    1.00:1 (identical)
     *   investigating text-info-text    on bg-info      1.30:1
     *   resolved      text-success-text on bg-primary   1.40:1
     *   pending       text-warning-text on bg-warning   1.58:1
     *
     * The `-text` tokens are the readable half of the `X-bg` wash pair, which
     * is what the inactive branch below already uses — the two were inverted,
     * and the inactive chips were the legible ones.
     *
     * The wash is barely a wash (1.04:1 to 1.09:1 against the inactive
     * `bg-surface`), which would leave colour as the only thing telling the
     * selected chip apart — a WCAG 1.4.1 failure on its own. Two things carry
     * it instead: `aria-pressed` on the button, so the state is in the
     * accessibility tree rather than inferred, and the 2px ring below, which
     * is a shape difference rather than a hue one. The ring width lives in
     * both branches rather than the base class, because `ring-1` and `ring-2`
     * are the same property and would resolve by stylesheet order, not by
     * which branch won.
     */
    const colorMap: Record<string, string> = {
        pending: 'text-warning-text bg-warning-bg ring-2 ring-warning-border',
        investigating: 'text-info-text bg-info-bg ring-2 ring-info-border',
        resolved: 'text-success-text bg-success-bg ring-2 ring-success-border',
        rejected: 'text-danger-text bg-danger-bg ring-2 ring-danger-border',
    };
    const activeFallback = 'bg-primary/10 text-primary ring-2 ring-primary/20';

    return (
        <div
            className="scrollbar-none flex flex-wrap gap-2 overflow-x-auto"
            role="group"
            aria-label="Filter status laporan"
        >
            {reportStatusFilters.map((option) => (
                <button
                    key={option.key}
                    type="button"
                    onClick={() => onChange(option.key)}
                    aria-pressed={activeFilter === option.key}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center ${
                        activeFilter === option.key
                            ? (colorMap[option.key] ?? activeFallback)
                            : 'bg-surface text-text-muted ring-1 ring-border hover:bg-mint-wash'
                    }`}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}
