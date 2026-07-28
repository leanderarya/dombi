import { useState } from 'react';

interface ProductImageProps {
    name: string;
    src: string | null;
    categoryImage?: string | null;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export default function ProductImage({
    name,
    src,
    categoryImage,
    size = 'md',
    className = '',
}: ProductImageProps) {
    const [error, setError] = useState(false);
    const [catError, setCatError] = useState(false);

    const resolve = (p: string | null): string | null => {
        if (!p) {
            return null;
        }

        return p.startsWith('http') ? p : `/storage/${p}`;
    };

    const productSrc = resolve(src);
    const catSrc = resolve(categoryImage ?? null);

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

    if (!catError && catSrc) {
        return (
            <img
                src={catSrc}
                alt={name}
                className={`${sizeCls} rounded object-cover ${className}`}
                onError={() => setCatError(true)}
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
