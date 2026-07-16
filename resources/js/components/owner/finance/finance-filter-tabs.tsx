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
        <div className="scrollbar-none flex flex-wrap gap-2 overflow-x-auto">
            {tabs.map((tab) => {
                const isActive = active === tab.key;

                return (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => onChange(tab.key)}
                        className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition-all ${
                            isActive
                                ? 'bg-primary/10 text-primary ring-primary/20'
                                : 'bg-surface text-text-muted ring-border hover:bg-surface-muted'
                        }`}
                    >
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
}
