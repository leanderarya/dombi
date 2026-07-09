import { router } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/format';
import type { OutletPriceRow, PusatVariant } from './types';

export function GlobalPriceModal({ open, variant, onClose }: {
    open: boolean; variant: PusatVariant; onClose: () => void;
}) {
    const [centerPrice, setCenterPrice] = useState(String(variant.center_price));
    const [sellingPrice, setSellingPrice] = useState(String(variant.selling_price));
    const [saving, setSaving] = useState(false);

    const margin = (parseFloat(sellingPrice) || 0) - (parseFloat(centerPrice) || 0);
    const isNegative = margin < 0;

    const handleSave = () => {
        const updates: Record<string, number> = {};
        const newCenter = parseFloat(centerPrice);
        const newSelling = parseFloat(sellingPrice);

        if (!isNaN(newCenter) && newCenter !== variant.center_price) {
            updates.center_price = newCenter;
        }

        if (!isNaN(newSelling) && newSelling !== variant.selling_price) {
            updates.selling_price = newSelling;
        }

        if (Object.keys(updates).length === 0) {
            onClose();

            return;
        }

        setSaving(true);
        router.patch(`/owner/pricing/variants/${variant.variant_id}`, updates, {
            onFinish: () => {
                setSaving(false); onClose();
            },
        });
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Ubah Harga</DialogTitle>
                    <DialogDescription>{variant.name}</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div>
                        <label className="mb-1 block text-xs font-medium text-text-muted">HPP (Harga Pusat)</label>
                        <Input type="number" value={centerPrice} onChange={(e) => setCenterPrice(e.target.value)} prefix="Rp" />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-text-muted">Harga Jual</label>
                        <Input type="number" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} prefix="Rp" />
                    </div>

                    <div className={`rounded-lg p-3 ${isNegative ? 'bg-red-50' : 'bg-surface-muted'}`}>
                        <div className="text-xs text-text-muted">Margin</div>
                        <div className={`text-lg font-bold tabular-nums ${isNegative ? 'text-red-600' : 'text-emerald-600'}`}>
                            {formatCurrency(margin)}
                        </div>
                        {isNegative && (
                            <p className="mt-1 text-xs text-red-600">Margin negatif — harga jual lebih rendah dari HPP</p>
                        )}
                    </div>

                    {variant.outlet_override_count > 0 && (
                        <p className="text-xs text-amber-600">
                            {variant.outlet_override_count} outlet memiliki override. Perubahan HPP dapat mempengaruhi margin outlet.
                        </p>
                    )}
                </div>

                <div className="mt-6 flex gap-2">
                    <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Batal</Button>
                    <Button type="button" onClick={handleSave} disabled={saving} className="flex-1">
                        {saving ? 'Menyimpan...' : 'Simpan'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export function OutletPriceModal({ open, row, onClose, onSave, saving }: {
    open: boolean; row: OutletPriceRow; onClose: () => void; onSave: (price: number) => void; saving: boolean;
}) {
    const [price, setPrice] = useState(String(row.selling_price));

    const margin = (parseFloat(price) || 0) - row.center_price;
    const isNegative = margin < 0;

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Ubah Harga Outlet</DialogTitle>
                    <DialogDescription>{row.name}</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div>
                        <label className="mb-1 block text-xs font-medium text-text-muted">Harga Pusat (Global)</label>
                        <div className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-text-muted">
                            {formatCurrency(row.center_price)}
                        </div>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-text-muted">Harga Jual (Outlet)</label>
                        <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} prefix="Rp" />
                    </div>

                    <div className={`rounded-lg p-3 ${isNegative ? 'bg-red-50' : 'bg-surface-muted'}`}>
                        <div className="text-xs text-text-muted">Margin</div>
                        <div className={`text-lg font-bold tabular-nums ${isNegative ? 'text-red-600' : 'text-emerald-600'}`}>
                            {formatCurrency(margin)}
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex gap-2">
                    <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Batal</Button>
                    <Button type="button" onClick={() => onSave(parseFloat(price))} disabled={saving} className="flex-1">
                        {saving ? 'Menyimpan...' : 'Simpan'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
