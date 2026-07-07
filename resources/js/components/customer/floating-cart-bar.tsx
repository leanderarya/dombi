import { router } from '@inertiajs/react';
import { formatCurrency } from '@/lib/format';
import { useCart } from '@/lib/use-cart';

function getSelectedOutletId(): number | null {
    try {
        const raw = localStorage.getItem('dombi_selected_outlet');
        if (!raw) return null;
        const id = JSON.parse(raw);
        return typeof id === 'number' ? id : null;
    } catch {
        return null;
    }
}

export default function FloatingCartBar() {
    const { items, totalItems, totalPrice } = useCart();

    if (totalItems === 0) return null;

    const handleCheckout = () => {
        const payload: Record<string, unknown> = {
            items: items.map((i) => ({
                product_variant_id: i.product_variant_id,
                quantity: i.quantity,
            })),
        };
        const outletId = getSelectedOutletId();
        if (outletId) payload.selected_outlet_id = outletId;
        router.post('/customer/checkout', payload);
    };

    return (
        <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0))] z-30 px-4">
            <button
                type="button"
                onClick={handleCheckout}
                className="mx-auto flex max-w-lg w-full items-center gap-3 rounded-xl border border-white/10 bg-text px-4 py-2.5 shadow-lg active:bg-text/90"
            >
                <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                    <svg className="h-4.5 w-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                    </svg>
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-0.5 text-[11px] font-bold text-white">
                        {totalItems > 9 ? '9+' : totalItems}
                    </span>
                </div>

                <div className="min-w-0 flex-1 text-left">
                    <div className="text-xs text-white/60">{totalItems} item di keranjang</div>
                    <div className="text-sm font-bold text-white tabular-nums">{formatCurrency(totalPrice)}</div>
                </div>

                <span className="flex min-h-9 items-center rounded-lg bg-emerald-600 px-4 text-xs font-bold text-white">
                    Checkout
                </span>
            </button>
        </div>
    );
}
