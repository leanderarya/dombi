import OwnerPageShell from '@/components/owner/owner-page-shell';
import Pagination from '@/components/pagination';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency, formatDate } from '@/lib/format';

interface AuditLog {
    id: number;
    outlet: string;
    product: string;
    old_price: number;
    new_price: number;
    action: string;
    changed_by: string;
    created_at: string;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface PaginatedLogs {
    data: AuditLog[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    links: PaginationLink[];
}

interface Props {
    logs: PaginatedLogs;
}

const actionLabels: Record<string, string> = {
    update: 'Ubah',
    bulk_update: 'Ubah Massal',
    copy: 'Salin',
    master_update: 'Harga Pusat',
};

const actionVariants: Record<string, 'success' | 'warning' | 'info' | 'neutral'> = {
    update: 'info',
    bulk_update: 'warning',
    copy: 'neutral',
    master_update: 'success',
};

export default function PricingHistory({ logs }: Props) {
    return (
        <OwnerPageShell title="Riwayat Harga" subtitle="Lihat semua perubahan harga">
            {logs.data.length === 0 && (
                <div className="rounded-xl border border-border bg-white p-10 text-center">
                    <p className="text-sm text-text-muted">Belum ada riwayat perubahan harga.</p>
                </div>
            )}
            <div className="space-y-3">
                {logs.data.map((log) => (
                    <div key={log.id} className="rounded-xl border border-border bg-white p-5 transition-all duration-200 hover:shadow-md">
                        {/* Top row: product + action badge + new price */}
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="text-lg font-bold text-text">{log.product}</div>
                                <div className="mt-1">
                                    <StatusBadge variant={actionVariants[log.action] ?? 'neutral'} size="sm">
                                        {actionLabels[log.action] ?? log.action}
                                    </StatusBadge>
                                </div>
                            </div>
                            <span className="text-lg font-bold tabular-nums text-primary">{formatCurrency(log.new_price)}</span>
                        </div>

                        {/* Middle row: metadata */}
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-muted">
                            <span>{log.outlet}</span>
                            <span className="text-text-subtle">&middot;</span>
                            <span>{formatDate(log.created_at)}</span>
                            <span className="text-text-subtle">&middot;</span>
                            <span>{log.changed_by}</span>
                            {log.old_price != null && (
                                <>
                                    <span className="text-text-subtle">&middot;</span>
                                    <span>
                                        Lama: <span className="line-through">{formatCurrency(log.old_price)}</span>
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {logs.links && logs.links.length > 3 && <Pagination links={logs.links} />}
        </OwnerPageShell>
    );
}
