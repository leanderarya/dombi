import { router } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { Product } from '@/types/product';

interface SetupCenterStockModalProps {
    products: Product[];
    open: boolean;
    onClose: () => void;
}

export default function SetupCenterStockModal({
    products,
    open,
    onClose,
}: SetupCenterStockModalProps) {
    const [stocks, setStocks] = useState<Record<number, string>>({});
    const [processing, setProcessing] = useState(false);

    const handleSave = () => {
        if (products.length === 0) {
            onClose();

            return;
        }

        setProcessing(true);
        let done = 0;

        const finishOne = () => {
            done += 1;

            if (done === products.length) {
                setProcessing(false);
                onClose();
            }
        };

        products.forEach((p) => {
            const qty = parseInt(stocks[p.id] || '0', 10);
            const safeQty = Number.isNaN(qty) || qty < 0 ? 0 : qty;

            router.patch(
                `/owner/inventories/central-stock/${p.id}`,
                {
                    center_stock: safeQty,
                    reason: 'Stok awal produk baru',
                },
                {
                    preserveScroll: true,
                    onFinish: finishOne,
                    onError: finishOne,
                },
            );
        });
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Setup Stok Pusat Awal</DialogTitle>
                </DialogHeader>

                <div className="max-h-[60vh] space-y-3 overflow-y-auto py-1 pr-1">
                    {products.length === 0 ? (
                        <p className="py-6 text-center text-sm text-text-muted">
                            Tidak ada produk baru.
                        </p>
                    ) : (
                        products.map((p) => (
                            <div
                                key={p.id}
                                className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2.5"
                            >
                                <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">
                                    {p.name}
                                    <span className="ml-1 text-xs text-text-subtle">
                                        ({p.sku ?? `#${p.id}`})
                                    </span>
                                </span>
                                <Input
                                    type="number"
                                    min={0}
                                    value={stocks[p.id] ?? '0'}
                                    onChange={(e) =>
                                        setStocks((prev) => ({
                                            ...prev,
                                            [p.id]: e.target.value,
                                        }))
                                    }
                                    className="w-24 text-right"
                                    disabled={processing}
                                />
                            </div>
                        ))
                    )}
                </div>

                <DialogFooter className="mt-2">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={processing}
                    >
                        Lewati (Stok 0)
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={processing || products.length === 0}
                    >
                        {processing ? 'Menyimpan...' : 'Simpan'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
