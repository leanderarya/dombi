import { router } from '@inertiajs/react';
import { CheckCircle, ShoppingCart, ArrowRight } from 'lucide-react';
import BottomSheet from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import type { CartConfirmationData } from '@/contexts/cart-confirmation-context';
import { formatCurrency } from '@/lib/format';

interface Props {
    open: boolean;
    onClose: () => void;
    data: CartConfirmationData | null;
}

export default function CartConfirmationSheet({ open, onClose, data }: Props) {
    if (!data) {
        return null;
    }

    const handleCheckout = () => {
        onClose();
        router.get('/customer/checkout');
    };

    const handleContinueShopping = () => {
        onClose();
    };

    return (
        <BottomSheet open={open} onClose={onClose} title="Produk Ditambahkan">
            <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-thumb bg-primary-light p-4">
                    <CheckCircle className="h-8 w-8 shrink-0 text-primary" />
                    <div>
                        <div className="text-sm font-semibold text-primary">
                            Berhasil ditambahkan!
                        </div>
                        <div className="text-xs text-primary">
                            Produk sudah ada di keranjang Anda
                        </div>
                    </div>
                </div>

                <div className="rounded-thumb border border-border bg-surface p-4">
                    <div className="text-sm font-semibold text-text">
                        {data.productName}
                    </div>
                    {data.variantName && (
                        <div className="mt-0.5 text-xs text-text-muted">
                            {data.variantName}
                        </div>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-text-muted">
                            Jumlah: {data.quantity}
                        </span>
                        <span className="text-sm font-semibold text-primary">
                            {formatCurrency(data.price * data.quantity)}
                        </span>
                    </div>
                </div>

                <div className="space-y-2 pt-2">
                    <Button
                        type="button"
                        variant="primary"
                        onClick={handleCheckout}
                        className="w-full rounded-thumb py-3.5 font-bold"
                    >
                        <ShoppingCart className="h-4 w-4" />
                        Cek Keranjang
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleContinueShopping}
                        className="w-full rounded-thumb py-3 font-semibold"
                    >
                        Lanjut Belanja
                    </Button>
                </div>
            </div>
        </BottomSheet>
    );
}
