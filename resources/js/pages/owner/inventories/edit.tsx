import { useForm } from '@inertiajs/react';
import OwnerPageShell from '@/components/owner/owner-page-shell';

export default function EditInventory({ inventory }: any) {
    const form = useForm({ current_stock: inventory.current_stock, minimum_stock: inventory.minimum_stock, notes: '' });

    const variantName = inventory.variant?.name ?? inventory.product?.name ?? '-';
    const familyName = inventory.variant?.family?.name ?? '';

    return (
        <OwnerPageShell title="Edit Stok" backHref="/owner/inventories">
            <div className="mt-2">
                <div className="text-sm font-semibold text-slate-900">{inventory.outlet?.name}</div>
                <div className="mt-0.5 text-sm text-slate-600">
                    {familyName && <span className="text-slate-400">{familyName} &middot; </span>}
                    {variantName}
                </div>
            </div>
            <form
                onSubmit={(e) => {
 e.preventDefault(); form.put(`/owner/inventories/${inventory.id}`); 
}}
                className="mt-5 grid gap-4 rounded-lg border border-slate-200 bg-white p-5 sm:grid-cols-2"
            >
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
                        Update
                    </button>
                </div>
            </form>
        </OwnerPageShell>
    );
}
