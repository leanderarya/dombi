import { useForm } from '@inertiajs/react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export default function CreateInventory({ outlets, families }: any) {
    const form = useForm({ outlet_id: '', product_variant_id: '', current_stock: 0, minimum_stock: 0, notes: '' });

    return (
        <OwnerPageShell title="Tambah Stok" subtitle="Catat inventaris baru ke outlet" backHref="/owner/inventories">
            <div className="mx-auto max-w-lg">
                <form
                    onSubmit={(e) => { e.preventDefault(); form.post('/owner/inventories'); }}
                    className="space-y-4"
                >
                    <Select
                        label="Outlet"
                        value={form.data.outlet_id}
                        onChange={(e) => form.setData('outlet_id', e.target.value)}
                        options={(outlets ?? []).map((o: any) => ({ value: String(o.id), label: o.name }))}
                        placeholder="Pilih Outlet"
                        error={form.errors.outlet_id}
                    />

                    <Select
                        label="Varian Produk"
                        value={form.data.product_variant_id}
                        onChange={(e) => form.setData('product_variant_id', e.target.value)}
                        options={(families ?? []).flatMap((f: any) =>
                            (f.variants ?? []).map((v: any) => ({ value: String(v.id), label: `${f.name} — ${v.name}` }))
                        )}
                        placeholder="Pilih Varian"
                        error={form.errors.product_variant_id}
                    />

                    <Input
                        label="Stok Saat Ini"
                        type="number"
                        min={0}
                        value={form.data.current_stock}
                        onChange={(e) => form.setData('current_stock', Number(e.target.value))}
                        error={form.errors.current_stock}
                    />

                    <Input
                        label="Stok Minimum"
                        type="number"
                        min={0}
                        value={form.data.minimum_stock}
                        onChange={(e) => form.setData('minimum_stock', Number(e.target.value))}
                        error={form.errors.minimum_stock}
                    />

                    <Textarea
                        label="Catatan"
                        value={form.data.notes}
                        onChange={(e) => form.setData('notes', e.target.value)}
                        error={form.errors.notes}
                    />

                    <div className="flex items-center gap-3 pt-2">
                        <Button type="submit" loading={form.processing} disabled={form.processing}>
                            Simpan
                        </Button>
                        <a href="/owner/inventories" className="text-xs font-semibold text-text-muted hover:text-text">
                            Batal
                        </a>
                    </div>
                </form>
            </div>
        </OwnerPageShell>
    );
}
