import { Head, Link } from '@inertiajs/react';
import StockLevelBadge from '../../components/stock-level-badge';
import OutletLayout from '../../layouts/outlet-layout';

export default function OutletInventory({ outlet, inventories }: any) {
    return (
        <OutletLayout>
            <Head title="Outlet Inventory" />
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">Inventory</h1>
                    <p className="text-sm text-zinc-500">{outlet.name}</p>
                </div>
                <Link href="/outlet/restocks/create" className="rounded-md bg-emerald-700 px-4 py-2 text-white">Request Restock</Link>
            </div>
            <div className="mt-5 overflow-x-auto rounded-lg border bg-white">
                <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-50">
                        <tr><th className="p-3">Product</th><th>Current</th><th>Reserved</th><th>Available</th><th>Minimum</th><th>Level</th></tr>
                    </thead>
                    <tbody>
                        {inventories.length === 0 && <tr><td className="p-4 text-zinc-500" colSpan={6}>Belum ada inventory.</td></tr>}
                        {inventories.map((item: any) => <tr key={item.id} className="border-t"><td className="p-3 font-medium">{item.product.name}</td><td>{item.current_stock}</td><td>{item.reserved_stock}</td><td>{item.current_stock - item.reserved_stock}</td><td>{item.minimum_stock}</td><td><StockLevelBadge currentStock={item.current_stock} reservedStock={item.reserved_stock} minimumStock={item.minimum_stock} /></td></tr>)}
                    </tbody>
                </table>
            </div>
        </OutletLayout>
    );
}
