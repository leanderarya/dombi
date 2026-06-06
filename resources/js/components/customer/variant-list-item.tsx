import { memo, useState } from 'react';
import { Link } from '@inertiajs/react';
import { Heart } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { useCart } from '@/lib/use-cart';
import { useFavorites } from '@/lib/use-favorites';

interface Variant {
    id: number;
    name: string;
    flavor: string | null;
    size: string | null;
    selling_price: number;
    is_active: boolean;
    available_stock?: number;
    stock_status?: string;
}

interface Props {
    variant: Variant;
    familyId: number;
    familyName: string;
    familyDescription: string | null;
    familyBrand: string | null;
    displayPrice: number;
    displayLabel: string;
    onQuickAdd?: () => void;
}

const VariantListItem = memo(function VariantListItem({ variant, familyId, familyName, familyDescription, familyBrand, displayPrice, displayLabel, onQuickAdd }: Props) {
    const [adding, setAdding] = useState(false);
    const [toast, setToast] = useState(false);
    const cart = useCart();
    const { isFavorite, toggle } = useFavorites();

    const isFav = isFavorite(variant.id);
    const isOutOfStock = variant.stock_status === 'out_of_stock';

    const handleQuickAdd = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (adding || isOutOfStock) return;

        if (onQuickAdd) {
            onQuickAdd();
            return;
        }

        setAdding(true);
        cart.addItem(variant.id, 1);

        try {
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            await fetch('/customer/cart/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    ...(token ? { 'X-CSRF-TOKEN': token } : {}),
                },
                body: JSON.stringify({
                    product_variant_id: variant.id,
                    quantity: 1,
                }),
                credentials: 'same-origin',
            });
        } catch {
            // Frontend cart already updated
        }

        setAdding(false);
        setToast(true);
        setTimeout(() => setToast(false), 2000);
    };

    const handleFavorite = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(variant.id);
    };

    return (
        <Link
            href={`/customer/products/${familyId}`}
            className="flex items-center gap-3.5 bg-white py-4 active:bg-zinc-50"
        >
            {/* Image */}
            <div className="relative flex h-[88px] w-[88px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-emerald-50 to-zinc-50">
                <span className="text-4xl">&#129371;</span>
                {/* Favorite button */}
                <button
                    type="button"
                    onClick={handleFavorite}
                    className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm"
                    aria-label={isFav ? 'Hapus dari favorit' : 'Tambah ke favorit'}
                >
                    <Heart
                        className={`h-3.5 w-3.5 ${isFav ? 'fill-red-500 text-red-500' : 'text-zinc-400'}`}
                    />
                </button>
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold leading-tight text-slate-900">
                    {displayLabel}
                </div>
                <div className="mt-1 text-[13px] text-zinc-500 leading-snug">
                    {familyDescription || (familyBrand ? `${familyBrand} ${variant.name}` : variant.name)}
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-[15px] font-bold tabular-nums text-emerald-700">
                        {formatCurrency(displayPrice)}
                    </span>
                </div>
            </div>

            {/* Quick Add / Toast */}
            <div className="shrink-0">
                {toast ? (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100">
                        <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={handleQuickAdd}
                        disabled={adding || isOutOfStock}
                        className={`flex h-9 w-9 items-center justify-center rounded-full transition-all active:scale-90 disabled:opacity-40 ${
                            isOutOfStock
                                ? 'bg-zinc-100 text-zinc-400'
                                : 'bg-emerald-600 text-white active:bg-emerald-700'
                        }`}
                        aria-label={isOutOfStock ? 'Habis' : 'Tambah ke keranjang'}
                    >
                        {isOutOfStock ? (
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" d="M18 12H6" />
                            </svg>
                        ) : (
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                            </svg>
                        )}
                    </button>
                )}
            </div>
        </Link>
    );
});

export default VariantListItem;
