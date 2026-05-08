import { Head, Link } from '@inertiajs/react';
import DashboardCard from '../../components/dashboard-card';
import OwnerLayout from '../../layouts/owner-layout';

export default function Dashboard({ stats }: any) {
    return (
        <OwnerLayout>
            <Head title="Owner Dashboard" />
            <h1 className="text-2xl font-semibold">Dashboard Owner</h1>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                    ['Order hari ini', stats.todayOrders],
                    ['Active orders', stats.activeOrders],
                    ['Outlet aktif', stats.activeOutlets],
                    ['Produk aktif', stats.activeProducts],
                    ['Stok rendah', stats.lowStocks],
                    ['Pending restocks', stats.pendingRestocks],
                    ['Active deliveries', stats.activeDeliveries],
                ].map(([label, value]) => <DashboardCard key={label} label={String(label)} value={value} />)}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/owner/orders" className="rounded-md bg-emerald-700 px-4 py-2 text-white">Orders</Link>
                <Link href="/owner/inventories" className="rounded-md border border-zinc-300 bg-white px-4 py-2">Inventory</Link>
                <Link href="/owner/restocks" className="rounded-md border border-zinc-300 bg-white px-4 py-2">Restocks</Link>
                <Link href="/owner/deliveries" className="rounded-md border border-zinc-300 bg-white px-4 py-2">Deliveries</Link>
            </div>
        </OwnerLayout>
    );
}
