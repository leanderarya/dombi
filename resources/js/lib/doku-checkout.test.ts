// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    buildDokuCheckoutUrl,
    closeDokuCheckout,
    isDokuCheckoutOpen,
    openDokuCheckout,
} from './doku-checkout';

const PAYMENT_URL = 'https://sandbox.doku.com/checkout/link/PAY1';
const MODAL_SELECTOR = '#dombi-doku-checkout';

function modal(): HTMLElement | null {
    return document.querySelector(MODAL_SELECTOR);
}

function frame(): HTMLIFrameElement | null {
    return document.querySelector(`${MODAL_SELECTOR} iframe`);
}

function closeButton(): HTMLButtonElement {
    const button = modal()?.querySelector('button');

    if (!button) {
        throw new Error('close button not found');
    }

    return button as HTMLButtonElement;
}

function clickCloseButton() {
    closeButton().click();
}

function pressEscape() {
    document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
}

function clickBackdrop() {
    const stage = modal()?.lastElementChild as HTMLElement | undefined;

    if (!stage) {
        throw new Error('overlay stage not found');
    }

    stage.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function postFromDoku(data: unknown, origin = 'https://sandbox.doku.com') {
    window.dispatchEvent(
        new MessageEvent('message', {
            data,
            origin,
            source: frame()?.contentWindow ?? null,
        }),
    );
}

function postFromForeignWindow(
    data: unknown,
    origin = 'https://sandbox.doku.com',
) {
    window.dispatchEvent(
        new MessageEvent('message', { data, origin, source: window }),
    );
}

describe('buildDokuCheckoutUrl', () => {
    it('appends view=iframe to a bare url', () => {
        expect(buildDokuCheckoutUrl(PAYMENT_URL)).toBe(
            `${PAYMENT_URL}?view=iframe`,
        );
    });

    it('appends after the existing query string', () => {
        expect(buildDokuCheckoutUrl(`${PAYMENT_URL}?token=abc`)).toBe(
            `${PAYMENT_URL}?token=abc&view=iframe`,
        );
    });

    it('leaves an existing view parameter untouched', () => {
        expect(buildDokuCheckoutUrl(`${PAYMENT_URL}?view=iframe`)).toBe(
            `${PAYMENT_URL}?view=iframe`,
        );
    });

    it('keeps the query before the fragment', () => {
        expect(buildDokuCheckoutUrl(`${PAYMENT_URL}#step2`)).toBe(
            `${PAYMENT_URL}?view=iframe#step2`,
        );
    });
});

describe('openDokuCheckout', () => {
    beforeEach(() => {
        closeDokuCheckout();
        document.body.innerHTML = '';
        document.body.style.overflow = '';
    });

    it('renders an in-app overlay with the embeddable DOKU url', () => {
        expect(openDokuCheckout(PAYMENT_URL)).toBe(true);

        const overlay = modal();
        expect(overlay).not.toBeNull();
        expect(overlay?.getAttribute('role')).toBe('dialog');
        expect(overlay?.getAttribute('aria-modal')).toBe('true');

        expect(frame()?.src).toBe(`${PAYMENT_URL}?view=iframe`);
    });

    it('exposes a labelled close control', () => {
        openDokuCheckout(PAYMENT_URL);

        expect(closeButton().getAttribute('aria-label')).toBe(
            'Tutup pembayaran',
        );
    });

    it('renders a native-style header with a centered title', () => {
        openDokuCheckout(PAYMENT_URL);

        const overlay = modal();
        const header = overlay?.firstElementChild as HTMLElement;
        const title = header.querySelector('p');

        expect(
            header.className.includes('border-b') &&
                header.className.includes('pt-safe'),
        ).toBe(true);
        expect(title?.textContent).toBe('Pembayaran');
        expect(title?.className).toContain('text-center');

        // 44px touch target, matching the app header buttons.
        expect(closeButton().className).toContain('h-11');
        expect(closeButton().className).toContain('w-11');
        expect(closeButton().className).toContain('bg-surface-muted');
    });

    it('closes via the close button', () => {
        openDokuCheckout(PAYMENT_URL);
        clickCloseButton();

        expect(modal()).toBeNull();
        expect(isDokuCheckoutOpen()).toBe(false);
    });

    it('closes via Escape', () => {
        openDokuCheckout(PAYMENT_URL);
        pressEscape();

        expect(modal()).toBeNull();
    });

    it('closes via a backdrop click', () => {
        openDokuCheckout(PAYMENT_URL);
        clickBackdrop();

        expect(modal()).toBeNull();
    });

    it('does not close when the panel itself is clicked', () => {
        openDokuCheckout(PAYMENT_URL);

        frame()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(modal()).not.toBeNull();
    });

    it('closes on closeJokul from an allowed DOKU origin', () => {
        openDokuCheckout(PAYMENT_URL);
        postFromDoku({ func: 'closeJokul' });

        expect(modal()).toBeNull();
    });

    it('ignores closeJokul from an untrusted origin', () => {
        openDokuCheckout(PAYMENT_URL);
        postFromDoku({ func: 'closeJokul' }, 'https://evil.example');

        expect(modal()).not.toBeNull();
    });

    it('ignores closeJokul from an allowlisted origin in a foreign window', () => {
        openDokuCheckout(PAYMENT_URL);
        postFromForeignWindow({ func: 'closeJokul' });

        expect(modal()).not.toBeNull();
    });

    it('ignores unrelated messages from DOKU', () => {
        openDokuCheckout(PAYMENT_URL);
        postFromDoku({ func: 'somethingElse' });

        expect(modal()).not.toBeNull();
    });

    it('replaces a previously open overlay instead of stacking', () => {
        openDokuCheckout(PAYMENT_URL);
        openDokuCheckout(`${PAYMENT_URL}2`);

        expect(document.querySelectorAll(MODAL_SELECTOR)).toHaveLength(1);
        expect(frame()?.src).toBe(`${PAYMENT_URL}2?view=iframe`);
    });

    it('locks page scroll while open and restores it on close', () => {
        document.body.style.overflow = 'auto';

        openDokuCheckout(PAYMENT_URL);
        expect(document.body.style.overflow).toBe('hidden');

        closeDokuCheckout();
        expect(document.body.style.overflow).toBe('auto');
    });

    it('detaches its listeners after closing', () => {
        openDokuCheckout(PAYMENT_URL);

        const removeWindow = vi.spyOn(window, 'removeEventListener');
        const removeDocument = vi.spyOn(document, 'removeEventListener');

        clickCloseButton();

        expect(removeWindow).toHaveBeenCalledWith(
            'message',
            expect.any(Function),
        );
        expect(removeDocument).toHaveBeenCalledWith(
            'keydown',
            expect.any(Function),
        );

        // A late DOKU message must not throw or resurrect the overlay.
        expect(() => postFromDoku({ func: 'closeJokul' })).not.toThrow();
        expect(() => pressEscape()).not.toThrow();
        expect(modal()).toBeNull();
    });

    it('hides the page behind the dialog from assistive tech while open', () => {
        const app = document.createElement('div');
        app.id = 'app';
        document.body.appendChild(app);

        openDokuCheckout(PAYMENT_URL);
        expect(app.getAttribute('aria-hidden')).toBe('true');
        expect(app.hasAttribute('inert')).toBe(true);

        closeDokuCheckout();
        expect(app.hasAttribute('aria-hidden')).toBe(false);
        expect(app.hasAttribute('inert')).toBe(false);
    });

    it('keeps Tab focus on the close control', () => {
        openDokuCheckout(PAYMENT_URL);

        const event = new KeyboardEvent('keydown', {
            key: 'Tab',
            bubbles: true,
            cancelable: true,
        });
        document.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(closeButton());
    });
});
