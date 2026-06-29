import { router, useForm } from '@inertiajs/react';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import StockLevelBadge from '@/components/stock-level-badge';
import SectionCard from '@/components/ui/section-card';
import StickyActionBar from '@/components/ui/sticky-action-bar';

export default function OwnerRestockCreate({ outlets, selectedOutletId, selectedProductId, returnTo }: any) {
    const backHref = returnTo || '/owner/restocks';
    const [outletId, setOutletId] = useState(selectedOutletId || '');
    const [families, setFamilies] = useState<any[]>([]);
    const [inventories, setInventories] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const form = useForm({
        outlet_id: outletId,
        notes: '',
        items: [{ product_variant_id: '', requested_quantity: 1 }],
    });

    // Load products when outlet changes
    useEffect(() => {
        if (!outletId) {
            setFamilies([]);
            setInventories([]);
            return;
        }

        setLoading(true);
        fetch(`/owner/outlets/${outletId}/products`)
            .then((res) => res.json())
            .then((data) => {
                setFamilies(data.families || []);
                setInventories(data.inventories || []);
                setLoading(false);

                // Auto-select product if selectedProductId is provided
                if (selectedProductId && data.families) {
                    const allVariants = data.families.flatMap((f: any) =>
                        (f.variants || []).map((v: any) => v.id)
                    );
                    if (allVariants.includes(selectedProductId)) {
                        form.setData('items', [{ product_variant_id: selectedProductId, requested_quantity: 1 }]);
                    }
                }
            })
            .catch(() => setLoading(false));
    }, [outletId]);

    const allVariants = families?.flatMap((f: any) =>
        (f.variants ?? []).map((v: any) => ({
            ...v,
            family_name: f.name,
            family_id: f.id,
        }))
    ) ?? [];

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
        form.setData('outlet_id', outletId);
        form.post('/owner/restocks');
    };

    return (
        <OwnerPageShell title="Buat Restock" subtitle="Buat permintaan restock untuk outlet" backHref={backHref}>
            {/* Outlet Selector */}
            <SectionCard label="Pilih Outlet">
                <select
                    value={outletId}
                    onChange={(e) => setOutletId(e.target.value)}
                    className="w-full min-h-11 rounded-lg border border-border px-3 text-sm"
                >
                    <option value="">Pilih outlet...</option>
                    {outlets.map((outlet: any) => (
                        <option key={outlet.id} value={outlet.id}>{outlet.name}</option>
                    ))}
                </select>
            </SectionCard>

            {/* Items */}
            {outletId && (
                <>
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
                                            <option value="">Pilih produk...</option>
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
                                                currentStock={inventory.current_stock}
                                                reservedStock={inventory.reserved_stock}
                                                minimumStock={inventory.minimum_stock}
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
                    <div className="mt-4">
                        <label className="text-xs font-medium text-text-muted">Catatan</label>
                        <textarea
                            value={form.data.notes}
                            onChange={(e) => form.setData('notes', e.target.value)}
                            placeholder="Catatan restock (opsional)..."
                            className="mt-1 min-h-[80px] w-full rounded-lg border border-border px-3 py-2.5 text-sm placeholder:text-text-subtle focus:border-primary focus:ring-1 focus:ring-primary/30"
                        />
                    </div>

                    {form.errors.items && <div className="mt-2 text-xs text-red-600">{form.errors.items}</div>}

                    {/* Sticky Submit */}
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
                    <div className="h-20" />
                </>
            )}

            {/* Loading State */}
            {outletId && loading && (
                <div className="mt-8 flex items-center justify-center py-12">
                    <div className="text-sm text-text-muted">Memuat produk...</div>
                </div>
            )}
        </OwnerPageShell>
    );
}
