interface ProductImageProps {
    name: string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export default function ProductImage({ name, size = 'md', className = '' }: ProductImageProps) {
    const colors = [
        'from-emerald-100 to-emerald-200',
        'from-amber-100 to-amber-200',
        'from-blue-100 to-blue-200',
        'from-rose-100 to-rose-200',
        'from-purple-100 to-purple-200',
    ];
    const colorIndex = name.length % colors.length;
    const sizeClasses = {
        sm: 'h-12 w-12 text-lg',
        md: 'h-20 w-20 text-3xl',
        lg: 'h-28 w-28 text-4xl',
    };

    return (
        <div className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${colors[colorIndex]} ${sizeClasses[size]} ${className}`}>
            &#129371;
        </div>
    );
}
