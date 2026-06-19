import { type ReactNode } from 'react';
import { CartConfirmationContext, useCartConfirmationState } from '@/contexts/cart-confirmation-context';
import CartConfirmationSheet from '@/components/customer/cart-confirmation-sheet';

interface Props {
    children: ReactNode;
}

export default function CartConfirmationProvider({ children }: Props) {
    const { isOpen, data, showConfirmation, hideConfirmation } = useCartConfirmationState();

    return (
        <CartConfirmationContext.Provider value={{ isOpen, data, showConfirmation, hideConfirmation }}>
            {children}
            <CartConfirmationSheet
                open={isOpen}
                onClose={hideConfirmation}
                data={data}
            />
        </CartConfirmationContext.Provider>
    );
}
