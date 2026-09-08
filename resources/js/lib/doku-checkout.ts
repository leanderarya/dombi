type LoadJokulCheckout = (url: string) => void;

declare global {
    interface Window {
        loadJokulCheckout?: LoadJokulCheckout;
    }
}

const scriptTags = new Map<string, Promise<void>>();

/** Load the DOKU Checkout JS library exactly once per URL. */
export function ensureDokuScript(scriptUrl: string): Promise<void> {
    if (scriptTags.has(scriptUrl)) {
        return scriptTags.get(scriptUrl)!;
    }

    if (typeof window.loadJokulCheckout === 'function') {
        return Promise.resolve();
    }

    const existing = document.querySelector<HTMLScriptElement>(
        `script[data-doku-checkout="${scriptUrl}"]`,
    );

    if (existing) {
        return ensureDokuScript(scriptUrl);
    }

    const promise = new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = scriptUrl;
        script.async = true;
        script.dataset.dokuCheckout = scriptUrl;

        const onReady = () => {
            if (typeof window.loadJokulCheckout === 'function') {
                resolve();

                return;
            }

            // Script loaded but global not defined yet → give it one more tick.
            setTimeout(() => {
                if (typeof window.loadJokulCheckout === 'function') {
                    resolve();
                } else {
                    reject(new Error('DOKU checkout global not available'));
                }
            }, 50);
        };

        script.onload = () => {
            onReady();
            script.remove();
        };
        script.onerror = () =>
            reject(new Error('Failed to load DOKU checkout script'));

        document.head.appendChild(script);
    });

    // Keep the promise so repeated calls reuse the in-flight load.
    const guarded = promise.catch((err) => {
        scriptTags.delete(scriptUrl);

        throw err;
    });
    scriptTags.set(scriptUrl, guarded);

    return guarded;
}

/** Open the DOKU Checkout hosted page as an in-app modal. Returns false on failure (caller should fall back to window.open). */
export async function openDokuCheckout(
    paymentUrl: string,
    scriptUrl: string,
): Promise<boolean> {
    try {
        await ensureDokuScript(scriptUrl);

        if (typeof window.loadJokulCheckout !== 'function') {
            return false;
        }

        window.loadJokulCheckout(paymentUrl);

        return true;
    } catch {
        return false;
    }
}
