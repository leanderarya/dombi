import { useForm } from '@inertiajs/react';
import OwnerPageShell from '@/components/owner/owner-page-shell';

export default function CreateProduct({ categories }: any) {
    const form = useForm({ product_category_id: '', name: '', description: '', size: '', unit: 'botol', price: '', is_active: true as any });
    return (
        <OwnerPageShell title="Tambah Produk" backHref="/owner/products">
            <ProductForm form={form} categories={categories} submit={(e: any) => { e.preventDefault(); form.post('/owner/products'); }} />
        </OwnerPageShell>
    );
}

export function ProductForm({ form, categories, submit }: any) {
    return (
        <form onSubmit={submit} className="space-y-4">
            <Field label="Nama Produk" value={form.data.name} onChange={(v: string) => form.setData('name', v)} error={form.errors.name} required />
            <Field label="Harga" value={form.data.price} onChange={(v: string) => form.setData('price', v)} error={form.errors.price} type="number" required />
            <div className="grid grid-cols-2 gap-3">
                <Field label="Size" value={form.data.size ?? ''} onChange={(v: string) => form.setData('size', v)} placeholder="250ml" />
                <Field label="Unit" value={form.data.unit} onChange={(v: string) => form.setData('unit', v)} />
            </div>
            <div>
                <label className="text-xs font-semibold text-slate-700">Kategori</label>
                <select value={form.data.product_category_id ?? ''} onChange={(e) => form.setData('product_category_id', e.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-emerald-300 focus:ring-1 focus:ring-emerald-200">
                    <option value="">Tanpa kategori</option>
                    {categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>
            <div>
                <label className="text-xs font-semibold text-slate-700">Deskripsi</label>
                <textarea value={form.data.description ?? ''} onChange={(e) => form.setData('description', e.target.value)} className="mt-1.5 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-emerald-300 focus:ring-1 focus:ring-emerald-200" placeholder="Opsional" />
            </div>
            <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
                <input type="checkbox" checked={Boolean(form.data.is_active)} onChange={(e) => form.setData('is_active', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-emerald-600" />
                <span className="text-sm text-slate-700">Produk aktif</span>
            </label>
            <button type="submit" disabled={form.processing} className="flex min-h-12 w-full items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white transition-all duration-150 active:scale-[0.98] active:bg-emerald-800 disabled:bg-slate-300">
                {form.processing ? 'Menyimpan...' : 'Simpan Produk'}
            </button>
        </form>
    );
}

function Field({ label, value, onChange, error, type = 'text', placeholder, required }: any) {
    return (
        <div>
            <label className="text-xs font-semibold text-slate-700">{label} {required && <span className="text-red-500">*</span>}</label>
            <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-emerald-300 focus:ring-1 focus:ring-emerald-200" required={required} />
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
    );
}
