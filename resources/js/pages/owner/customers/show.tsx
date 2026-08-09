import {
    Clock,
    DollarSign,
    Receipt,
    ShoppingBag,
    User,
} from 'lucide-react';
import OwnerDetailRow from '@/components/owner/owner-detail-row';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import OwnerTable from '@/components/owner/owner-table';
import EmptyState from '@/components/ui/empty-state';
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
import { getOrderStatus } from '@/lib/status-labels';

function StatCard({
    icon,
    label,
    value,
    tone,
}: {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
    tone: string;
}) {
    return (
        <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-muted">
                    {label}
                </span>
                <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}
                >
                    {icon}
                </span>
            </div>
            <div className="font-heading text-xl font-bold tabular-nums text-text sm:text-2xl">
                {value}
            </div>
        </div>
    );
}

export default function CustomerShow({ customer, orders, stats }: any) {
    if (!customer) {
        return (
            <OwnerPageShell
                title="Memuat..."
                subtitle="Detail pelanggan"
                backHref="/owner/customers"
            >
                <EmptyState
                    icon={<User className="h-8 w-8" />}
                    title="Pelanggan tidak ditemukan"
                />
            </OwnerPageShell>
        );
    }

    return (
        <OwnerPageShell
            title={customer.name ?? 'Pelanggan'}
            subtitle="Detail informasi pelanggan"
            backHref="/owner/customers"
        >
            <div className="space-y-6">
                {/* KPI */}
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <StatCard
                        icon={
                            <ShoppingBag className="h-5 w-5 text-[#2563EB]" />
                        }
                        label="Total Order"
                        value={stats.total_orders}
                        tone="bg-[#2563EB]/10 text-[#2563EB]"
                    />
                    <StatCard
                        icon={
                            <DollarSign className="h-5 w-5 text-emerald-600" />
                        }
                        label="Total Belanja"
                        value={formatCurrency(stats.total_spend)}
                        tone="bg-emerald-500/10 text-emerald-600"
                    />
                    <StatCard
                        icon={<Receipt className="h-5 w-5 text-amber-600" />}
                        label="Rata-rata Order"
                        value={formatCurrency(stats.avg_order)}
                        tone="bg-amber-500/10 text-amber-600"
                    />
                    <StatCard
                        icon={<Clock className="h-5 w-5 text-[#7C3AED]" />}
                        label="Terakhir Belanja"
                        value={formatDate(stats.last_order_at)}
                        tone="bg-[#7C3AED]/10 text-[#7C3AED]"
                    />
                </div>

                {/* Info */}
                <div className="space-y-3 rounded-2xl border border-border bg-surface p-5">
                    <h3 className="text-sm font-bold text-text">
                        Informasi Pelanggan
                    </h3>
                    <OwnerDetailRow label="Nama" value={customer.name} />
                    <OwnerDetailRow label="Email" value={customer.email} />
                    <OwnerDetailRow label="No. HP" value={customer.phone} />
                    <OwnerDetailRow
                        label="Status"
                        value={
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
                        }
                    />
                    <OwnerDetailRow
                        label="Terakhir Belanja"
                        value={formatDate(customer.last_order_at)}
                    />
                    <OwnerDetailRow
                        label="Tanggal Daftar"
                        value={formatDate(customer.created_at)}
                    />
                </div>

                {/* Riwayat */}
                <div className="space-y-3 rounded-2xl border border-border bg-surface p-5">
                    <h3 className="text-sm font-bold text-text">
                        Riwayat Transaksi
                    </h3>
                    {orders.length === 0 ? (
                        <EmptyState
                            icon={<ShoppingBag className="h-8 w-8" />}
                            title="Belum ada transaksi"
                            description="Pelanggan ini belum pernah melakukan order"
                        />
                    ) : (
                        <OwnerTable noWrapper>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="px-4 py-3 text-xs font-semibold text-text-muted">
                                            Kode
                                        </TableHead>
                                        <TableHead className="px-4 py-3 text-xs font-semibold text-text-muted">
                                            Status
                                        </TableHead>
                                        <TableHead className="px-4 py-3 text-xs font-semibold text-text-muted">
                                            Outlet
                                        </TableHead>
                                        <TableHead className="px-4 py-3 text-right text-xs font-semibold text-text-muted">
                                            Total
                                        </TableHead>
                                        <TableHead className="px-4 py-3 text-xs font-semibold text-text-muted">
                                            Tanggal
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {orders.map((order: any) => {
                                        const s = getOrderStatus(order.status);

                                        return (
                                            <TableRow
                                                key={order.id}
                                                className="border-t border-border/20"
                                            >
                                                <TableCell className="px-4 py-3 font-mono font-bold text-primary tabular-nums">
                                                    {order.order_code}
                                                </TableCell>
                                                <TableCell className="px-4 py-3">
                                                    <StatusBadge
                                                        variant={s.variant}
                                                        size="sm"
                                                    >
                                                        {s.label}
                                                    </StatusBadge>
                                                </TableCell>
                                                <TableCell className="px-4 py-3 text-text-muted">
                                                    {order.outlet?.name ?? '—'}
                                                </TableCell>
                                                <TableCell className="px-4 py-3 text-right font-semibold tabular-nums text-text">
                                                    {formatCurrency(
                                                        order.total,
                                                    )}
                                                </TableCell>
                                                <TableCell className="px-4 py-3 text-text-muted">
                                                    {formatDate(
                                                        order.created_at,
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </OwnerTable>
                    )}
                </div>
            </div>
        </OwnerPageShell>
    );
}