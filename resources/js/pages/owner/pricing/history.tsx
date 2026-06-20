import OwnerPageShell from '@/components/owner/owner-page-shell';
import Pagination from '@/components/pagination';
import DataTable from '@/components/ui/data-table';
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

const columns = [
    { key: 'created_at', label: 'Waktu', className: 'text-xs text-slate-500', render: (row: AuditLog) => formatDate(row.created_at) },
    { key: 'outlet', label: 'Outlet', className: 'text-sm text-slate-900' },
    { key: 'product', label: 'Produk', className: 'text-sm text-slate-900' },
    {
        key: 'old_price',
        label: 'Lama',
        className: 'text-right tabular-nums text-slate-500',
        render: (row: AuditLog) => (row.old_price ? formatCurrency(row.old_price) : '-'),
    },
    {
        key: 'new_price',
        label: 'Baru',
        className: 'text-right tabular-nums font-semibold text-slate-900',
        render: (row: AuditLog) => formatCurrency(row.new_price),
    },
    {
        key: 'action',
        label: 'Aksi',
        render: (row: AuditLog) => (
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                {actionLabels[row.action] ?? row.action}
            </span>
        ),
    },
    { key: 'changed_by', label: 'Oleh', className: 'text-xs text-slate-500' },
];

export default function PricingHistory({ logs }: Props) {
    return (
        <OwnerPageShell title="Riwayat Harga" subtitle="Lihat semua perubahan harga">
            <DataTable columns={columns} data={logs.data} rowKey="id" emptyMessage="Belum ada riwayat perubahan harga." />

            {logs.links && logs.links.length > 3 && <Pagination links={logs.links} />}
        </OwnerPageShell>
    );
}
