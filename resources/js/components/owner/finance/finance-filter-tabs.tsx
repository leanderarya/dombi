interface Tab {
    key: string;
    label: string;
}

interface Props {
    tabs: Tab[];
    active: string;
    onChange: (key: string) => void;
}

export default function FinanceFilterTabs({ tabs, active, onChange }: Props) {
    return (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
            {tabs.map((tab) => {
                const isActive = active === tab.key;
                return (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => onChange(tab.key)}
                        className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                            isActive
                                ? 'bg-primary text-white shadow-sm shadow-primary/20'
                                : 'bg-surface-muted text-text-muted hover:bg-surface-muted/80 hover:text-text'
                        }`}
                    >
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
}
