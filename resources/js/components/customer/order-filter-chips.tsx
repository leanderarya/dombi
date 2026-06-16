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
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {options.map((option) => {
                const isActive = active === option.key;

                return (
                    <button
                        key={option.key}
                        onClick={() => onChange(option.key)}
                        className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors active:scale-[0.97] ${
                            isActive
                                ? 'bg-slate-900 text-white'
                                : 'border border-zinc-200 bg-white text-slate-600'
                        }`}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
