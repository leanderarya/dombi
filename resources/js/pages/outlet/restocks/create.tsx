import { Head, useForm } from '@inertiajs/react';
import StockLevelBadge from '../../../components/stock-level-badge';
import OutletLayout from '../../../layouts/outlet-layout';

export default function CreateRestock({ products, inventories }: any) {
    const form = useForm({ notes: '', items: [{ product_id: products[0]?.id ?? '', requested_quantity: 1 }] });
    const inventoryByProduct = new Map(inventories.map((item: any) => [item.product_id, item]));
    const setItem = (index: number, key: string, value: any) => {
        const items = [...form.data.items] as any[];
        items[index] = { ...items[index], [key]: value };
        form.setData('items', items as any);
    };

    return (
        <OutletLayout>
            <Head title="Create Restock" />
            <h1 className="text-2xl font-semibold">Create Restock Request</h1>
            <form onSubmit={(e) => { e.preventDefault(); form.post('/outlet/restocks'); }} className="mt-5 space-y-4 rounded-lg border bg-white p-5">
                {form.data.items.map((item: any, index: number) => {
                    const inventory: any = inventoryByProduct.get(Number(item.product_id));

                    return (
                        <div key={index} className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_130px_160px_auto]">
                            <select value={item.product_id} onChange={(e) => setItem(index, 'product_id', e.target.value)} className="rounded-md border px-3 py-2">
                                {products.map((product: any) => <option key={product.id} value={product.id}>{product.name}</option>)}
                            </select>
                            <input type="number" min="1" value={item.requested_quantity} onChange={(e) => setItem(index, 'requested_quantity', Number(e.target.value))} className="rounded-md border px-3 py-2" />
                            <div className="text-sm text-zinc-600">
                                <div>Stock: {inventory?.current_stock ?? 0}</div>
                                <div>Min: {inventory?.minimum_stock ?? 0}</div>
                                {inventory && <StockLevelBadge currentStock={inventory.current_stock} reservedStock={inventory.reserved_stock} minimumStock={inventory.minimum_stock} />}
                            </div>
                            <button type="button" onClick={() => form.setData('items', form.data.items.filter((_: any, i: number) => i !== index) as any)} className="rounded-md border px-3 py-2">Hapus</button>
                        </div>
                    );
                })}
                <button type="button" onClick={() => form.setData('items', [...form.data.items, { product_id: products[0]?.id ?? '', requested_quantity: 1 }] as any)} className="rounded-md border px-3 py-2">Tambah item</button>
                <label className="block text-sm">Notes<textarea value={form.data.notes} onChange={(e) => form.setData('notes', e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" /></label>
                {form.errors.items && <div className="text-sm text-red-600">{form.errors.items}</div>}
                <button className="rounded-md bg-emerald-700 px-4 py-2 font-medium text-white">Submit Request</button>
            </form>
        </OutletLayout>
    );
}
