import { Head, useForm } from '@inertiajs/react';
import OwnerLayout from '../../../layouts/owner-layout';

export default function CreateProduct({ categories }: any) {
    const form = useForm({ product_category_id: '', name: '', description: '', size: '', unit: 'botol', price: '', is_active: true as any });
    return <OwnerLayout><Head title="Tambah Produk" /><h1 className="text-2xl font-semibold">Tambah Produk</h1><ProductForm form={form} categories={categories} submit={(e: any) => { e.preventDefault(); form.post('/owner/products'); }} /></OwnerLayout>;
}

export function ProductForm({ form, categories, submit }: any) {
    return <form onSubmit={submit} className="mt-5 grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 sm:grid-cols-2">
        <label className="text-sm">Kategori<select value={form.data.product_category_id ?? ''} onChange={(e) => form.setData('product_category_id', e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2"><option value="">Tanpa kategori</option>{categories.map((category: any) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label className="text-sm">Nama<input value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" />{form.errors.name && <span className="text-red-600">{form.errors.name}</span>}</label>
        <label className="text-sm">Size<input value={form.data.size ?? ''} onChange={(e) => form.setData('size', e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" /></label>
        <label className="text-sm">Unit<input value={form.data.unit} onChange={(e) => form.setData('unit', e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" /></label>
        <label className="text-sm">Harga<input type="number" min="0" value={form.data.price} onChange={(e) => form.setData('price', e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" />{form.errors.price && <span className="text-red-600">{form.errors.price}</span>}</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form.data.is_active)} onChange={(e) => form.setData('is_active', e.target.checked)} /> Produk aktif</label>
        <label className="text-sm sm:col-span-2">Deskripsi<textarea value={form.data.description ?? ''} onChange={(e) => form.setData('description', e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" /></label>
        <div className="sm:col-span-2"><button className="rounded-md bg-emerald-700 px-4 py-2 text-white">Simpan</button></div>
    </form>;
}
