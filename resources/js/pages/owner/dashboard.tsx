import { Head, Link } from '@inertiajs/react';
import OwnerLayout from '../../layouts/owner-layout';

export default function Dashboard({ stats }: any) {
    return (
        <OwnerLayout>
            <Head title="Owner Dashboard" />
            <h1 className="text-2xl font-semibold">Dashboard Owner</h1>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                    ['Outlet aktif', stats.activeOutlets],
                    ['Produk aktif', stats.activeProducts],
                    ['Order hari ini', stats.todayOrders],
                    ['Stok rendah', stats.lowStocks],
                    ['Pending', stats.pendingOrders],
                    ['Preparing', stats.preparingOrders],
                    ['Ready pickup', stats.readyForPickupOrders],
                ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-zinc-200 bg-white p-4">
                        <div className="text-sm text-zinc-500">{label}</div>
                        <div className="mt-2 text-3xl font-semibold">{value}</div>
                    </div>
                ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/owner/outlets" className="rounded-md bg-emerald-700 px-4 py-2 text-white">Kelola Outlet</Link>
                <Link href="/owner/products" className="rounded-md bg-zinc-900 px-4 py-2 text-white">Kelola Produk</Link>
                <Link href="/owner/inventories" className="rounded-md border border-zinc-300 px-4 py-2">Kelola Stok</Link>
            </div>
        </OwnerLayout>
    );
}
