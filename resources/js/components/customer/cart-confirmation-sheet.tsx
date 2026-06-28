import { router } from '@inertiajs/react';
import { CheckCircle, ShoppingCart, ArrowRight } from 'lucide-react';
import BottomSheet from '@/components/ui/bottom-sheet';
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
                <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4">
                    <CheckCircle className="h-8 w-8 shrink-0 text-emerald-600" />
                    <div>
                        <div className="text-sm font-semibold text-emerald-800">Berhasil ditambahkan!</div>
                        <div className="text-xs text-emerald-600">Produk sudah ada di keranjang Anda</div>
                    </div>
                </div>

                <div className="rounded-xl border border-border bg-white p-4">
                    <div className="text-sm font-semibold text-text">{data.productName}</div>
                    {data.variantName && (
                        <div className="mt-0.5 text-xs text-text-muted">{data.variantName}</div>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-text-muted">Jumlah: {data.quantity}</span>
                        <span className="text-sm font-semibold text-emerald-700">{formatCurrency(data.price * data.quantity)}</span>
                    </div>
                </div>

                <div className="space-y-2 pt-2">
                    <button
                        onClick={handleCheckout}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-white active:opacity-80"
                    >
                        <ShoppingCart className="h-4 w-4" />
                        Cek Keranjang
                        <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                        onClick={handleContinueShopping}
                        className="w-full rounded-xl border border-border py-3 text-sm font-semibold text-text active:opacity-80"
                    >
                        Lanjut Belanja
                    </button>
                </div>
            </div>
        </BottomSheet>
    );
}
