import { Link, usePage } from '@inertiajs/react';
import EmptyState from '@/components/empty-state';
import OwnerOutletCard from '@/components/owner/owner-outlet-card';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import OutletProvisioningSummary from '@/components/owner/outlet-provisioning-summary';
import Pagination from '@/components/pagination';

export default function OutletsIndex({ outlets }: any) {
    const { flash } = usePage<any>().props;
    const activeOutlets = outlets.data.filter((outlet: any) => outlet.status === 'active').length;
    const lowStockOutlets = outlets.data.filter((outlet: any) => Number(outlet.low_stock_count) > 0).length;
    const busyOutlets = outlets.data.filter((outlet: any) => Number(outlet.active_orders_count) >= 3).length;

    return (
        <OwnerPageShell
            title="Outlet"
            subtitle="Branch operations setup"
            headerRight={
                <Link href="/owner/outlets/create" className="flex min-h-10 items-center rounded-lg bg-emerald-500 px-3 text-[11px] font-semibold text-white transition-colors duration-150 active:bg-emerald-600">
                    Tambah
                </Link>
            }
        >
            <div className="space-y-4">
                <section className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Outlet Board</p>
                    <h1 className="mt-1 text-2xl font-semibold text-slate-900">Branch Operations</h1>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                        <Metric label="Active" value={activeOutlets} />
                        <Metric label="Low Stock" value={lowStockOutlets} warn />
                        <Metric label="Busy" value={busyOutlets} />
                    </div>
                </section>

                {outlets.data.length === 0 ? (
                    <EmptyState icon="🏬" title="Belum ada outlet" description="Tambah outlet pertama dengan memilih titik lokasi di peta." />
                ) : (
                    <div className="space-y-3">
                        {outlets.data.map((outlet: any) => <OwnerOutletCard key={outlet.id} outlet={outlet} />)}
                    </div>
                )}

                <Pagination links={outlets.links} />
            </div>
            <OutletProvisioningSummary provisioning={flash?.outlet_provisioning} />
        </OwnerPageShell>
    );
}

function Metric({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
    return (
        <div className={`rounded-lg border p-3 ${warn && value > 0 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-[#F8FAFC] text-slate-700'}`}>
            <div className="text-lg font-semibold tabular-nums">{value}</div>
            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</div>
        </div>
    );
}
