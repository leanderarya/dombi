import { describe, expect, it } from 'vitest';
import { getInitialOwnerTab } from './tab-state';

const tabs = ['dashboard', 'audit', 'reports'] as const;

describe('getInitialOwnerTab', () => {
    it('uses a valid tab from the URL before the server value', () => {
        expect(
            getInitialOwnerTab(tabs, 'dashboard', 'audit', '?tab=reports'),
        ).toBe('reports');
    });

    it('falls back through the server value and default for invalid tabs', () => {
        expect(
            getInitialOwnerTab(tabs, 'dashboard', 'audit', '?tab=missing'),
        ).toBe('audit');
        expect(
            getInitialOwnerTab(tabs, 'dashboard', 'missing', '?tab=missing'),
        ).toBe('dashboard');
    });
});
