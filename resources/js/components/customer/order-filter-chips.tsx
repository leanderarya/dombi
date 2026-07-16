interface FilterOption {
    key: string;
    label: string;
}

interface Props {
    options: FilterOption[];
    active: string;
    onChange: (key: string) => void;
}

export default function OrderFilterChips({ options, active, onChange }: Props) {
    return (
        <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
            {options.map((option) => {
                const isActive = active === option.key;

                return (
                    <button
                        key={option.key}
                        onClick={() => onChange(option.key)}
                        className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors active:opacity-80 ${
                            isActive
                                ? 'bg-text text-white'
                                : 'border border-border bg-white text-text-muted'
                        }`}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
