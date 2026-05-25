import { Head, Link, router } from '@inertiajs/react';
import EmptyState from '@/components/empty-state';
import Pagination from '@/components/pagination';
import StockLevelBadge from '@/components/stock-level-badge';
import OwnerLayout from '@/layouts/owner-layout';

export default function InventoriesIndex({ inventories, outlets, products, filters }: any) {
    const setFilter = (key: string, value: string) => {
        router.get('/owner/inventories', { ...filters, [key]: value || undefined }, { preserveState: true, replace: true });
    };

    return (
        <OwnerLayout>
            <Head title="Inventory" />
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Inventory</h1>
                <Link href="/owner/inventories/create" className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white">Tambah Stok</Link>
            </div>
            <div className="mt-5 flex flex-wrap gap-3 rounded-lg border bg-white p-4">
                <select value={filters.outlet_id ?? ''} onChange={(e) => setFilter('outlet_id', e.target.value)} className="rounded-md border px-3 py-2 text-sm">
                    <option value="">Semua outlet</option>
                    {outlets.map((outlet: any) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}
                </select>
                <select value={filters.product_id ?? ''} onChange={(e) => setFilter('product_id', e.target.value)} className="rounded-md border px-3 py-2 text-sm">
                    <option value="">Semua produk</option>
                    {products.map((product: any) => <option key={product.id} value={product.id}>{product.name}</option>)}
                </select>
            </div>
            <div className="mt-5 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
                {inventories.data.length === 0 ? (
                    <EmptyState icon="📊" title="Belum ada inventory" description="Tambahkan stok untuk outlet." />
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-zinc-50">
                            <tr><th className="p-3">Outlet</th><th className="p-3">Produk</th><th className="p-3">Current</th><th className="p-3">Reserved</th><th className="p-3">Available</th><th className="p-3">Minimum</th><th className="p-3">Level</th><th className="p-3"></th></tr>
                        </thead>
                        <tbody>
                            {inventories.data.map((item: any) => (
                                <tr key={item.id} className="border-t hover:bg-zinc-50/50">
                                    <td className="p-3">{item.outlet.name}</td>
                                    <td className="p-3">{item.product.name}</td>
                                    <td className="p-3 font-mono">{item.current_stock}</td>
                                    <td className="p-3 font-mono">{item.reserved_stock}</td>
                                    <td className="p-3 font-mono font-medium">{item.current_stock - item.reserved_stock}</td>
                                    <td className="p-3 font-mono">{item.minimum_stock}</td>
                                    <td className="p-3"><StockLevelBadge currentStock={item.current_stock} reservedStock={item.reserved_stock} minimumStock={item.minimum_stock} /></td>
                                    <td className="p-3 text-right"><Link href={`/owner/inventories/${item.id}/edit`} className="text-emerald-700 text-sm">Edit</Link></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            <Pagination links={inventories.links} />
        </OwnerLayout>
    );
}
