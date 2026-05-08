import { Head, Link } from '@inertiajs/react';
import OutletLayout from '../../layouts/outlet-layout';

export default function OutletDashboard({ outlet, stats }: any) {
    return (
        <OutletLayout>
            <Head title="Outlet Dashboard" />
            <div>
                <h1 className="text-2xl font-semibold">Dashboard {outlet.name}</h1>
                <p className="mt-1 text-sm text-zinc-500">{outlet.kecamatan}</p>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {[
                    ['Pending', stats.pendingOrders],
                    ['Preparing', stats.preparingOrders],
                    ['Ready pickup', stats.readyForPickupOrders],
                    ['Order hari ini', stats.todayOrders],
                    ['Stok rendah', stats.lowStocks],
                ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border bg-white p-4">
                        <div className="text-sm text-zinc-500">{label}</div>
                        <div className="mt-2 text-3xl font-semibold">{value}</div>
                    </div>
                ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/outlet/orders?status=pending" className="rounded-md bg-emerald-700 px-4 py-2 text-white">Lihat pending</Link>
                <Link href="/outlet/orders?status=preparing" className="rounded-md border px-4 py-2">Lihat preparing</Link>
            </div>
        </OutletLayout>
    );
}
