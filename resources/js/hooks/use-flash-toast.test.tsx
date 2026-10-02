// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFlashToast } from './use-flash-toast';

const { toastMock, pageProps } = vi.hoisted(() => ({
    toastMock: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
    pageProps: { current: {} as Record<string, unknown> },
}));

vi.mock('sonner', () => ({ toast: toastMock }));
vi.mock('@inertiajs/react', () => ({
    usePage: () => ({ props: pageProps.current }),
}));

let container: HTMLDivElement;
let root: Root;

function Harness() {
    useFlashToast();

    return <div />;
}

async function render(props: Record<string, unknown>) {
    pageProps.current = props;

    await act(async () => root.render(<Harness />));
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    toastMock.success.mockClear();
    toastMock.error.mockClear();
    toastMock.warning.mockClear();
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

describe('useFlashToast', () => {
    // The login screen is the one page with no layout, so it is the only
    // surface where the 429 message has nowhere to go unless the page drains
    // the flash channel itself. This hook is that drain.
    it('raises a toast for a flash error', async () => {
        await render({ flash: { error: 'Terlalu banyak percobaan.' } });

        expect(toastMock.error).toHaveBeenCalledTimes(1);
        expect(toastMock.error).toHaveBeenCalledWith(
            'Terlalu banyak percobaan.',
        );
    });

    it('does not repeat a toast when the same message re-renders', async () => {
        await render({ flash: { error: 'Terlalu banyak percobaan.' } });
        await render({ flash: { error: 'Terlalu banyak percobaan.' } });

        expect(toastMock.error).toHaveBeenCalledTimes(1);
    });

    it('stays silent when there is no flash', async () => {
        await render({});

        expect(toastMock.error).not.toHaveBeenCalled();
        expect(toastMock.success).not.toHaveBeenCalled();
    });
});
