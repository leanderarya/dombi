import { Link, router } from '@inertiajs/react';
import { LayoutGrid, MapPin, Package, Truck, XCircle } from 'lucide-react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import Pagination from '@/components/pagination';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/empty-state';
import DeliveryStatusBadge from '@/components/delivery-status-badge';
import { formatDate } from '@/lib/format';

const statusOptions = [
    { value: '', label: 'Semua' },
    { value: 'waiting_pickup', label: 'Menunggu Pickup' },
    { value: 'picked_up', label: 'Diambil Kurir' },
    { value: 'delivering', label: 'Dalam Pengiriman' },
    { value: 'completed', label: 'Selesai' },
    { value: 'failed', label: 'Gagal' },
];

const statusBorderMap: Record<string, string> = {
    waiting_pickup: 'border-l-amber-400',
    picked_up: 'border-l-blue-400',
    delivering: 'border-l-indigo-400',
    completed: 'border-l-emerald-400',
    failed: 'border-l-red-400',
    retry_delivery: 'border-l-orange-400',
    returned_to_outlet: 'border-l-amber-400',
    cancelled_and_released: 'border-l-slate-300',
    waiting_assignment: 'border-l-slate-300',
};

export default function OwnerDeliveriesIndex({ deliveries, couriers, filters, stats }: any) {
    const setFilter = (key: string, value: string) => {
        router.get('/owner/deliveries', { ...filters, [key]: value || undefined }, { preserveState: true, replace: true });
    };

    return (
        <OwnerPageShell
            title="Pengiriman"
            headerRight={
                <Link href="/owner/deliveries/board">
                    <Button variant="outline" size="sm" className="gap-1.5">
                        <LayoutGrid className="h-4 w-4" />
                        Board View
                    </Button>
                </Link>
            }
        >
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                {/* Left: Filters + Delivery List */}
                <div className="space-y-4">
                    {/* Filter Pills */}
                    <div className="flex flex-wrap items-center gap-2">
                        {statusOptions.map((opt) => {
                            const isActive = (filters.status ?? '') === opt.value;

                            return (
                                <button
                                    key={opt.value}
                                    onClick={() => setFilter('status', opt.value)}
                                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                                        isActive
                                            ? 'bg-slate-900 text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            );
                        })}
                        <select
                            value={filters.courier_id ?? ''}
                            onChange={(e) => setFilter('courier_id', e.target.value)}
                            className="h-8 rounded-full border border-border bg-white px-3 text-xs font-medium text-slate-600"
                        >
                            <option value="">Semua kurir</option>
                            {couriers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    {/* Delivery Cards */}
                    {deliveries.data.length === 0 ? (
                        <EmptyState
                            icon={<Truck className="h-8 w-8 text-text-subtle" />}
                            title="Tidak ada pengiriman"
                            description="Pengiriman akan muncul setelah kurir di-assign."
                        />
                    ) : (
                        <div className="space-y-2">
                            {deliveries.data.map((d: any) => {
                                const borderColor = statusBorderMap[d.status] ?? 'border-l-slate-300';
                                const isActive = ['delivering', 'picked_up'].includes(d.status);

                                return (
                                    <Link
                                        key={d.id}
                                        href={`/owner/deliveries/${d.id}`}
                                        className={`block rounded-lg border border-slate-200 border-l-4 bg-white p-4 transition-all duration-150 hover:shadow-md ${borderColor}`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold tabular-nums text-slate-900">
                                                        {d.order?.order_code ?? '-'}
                                                    </span>
                                                    <DeliveryStatusBadge status={d.status} />
                                                </div>
                                                <div className="mt-1 text-xs text-slate-500">
                                                    {d.order?.outlet?.name ?? '-'}
                                                </div>
                                                <div className="mt-0.5 text-xs text-slate-400">
                                                    {d.courier?.name ?? 'Belum ada kurir'}
                                                </div>
                                            </div>
                                            <div className="text-right text-xs text-slate-400">
                                                {formatDate(d.assigned_at)}
                                            </div>
                                        </div>
                                        {isActive && (
                                            <div className="mt-3 flex justify-end">
                                                <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
                                                    <MapPin className="h-3 w-3" />
                                                    Lacak
                                                </span>
                                            </div>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                    <Pagination links={deliveries.links} />
                </div>

                {/* Right: KPI Stats Sidebar */}
                <aside className="hidden lg:block">
                    <div className="sticky top-4 space-y-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Statistik Hari Ini</h3>
                        <KpiCard
                            icon={<Package className="h-5 w-5" />}
                            label="Total Pengiriman"
                            value={stats.total_today}
                            color="slate"
                        />
                        <KpiCard
                            icon={<Truck className="h-5 w-5" />}
                            label="Aktif"
                            value={stats.active}
                            color="blue"
                        />
                        <KpiCard
                            icon={<Package className="h-5 w-5" />}
                            label="Selesai Hari Ini"
                            value={stats.completed_today}
                            color="emerald"
                        />
                        <KpiCard
                            icon={<XCircle className="h-5 w-5" />}
                            label="Gagal Hari Ini"
                            value={stats.failed_today}
                            color="red"
                            href="/owner/deliveries?status=failed"
                        />
                    </div>
                </aside>
            </div>
        </OwnerPageShell>
    );
}

function KpiCard({ icon, label, value, color, href }: {
    icon: React.ReactNode;
    label: string;
    value: number;
    color: 'slate' | 'blue' | 'emerald' | 'red';
    href?: string;
}) {
    const colorMap = {
        slate: { bg: 'bg-slate-50', text: 'text-slate-700', icon: 'text-slate-400' },
        blue: { bg: 'bg-blue-50', text: 'text-blue-700', icon: 'text-blue-400' },
        emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'text-emerald-400' },
        red: { bg: 'bg-red-50', text: 'text-red-700', icon: 'text-red-400' },
    };
    const c = colorMap[color];
    const Wrapper = href ? Link : 'div';

    return (
        <Wrapper
            {...(href ? { href } : {})}
            className={`flex items-center gap-3 rounded-xl border border-slate-200 ${c.bg} p-4 transition-all hover:shadow-sm`}
        >
            <div className={c.icon}>{icon}</div>
            <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
                <div className={`mt-0.5 text-2xl font-bold tabular-nums ${c.text}`}>{value}</div>
            </div>
        </Wrapper>
    );
}
