import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface FilterOption {
    key: string;
    label: string;
    icon?: ReactNode;
}

interface Props {
    options: FilterOption[];
    active: string;
    onChange: (key: string) => void;
    size?: 'sm' | 'md' | 'caption';
    variant?: 'solid' | 'ring' | 'neutral';
}

export const FILTER_CHIP_BASE =
    'shrink-0 rounded-full font-semibold transition-colors active:opacity-80';

/**
 * Which combination belongs where, as the code stands today — the audit found
 * the three pairings map to a job rather than to taste, so nothing is merged:
 *
 * - `md` + `solid` (the defaults): status filters on the outlet and courier
 *   list screens, ten places.
 * - `sm` + `ring`: the owner role, plus the outlet reports and analytics
 *   screens, where the chips pick a *period* rather than a status.
 * - `caption` + `neutral`: the customer order history, matching the kanvas
 *   `Filter/Semua` frame. Do not change it without the frame.
 */


const sizeStyles = {
    sm: 'px-3.5 py-1.5 text-xs',
    md: 'px-4 py-2 text-xs',
    /* `leading-tight` keeps the pill at the kanvas height (8/8 padding + 11px
       label) — the inherited 1.5 line-height made it several px taller. */
    caption: 'px-3.5 py-2 text-caption leading-tight',
};

export const FILTER_CHIP_VARIANT_CLASSES = {
    solid: {
        active: 'bg-primary text-white',
        inactive: 'border border-border bg-surface text-text-muted',
    },
    ring: {
        active: 'bg-primary/10 text-primary ring-1 ring-primary/20',
        inactive: 'bg-surface text-text-muted ring-1 ring-border',
    },
    /**
     * The order screens' filter row: active chip is the neutral text colour
     * rather than the brand, matching the kanvas `Filter/Semua` frame.
     * Added as a variant instead of changing `solid`, because `solid` is
     * already consumed in nineteen places where emerald is correct.
     */
    neutral: {
        active: 'bg-text text-white',
        inactive: 'border border-border-strong bg-surface text-text-muted',
    },
};

export default function FilterChips({
    options,
    active,
    onChange,
    size = 'md',
    variant = 'solid',
}: Props) {
    const styles = FILTER_CHIP_VARIANT_CLASSES[variant];

    return (
        <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
            {options.map((option) => {
                const isActive = active === option.key;

                return (
                    <button
                        key={option.key}
                        onClick={() => onChange(option.key)}
                        className={cn(
                            FILTER_CHIP_BASE,
                            sizeStyles[size],
                            isActive ? styles.active : styles.inactive,
                        )}
                    >
                        {option.icon ? (
                            <span className="flex items-center gap-1.5">
                                {option.icon}
                                {option.label}
                            </span>
                        ) : (
                            option.label
                        )}
                    </button>
                );
            })}
        </div>
    );
}
