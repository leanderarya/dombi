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
        <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
                <button
                    key={tab.key}
                    type="button"
                    onClick={() => onChange(tab.key)}
                    className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                        active === tab.key
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}
