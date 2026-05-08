import { Head, Link, router } from '@inertiajs/react';
import OwnerLayout from '../../../layouts/owner-layout';

export default function InventoriesIndex({ inventories, outlets, products, filters }: any) {
    return <OwnerLayout><Head title="Inventory" /><div className="flex items-center justify-between"><h1 className="text-2xl font-semibold">Inventory</h1><Link href="/owner/inventories/create" className="rounded-md bg-emerald-700 px-4 py-2 text-white">Tambah Stok</Link></div>
        <div className="mt-5 flex flex-wrap gap-3 rounded-lg border bg-white p-4">
            <select defaultValue={filters.outlet_id ?? ''} onChange={(e) => router.get('/owner/inventories', { ...filters, outlet_id: e.target.value }, { preserveState: true })} className="rounded-md border px-3 py-2"><option value="">Semua outlet</option>{outlets.map((outlet: any) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}</select>
            <select defaultValue={filters.product_id ?? ''} onChange={(e) => router.get('/owner/inventories', { ...filters, product_id: e.target.value }, { preserveState: true })} className="rounded-md border px-3 py-2"><option value="">Semua produk</option>{products.map((product: any) => <option key={product.id} value={product.id}>{product.name}</option>)}</select>
        </div>
        <div className="mt-5 overflow-x-auto rounded-lg border border-zinc-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-zinc-50"><tr><th className="p-3">Outlet</th><th>Produk</th><th>Stock</th><th>Reserved</th><th>Minimum</th><th></th></tr></thead><tbody>{inventories.data.map((item: any) => <tr key={item.id} className="border-t"><td className="p-3">{item.outlet.name}</td><td>{item.product.name}</td><td>{item.current_stock}</td><td>{item.reserved_stock}</td><td>{item.minimum_stock}</td><td className="p-3 text-right"><Link href={`/owner/inventories/${item.id}/edit`} className="text-emerald-700">Edit</Link></td></tr>)}</tbody></table></div>
    </OwnerLayout>;
}
