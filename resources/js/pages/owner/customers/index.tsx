import { router } from '@inertiajs/react';
import { Users } from 'lucide-react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import OwnerTable from '@/components/owner/owner-table';
import EmptyState from '@/components/ui/empty-state';
import Pagination from '@/components/ui/pagination';
import { SkeletonPage } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui/status-badge';
import {
    Table,
    TableHeader,
    TableBody,
    TableHead,
    TableRow,
    TableCell,
} from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/format';

export default function CustomersIndex({ customers }: any) {
    if (!customers) {
        return <SkeletonPage />;
    }

    return (
        <OwnerPageShell
            title="Pelanggan"
            subtitle="Informasi pelanggan dan riwayat transaksi"
        >
            <div className="space-y-6">
                {customers.data.length === 0 ? (
                    <EmptyState
                        icon={<Users className="h-8 w-8" />}
                        title="Belum ada pelanggan"
                        description="Pelanggan akan muncul setelah ada transaksi"
                    />
                ) : (
                    <OwnerTable>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="px-4 py-3 text-xs font-semibold text-text-muted">
                                        Nama
                                    </TableHead>
                                    <TableHead className="px-4 py-3 text-xs font-semibold text-text-muted">
                                        No. HP
                                    </TableHead>
                                    <TableHead className="px-4 py-3 text-xs font-semibold text-text-muted">
                                        Status
                                    </TableHead>
                                    <TableHead className="px-4 py-3 text-right text-xs font-semibold text-text-muted">
                                        Total Order
                                    </TableHead>
                                    <TableHead className="px-4 py-3 text-right text-xs font-semibold text-text-muted">
                                        Total Belanja
                                    </TableHead>
                                    <TableHead className="px-4 py-3 text-xs font-semibold text-text-muted">
                                        Terakhir Belanja
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {customers.data.map((customer: any) => (
                                    <TableRow
                                        key={customer.id}
                                        className="cursor-pointer border-t border-border/20 transition-colors hover:bg-emerald-50/40"
                                        onClick={() =>
                                            router.visit(
                                                `/owner/customers/${customer.id}`,
                                            )
                                        }
                                    >
                                        <TableCell className="px-4 py-3 font-medium text-text">
                                            {customer.name ?? '—'}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-text-muted">
                                            {customer.phone ?? '—'}
                                        </TableCell>
                                        <TableCell className="px-4 py-3">
                                            <StatusBadge
                                                variant={
                                                    customer.is_registered
                                                        ? 'success'
                                                        : 'neutral'
                                                }
                                                size="sm"
                                            >
                                                {customer.is_registered
                                                    ? 'Terdaftar'
                                                    : 'Guest'}
                                            </StatusBadge>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-right tabular-nums text-text">
                                            {customer.orders_count}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-right font-semibold tabular-nums text-text">
                                            {formatCurrency(
                                                customer.total_spend ?? 0,
                                            )}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-text-muted">
                                            {formatDate(customer.last_order_at)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </OwnerTable>
                )}

                <Pagination links={customers.links} />
            </div>
        </OwnerPageShell>
    );
}