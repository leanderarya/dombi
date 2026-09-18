import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * `tailwind-merge` only knows Tailwind's stock type scale. Our custom sizes
 * (`--text-control`, `--text-control-sm`, `--text-caption`) look like colour
 * utilities to it, so `cn('text-caption', 'text-text-muted')` dropped the size
 * while `cn('text-control', 'text-white')` dropped the colour — the chips fell
 * back to 16px and primary buttons lost their white label. Declaring the scale
 * here keeps size and colour from fighting over the same class group.
 */
const twMerge = extendTailwindMerge({
    extend: {
        classGroups: {
            'font-size': [{ text: ['control', 'control-sm', 'caption'] }],
        },
    },
});

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
