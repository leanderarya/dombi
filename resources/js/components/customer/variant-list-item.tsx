import { Link } from '@inertiajs/react';
import { Heart } from 'lucide-react';
import { memo, useState } from 'react';
import ProductImage from '@/components/customer/product-image';
import { Skeleton } from '@/components/ui/skeleton';
import { useOutlet } from '@/contexts/outlet-context';
import { formatCurrency } from '@/lib/format';
import { useCart } from '@/lib/use-cart';
import { useFavorites } from '@/lib/use-favorites';

interface Variant {
    id: number;
    name: string;
    flavor: string | null;
    size: string | null;
    price: number;
    is_active: boolean;
    image?: string | null;
    available_stock?: number;
    stock_status?: string;
}

interface Props {
    variant: Variant;
    familyId: number;
    familyDescription: string | null;
    familyImage?: string | null;
    displayPrice: number;
    displayLabel: string;
    variantCount?: number;
    onQuickAdd?: () => void;
    loading?: boolean;
}

const VariantListItem = memo(function VariantListItem({
    variant,
    familyId,
    familyDescription,
    familyImage,
    displayPrice,
    displayLabel,
    variantCount = 1,
    onQuickAdd,
    loading,
}: Props) {
    const [adding, setAdding] = useState(false);
    const [toast, setToast] = useState(false);
    const cart = useCart();
    const { isFavorite, toggle } = useFavorites();
    const { selectedOutlet } = useOutlet();

    const isFav = isFavorite(variant.id);
    const isOutOfStock = variant.stock_status === 'out_of_stock';
    const showMulaiDari = variantCount > 1;

    const productHref = (() => {
        const params = new URLSearchParams();

        if (selectedOutlet) {
            params.set('outlet_id', String(selectedOutlet.id));
        }

        if (variant.flavor) {
            params.set('flavor', variant.flavor);
        }

        if (variant.size) {
            params.set('size', variant.size);
        }

        const qs = params.toString();

        return qs
            ? `/customer/products/${familyId}?${qs}`
            : `/customer/products/${familyId}`;
    })();

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
        cart.addItem(variant.id, 1, displayPrice);

        try {
            const token = document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute('content');
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
            href={productHref}
            className={`flex items-center gap-3.5 p-3 transition-colors active:bg-surface-muted ${isOutOfStock ? 'opacity-50' : ''}`}
        >
            {/* Image */}
            <div className="relative shrink-0">
                {loading ? (
                    <Skeleton className="h-16 w-16 rounded-xl" />
                ) : (
                    <>
                        <ProductImage
                            name={variant.name}
                            src={variant.image ?? familyImage}
                            size="md"
                        />
                        {/* Favorite button */}
                        <button
                            type="button"
                            onClick={handleFavorite}
                            className="absolute -top-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm"
                            aria-label={
                                isFav
                                    ? 'Hapus dari favorit'
                                    : 'Tambah ke favorit'
                            }
                        >
                            <Heart
                                className={`h-3.5 w-3.5 ${isFav ? 'fill-red-500 text-red-500' : 'text-text-muted'}`}
                            />
                        </button>
                    </>
                )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-text">
                    {displayLabel}
                </div>
                {familyDescription && (
                    <div className="mt-0.5 line-clamp-2 text-xs text-text-muted">
                        {familyDescription}
                    </div>
                )}
                <div className="mt-1 flex items-center justify-between">
                    <div>
                        {showMulaiDari && (
                            <div className="text-[10px] text-text-muted">
                                Mulai dari
                            </div>
                        )}
                        <div className="text-sm font-bold text-text tabular-nums">
                            {formatCurrency(displayPrice)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Add / Toast */}
            <div className="shrink-0">
                {toast ? (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100">
                        <svg
                            className="h-4 w-4 text-emerald-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2.5"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                            />
                        </svg>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={handleQuickAdd}
                        disabled={adding || isOutOfStock}
                        className={`flex h-10 w-10 items-center justify-center rounded-full transition-all active:opacity-80 disabled:opacity-40 ${
                            isOutOfStock
                                ? 'bg-surface-muted text-text-muted'
                                : 'bg-primary text-white active:bg-primary-hover'
                        }`}
                        aria-label={
                            isOutOfStock ? 'Habis' : 'Tambah ke keranjang'
                        }
                    >
                        {isOutOfStock ? (
                            <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <path strokeLinecap="round" d="M18 12H6" />
                            </svg>
                        ) : (
                            <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth="2.5"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M12 5v14M5 12h14"
                                />
                            </svg>
                        )}
                    </button>
                )}
            </div>
        </Link>
    );
});

export default VariantListItem;
