import { useForm } from '@inertiajs/react';
import { toast } from 'sonner';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { displayProductName } from '@/lib/display';

// DESIGN.md: stock quantities are displayed with an explicit unit (Liter/Pcs).
function unitLabel(item: any): string {
    const unit = item?.product?.size_unit ?? item?.variant?.size_unit;

    return unit === 'ml' || unit === 'l' || unit === 'g' || unit === 'kg'
        ? 'Liter'
        : 'Pcs';
}

export default function EditInventory({ inventory }: any) {
    const form = useForm({
        current_stock: inventory.current_stock,
        minimum_stock: inventory.minimum_stock,
        notes: '',
    });

    const stockUnit = unitLabel(inventory);
    const variantName = displayProductName(inventory.variant);
    const familyName = inventory.variant?.family?.name ?? '';

    return (
        <OwnerPageShell title="Edit Stok" backHref="/owner/inventories">
            <section className="mb-4" aria-label="Detail Inventaris">
                <div className="flex items-center gap-2 text-sm font-semibold text-text">
                    {inventory.outlet?.name}
                </div>
                <div className="mt-0.5 text-sm text-text-muted">
                    {familyName && (
                        <span className="text-text-subtle">
                            {familyName} &middot;{' '}
                        </span>
                    )}
                    {variantName}
                </div>
            </section>
            <section
                className="mx-auto max-w-lg"
                aria-label="Form Edit Inventaris"
            >
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.put(`/owner/inventories/${inventory.id}`, {
                            preserveScroll: true,
                            onSuccess: () => toast.success('Stok diperbarui'),
                            onError: (errors) =>
                                toast.error(
                                    Object.values(errors).flat().join(', '),
                                ),
                        });
                    }}
                    className="space-y-4"
                >
                    <Input
                        label={`Stok Saat Ini (${stockUnit})`}
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
                            className="min-h-11"
                            loading={form.processing}
                            disabled={form.processing}
                        >
                            Update
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
