import { useCallback, useEffect, useRef, useState } from 'react';
import { mutationFetch } from '@/lib/api';
import { useCart } from '@/lib/use-cart';

interface Options {
    productId: number;
    price: number;
    quantity?: number;
    onAdded?: () => void;
}

/**
 * Shared quick-add-to-cart: optimistic cart update + server POST + toast.
 * Per-item state (independent per instance).
 */
export function useQuickAddCart() {
    const cart = useCart();
    const [adding, setAdding] = useState(false);
    const [toast, setToast] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => clearTimeout(timerRef.current ?? undefined), []);

    const addToCart = useCallback(
        async ({ productId, price, quantity = 1, onAdded }: Options) => {
            if (adding) {
                return;
            }

            setAdding(true);
            cart.addItem(productId, quantity, price);

            try {
                const token = document
                    .querySelector('meta[name="csrf-token"]')
                    ?.getAttribute('content');
                const res = await mutationFetch('/customer/cart/add', {
                    method: 'POST',
                    headers: {
                        ...(token ? { 'X-CSRF-TOKEN': token } : {}),
                    },
                    body: JSON.stringify({
                        product_id: productId,
                        quantity,
                    }),
                });

                if (!res.ok) {
                    throw new Error('Failed to add item');
                }

                if (timerRef.current) {
                    clearTimeout(timerRef.current);
                }

                setToast(true);
                timerRef.current = setTimeout(() => setToast(false), 2000);
                onAdded?.();
            } catch {
                cart.removeItem(productId);
            } finally {
                setAdding(false);
            }
        },
        [adding, cart],
    );

    return { addToCart, adding, toast };
}
