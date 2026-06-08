import { useForm } from '@inertiajs/react';
import OwnerPageShell from '@/components/owner/owner-page-shell';

export default function CreateInventory({ outlets, families }: any) {
    const form = useForm({ outlet_id: '', product_variant_id: '', current_stock: 0, minimum_stock: 0, notes: '' });

    const selectedFamily = families?.find((f: any) =>
        f.variants?.some((v: any) => String(v.id) === String(form.data.product_variant_id))
    );

    const allVariants = families?.flatMap((f: any) =>
        (f.variants ?? []).map((v: any) => ({
            ...v,
            family_name: f.name,
            family_id: f.id,
        }))
    ) ?? [];

    return (
        <OwnerPageShell title="Tambah Stok" backHref="/owner/inventories">
            <form
                onSubmit={(e) => { e.preventDefault(); form.post('/owner/inventories'); }}
                className="mt-5 grid gap-4 rounded-lg border border-slate-200 bg-white p-5 sm:grid-cols-2"
            >
                <label className="text-sm">
                    Outlet
                    <select
                        value={form.data.outlet_id}
                        onChange={(e) => form.setData('outlet_id', e.target.value)}
                        className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
                    >
                        <option value="">Pilih Outlet</option>
                        {outlets?.map((o: any) => (
                            <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                    </select>
                    {form.errors.outlet_id && <div className="mt-1 text-xs text-red-600">{form.errors.outlet_id}</div>}
                </label>

                <label className="text-sm">
                    Varian Produk
                    <select
                        value={form.data.product_variant_id}
                        onChange={(e) => form.setData('product_variant_id', e.target.value)}
                        className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
                    >
                        <option value="">Pilih Varian</option>
                        {families?.map((family: any) => (
                            <optgroup key={family.id} label={family.name}>
                                {family.variants?.map((v: any) => (
                                    <option key={v.id} value={v.id}>{v.name}</option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                    {form.errors.product_variant_id && <div className="mt-1 text-xs text-red-600">{form.errors.product_variant_id}</div>}
                </label>

                <label className="text-sm">
                    Current Stock
                    <input
                        type="number"
                        min="0"
                        value={form.data.current_stock}
                        onChange={(e) => form.setData('current_stock', Number(e.target.value))}
                        className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
                    />
                </label>

                <label className="text-sm">
                    Minimum Stock
                    <input
                        type="number"
                        min="0"
                        value={form.data.minimum_stock}
                        onChange={(e) => form.setData('minimum_stock', Number(e.target.value))}
                        className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
                    />
                </label>

                <label className="text-sm sm:col-span-2">
                    Catatan
                    <textarea
                        value={form.data.notes}
                        onChange={(e) => form.setData('notes', e.target.value)}
                        className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
                    />
                </label>

                <div className="sm:col-span-2">
                    <button className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
                        Simpan
                    </button>
                </div>
            </form>
        </OwnerPageShell>
    );
}
