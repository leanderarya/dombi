interface Tab {
    key: string;
    label: string;
    count?: number;
}

interface Props {
    tabs: Tab[];
    activeTab: string;
    onChange: (key: string) => void;
    className?: string;
}

export default function OwnerSegmentedTabs({ tabs, activeTab, onChange, className = '' }: Props) {
    return (
        <div className={`mb-6 inline-flex rounded-lg bg-mint-wash p-1 ${className}`}>
            {tabs.map((tab) => (
                <button
                    key={tab.key}
                    onClick={() => onChange(tab.key)}
                    className={`relative rounded-lg px-5 py-2 text-[12px] font-semibold transition-all duration-200 ${
                        activeTab === tab.key
                            ? 'bg-white text-primary shadow-sm'
                            : 'text-text-muted hover:text-primary'
                    }`}
                >
                    {tab.label}
                    {tab.count !== undefined && tab.count > 0 && (
                        <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                            {tab.count}
                        </span>
                    )}
                </button>
            ))}
        </div>
    );
}
