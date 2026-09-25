import { cn } from '@/lib/utils';

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

export default function BrandMark({ size = 'md', className }: Props) {
    return (
        <img
            src="/icons/icon-192.png"
            alt="Dombi"
            // Merged rather than concatenated so a caller can override the size
            // without leaving two conflicting height classes in the attribute.
            className={cn(
                'shrink-0 object-cover',
                sizeClasses[size],
                className,
            )}
        />
    );
}
