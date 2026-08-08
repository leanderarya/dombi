import { useCallback, useEffect, useRef, useState } from 'react';
import { toast as toastNotify } from 'sonner';
import { useOutlet } from '@/contexts/outlet-context';
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
 * Handles smart outlet switch (server returns switched_outlet) by syncing the
 * outlet context and showing a warning toast.
 */
export function useQuickAddCart() {
    const cart = useCart();
    const { syncOutletId } = useOutlet();
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

                const data = await res.json().catch(() => null);

                if (data?.switched_outlet && data?.outlet?.to_outlet_id) {
                    // Smart switch: sync outlet context + notify
                    syncOutletId(data.outlet.to_outlet_id);
                    toastNotify.warning(
                        `Stok tidak tersedia di ${data.outlet.from_outlet_name}. Outlet belanja Anda otomatis dialihkan ke ${data.outlet.to_outlet_name}.`,
                        { duration: 4000 },
                    );
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
        [adding, cart, syncOutletId],
    );

    return { addToCart, adding, toast };
}
