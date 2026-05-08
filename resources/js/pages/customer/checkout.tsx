import { Head, Link, useForm } from '@inertiajs/react';
import CustomerLayout from '../../layouts/customer-layout';

export default function Checkout({ products, addresses }: any) {
    const form = useForm({ address_id: addresses[0]?.id ?? '', items: [{ product_id: products[0]?.id ?? '', quantity: 1 }], notes: '' });
    const setItem = (index: number, key: string, value: any) => {
        const items = [...form.data.items] as any[];
        items[index] = { ...items[index], [key]: value };
        form.setData('items', items as any);
    };

    return (
        <CustomerLayout>
            <Head title="Checkout" />
            <h1 className="text-2xl font-semibold">Checkout</h1>
            {addresses.length === 0 && (
                <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                    Buat alamat dulu. <Link href="/customer/addresses/create" className="font-medium underline">Tambah alamat</Link>
                </div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); form.post('/customer/orders'); }} className="mt-5 space-y-4 rounded-lg border bg-white p-4">
                <label className="block text-sm">
                    Alamat
                    <select value={form.data.address_id} onChange={(e) => form.setData('address_id', e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2">
                        <option value="">Pilih alamat</option>
                        {addresses.map((address: any) => <option key={address.id} value={address.id}>{address.label || address.recipient_name} - {address.kecamatan}</option>)}
                    </select>
                    {form.errors.address_id && <span className="text-red-600">{form.errors.address_id}</span>}
                </label>
                {form.data.items.map((item: any, index: number) => (
                    <div key={index} className="grid gap-3 sm:grid-cols-[1fr_120px_auto]">
                        <select value={item.product_id} onChange={(e) => setItem(index, 'product_id', e.target.value)} className="rounded-md border px-3 py-2">
                            {products.map((product: any) => <option key={product.id} value={product.id}>{product.name} - Rp {Number(product.price).toLocaleString('id-ID')}</option>)}
                        </select>
                        <input type="number" min="1" value={item.quantity} onChange={(e) => setItem(index, 'quantity', Number(e.target.value))} className="rounded-md border px-3 py-2" />
                        <button type="button" onClick={() => form.setData('items', form.data.items.filter((_: any, i: number) => i !== index) as any)} className="rounded-md border px-3 py-2">Hapus</button>
                    </div>
                ))}
                <button type="button" onClick={() => form.setData('items', [...form.data.items, { product_id: products[0]?.id ?? '', quantity: 1 }] as any)} className="rounded-md border px-3 py-2">Tambah item</button>
                <label className="block text-sm">
                    Catatan
                    <textarea value={form.data.notes} onChange={(e) => form.setData('notes', e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" />
                </label>
                {form.errors.items && <div className="text-sm text-red-600">{form.errors.items}</div>}
                <button disabled={form.processing || addresses.length === 0} className="w-full rounded-md bg-emerald-700 px-4 py-2 text-white disabled:bg-zinc-300">Buat Order</button>
            </form>
        </CustomerLayout>
    );
}
