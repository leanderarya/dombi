import { useEffect, useState } from 'react';

export interface HeroSlide {
    title: string;
    subtitle: string;
    cta: string;
    ctaHref: string;
    image: string;
    gradient: string;
}

const HERO_SLIDES: HeroSlide[] = [
    {
        title: 'Susu Kambing Segar',
        subtitle: 'Kualitas terbaik langsung dari Dombi',
        cta: 'Pesan Sekarang',
        ctaHref: '/customer/products',
        image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=800&q=80',
        gradient: 'from-emerald-600 via-emerald-500 to-teal-500',
    },
    {
        title: 'Delivery Mudah',
        subtitle: 'Pesanan dikirim langsung ke rumah Anda',
        cta: 'Pesan Sekarang',
        ctaHref: '/customer/products',
        image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80',
        gradient: 'from-emerald-700 via-emerald-600 to-emerald-500',
    },
    {
        title: 'Pickup Cepat',
        subtitle: 'Ambil langsung tanpa antre',
        cta: 'Pesan Sekarang',
        ctaHref: '/customer/products',
        image: 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?w=800&q=80',
        gradient: 'from-teal-600 via-emerald-500 to-emerald-400',
    },
];

export function useHeroSlides(intervalMs = 5000) {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }

        const timer = setInterval(() => {
            setIndex((prev) => (prev + 1) % HERO_SLIDES.length);
        }, intervalMs);

        return () => clearInterval(timer);
    }, [intervalMs]);

    return {
        slides: HERO_SLIDES,
        index,
        setIndex,
        current: HERO_SLIDES[index],
    };
}
