import type { ResolvedComponent } from '@inertiajs/react';
import OwnerLayout from '@/layouts/owner-layout';

export function applyOwnerLayout(
    component: ResolvedComponent,
): ResolvedComponent {
    component.layout ??= OwnerLayout;

    return component;
}
