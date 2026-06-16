import { Head } from '@inertiajs/react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
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

interface PaginatedLogs {
    data: AuditLog[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
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

export default function PricingHistory({ logs }: Props) {
    return (
        <OwnerPageShell title="Riwayat Harga" subtitle="Lihat semua perubahan harga">
            <div className="rounded-xl border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-100">
                                <th className="px-4 py-3 text-left font-medium text-slate-500">Waktu</th>
                                <th className="px-4 py-3 text-left font-medium text-slate-500">Outlet</th>
                                <th className="px-4 py-3 text-left font-medium text-slate-500">Produk</th>
                                <th className="px-4 py-3 text-right font-medium text-slate-500">Lama</th>
                                <th className="px-4 py-3 text-right font-medium text-slate-500">Baru</th>
                                <th className="px-4 py-3 text-left font-medium text-slate-500">Aksi</th>
                                <th className="px-4 py-3 text-left font-medium text-slate-500">Oleh</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.data.map((log) => (
                                <tr key={log.id} className="border-b border-slate-50 last:border-0">
                                    <td className="px-4 py-3 text-xs text-slate-500">
                                        {formatDate(log.created_at)}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-900">{log.outlet}</td>
                                    <td className="px-4 py-3 text-sm text-slate-900">{log.product}</td>
                                    <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                                        {log.old_price ? formatCurrency(log.old_price) : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">
                                        {formatCurrency(log.new_price)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                            {actionLabels[log.action] ?? log.action}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-500">{log.changed_by}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {logs.data.length === 0 && (
                    <div className="p-8 text-center text-sm text-slate-500">Belum ada riwayat perubahan harga.</div>
                )}
            </div>

            {/* Pagination */}
            {logs.last_page > 1 && (
                <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                    <span>Halaman {logs.current_page} dari {logs.last_page}</span>
                    <span>{logs.total} total entri</span>
                </div>
            )}
        </OwnerPageShell>
    );
}
