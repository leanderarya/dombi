/**
 * In-app DOKU Checkout overlay.
 *
 * We intentionally do NOT use the vendor `jokul-checkout-1.0.0.js` bundle. That
 * bundle injects a full-screen modal with no close affordance and a broken
 * backdrop handler (`window.onclick` sets `display="block"` instead of `"none"`),
 * so the customer could not dismiss it to reach the retry button behind it.
 *
 * DOKU serves an iframe-friendly layout when `?view=iframe` is present, which is
 * exactly what the vendor bundle relied on. We embed that URL in our own modal
 * so the app keeps a visible header and a working close control.
 */

const MODAL_ID = 'dombi-doku-checkout';

/** Origins DOKU posts `{ func: 'closeJokul' }` from once payment completes. */
const DOKU_FRAME_ORIGINS = [
    'https://checkout.doku.com',
    'https://jokul.doku.com',
    'https://sandbox.doku.com',
    'https://staging.doku.com',
    'https://app-uat.doku.com',
    'https://app-sit.doku.com',
];

const CLOSE_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

type ActiveModal = {
    root: HTMLDivElement;
    cleanup: () => void;
};

let active: ActiveModal | null = null;

/**
 * DOKU only renders the embeddable layout when `view=iframe` is set. Preserve
 * any existing query string (and fragment) instead of blindly appending `?`.
 */
export function buildDokuCheckoutUrl(paymentUrl: string): string {
    try {
        const url = new URL(paymentUrl);
        url.searchParams.set('view', 'iframe');

        return url.toString();
    } catch {
        // Relative or malformed URL: keep the fragment last.
        const [base, fragment] = paymentUrl.split('#', 2);
        const separator = base.includes('?') ? '&' : '?';

        return `${base}${separator}view=iframe${fragment ? `#${fragment}` : ''}`;
    }
}

export function isDokuCheckoutOpen(): boolean {
    return active !== null;
}

export function closeDokuCheckout(): void {
    active?.cleanup();
}

/**
 * Open the DOKU checkout page as a dismissible in-app overlay.
 * Returns false when the overlay cannot be mounted so callers can fall back to
 * opening the hosted page in a new tab.
 */
export function openDokuCheckout(paymentUrl: string): boolean {
    if (typeof document === 'undefined' || !document.body) {
        return false;
    }

    // Never stack overlays: a retry replaces whatever was already open.
    closeDokuCheckout();

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;

    // Hide the obscured page from assistive tech and take it out of the tab
    // order, so Tab cannot escape the dialog into the content behind it.
    const background = document.getElementById('app');
    const previousAriaHidden = background?.getAttribute('aria-hidden') ?? null;
    const previousInert = background?.hasAttribute('inert') ?? false;

    if (background) {
        background.setAttribute('aria-hidden', 'true');
        background.setAttribute('inert', '');
    }

    const root = document.createElement('div');
    root.id = MODAL_ID;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Pembayaran DOKU');
    root.className =
        'fixed inset-0 z-[999999] flex flex-col overscroll-contain bg-black/60';

    const header = document.createElement('div');
    header.className =
        'flex shrink-0 items-center justify-between gap-3 bg-surface px-4 py-3 pt-safe shadow-sm';

    const title = document.createElement('p');
    title.className = 'text-sm font-semibold text-text';
    title.textContent = 'Pembayaran';

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Tutup pembayaran');
    closeButton.className =
        'flex h-10 w-10 items-center justify-center rounded-lg text-text-muted active:opacity-70';
    closeButton.innerHTML = CLOSE_ICON;

    const stage = document.createElement('div');
    stage.className =
        'flex min-h-0 flex-1 items-stretch justify-center sm:items-center sm:p-6';

    const panel = document.createElement('div');
    panel.className =
        'flex h-full w-full flex-col overflow-hidden bg-white sm:h-[85vh] sm:max-w-lg sm:rounded-xl sm:shadow-xl';

    const frame = document.createElement('iframe');
    frame.src = buildDokuCheckoutUrl(paymentUrl);
    frame.title = 'Pembayaran DOKU';
    frame.className = 'h-full w-full flex-1 border-0';
    frame.setAttribute('allow', 'payment');

    panel.append(frame);
    stage.append(panel);
    header.append(title, closeButton);
    root.append(header, stage);
    document.body.appendChild(root);

    const onBackdropClick = (event: MouseEvent) => {
        // Clicks on the dark filler around the panel land on `root`/`stage`.
        if (event.target === root || event.target === stage) {
            closeDokuCheckout();
        }
    };

    const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            closeDokuCheckout();

            return;
        }

        // The overlay only holds the close button, but keep the focus inside it
        // so Tab never lands on the inert page behind the dialog.
        if (event.key === 'Tab') {
            event.preventDefault();
            closeButton.focus();
        }
    };

    const onMessage = (event: MessageEvent) => {
        // Require the message to come from THIS iframe, not merely from an
        // allowlisted DOKU origin (any other tab/window could claim one).
        if (event.source !== frame.contentWindow) {
            return;
        }

        if (!DOKU_FRAME_ORIGINS.includes(event.origin)) {
            return;
        }

        const data = event.data as { func?: string } | null;

        if (data?.func === 'closeJokul') {
            closeDokuCheckout();
        }
    };

    const cleanup = () => {
        // Guard against double-cleanup (close button + message + unmount).
        if (active?.root !== root) {
            return;
        }

        active = null;
        document.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('message', onMessage);
        root.remove();
        document.body.style.overflow = previousOverflow;

        if (background) {
            if (previousInert) {
                background.setAttribute('inert', '');
            } else {
                background.removeAttribute('inert');
            }

            if (previousAriaHidden === null) {
                background.removeAttribute('aria-hidden');
            } else {
                background.setAttribute('aria-hidden', previousAriaHidden);
            }
        }

        previouslyFocused?.focus?.();
    };

    active = { root, cleanup };

    closeButton.addEventListener('click', cleanup);
    root.addEventListener('click', onBackdropClick);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('message', onMessage);

    // Prevent the page behind the overlay from scrolling on touch devices.
    document.body.style.overflow = 'hidden';
    closeButton.focus?.();

    return true;
}
