// @vitest-environment jsdom
import { router } from '@inertiajs/react';
import { act } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BannersIndex from './index';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const actual = (await importOriginal()) as Record<string, unknown>;

    return {
        ...actual,
        router: { delete: vi.fn() },
        Link: ({ children, ...rest }: { children?: ReactNode }) => (
            <a {...rest}>{children}</a>
        ),
        useForm: () => ({
            data: {
                name: '',
                alt_text: '',
                image: null,
                target_path: '',
                sort_order: '0',
                is_active: false,
            },
            errors: {},
            hasErrors: false,
            processing: false,
            progress: null,
            setData: vi.fn(),
            transform: vi.fn(),
            post,
        }),
    };
});

vi.mock('@/components/owner/owner-page-shell', () => ({
    default: ({
        children,
        headerRight,
    }: {
        children?: ReactNode;
        headerRight?: ReactNode;
    }) => (
        <div>
            <header>{headerRight}</header>
            <main>{children}</main>
        </div>
    ),
}));

let root: Root;
let container: HTMLDivElement;

const banner = (id: number, name: string) => ({
    id,
    name,
    alt_text: `${name} alt`,
    image_url: `/banner-${id}.webp`,
    target_path: '/customer/products',
    sort_order: id,
    is_active: false,
});

const render = (banners: ReturnType<typeof banner>[], maxBanners = 3) =>
    act(() =>
        root.render(<BannersIndex banners={banners} maxBanners={maxBanners} />),
    );

beforeEach(() => {
    (
        globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
});

const buttons = () => [...document.body.querySelectorAll('button')];
const buttonByLabel = (label: string) =>
    buttons().find((button) => button.getAttribute('aria-label') === label);
const buttonByText = (text: string) =>
    buttons().find((button) => button.textContent?.trim() === text);

describe('BannersIndex', () => {
    it('explains the public fallback when no banners are active', () => {
        render([banner(1, 'Satu')]);
        expect(container.textContent).toContain('0 dari 1 banner aktif');
        expect(container.textContent).toContain(
            'Customer saat ini melihat 3 banner bawaan Dombi yang bergantian setiap 5 detik',
        );
    });
    it('explains that a single active banner does not rotate', () => {
        render([{ ...banner(1, 'Satu'), is_active: true }]);
        expect(container.textContent).toContain('1 dari 1 banner aktif');
        expect(container.textContent).toContain(
            'Satu banner tampil tanpa pergantian otomatis',
        );
    });
    it('explains autoplay for multiple active banners', () => {
        render(
            [1, 2, 3].map((id) => ({
                ...banner(id, String(id)),
                is_active: true,
            })),
        );
        expect(container.textContent).toContain('3 dari 3 banner aktif');
        expect(container.textContent).toContain('bergantian setiap 5 detik');
        expect(container.textContent).not.toContain('menjeda rotasi');
    });
    it('disables the add button and explains why at capacity', () => {
        render([banner(1, 'Satu'), banner(2, 'Dua'), banner(3, 'Tiga')]);

        const add = buttons().find((button) =>
            button.textContent?.includes('Tambah banner'),
        )!;
        expect(add.disabled).toBe(true);
        expect(container.textContent).toContain('Hapus salah satu');
    });

    it('keeps the add button enabled below capacity', () => {
        render([banner(1, 'Satu')]);

        const add = buttons().find((button) =>
            button.textContent?.includes('Tambah banner'),
        )!;
        expect(add.disabled).toBe(false);
    });

    it('deletes only after the confirmation dialog is accepted', () => {
        render([banner(7, 'Satu')]);

        act(() => buttonByLabel('Hapus banner Satu')!.click());
        expect(document.body.textContent).toContain('Hapus banner?');
        expect(document.body.textContent).toContain('"Satu"');
        expect(router.delete).not.toHaveBeenCalled();

        act(() => buttonByText('Hapus banner')!.click());
        expect(router.delete).toHaveBeenCalledWith(
            '/owner/banners/7',
            expect.objectContaining({ preserveScroll: true }),
        );
    });

    it('does not close a newer editor when an older save succeeds', () => {
        render([banner(1, 'Satu'), banner(2, 'Dua')]);
        act(() => buttonByLabel('Edit banner Satu')!.click());
        act(() =>
            document
                .querySelector('form')!
                .dispatchEvent(
                    new Event('submit', { bubbles: true, cancelable: true }),
                ),
        );
        const saved = post.mock.calls[0][1].onSuccess;
        act(() => buttonByText('Close')!.click());
        act(() => buttonByLabel('Edit banner Dua')!.click());
        act(() => saved());
        expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    });

    it('restores focus to status when creation disables the add trigger', async () => {
        const initial = [banner(1, 'Satu'), banner(2, 'Dua')];
        render(initial);
        act(() => buttonByText('Tambah banner')!.click());
        act(() =>
            document
                .querySelector('form')!
                .dispatchEvent(
                    new Event('submit', { bubbles: true, cancelable: true }),
                ),
        );
        const saved = post.mock.calls[0][1].onSuccess;
        render([...initial, banner(3, 'Tiga')]);
        act(() => saved());
        await vi.waitFor(() =>
            expect(document.activeElement?.getAttribute('tabindex')).toBe('-1'),
        );
        expect(document.activeElement?.textContent).toContain(
            '3 banner, termasuk yang nonaktif',
        );
    });

    it('restores focus to status after the delete trigger is removed', async () => {
        render([banner(1, 'Satu')]);
        act(() => buttonByLabel('Hapus banner Satu')!.click());
        act(() => buttonByText('Hapus banner')!.click());
        const options = vi.mocked(router.delete).mock.calls[0][1]!;
        render([]);
        act(() => (options.onSuccess as () => void)());
        await vi.waitFor(() =>
            expect(document.activeElement?.getAttribute('tabindex')).toBe('-1'),
        );
        expect(document.activeElement?.textContent).toContain(
            '0 dari 0 banner aktif',
        );
    });

    it('sends nothing when the confirmation is cancelled', () => {
        render([banner(7, 'Satu')]);

        act(() => buttonByLabel('Hapus banner Satu')!.click());
        act(() => buttonByText('Batal')!.click());

        expect(router.delete).not.toHaveBeenCalled();
        expect(document.body.textContent).not.toContain('Hapus banner?');
    });
});
