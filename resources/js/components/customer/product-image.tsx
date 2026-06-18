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
        sm: 'h-10 w-10 text-sm',
        md: 'h-16 w-16 text-2xl',
        lg: 'h-24 w-24 text-3xl',
    };

    return (
        <div className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${colors[colorIndex]} ${sizeClasses[size]} ${className}`}>
            &#129371;
        </div>
    );
}
