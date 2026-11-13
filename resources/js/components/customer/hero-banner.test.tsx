// @vitest-environment jsdom
import { act } from 'react';
import type { AnchorHTMLAttributes } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_HERO_SLIDE } from '@/hooks/use-hero-slides';
import type { HeroSlide } from '@/hooks/use-hero-slides';
import HeroBanner, { BannerImage } from './hero-banner';

vi.mock('@inertiajs/react', () => ({
    Link: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}));
let root: Root;
let container: HTMLDivElement;
const dot = (n: number) =>
    container.querySelector<HTMLButtonElement>(
        `button[aria-label="Banner ${n}"]`,
    )!;
const advance = (ms = 5000) => act(() => vi.advanceTimersByTime(ms));
const renderHero = () =>
    act(() => root.render(<HeroBanner banners={banners} />));
const current = () =>
    container
        .querySelector('[aria-current="true"]')
        ?.getAttribute('aria-label');
const event = (name: string, props: Record<string, unknown> = {}) => {
    const e = new Event(name, { bubbles: true });
    Object.defineProperty(e, 'touches', {
        value: props.touches ?? [],
        configurable: true,
    });
    Object.entries(props).forEach(([key, value]) =>
        Object.defineProperty(e, key, { value }),
    );
    act(() =>
        container
            .querySelector('[aria-roledescription="carousel"]')!
            .dispatchEvent(e),
    );
};
let motion: boolean;
let motionEvents: EventTarget;
const banners: HeroSlide[] = [1, 2].map((id) => ({
    id,
    alt_text: `Banner ${id}`,
    image_url: `/banner-${id}.webp`,
    target_path: '/customer/products',
}));
beforeEach(() => {
    (
        globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(document, 'hidden', {
        configurable: true,
        value: false,
    });
    motion = false;
    motionEvents = new EventTarget();
    vi.stubGlobal('matchMedia', () => ({
        matches: motion,
        addEventListener: motionEvents.addEventListener.bind(motionEvents),
        removeEventListener:
            motionEvents.removeEventListener.bind(motionEvents),
    }));
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('HeroBanner', () => {
    it('autoplays and exposes pause/play controls', () => {
        vi.useFakeTimers();
        renderHero();
        expect(container.querySelectorAll('button')).toHaveLength(3);
        expect(
            container.querySelector('[aria-label="Jeda banner"]'),
        ).not.toBeNull();
        advance();
        expect(current()).toBe('Banner 2');
    });
    it('pauses while hovered and resumes with a full delay', () => {
        vi.useFakeTimers();
        renderHero();
        const region = container.querySelector<HTMLDivElement>(
            '[data-carousel="true"]',
        )!;
        act(() =>
            region.dispatchEvent(
                new MouseEvent('mouseover', { bubbles: true }),
            ),
        );
        advance(5000);
        expect(current()).toBe('Banner 1');
        act(() =>
            region.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })),
        );
        advance(4999);
        expect(current()).toBe('Banner 1');
        advance(1);
        expect(current()).toBe('Banner 2');
    });
    it('allows explicit play after keyboard focus pauses rotation', () => {
        vi.useFakeTimers();
        renderHero();
        const region = container.querySelector<HTMLDivElement>(
            '[data-carousel="true"]',
        )!;
        const dotButton = dot(1);
        act(() => {
            region.focus();
            region.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
            dotButton.focus();
        });
        advance(10000);
        expect(current()).toBe('Banner 1');
        act(() =>
            container
                .querySelector<HTMLButtonElement>(
                    '[aria-label="Putar banner"]',
                )!
                .click(),
        );
        expect(
            container.querySelector('[aria-label="Jeda banner"]'),
        ).not.toBeNull();
        advance();
        expect(current()).toBe('Banner 2');
    });
    it('keeps rotation paused until touch ends or is cancelled', () => {
        vi.useFakeTimers();
        renderHero();
        const region = container.querySelector<HTMLDivElement>(
            '[data-carousel="true"]',
        )!;
        const touch = (
            type: string,
            touches: unknown[] = [],
            changedTouches: unknown[] = [],
        ) => {
            const touchEvent = new Event(type, { bubbles: true });
            Object.defineProperty(touchEvent, 'touches', { value: touches });
            Object.defineProperty(touchEvent, 'changedTouches', {
                value: changedTouches,
            });
            act(() => region.dispatchEvent(touchEvent));
        };
        touch('touchstart', [{ identifier: 1, clientX: 200, clientY: 100 }]);
        touch('touchend', [], [{ identifier: 1, clientX: 200, clientY: 100 }]);
        touch('touchstart', [{ identifier: 2, clientX: 200, clientY: 100 }]);

        advance(5000);
        expect(current()).toBe('Banner 1');
        touch('touchcancel');
        advance(4999);
        expect(current()).toBe('Banner 1');
        advance(1);
        expect(current()).toBe('Banner 2');
    });
    it('hides rotation controls when reduced motion is enabled', () => {
        vi.useFakeTimers();
        motion = true;
        renderHero();
        expect(container.querySelector('[data-rotation-control]')).toBeNull();
        advance(10000);
        expect(current()).toBe('Banner 1');
    });
    it('pauses while document is hidden and resumes with a full delay', () => {
        vi.useFakeTimers();
        renderHero();
        Object.defineProperty(document, 'hidden', {
            configurable: true,
            value: true,
        });
        act(() => document.dispatchEvent(new Event('visibilitychange')));
        advance(10000);
        expect(current()).toBe('Banner 1');
        Object.defineProperty(document, 'hidden', {
            configurable: true,
            value: false,
        });
        act(() => document.dispatchEvent(new Event('visibilitychange')));
        advance(4999);
        expect(current()).toBe('Banner 1');
        advance(1);
        expect(current()).toBe('Banner 2');
    });
    it('does not rotate while reduced motion is enabled at runtime', () => {
        vi.useFakeTimers();
        renderHero();
        act(() => {
            motion = true;
            motionEvents.dispatchEvent(new Event('change'));
        });
        advance(10000);
        expect(current()).toBe('Banner 1');
        expect(container.querySelector('[data-rotation-control]')).toBeNull();
    });
    it('does not announce automatic transitions', () => {
        vi.useFakeTimers();
        renderHero();
        expect(
            container
                .querySelector('.overflow-hidden')
                ?.getAttribute('aria-live'),
        ).toBe('off');
        advance();
        expect(current()).toBe('Banner 2');
    });
    it('does not create rotation controls for a single slide', () => {
        act(() => root.render(<HeroBanner banners={[banners[0]]} />));
        expect(container.querySelector('[data-rotation-control]')).toBeNull();
        expect(container.querySelectorAll('button')).toHaveLength(0);
    });
    it('does not restart the delay when identical slides are rerendered', () => {
        vi.useFakeTimers();
        renderHero();
        advance(4000);
        act(() =>
            root.render(
                <HeroBanner banners={banners.map((slide) => ({ ...slide }))} />,
            ),
        );
        advance(1000);
        expect(current()).toBe('Banner 2');
    });
    it('lets explicit play resume rotation while the control has focus', () => {
        vi.useFakeTimers();
        renderHero();
        const pause = container.querySelector<HTMLButtonElement>(
            '[aria-label="Jeda banner"]',
        )!;
        act(() => pause.click());
        const play = container.querySelector<HTMLButtonElement>(
            '[aria-label="Putar banner"]',
        )!;
        act(() => play.focus());
        act(() => play.click());
        advance();
        expect(current()).toBe('Banner 2');
    });
    it('resets autoplay delay when the same dot is selected', () => {
        vi.useFakeTimers();
        renderHero();
        advance(4000);
        act(() => dot(1).click());
        advance(4000);
        expect(current()).toBe('Banner 1');
        advance(1000);
        expect(current()).toBe('Banner 2');
    });
    it('respects dot navigation while paused and resumes after explicit play', () => {
        vi.useFakeTimers();
        renderHero();
        const pause = container.querySelector<HTMLButtonElement>(
            '[aria-label="Jeda banner"]',
        )!;
        act(() => pause.click());
        act(() => dot(2).click());
        expect(current()).toBe('Banner 2');
        advance(10000);
        expect(current()).toBe('Banner 2');
        act(() =>
            container
                .querySelector<HTMLButtonElement>(
                    '[aria-label="Putar banner"]',
                )!
                .click(),
        );
        advance();
        expect(current()).toBe('Banner 1');
    });
    it('keeps pause active when hover ends but keyboard focus remains', () => {
        vi.useFakeTimers();
        renderHero();
        const region = container.querySelector<HTMLDivElement>(
            '[data-carousel="true"]',
        )!;
        const dotButton = dot(1);
        act(() => {
            region.focus();
            region.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
            dotButton.focus();
        });
        act(() => region.dispatchEvent(new MouseEvent('mouseenter')));
        act(() =>
            region.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })),
        );
        advance(10000);
        expect(current()).toBe('Banner 1');
    });
    it('prevents a swipe click from activating a banner link', () => {
        renderHero();
        const region = container.querySelector<HTMLDivElement>(
            '[data-carousel="true"]',
        )!;
        event('touchstart', {
            touches: [{ identifier: 1, clientX: 250, clientY: 100 }],
        });
        event('touchend', {
            touches: [],
            changedTouches: [{ identifier: 1, clientX: 100, clientY: 110 }],
        });
        const link = container.querySelector('a')!;
        const syntheticClick = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            detail: 1,
        });
        act(() => region.dispatchEvent(syntheticClick));
        expect(syntheticClick.defaultPrevented).toBe(true);
        expect(link).not.toBeNull();
    });
    it('ignores a swipe when a second finger interrupts the gesture', () => {
        renderHero();
        event('touchstart', {
            touches: [{ identifier: 1, clientX: 250, clientY: 100 }],
        });
        event('touchstart', {
            touches: [
                { identifier: 1, clientX: 250, clientY: 100 },
                { identifier: 2, clientX: 80, clientY: 100 },
            ],
        });
        event('touchend', {
            touches: [{ identifier: 1, clientX: 250, clientY: 100 }],
            changedTouches: [{ identifier: 2, clientX: 80, clientY: 100 }],
        });
        expect(current()).toBe('Banner 1');
    });
    it('honors reduced motion initially and when changed at runtime', () => {
        vi.useFakeTimers();
        motion = true;
        renderHero();
        advance(10000);
        expect(current()).toBe('Banner 1');
        act(() => {
            motion = false;
            motionEvents.dispatchEvent(new Event('change'));
        });
        advance();
        expect(current()).toBe('Banner 2');
        act(() => {
            motion = true;
            motionEvents.dispatchEvent(new Event('change'));
        });
        advance(10000);
        expect(current()).toBe('Banner 2');
    });
    it('renders three linked rotating defaults for an empty owner list', () => {
        vi.useFakeTimers();
        act(() => root.render(<HeroBanner banners={[]} />));
        expect(
            container.querySelectorAll('[aria-roledescription="slide"]'),
        ).toHaveLength(3);
        expect(
            container.querySelectorAll('[aria-label="Pilih banner"] button'),
        ).toHaveLength(3);
        expect(container.querySelectorAll('a')).toHaveLength(3);
        expect(container.querySelector('img')?.getAttribute('src')).toBe(
            DEFAULT_HERO_SLIDE.image_url,
        );
        expect(container.querySelector('a')?.getAttribute('href')).toBe(
            '/customer/products',
        );
        advance();
        expect(current()).toBe('Banner 2');
    });
    it('does not mix defaults into the active owner banners', () => {
        act(() => root.render(<HeroBanner banners={[banners[0]]} />));
        expect(container.querySelectorAll('img')).toHaveLength(1);
        expect(container.querySelector('img')?.getAttribute('src')).toBe(
            banners[0].image_url,
        );
        expect(container.querySelectorAll('button')).toHaveLength(0);
    });
    it('makes inactive slides inert and allows manual selection', () => {
        act(() => root.render(<HeroBanner banners={banners} />));
        let slides = container.querySelectorAll(
            '[aria-roledescription="slide"]',
        );
        expect(slides[0].hasAttribute('inert')).toBe(false);
        expect(slides[1].hasAttribute('inert')).toBe(true);
        act(() => dot(2).click());
        slides = container.querySelectorAll('[aria-roledescription="slide"]');
        expect(slides[0].hasAttribute('inert')).toBe(true);
        expect(slides[1].hasAttribute('inert')).toBe(false);
        expect(dot(2).getAttribute('aria-current')).toBe('true');
    });
    it('renders no link without a target and falls back when image fails', () => {
        act(() =>
            root.render(
                <BannerImage
                    slide={{ ...banners[0], target_path: null }}
                    interactive
                />,
            ),
        );
        expect(container.querySelector('a')).toBeNull();
        act(() =>
            container.querySelector('img')?.dispatchEvent(new Event('error')),
        );
        expect(container.querySelector('img')?.getAttribute('src')).toBe(
            DEFAULT_HERO_SLIDE.image_url,
        );
        expect(container.querySelector('a')?.getAttribute('href')).toBe(
            DEFAULT_HERO_SLIDE.target_path,
        );
        act(() =>
            container.querySelector('img')?.dispatchEvent(new Event('error')),
        );
        expect(container.querySelector('img')?.getAttribute('src')).toBe(
            DEFAULT_HERO_SLIDE.image_url,
        );
    });
    it('swipes horizontally but ignores vertical scrolling', () => {
        act(() => root.render(<HeroBanner banners={banners} />));
        const region = container.querySelector(
            '[aria-roledescription="carousel"]',
        )!;
        const touch = (type: string, x: number, y: number) => {
            const event = new Event(type, { bubbles: true });
            Object.defineProperty(event, 'touches', {
                value: [],
                configurable: true,
            });
            Object.defineProperty(
                event,
                type === 'touchstart' ? 'touches' : 'changedTouches',
                { value: [{ clientX: x, clientY: y }] },
            );
            act(() => {
                region.dispatchEvent(event);
            });
        };
        touch('touchstart', 250, 100);
        touch('touchend', 240, 200);
        expect(dot(1).getAttribute('aria-current')).toBe('true');
        touch('touchstart', 250, 100);
        touch('touchend', 100, 110);
        expect(dot(2).getAttribute('aria-current')).toBe('true');
        const link = container.querySelectorAll('a')[1];
        const syntheticClick = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            detail: 1,
        });
        act(() => {
            link.dispatchEvent(syntheticClick);
        });
        expect(syntheticClick.defaultPrevented).toBe(true);
        touch('touchstart', 250, 100);
        touch('touchend', 100, 110);
        const keyboardClick = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            detail: 0,
        });
        act(() => {
            link.dispatchEvent(keyboardClick);
        });
        expect(keyboardClick.defaultPrevented).toBe(false);
    });
});
