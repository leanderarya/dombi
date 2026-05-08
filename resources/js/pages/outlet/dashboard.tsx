import { Head, Link } from '@inertiajs/react';
import DashboardCard from '../../components/dashboard-card';
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
                    ['Low stock', stats.lowStocks],
                    ['Pending restocks', stats.pendingRestocks],
                ].map(([label, value]) => <DashboardCard key={label} label={String(label)} value={value} />)}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/outlet/orders?status=pending" className="rounded-md bg-emerald-700 px-4 py-2 text-white">Orders</Link>
                <Link href="/outlet/inventory" className="rounded-md border bg-white px-4 py-2">Inventory</Link>
                <Link href="/outlet/restocks" className="rounded-md border bg-white px-4 py-2">Restocks</Link>
            </div>
        </OutletLayout>
    );
}
