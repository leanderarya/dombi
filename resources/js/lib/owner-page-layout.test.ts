import type { ResolvedComponent } from '@inertiajs/react';
import { describe, expect, it } from 'vitest';
import OwnerLayout from '@/layouts/owner-layout';
import { applyOwnerLayout } from './owner-page-layout';

describe('applyOwnerLayout', () => {
    it('assigns the same persistent layout to owner pages', () => {
        const firstPage = (() => null) as ResolvedComponent;
        const secondPage = (() => null) as ResolvedComponent;

        applyOwnerLayout(firstPage);
        applyOwnerLayout(secondPage);

        expect(firstPage.layout).toBe(OwnerLayout);
        expect(secondPage.layout).toBe(OwnerLayout);
    });

    it('preserves a page-specific layout', () => {
        const component = (() => null) as ResolvedComponent;
        const customLayout = OwnerLayout;
        component.layout = customLayout;

        applyOwnerLayout(component);

        expect(component.layout).toBe(customLayout);
    });
});
