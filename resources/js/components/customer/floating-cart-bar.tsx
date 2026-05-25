import { Link } from '@inertiajs/react';
import { useCart } from '@/lib/use-cart';
import { formatCurrency } from '@/lib/format';

interface Props {
    products?: { id: number; price: number | string }[];
}

/**
 * Floating dark cart bar that appears above bottom nav when cart has items.
 * Shows item count + total + green "Checkout" CTA.
 * Hidden when cart is empty.
 */
export default function FloatingCartBar({ products = [] }: Props) {
    const { items, totalItems } = useCart();

    if (totalItems === 0) return null;

    const productPriceMap = new Map(products.map((p) => [p.id, Number(p.price)]));
    const total = items.reduce((sum, item) => {
        const price = productPriceMap.get(item.product_id) ?? 0;
        return sum + price * item.quantity;
    }, 0);

    return (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 px-4">
            <Link
                href="/customer/checkout"
                className="mx-auto flex max-w-lg items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 shadow-lg active:bg-slate-800"
            >
                {/* Cart icon + count */}
                <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                    <svg className="h-4.5 w-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                    </svg>
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-0.5 text-[9px] font-bold text-white">
                        {totalItems > 9 ? '9+' : totalItems}
                    </span>
                </div>

                {/* Total */}
                <div className="min-w-0 flex-1">
                    <div className="text-xs text-white/60">{totalItems} item</div>
                    <div className="text-sm font-bold tabular-nums text-white">
                        {total > 0 ? formatCurrency(total) : `${totalItems} produk`}
                    </div>
                </div>

                {/* CTA */}
                <span className="flex min-h-9 items-center rounded-lg bg-emerald-600 px-4 text-xs font-bold text-white">
                    Checkout
                </span>
            </Link>
        </div>
    );
}
