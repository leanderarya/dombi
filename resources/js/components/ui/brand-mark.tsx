interface Props {
    size?: 'sm' | 'md';
    className?: string;
}

// The shipped app icon is the brand mark — the order card header and the
// e-receipt title used to draw a letter "D" in its place.
const sizeClasses = {
    sm: 'h-7 w-7 rounded-chip',
    md: 'h-[42px] w-[42px] rounded-full',
};

export default function BrandMark({ size = 'md', className = '' }: Props) {
    return (
        <img
            src="/icons/icon-192.png"
            alt="Dombi"
            className={`shrink-0 object-cover ${sizeClasses[size]} ${className}`}
        />
    );
}
