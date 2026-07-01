import type { PropsWithChildren } from 'react';

interface Props extends PropsWithChildren {
    /** Remove default vertical spacing between children */
    noGap?: boolean;
    /** Extra bottom padding for pages with StickyActionBar */
    hasStickyBar?: boolean;
}

export default function OutletPageShell({ children, noGap, hasStickyBar }: Props) {
    return (
        <div className={`mt-4 ${noGap ? '' : 'space-y-4'} ${hasStickyBar ? 'pb-24' : 'pb-8'}`}>
            {children}
        </div>
    );
}
