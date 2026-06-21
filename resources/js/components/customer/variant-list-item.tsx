import { Link } from '@inertiajs/react';
import { Heart } from 'lucide-react';
import { memo, useState } from 'react';
import ProductImage from '@/components/customer/product-image';
import { Skeleton } from '@/components/ui/skeleton';
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
    loading?: boolean;
}

const VariantListItem = memo(function VariantListItem({ variant, familyId, familyName, familyDescription, familyBrand, displayPrice, displayLabel, onQuickAdd, loading }: Props) {
    const [adding, setAdding] = useState(false);
    const [toast, setToast] = useState(false);
    const cart = useCart();
    const { isFavorite, toggle } = useFavorites();

    const isFav = isFavorite(variant.id);
    const isOutOfStock = variant.stock_status === 'out_of_stock';

    const handleQuickAdd = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (adding || isOutOfStock) {
return;
}

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
            className="flex items-center gap-3.5 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm active:bg-zinc-50"
        >
            {/* Image */}
            <div className="relative shrink-0">
                {loading ? (
                    <Skeleton className="h-16 w-16 rounded-xl" />
                ) : (
                    <>
                        <ProductImage name={variant.name} size="md" />
                        {/* Favorite button */}
                        <button
                            type="button"
                            onClick={handleFavorite}
                            className="absolute -right-1 -top-1 flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm"
                            aria-label={isFav ? 'Hapus dari favorit' : 'Tambah ke favorit'}
                        >
                            <Heart
                                className={`h-3.5 w-3.5 ${isFav ? 'fill-red-500 text-red-500' : 'text-zinc-400'}`}
                            />
                        </button>
                    </>
                )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-zinc-900">
                    {displayLabel}
                </div>
                {familyDescription && (
                    <div className="mt-0.5 text-xs text-zinc-400 line-clamp-2">
                        {familyDescription}
                    </div>
                )}
                <div className="mt-1 text-base font-semibold text-zinc-900 tabular-nums">
                    {formatCurrency(displayPrice)}
                </div>
                {variant.available_stock !== undefined && (
                    <div className="mt-0.5 text-xs text-zinc-500">
                        Stok: {variant.available_stock}
                    </div>
                )}
            </div>

            {/* Quick Add / Toast */}
            <div className="shrink-0">
                {toast ? (
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100">
                        <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={handleQuickAdd}
                        disabled={adding || isOutOfStock}
                        className={`flex h-11 w-11 items-center justify-center rounded-lg transition-all active:scale-90 disabled:opacity-40 ${
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
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                            </svg>
                        )}
                    </button>
                )}
            </div>
        </Link>
    );
});

export default VariantListItem;
