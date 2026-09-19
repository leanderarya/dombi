import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * `tailwind-merge` only knows Tailwind's stock scale. Two consequences bit us:
 * our custom text sizes (`--text-control`, `--text-control-sm`,
 * `--text-caption`) looked like colour utilities, so `cn('text-caption',
 * 'text-text-muted')` dropped the size while `cn('text-control', 'text-white')`
 * dropped the colour; and our custom radii (`--radius-card`, `--radius-chip`,
 * `--radius-thumb`) were unknown, so a `className` radius could not override
 * `Button`'s `rounded-control` without an `!important` suffix. Declaring both
 * scales here keeps the groups honest.
 */
const twMerge = extendTailwindMerge({
    extend: {
        classGroups: {
            'font-size': [{ text: ['control', 'control-sm', 'caption'] }],
            rounded: [
                { rounded: ['card', 'chip', 'thumb', 'sheet', 'control'] },
            ],
        },
    },
});

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
