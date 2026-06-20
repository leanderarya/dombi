import type {ReactNode} from 'react';
import CartConfirmationSheet from '@/components/customer/cart-confirmation-sheet';
import { CartConfirmationContext, useCartConfirmationState } from '@/contexts/cart-confirmation-context';

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
