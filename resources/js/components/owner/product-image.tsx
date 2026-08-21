import { useState } from 'react';

interface ProductImageProps {
    name: string;
    src: string | null;
    flavorGroupImage?: string | null;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export default function ProductImage({
    name,
    src,
    flavorGroupImage,
    size = 'md',
    className = '',
}: ProductImageProps) {
    const [error, setError] = useState(false);
    const [fgError, setFgError] = useState(false);

    const resolve = (p: string | null): string | null => {
        if (!p) {
            return null;
        }

        return p.startsWith('http') ? p : `/storage/${p}`;
    };

    const productSrc = resolve(src);
    const flavorSrc = resolve(flavorGroupImage ?? null);

    const sizeCls =
        size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-24 w-24' : 'h-10 w-10';

    if (!error && productSrc) {
        return (
            <img
                src={productSrc}
                alt={name}
                className={`${sizeCls} rounded object-cover ${className}`}
                onError={() => setError(true)}
            />
        );
    }

    if (!fgError && flavorSrc) {
        return (
            <img
                src={flavorSrc}
                alt={name}
                className={`${sizeCls} rounded object-cover ${className}`}
                onError={() => setFgError(true)}
            />
        );
    }

    return (
        <div
            className={`${sizeCls} ${className} flex items-center justify-center rounded bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-700`}
            aria-label={name}
        >
            🥛
        </div>
    );
}
