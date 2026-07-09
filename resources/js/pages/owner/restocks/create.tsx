import { useForm } from '@inertiajs/react';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import StockLevelBadge from '@/components/ui/stock-level-badge';
import { calculateStockStatus } from '@/lib/stock';

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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        form.setData('outlet_id', outletId);
        form.post('/owner/restocks');
    };

    return (
        <OwnerPageShell title="Buat Restock" subtitle="Buat permintaan restock untuk outlet" backHref={backHref}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="rounded-lg border border-border p-4">
                    <div className="mb-3 text-xs font-bold uppercase tracking-wide text-text-subtle">Pilih Outlet</div>
                    <select
                        value={outletId}
                        onChange={(e) => setOutletId(e.target.value)}
                        className="w-full appearance-none rounded-[--radius-control] border border-border bg-surface px-3 py-2 pr-8 text-sm text-text transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                        <option value="">Pilih outlet...</option>
                        {outlets.map((outlet: any) => (
                            <option key={outlet.id} value={outlet.id}>{outlet.name}</option>
                        ))}
                    </select>
                </div>

                {outletId && (
                    <>
                        <div className="space-y-3">
                            {form.data.items.map((item: any, index: number) => {
                                const inventory: any = inventoryByVariant.get(Number(item.product_variant_id));

                                return (
                                    <div key={index} className="rounded-lg border border-border p-4">
                                        <div className="flex items-start justify-between">
                                            <div className="text-xs font-bold uppercase tracking-wider text-text-subtle">Item {index + 1}</div>
                                            {form.data.items.length > 1 && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeItem(index)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>

                                        <div className="mt-3">
                                            <label className="text-xs font-medium text-text-muted">Varian Produk</label>
                                            <select
                                                value={item.product_variant_id}
                                                onChange={(e) => setItem(index, 'product_variant_id', e.target.value)}
                                                className="mt-1 w-full appearance-none rounded-[--radius-control] border border-border bg-surface px-3 py-2 pr-8 text-sm text-text transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
                                                    {...calculateStockStatus(inventory.current_stock, inventory.reserved_stock, inventory.minimum_stock)}
                                                    showQuantity
                                                />
                                            </div>
                                        )}

                                        <div className="mt-3">
                                            <label className="text-xs font-medium text-text-muted">Jumlah Diminta</label>
                                            <Input
                                                type="number"
                                                min="1"
                                                value={item.requested_quantity}
                                                onChange={(e) => setItem(index, 'requested_quantity', Number(e.target.value))}
                                                className="mt-1"
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <button
                            type="button"
                            onClick={addItem}
                            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border text-sm font-medium text-text-muted active:bg-surface-muted"
                        >
                            <Plus className="h-4 w-4" />
                            Tambah Item
                        </button>

                        <div className="rounded-lg border border-border p-4">
                            <div className="mb-3 text-xs font-bold uppercase tracking-wide text-text-subtle">Catatan</div>
                            <Textarea
                                value={form.data.notes}
                                onChange={(e) => form.setData('notes', e.target.value)}
                                placeholder="Catatan restock (opsional)..."
                                rows={3}
                            />
                        </div>

                        {form.errors.items && <div className="text-xs text-red-600">{form.errors.items}</div>}

                        <div className="sticky bottom-0 z-10 border-t border-border bg-white p-4">
                            <Button type="submit" className="w-full" disabled={form.processing || !outletId}>
                                {form.processing ? 'Memproses...' : 'Kirim Request Restock'}
                            </Button>
                        </div>
                    </>
                )}

                {outletId && loading && (
                    <div className="flex items-center justify-center py-12">
                        <div className="text-sm text-text-muted">Memuat produk...</div>
                    </div>
                )}
            </form>
        </OwnerPageShell>
    );
}
