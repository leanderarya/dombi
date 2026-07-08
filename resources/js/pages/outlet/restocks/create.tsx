import { Head, Link, useForm } from '@inertiajs/react';
import { Plus, Trash2 } from 'lucide-react';
import SectionCard from '@/components/ui/section-card';
import StickyActionBar from '@/components/ui/sticky-action-bar';
import StockLevelBadge from '@/components/ui/stock-level-badge';
import OutletLayout from '@/layouts/outlet-layout';
import { calculateStockStatus } from '@/lib/stock';

export default function CreateRestock({ families, inventories }: any) {
    const allVariants = families?.flatMap((f: any) =>
        (f.variants ?? []).map((v: any) => ({
            ...v,
            family_name: f.name,
            family_id: f.id,
        }))
    ) ?? [];

    const form = useForm({ notes: '', items: [{ product_variant_id: allVariants[0]?.id ?? '', requested_quantity: 1 }] });
    const inventoryByVariant = new Map(inventories.map((item: any) => [item.product_variant_id, item]));

    const setItem = (index: number, key: string, value: any) => {
        const items = [...form.data.items] as any[];
        items[index] = { ...items[index], [key]: value };
        form.setData('items', items as any);
    };

    const addItem = () => {
        form.setData('items', [...form.data.items, { product_variant_id: allVariants[0]?.id ?? '', requested_quantity: 1 }] as any);
    };

    const removeItem = (index: number) => {
        form.setData('items', form.data.items.filter((_: any, i: number) => i !== index) as any);
    };

    const handleSubmit = () => {
        form.post('/outlet/restocks');
    };

    return (
        <OutletLayout
            title="Buat Restock"
            backHref="/outlet/restocks"
            actionBarSlot={
                <StickyActionBar
                    actions={[
                        {
                            label: 'Kirim Request Restock',
                            variant: 'primary',
                            onClick: handleSubmit,
                            loading: form.processing,
                        },
                    ]}
                />
            }
        >
            <Head title="Buat Restock" />

            {/* Items */}
            <div className="mt-4 space-y-3">
                {form.data.items.map((item: any, index: number) => {
                    const inventory: any = inventoryByVariant.get(Number(item.product_variant_id));

                    return (
                        <SectionCard key={index}>
                            <div className="flex items-start justify-between">
                                <div className="text-xs font-bold uppercase tracking-wider text-text-subtle">Item {index + 1}</div>
                                {form.data.items.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeItem(index)}
                                        className="flex h-11 w-11 items-center justify-center rounded-lg text-text-subtle active:bg-red-50 active:text-red-600"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                            </div>

                            <div className="mt-3">
                                <label className="text-xs font-medium text-text-muted">Varian Produk</label>
                                <select
                                    value={item.product_variant_id}
                                    onChange={(e) => setItem(index, 'product_variant_id', e.target.value)}
                                    className="mt-1 w-full min-h-11 rounded-lg border border-border px-3 text-sm"
                                >
                                    {families?.map((family: any) => (
                                        <optgroup key={family.id} label={family.name}>
                                            {family.variants?.map((v: any) => (
                                                <option key={v.id} value={v.id}>{v.name}</option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>

                            {inventory && (
                                <div className="mt-2 flex items-center gap-3 rounded-lg bg-surface-muted p-2.5 text-xs">
                                    <div>
                                        <span className="text-text-muted">Stok:</span>{' '}
                                        <span className="font-semibold">{inventory.current_stock}</span>
                                    </div>
                                    <div>
                                        <span className="text-text-muted">Min:</span>{' '}
                                        <span className="font-semibold">{inventory.minimum_stock}</span>
                                    </div>
                                    <StockLevelBadge
                                        {...calculateStockStatus(inventory.current_stock, inventory.reserved_stock, inventory.minimum_stock)}
                                        showQuantity
                                    />
                                </div>
                            )}

                            <div className="mt-3">
                                <label className="text-xs font-medium text-text-muted">Jumlah Diminta</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={item.requested_quantity}
                                    onChange={(e) => setItem(index, 'requested_quantity', Number(e.target.value))}
                                    className="mt-1 w-full min-h-11 rounded-lg border border-border px-3 text-sm"
                                />
                            </div>
                        </SectionCard>
                    );
                })}
            </div>

            {/* Add Item Button */}
            <button
                type="button"
                onClick={addItem}
                className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border text-sm font-medium text-text-muted active:bg-surface-muted"
            >
                <Plus className="h-4 w-4" />
                Tambah Item
            </button>

            {/* Notes */}
            <div>
                <label className="text-xs font-medium text-text-muted">Catatan</label>
                <textarea
                    value={form.data.notes}
                    onChange={(e) => form.setData('notes', e.target.value)}
                    placeholder="Catatan restock (opsional)..."
                    className="mt-1 min-h-[80px] w-full rounded-lg border border-border px-3 py-2.5 text-sm placeholder:text-text-subtle focus:border-emerald-300 focus:ring-1 focus:ring-emerald-200"
                />
            </div>

            {form.errors.items && <div className="mt-2 text-xs text-red-600">{form.errors.items}</div>}
        </OutletLayout>
    );
}
