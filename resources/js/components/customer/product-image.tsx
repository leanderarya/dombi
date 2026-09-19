interface ProductImageProps {
    name: string;
    src?: string | null;
    size?: 'sm' | 'md' | 'lg' | 'full';
    className?: string;
}

const sizeClasses = {
    sm: 'h-12 w-12 text-lg',
    md: 'h-20 w-20 text-3xl',
    lg: 'h-28 w-28 text-4xl',
    full: 'w-full aspect-square',
};

const fallbackColors = [
    'from-primary-light to-primary/20',
    'from-warning-bg to-warning-border',
    'from-info-bg to-info-border',
    'from-rose-100 to-rose-200',
    'from-purple-100 to-purple-200',
];

export default function ProductImage({
    name,
    src,
    size = 'md',
    className = '',
}: ProductImageProps) {
    const colorIndex = name.length % fallbackColors.length;

    if (src) {
        return (
            <div
                className={`relative shrink-0 overflow-hidden rounded-thumb ${sizeClasses[size]} ${className}`}
            >
                <img
                    src={src}
                    alt={name}
                    loading="lazy"
                    className="h-full w-full object-cover"
                />
            </div>
        );
    }

    return (
        <div
            className={`flex shrink-0 items-center justify-center rounded-thumb bg-gradient-to-br ${fallbackColors[colorIndex]} ${sizeClasses[size]} ${className}`}
        >
            &#x1F95B;
        </div>
    );
}
