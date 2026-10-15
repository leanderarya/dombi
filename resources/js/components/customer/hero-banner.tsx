import { Link } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { DEFAULT_HERO_SLIDE, useHeroSlides } from '@/hooks/use-hero-slides';
import type { HeroSlide } from '@/hooks/use-hero-slides';

export function BannerImage({
    slide,
    interactive = false,
    priority = false,
}: {
    slide: HeroSlide;
    interactive?: boolean;
    priority?: boolean;
}) {
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    const banner = failedUrl === slide.image_url ? DEFAULT_HERO_SLIDE : slide;
    const image = (
        <img
            src={banner.image_url}
            alt={banner.alt_text}
            width={1200}
            height={480}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            onError={() => setFailedUrl(slide.image_url)}
            className="aspect-[5/2] h-auto w-full rounded-card bg-brand-deep object-contain"
        />
    );

    return interactive && banner.target_path ? (
        <Link
            href={banner.target_path}
            className="block rounded-card focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white"
        >
            {image}
        </Link>
    ) : (
        image
    );
}

export default function HeroBanner({ banners }: { banners: HeroSlide[] }) {
    const { slides, index, setIndex, move, rotating } = useHeroSlides(banners);
    const touchStart = useRef<{ id: number; x: number; y: number } | null>(
        null,
    );
    const swiped = useRef(false);

    return (
        <div
            className="relative"
            role="region"
            aria-label="Banner Dombi"
            aria-roledescription="carousel"
            onPointerDown={() => {
                swiped.current = false;
            }}
            onTouchStart={(event) => {
                const touch = event.touches[0];
                touchStart.current =
                    event.touches.length === 1
                        ? {
                              id: touch.identifier,
                              x: touch.clientX,
                              y: touch.clientY,
                          }
                        : null;
                swiped.current = false;
            }}
            onTouchEnd={(event) => {
                const start = touchStart.current;
                touchStart.current = null;

                if (!start) {
                    return;
                }

                const touch = Array.from(event.changedTouches).find(
                    (touch) => touch.identifier === start.id,
                );

                if (!touch || event.touches.length > 0) {
                    return;
                }

                const dx = touch.clientX - start.x;
                const dy = touch.clientY - start.y;

                if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
                    swiped.current = true;
                    move(dx < 0 ? 1 : -1);
                }
            }}
            onTouchCancel={() => {
                touchStart.current = null;
            }}
            onClickCapture={(event) => {
                if (swiped.current && event.detail !== 0) {
                    event.preventDefault();
                    event.stopPropagation();
                }

                swiped.current = false;
            }}
        >
            <div
                aria-live={rotating ? 'off' : 'polite'}
                className="overflow-hidden rounded-card"
            >
                <div
                    className="flex touch-pan-y transition-transform duration-300 ease-out motion-reduce:transition-none"
                    style={{ transform: `translateX(-${index * 100}%)` }}
                >
                    {slides.map((slide, i) => (
                        <div
                            key={slide.id}
                            inert={i !== index}
                            aria-hidden={i !== index}
                            role="group"
                            aria-roledescription="slide"
                            aria-label={`${i + 1} dari ${slides.length}`}
                            className="w-full min-w-full shrink-0"
                        >
                            <BannerImage
                                slide={slide}
                                interactive
                                priority={i === 0 || i === index}
                            />
                        </div>
                    ))}
                </div>
            </div>
            {slides.length > 1 && (
                <div
                    className="flex flex-wrap justify-center"
                    aria-label="Pilih banner"
                >
                    {slides.map((slide, i) => (
                        <button
                            key={slide.id}
                            type="button"
                            onClick={() => setIndex(i)}
                            aria-label={`Banner ${i + 1}`}
                            aria-current={i === index || undefined}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white"
                        >
                            <span
                                className={`h-1.5 rounded-full ${i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/60'}`}
                            />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
