import { useForm } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import StockLevelBadge from '@/components/ui/stock-level-badge';
import { Textarea } from '@/components/ui/textarea';
import { calculateStockStatus } from '@/lib/stock';

interface Props {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    outlets?: { id: number; name: string }[];
    preselectedOutletId?: number;
    preselectedProductId?: number;
}

export default function RestockCreateModal({ open, outlets: outletsProp, preselectedOutletId, preselectedProductId, onClose, onSuccess }: Props) {
    const [outletId, setOutletId] = useState('');
    const [outlets] = useState<any[]>(outletsProp ?? []);
    const [families, setFamilies] = useState<any[]>([]);
    const [inventories, setInventories] = useState<any[]>([]);
    const [loadingOpen, setLoadingOpen] = useState(false);

    const form = useForm({
        outlet_id: '',
        notes: '',
        items: [{ product_variant_id: '', requested_quantity: 1 }],
    });


    // Apply preselected outlet
    useEffect(() => {
        if (open && preselectedOutletId) {
            setOutletId(String(preselectedOutletId));
        }
    }, [open, preselectedOutletId]);

    // Fetch products for selected outlet
    useEffect(() => {
        if (!outletId) { setFamilies([]); setInventories([]); return; }
        setLoadingOpen(true);
        fetch(`/owner/outlets/${outletId}/products`, { headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' } })
            .then(r => r.json())
            .then(data => {
                setFamilies(data.families ?? []);
                setInventories(data.inventories ?? []);
                setLoadingOpen(false);
                // Auto-select preselected product
                if (preselectedProductId && data.families) {
                    const allIds = (data.families as any[]).flatMap((f: any) => (f.variants ?? []).map((v: any) => v.id));
                    if (allIds.includes(preselectedProductId)) {
                        form.setData('items', [{ product_variant_id: String(preselectedProductId), requested_quantity: 1 }]);
                    }
                }
            })
            .catch(() => setLoadingOpen(false));
    }, [outletId]);

    const allVariants = families.flatMap((f: any) =>
        (f.variants ?? []).map((v: any) => ({ ...v, family_name: f.name, family_id: f.id }))
    );

    const invByVariant = new Map(inventories.map((i: any) => [i.product_variant_id, i]));

    const setItem = (index: number, key: string, value: any) => {
        const items = [...form.data.items] as any[];
        items[index] = { ...items[index], [key]: value };
        form.setData('items', items as any);
    };

    const addItem = () => form.setData('items', [...form.data.items, { product_variant_id: allVariants[0]?.id ?? '', requested_quantity: 1 }] as any);
    const removeItem = (index: number) => form.setData('items', form.data.items.filter((_: any, i: number) => i !== index) as any);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        form.setData('outlet_id', outletId);
        form.post('/owner/restocks', { onSuccess: () => { form.reset(); setOutletId(''); onSuccess(); onClose(); } });
    };

    const handleClose = () => {
        if (!form.processing) { form.reset(); setOutletId(''); onClose(); }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
            <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
                <DialogHeader><DialogTitle>Buat Restock</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-3">
                    <Select label="Outlet" value={outletId} onChange={(e) => setOutletId(e.target.value)}
                        options={outlets.map((o: any) => ({ value: String(o.id), label: o.name }))} placeholder="Pilih outlet..." />

                    {outletId && loadingOpen && <p className="text-sm text-text-muted">Memuat produk...</p>}

                    {outletId && !loadingOpen && families.length > 0 && (
                        <>
                            {form.data.items.map((item: any, index: number) => {
                                const inv: any = invByVariant.get(Number(item.product_variant_id));

                                return (
                                    <div key={index} className="rounded-lg border border-border p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-medium text-text-subtle">Item {index + 1}</span>
                                            {form.data.items.length > 1 && (
                                                <button type="button" onClick={() => removeItem(index)} className="text-xs text-red-500 hover:text-red-700">Hapus</button>
                                            )}
                                        </div>
                                        <select value={item.product_variant_id} onChange={(e) => setItem(index, 'product_variant_id', e.target.value)}
                                            className="h-8 w-full rounded-md border border-border bg-surface px-2 text-xs outline-none focus:border-primary">
                                            <option value="">Pilih produk...</option>
                                            {families.map((f: any) => (
                                                <optgroup key={f.id} label={f.name}>
                                                    {f.variants?.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                                                </optgroup>
                                            ))}
                                        </select>
                                        {inv && (
                                            <div className="mt-2 flex items-center gap-3 text-xs">
                                                <span className="text-text-muted">Stok: <b>{inv.current_stock}</b></span>
                                                <span className="text-text-muted">Min: <b>{inv.minimum_stock}</b></span>
                                                <StockLevelBadge {...calculateStockStatus(inv.current_stock, inv.reserved_stock, inv.minimum_stock)} />
                                            </div>
                                        )}
                                        <div className="mt-2">
                                            <label className="text-xs text-text-muted">Jumlah Diminta</label>
                                            <Input type="number" min={1} value={item.requested_quantity} onChange={(e) => setItem(index, 'requested_quantity', Number(e.target.value))} className="mt-0.5 h-8 text-sm" />
                                        </div>
                                    </div>
                                );
                            })}
                            <button type="button" onClick={addItem}
                                className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border text-xs font-medium text-text-muted hover:bg-surface-muted">
                                <Plus className="h-3.5 w-3.5" />Tambah Item
                            </button>
                            <Textarea value={form.data.notes} onChange={(e) => form.setData('notes', e.target.value)} placeholder="Catatan (opsional)" rows={2} />
                            {form.errors.items && <p className="text-xs text-red-600">{form.errors.items}</p>}
                        </>
                    )}
                </form>
                <DialogFooter className="mt-3 border-t border-border pt-3">
                    <Button variant="outline" onClick={handleClose}>Batal</Button>
                    <Button onClick={handleSubmit} disabled={form.processing || !outletId || !families.length}>
                        {form.processing ? 'Mengirim...' : 'Kirim Request'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
