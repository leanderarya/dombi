// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ensureDokuScript, openDokuCheckout } from './doku-checkout';

const SCRIPT_URL =
    'https://sandbox.doku.com/jokul-checkout-js/v1/jokul-checkout-1.0.0.js';

// jsdom never fires load/error for appended <script src>, and the module keeps
// an in-flight promise per URL, so each scenario exercises the load path with
// its own URL to keep tests isolated.
const SCRIPT_URLS = {
    injectOnce:
        'https://sandbox.doku.com/jokul-checkout-js/v1/jokul-checkout-inject-once.js',
    loadResolves:
        'https://sandbox.doku.com/jokul-checkout-js/v1/jokul-checkout-load-resolves.js',
    injectFails:
        'https://sandbox.doku.com/jokul-checkout-js/v1/jokul-checkout-inject-fails.js',
    loadButNoGlobal:
        'https://sandbox.doku.com/jokul-checkout-js/v1/jokul-checkout-no-global.js',
    staleNode:
        'https://sandbox.doku.com/jokul-checkout-js/v1/jokul-checkout-stale-node.js',
};

/**
 * Make appending a doku-checkout <script> behave like a real browser load:
 * fire the load event (optionally defining window.loadJokulCheckout first, as
 * the real DOKU lib does) instead of leaving the promise pending forever.
 */
function stubScriptLoad(definesGlobal: boolean) {
    const appendChild = document.head.appendChild.bind(document.head);
    vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
        const tag = node as HTMLScriptElement;

        if (tag.dataset?.dokuCheckout !== undefined) {
            setTimeout(() => {
                if (definesGlobal) {
                    (window as any).loadJokulCheckout = () => {};
                }

                tag.dispatchEvent(new Event('load'));
            }, 0);
        }

        return appendChild(node);
    });

    return vi.mocked(document.head.appendChild);
}

describe('ensureDokuScript', () => {
    beforeEach(() => {
        document.head
            .querySelectorAll('script[data-doku-checkout]')
            .forEach((s) => s.remove());
        vi.restoreAllMocks();
        delete window.loadJokulCheckout;
    });

    it('injects the script once', async () => {
        const append = stubScriptLoad(true);

        await ensureDokuScript(SCRIPT_URLS.injectOnce);
        await ensureDokuScript(SCRIPT_URLS.injectOnce);

        // The loader removes the tag after it loads, so "once" means a single
        // injection attempt for repeated calls with the same URL.
        expect(append).toHaveBeenCalledTimes(1);
    });

    it('resolves once window.loadJokulCheckout exists', async () => {
        stubScriptLoad(true);

        await expect(
            ensureDokuScript(SCRIPT_URLS.loadResolves),
        ).resolves.toBeUndefined();
        expect(typeof (window as any).loadJokulCheckout).toBe('function');
    });

    it('removes a stale DOM node and loads fresh when the map has no entry', async () => {
        // Simulate a previously failed load: a <script data-doku-checkout> node
        // left behind in the DOM with no matching entry in the module-level
        // scriptTags map. Previously this path recursed forever.
        const stale = document.createElement('script');
        stale.src = SCRIPT_URLS.staleNode;
        stale.dataset.dokuCheckout = SCRIPT_URLS.staleNode;
        document.head.appendChild(stale);

        const append = stubScriptLoad(true);

        await expect(
            ensureDokuScript(SCRIPT_URLS.staleNode),
        ).resolves.toBeUndefined();

        // The stale node was removed and exactly one fresh script was injected.
        expect(
            document.head.querySelectorAll('script[data-doku-checkout]'),
        ).toHaveLength(0);
        expect(append).toHaveBeenCalledTimes(1);
    });
});

describe('openDokuCheckout', () => {
    beforeEach(() => {
        document.head
            .querySelectorAll('script[data-doku-checkout]')
            .forEach((s) => s.remove());
        vi.restoreAllMocks();
        delete window.loadJokulCheckout;
    });

    it('calls loadJokulCheckout with the payment url', async () => {
        const open = vi.fn();
        (window as any).loadJokulCheckout = open;

        const ok = await openDokuCheckout(
            'https://sandbox.doku.com/checkout/link/PAY1',
            SCRIPT_URL,
        );

        expect(ok).toBe(true);
        expect(open).toHaveBeenCalledWith(
            'https://sandbox.doku.com/checkout/link/PAY1',
        );
    });

    it('returns false when script injection fails', async () => {
        vi.spyOn(document.head, 'appendChild').mockImplementation(() => {
            throw new Error('blocked');
        });

        const ok = await openDokuCheckout(
            'https://sandbox.doku.com/checkout/link/PAY2',
            SCRIPT_URLS.injectFails,
        );
        expect(ok).toBe(false);
    });

    it('returns false when loadJokulCheckout is missing', async () => {
        stubScriptLoad(false);

        const ok = await openDokuCheckout(
            'https://sandbox.doku.com/checkout/link/PAY3',
            SCRIPT_URLS.loadButNoGlobal,
        );
        expect(ok).toBe(false);
    });
});
