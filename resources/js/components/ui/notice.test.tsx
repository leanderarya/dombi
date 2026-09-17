// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { Info } from 'lucide-react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Notice from './notice';

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
    return container;
}

describe('Notice', () => {
    it('renders the neutral strip by default', () => {
        const el = render(<Notice icon={Info}>Butuh bantuan? Hubungi outlet</Notice>);
        const strip = el.firstElementChild as HTMLElement;

        expect(strip.className).toContain('bg-surface-muted');
        expect(strip.className).toContain('rounded-control');
        expect(strip.textContent).toContain('Butuh bantuan? Hubungi outlet');
    });

    it('renders a tinted block with title and body', () => {
        const el = render(
            <Notice variant="block" tone="danger" title="Pesanan Dibatalkan">
                Dana akan dikembalikan.
            </Notice>,
        );
        const block = el.firstElementChild as HTMLElement;

        expect(block.className).toContain('bg-danger-bg');
        expect(block.className).toContain('border-danger-border');
        expect(block.className).toContain('rounded-card');
        expect(block.textContent).toContain('Pesanan Dibatalkan');
        expect(block.textContent).toContain('Dana akan dikembalikan.');
    });

    it('renders the optional block action', () => {
        const el = render(
            <Notice
                variant="block"
                tone="warning"
                title="Konfirmasi Kadaluarsa"
                action={<button type="button">Hubungi Outlet</button>}
            >
                Outlet tidak mengkonfirmasi pesanan.
            </Notice>,
        );

        expect(el.querySelector('button')?.textContent).toBe('Hubungi Outlet');
    });

    it('leaves the neutral block without a visible border colour', () => {
        const el = render(
            <Notice variant="block" title="Info">
                Tidak ada yang urgent.
            </Notice>,
        );
        const block = el.firstElementChild as HTMLElement;

        expect(block.className).toContain('border-transparent');
    });

    it('never emits a raw palette class', () => {
        const tones = ['info', 'warning', 'danger', 'success', 'neutral'] as const;

        for (const tone of tones) {
            const el = render(
                <Notice variant="block" tone={tone} title="T">
                    B
                </Notice>,
            );
            const className = (el.firstElementChild as HTMLElement).className;

            expect(className).not.toMatch(/\b(bg|text|border)-(red|amber|blue|emerald)-\d/);
        }
    });
});
