// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import StatusBadge from './status-badge';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

function render(node: React.ReactNode) {
    act(() => root.render(node));
    return container.firstElementChild as HTMLElement;
}

describe('StatusBadge', () => {
    it('resolves a status string to its label and tone', () => {
        const el = render(<StatusBadge status="completed" />);

        expect(el.textContent).toBe('Selesai');
        expect(el.className).toContain('bg-success-bg');
        expect(el.className).toContain('text-success-text');
    });

    it('accepts an explicit variant', () => {
        const el = render(<StatusBadge variant="danger">Gagal</StatusBadge>);

        expect(el.textContent).toBe('Gagal');
        expect(el.className).toContain('bg-danger-bg');
        expect(el.className).toContain('text-danger-text');
    });

    it('falls back to neutral for an unknown status', () => {
        const el = render(<StatusBadge status="something_new" />);

        expect(el.textContent).toBe('something new');
        expect(el.className).toContain('bg-surface-muted');
        expect(el.className).toContain('text-text-muted');
    });

    it('emits no raw palette class in either mode', () => {
        const variants = ['success', 'warning', 'danger', 'info', 'neutral'] as const;
        const statuses = [
            'pending_confirmation',
            'pending_payment',
            'confirmed',
            'preparing',
            'ready_for_pickup',
            'picked_up',
            'delivering',
            'completed',
            'cancelled_by_customer',
            'cancelled_by_outlet',
            'rejected_by_outlet',
            'failed_delivery',
            'expired',
            'payment_failed',
        ];

        for (const variant of variants) {
            const className = render(
                <StatusBadge variant={variant}>x</StatusBadge>,
            ).className;
            expect(className).not.toMatch(/\b(bg|text|border|ring)-(red|amber|blue|emerald|orange|purple|indigo|gray|slate|green)-\d/);
        }

        for (const status of statuses) {
            const className = render(<StatusBadge status={status} />).className;
            expect(className).not.toMatch(/\b(bg|text|border|ring)-(red|amber|blue|emerald|orange|purple|indigo|gray|slate|green)-\d/);
        }
    });
});
