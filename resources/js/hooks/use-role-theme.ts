import { useLayoutEffect } from 'react';

export type RoleTheme = 'customer' | 'outlet' | 'courier' | 'owner';

/**
 * Pins `data-role` on <html> for the active panel.
 *
 * Role-scoped design tokens in `resources/css/app.css` resolve from this
 * attribute, so without it a panel silently falls back to the default theme.
 *
 * It is set here and not only on the blade root because Inertia navigates
 * without reloading the document: login, logout and cross-panel redirects
 * swap the mounted layout while the existing <html> element stays in place.
 */
export function useRoleTheme(role: RoleTheme): void {
    useLayoutEffect(() => {
        const root = document.documentElement;
        const previousRole = root.dataset.role;

        root.dataset.role = role;

        return () => {
            if (root.dataset.role !== role) {
                return;
            }

            if (previousRole) {
                root.dataset.role = previousRole;
            } else {
                delete root.dataset.role;
            }
        };
    }, [role]);
}
