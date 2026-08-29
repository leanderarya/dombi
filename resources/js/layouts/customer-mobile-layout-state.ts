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
