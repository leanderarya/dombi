export function customerHasFloatingBar({
    hasFooterSlot = false,
    showCartBar = false,
    showActiveOrderBar = false,
}: {
    hasFooterSlot?: boolean;
    showCartBar?: boolean;
    showActiveOrderBar?: boolean;
}): boolean {
    return hasFooterSlot || showCartBar || showActiveOrderBar;
}

export function customerFloatingBarBottom(hideBottomNav: boolean): string {
    return hideBottomNav
        ? 'calc(0.75rem + env(safe-area-inset-bottom, 0px))'
        : 'calc(4.5rem + env(safe-area-inset-bottom, 0px))';
}

export function customerContentBottomPadding({
    hasFloatingBar,
    hideBottomNav,
}: {
    hasFloatingBar: boolean;
    hideBottomNav: boolean;
}): string {
    if (hasFloatingBar && !hideBottomNav) {
        return 'pb-[calc(10rem+env(safe-area-inset-bottom,0px))]';
    }

    if (hasFloatingBar || !hideBottomNav) {
        return 'pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]';
    }

    return 'pb-[env(safe-area-inset-bottom,0px)]';
}
