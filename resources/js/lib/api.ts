let outletClosedHandler: (() => void) | null = null;

export function registerOutletClosedHandler(fn: () => void): void {
    outletClosedHandler = fn;
}

export async function mutationFetch(
    url: string,
    options: RequestInit = {},
): Promise<Response> {
    const res = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...(options.headers ?? {}),
        },
        credentials: 'same-origin',
    });

    if (res.status === 409) {
        try {
            const body = await res.clone().json();

            if (body?.error === 'outlet_closed') {
                outletClosedHandler?.();
            }
        } catch {
            // Non-JSON response — ignore
        }
    }

    if (!res.ok) {
        const error = await res.text().catch(() => 'Request failed');

        throw new Error(error);
    }

    return res;
}

export async function safeMutationFetch(
    url: string,
    options: RequestInit = {},
): Promise<Response> {
    const res = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...(options.headers ?? {}),
        },
        credentials: 'same-origin',
    });

    if (res.status === 409) {
        try {
            const body = await res.clone().json();

            if (body?.error === 'outlet_closed') {
                outletClosedHandler?.();
            }
        } catch {
            // Non-JSON response — ignore
        }
    }

    return res;
}
