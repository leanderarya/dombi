import { createContext, useContext, useCallback, useState } from 'react';
import type { ReactNode } from 'react';

interface CartConfirmationData {
    productName: string;
    variantName?: string;
    quantity: number;
    price: number;
}

interface CartConfirmationContextType {
    isOpen: boolean;
    data: CartConfirmationData | null;
    showConfirmation: (data: CartConfirmationData) => void;
    hideConfirmation: () => void;
}

const CartConfirmationContext =
    createContext<CartConfirmationContextType | null>(null);

export function useCartConfirmation() {
    const context = useContext(CartConfirmationContext);

    if (!context) {
        throw new Error(
            'useCartConfirmation must be used within CartConfirmationProvider',
        );
    }

    return context;
}

export function useCartConfirmationState() {
    const [isOpen, setIsOpen] = useState(false);
    const [data, setData] = useState<CartConfirmationData | null>(null);

    const showConfirmation = useCallback(
        (confirmationData: CartConfirmationData) => {
            setData(confirmationData);
            setIsOpen(true);
        },
        [],
    );

    const hideConfirmation = useCallback(() => {
        setIsOpen(false);
        setTimeout(() => setData(null), 300);
    }, []);

    return { isOpen, data, showConfirmation, hideConfirmation };
}

export { CartConfirmationContext };
export type { CartConfirmationData };
