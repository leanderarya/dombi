import { cn } from '@/lib/utils';

interface FilterOption {
    key: string;
    label: string;
}

interface Props {
    options: FilterOption[];
    active: string;
    onChange: (key: string) => void;
    /** Chip size. Default: 'md' */
    size?: 'sm' | 'md';
    /** Visual variant. Default: 'solid' */
    variant?: 'solid' | 'ring';
}

const sizeStyles = {
    sm: 'px-3.5 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
};

const variantStyles = {
    solid: {
        active: 'bg-slate-900 text-white',
        inactive: 'border border-zinc-200 bg-white text-slate-600',
    },
    ring: {
        active: 'bg-primary/10 text-primary ring-1 ring-primary/20',
        inactive: 'bg-surface text-text-muted ring-1 ring-border hover:bg-surface-muted',
    },
};

export default function FilterChips({ options, active, onChange, size = 'md', variant = 'solid' }: Props) {
    const styles = variantStyles[variant];

    return (
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {options.map((option) => {
                const isActive = active === option.key;
                return (
                    <button
                        key={option.key}
                        onClick={() => onChange(option.key)}
                        className={cn(
                            'shrink-0 rounded-full font-semibold transition-colors active:opacity-80',
                            sizeStyles[size],
                            isActive ? styles.active : styles.inactive
                        )}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
