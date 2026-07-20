import { useForm } from '@inertiajs/react';
import { toast } from 'sonner';
import { displayProductName } from '@/lib/display';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function EditInventory({ inventory }: any) {
    const form = useForm({
        current_stock: inventory.current_stock,
        minimum_stock: inventory.minimum_stock,
        notes: '',
    });

    const variantName = displayProductName(inventory.variant);
    const familyName = inventory.variant?.family?.name ?? '';

    return (
        <OwnerPageShell title="Edit Stok" backHref="/owner/inventories">
            <section className="mb-4" aria-label="Detail Inventaris">
                <div className="text-sm font-semibold text-text">
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
                            onError: (errors) => toast.error(Object.values(errors).flat().join(', ')),
                        });
                    }}
                    className="space-y-4"
                >
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
                    />

                    <Input
                        label="Stok Minimum"
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
                    />

                    <Textarea
                        label="Catatan"
                        value={form.data.notes}
                        onChange={(e) => form.setData('notes', e.target.value)}
                        error={form.errors.notes}
                    />

                    <div className="flex items-center gap-3 pt-2">
                        <Button
                            type="submit"
                            loading={form.processing}
                            disabled={form.processing}
                        >
                            Update
                        </Button>
                        <a
                            href="/owner/inventories"
                            className="text-xs font-semibold text-text-muted hover:text-text"
                        >
                            Batal
                        </a>
                    </div>
                </form>
            </section>
        </OwnerPageShell>
    );
}
