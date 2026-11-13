// @vitest-environment jsdom
import { act, StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    DEFAULT_HERO_SLIDE,
    DEFAULT_HERO_SLIDES,
    useHeroSlides,
} from './use-hero-slides';
import type { HeroSlide } from './use-hero-slides';

let root: Root;
let container: HTMLDivElement;
let hero: ReturnType<typeof useHeroSlides>;
const slides: HeroSlide[] = [1, 2, 3].map((id) => ({
    id,
    alt_text: `Banner ${id}`,
    image_url: `/banner-${id}.webp`,
    target_path: null,
}));
function Harness({ banners }: { banners: HeroSlide[] }) {
    const state = useHeroSlides(banners);
    useEffect(() => {
        hero = state;
    });

    return <span>{state.current.alt_text}</span>;
}
function render(banners: HeroSlide[]) {
    act(() => root.render(<Harness banners={banners} />));
}
beforeEach(() => {
    (
        globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(document, 'hidden', {
        configurable: true,
        value: false,
    });
    container = document.createElement('div');
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    vi.useRealTimers();
});

describe('useHeroSlides', () => {
    it('uses first-party fallback for no active banners', () => {
        render([]);
        expect(hero.current).toEqual(DEFAULT_HERO_SLIDE);
        expect(hero.index).toBe(0);
    });
    it('clamps selection for one or many banners', () => {
        render(slides);
        act(() => hero.setIndex(99));
        expect(hero.current.id).toBe(3);
        act(() => hero.setIndex(-1));
        expect(hero.current.id).toBe(1);
        render([slides[0]]);
        act(() => hero.setIndex(1));
        expect(hero.current.id).toBe(1);
    });
    it('preserves selected ID when polling reorders banners and recovers when removed', () => {
        render(slides);
        act(() => hero.setIndex(1));
        render([slides[1], slides[0]]);
        expect(hero.current.id).toBe(2);
        expect(hero.index).toBe(0);
        render([slides[2]]);
        expect(hero.current.id).toBe(3);
        render([]);
        expect(hero.current).toEqual(DEFAULT_HERO_SLIDE);
    });
    it('rotates every five seconds and wraps to the first slide', () => {
        vi.useFakeTimers();
        render(slides);
        act(() => vi.advanceTimersByTime(4999));
        expect(hero.index).toBe(0);
        act(() => vi.advanceTimersByTime(1));
        expect(hero.index).toBe(1);
        act(() => vi.advanceTimersByTime(5000));
        expect(hero.index).toBe(2);
        act(() => vi.advanceTimersByTime(5000));
        expect(hero.index).toBe(0);
    });
    it('restarts the delay even when the current dot is selected', () => {
        vi.useFakeTimers();
        render(slides);
        act(() => vi.advanceTimersByTime(4000));
        act(() => hero.setIndex(0));
        act(() => vi.advanceTimersByTime(4000));
        expect(hero.index).toBe(0);
        act(() => vi.advanceTimersByTime(1000));
        expect(hero.index).toBe(1);
    });
    it('rotates three bundled defaults when no owner banners are active', () => {
        vi.useFakeTimers();
        render([]);
        expect(hero.slides).toEqual(DEFAULT_HERO_SLIDES);
        expect(hero.slides).toHaveLength(3);
        expect(new Set(hero.slides.map((slide) => slide.image_url)).size).toBe(
            3,
        );

        for (const index of [1, 2, 0]) {
            act(() => vi.advanceTimersByTime(5000));
            expect(hero.index).toBe(index);
        }
    });
    it('uses only owner banners when any are active and restores defaults when removed', () => {
        vi.useFakeTimers();
        render([slides[0]]);
        expect(hero.slides).toEqual([slides[0]]);
        expect(vi.getTimerCount()).toBe(0);
        render([]);
        expect(hero.slides).toEqual(DEFAULT_HERO_SLIDES);
        expect(vi.getTimerCount()).toBe(1);
    });
    it('does not create a timer for one owner banner', () => {
        vi.useFakeTimers();
        render([slides[0]]);
        expect(vi.getTimerCount()).toBe(0);
    });
    it('does not postpone rotation when identical IDs are received again', () => {
        vi.useFakeTimers();
        render(slides);
        act(() => vi.advanceTimersByTime(4000));
        render(slides.map((slide) => ({ ...slide })));
        act(() => vi.advanceTimersByTime(1000));
        expect(hero.index).toBe(1);
    });
    it('keeps exactly one timer in StrictMode', () => {
        vi.useFakeTimers();
        act(() =>
            root.render(
                <StrictMode>
                    <Harness banners={slides} />
                </StrictMode>,
            ),
        );
        expect(vi.getTimerCount()).toBe(1);
        act(() => vi.advanceTimersByTime(5000));
        expect(hero.index).toBe(1);
        expect(vi.getTimerCount()).toBe(1);
    });
    it('recovers removed selection before the next automatic step', () => {
        vi.useFakeTimers();
        render(slides);
        act(() => hero.setIndex(2));
        render([slides[0], slides[1]]);
        expect(hero.index).toBe(0);
        act(() => vi.advanceTimersByTime(5000));
        expect(hero.current.id).toBe(2);
    });
    it('wraps relative navigation in both directions', () => {
        render(slides);
        act(() => hero.move(-1));
        expect(hero.current.id).toBe(3);
        act(() => hero.move(1));
        expect(hero.current.id).toBe(1);
    });
    it('cleans up the timer on unmount', () => {
        vi.useFakeTimers();
        render(slides);
        expect(vi.getTimerCount()).toBe(1);
        act(() => root.render(null));
        expect(vi.getTimerCount()).toBe(0);
    });
});
