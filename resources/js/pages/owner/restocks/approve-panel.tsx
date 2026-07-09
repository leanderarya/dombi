import { Button } from '@/components/ui/button';
import StockLevelBadge from '@/components/ui/stock-level-badge';
import { Textarea } from '@/components/ui/textarea';
import { calculateStockStatus } from '@/lib/stock';

export default function ApprovePanel({ restock, inventories, form, onQuantityChange }: any) {
    return (
        <section className="rounded-lg border border-border p-4" aria-label="Setujui & Siapkan">
            <div className="mb-3 text-xs font-semibold text-text-subtle">Setujui & Siapkan</div>
            <p className="text-xs text-text-muted">Set approved quantity. Distribution akan dibuat status preparing.</p>

            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs leading-5 text-amber-800">
                Warehouse stock management belum aktif. Quantity approved belum mengurangi stok pusat.
            </div>

            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    form.post(`/owner/restocks/${restock.id}/approve`);
                }}
                className="mt-3 space-y-2"
            >
                {restock.items.map((item: any, index: number) => {
                    const inventory: any = inventories.get(item.product_id);

                    return (
                        <div key={item.id} className="rounded-lg border border-border p-3">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-bold text-text">{item.product?.name ?? item.variant?.name ?? '-'}</div>
                                    <div className="text-xs text-text-muted">Diminta {item.requested_quantity}</div>
                                </div>
                                {inventory ? (
                                    <StockLevelBadge {...calculateStockStatus(inventory.current_stock, inventory.reserved_stock, inventory.minimum_stock)} showQuantity />
                                ) : (
                                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-text-muted">Stok Kosong</span>
                                )}
                            </div>
                            <label className="mt-2 block text-xs font-medium text-text-subtle">Jumlah disetujui</label>
                            <input
                                type="number"
                                min="0"
                                value={(form.data.items[index] as any).approved_quantity}
                                onChange={(event) => onQuantityChange(index, Number(event.target.value))}
                                className="mt-1 h-8 w-full rounded-lg border border-border px-2 text-xs font-semibold text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                            />
                        </div>
                    );
                })}

                <Textarea
                    value={form.data.owner_notes}
                    onChange={(event) => form.setData('owner_notes', event.target.value)}
                    placeholder="Catatan owner"
                    rows={3}
                />
                {form.errors.items && <div className="rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700">{form.errors.items}</div>}
                <Button type="submit" className="w-full" disabled={form.processing}>
                    {form.processing ? 'Memproses...' : 'Setujui & Buat Distribusi'}
                </Button>
            </form>
        </section>
    );
}
