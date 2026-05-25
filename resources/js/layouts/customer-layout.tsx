import type { PropsWithChildren } from 'react';
import CustomerMobileLayout from './customer-mobile-layout';

export default function CustomerLayout({ children }: PropsWithChildren) {
    return <CustomerMobileLayout>{children}</CustomerMobileLayout>;
}
