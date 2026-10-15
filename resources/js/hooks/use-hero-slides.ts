import { useEffect, useState, useSyncExternalStore } from 'react';

export interface HeroSlide {
    id: number | string;
    alt_text: string;
    image_url: string;
    target_path: string | null;
}

export const DEFAULT_HERO_SLIDES: HeroSlide[] = [
    {
        id: 'default-1',
        alt_text: 'Banner Dombi. Pilihan Dombi untuk harimu. Lihat produk.',
        image_url: '/images/banners/01-pilihan-dombi.webp',
        target_path: '/customer/products',
    },
    {
        id: 'default-2',
        alt_text:
            'Susu kambing segar, langsung dari peternakan. Diproses dan disiapkan di pusat, lalu sampai ke outlet pilihanmu.',
        image_url: '/images/banners/02-segar-dari-pusat.webp',
        target_path: '/customer/products',
    },
    {
        id: 'default-3',
        alt_text:
            'Ambil sendiri atau kami antar. Pickup di outlet terdekat atau kirim ke alamatmu lewat kurir Dombi.',
        image_url: '/images/banners/03-ambil-atau-dikirim.webp',
        target_path: '/customer/products',
    },
];

export const DEFAULT_HERO_SLIDE = DEFAULT_HERO_SLIDES[0];

function subscribeMotion(onChange: () => void) {
    if (!window.matchMedia) {
        return () => {};
    }

    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    query.addEventListener('change', onChange);

    return () => query.removeEventListener('change', onChange);
}

const prefersReducedMotion = () =>
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const serverPaused = () => true;

export function useHeroSlides(banners: HeroSlide[] = []) {
    const slides = banners.length ? banners : DEFAULT_HERO_SLIDES;
    const [selection, setSelection] = useState<{ id: HeroSlide['id'] } | null>(
        null,
    );
    const reducedMotion = useSyncExternalStore(
        subscribeMotion,
        prefersReducedMotion,
        serverPaused,
    );
    const idsKey = JSON.stringify(slides.map((slide) => slide.id));
    const index = Math.max(
        0,
        slides.findIndex((slide) => slide.id === selection?.id),
    );
    const rotating = slides.length > 1 && !reducedMotion;

    useEffect(() => {
        if (!rotating) {
            return;
        }

        const ids = JSON.parse(idsKey) as HeroSlide['id'][];
        const timer = window.setTimeout(() => {
            setSelection((previous) => {
                const current = Math.max(
                    0,
                    ids.indexOf(previous?.id ?? ids[0]),
                );

                return { id: ids[(current + 1) % ids.length] };
            });
        }, 5000);

        return () => window.clearTimeout(timer);
    }, [idsKey, selection, rotating]);

    const setIndex = (next: number) => {
        setSelection({
            id: slides[Math.max(0, Math.min(next, slides.length - 1))].id,
        });
    };
    const move = (direction: number) => {
        setIndex((index + direction + slides.length) % slides.length);
    };

    return {
        slides,
        index,
        setIndex,
        move,
        current: slides[index],
        rotating,
        reducedMotion,
    };
}
