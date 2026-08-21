import { useForm } from '@inertiajs/react';
import { useMemo } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

// DESIGN.md: stock quantities are displayed with an explicit unit (Liter/Pcs).
function unitLabel(item: any): string {
    const unit = item?.product?.size_unit ?? item?.variant?.size_unit;

    return unit === 'ml' || unit === 'l' || unit === 'g' || unit === 'kg'
        ? 'Liter'
        : 'Pcs';
}

export default function CreateInventory({ outlets, families }: any) {
    const form = useForm({
        outlet_id: '',
        product_variant_id: '',
        current_stock: 0,
        minimum_stock: 0,
        notes: '',
    });

    const stockUnit = useMemo(
        () =>
            unitLabel(
                (families ?? [])
                    .flatMap((f: any) => (f.variants ?? []).map((v: any) => v))
                    .find(
                        (v: any) =>
                            String(v.id) ===
                            String(form.data.product_variant_id),
                    ),
            ),
        [families, form.data.product_variant_id],
    );

    return (
        <OwnerPageShell
            title="Tambah Stok"
            subtitle="Catat inventaris baru ke outlet"
            backHref="/owner/inventories"
        >
            <section
                className="mx-auto max-w-lg"
                aria-label="Form Tambah Inventaris"
            >
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.post('/owner/inventories');
                    }}
                    className="space-y-4"
                >
                    <Select
                        label="Outlet"
                        value={form.data.outlet_id}
                        onChange={(e) =>
                            form.setData('outlet_id', e.target.value)
                        }
                        options={(outlets ?? []).map((o: any) => ({
                            value: String(o.id),
                            label: o.name,
                        }))}
                        placeholder="Pilih Outlet"
                        error={form.errors.outlet_id}
                    />

                    <Select
                        label="Varian Produk"
                        value={form.data.product_variant_id}
                        onChange={(e) =>
                            form.setData('product_variant_id', e.target.value)
                        }
                        options={(families ?? []).flatMap((f: any) =>
                            (f.variants ?? []).map((v: any) => ({
                                value: String(v.id),
                                label: `${f.name} — ${v.name}`,
                            })),
                        )}
                        placeholder="Pilih Varian"
                        error={form.errors.product_variant_id}
                    />

                    <Input
                        label="Stok Saat Ini"
                        type="number"
                        min={0}
                        value={form.data.current_stock}
                        onChange={(e) =>
                            form.setData(
                                'current_stock',
                                Number(e.target.value),
                            )
                        }
                        error={form.errors.current_stock}
                        className="min-h-11 tabular-nums focus-visible:ring-primary"
                    />

                    <Input
                        label={`Stok Minimum (${stockUnit})`}
                        type="number"
                        min={0}
                        value={form.data.minimum_stock}
                        onChange={(e) =>
                            form.setData(
                                'minimum_stock',
                                Number(e.target.value),
                            )
                        }
                        error={form.errors.minimum_stock}
                        className="min-h-11 tabular-nums focus-visible:ring-primary"
                    />

                    <Textarea
                        label="Catatan"
                        value={form.data.notes}
                        onChange={(e) => form.setData('notes', e.target.value)}
                        error={form.errors.notes}
                        className="min-h-[44px] focus-visible:ring-primary"
                    />

                    <div className="flex items-center gap-3 pt-2">
                        <Button
                            type="submit"
                            className="min-h-11 bg-accent-orange text-white shadow-sm hover:bg-accent-orange-hover"
                            loading={form.processing}
                            disabled={form.processing}
                        >
                            Tambah Stok
                        </Button>
                        <a
                            href="/owner/inventories"
                            className="flex min-h-11 items-center text-xs font-semibold text-text-muted hover:text-text"
                        >
                            Batal
                        </a>
                    </div>
                </form>
            </section>
        </OwnerPageShell>
    );
}
