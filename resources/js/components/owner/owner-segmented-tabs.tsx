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

export default function OwnerSegmentedTabs({
    tabs,
    activeTab,
    onChange,
    className = '',
}: Props) {
    return (
        <div
            role="tablist"
            // max-w-full + overflow-x-auto, not w-full: `inline-flex` stays
            // shrink-to-fit so the desktop layout is unchanged, but the two
            // properties drop the automatic minimum width to 0 and let the
            // list scroll once its tabs no longer fit. At 320px four tabs
            // measure 318px inside a 288px column, which pushed the whole
            // page 14px wide on /owner/finance.
            className={`mb-6 inline-flex max-w-full overflow-x-auto rounded-lg bg-surface-muted p-1 ${className}`}
        >
            {tabs.map((tab) => (
                <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.key}
                    onClick={() => onChange(tab.key)}
                    // pointer-coarse:min-h-11 — the padding alone measured
                    // 34px, under the 44px DESIGN.md line 83 asks for on
                    // touch. Guarded rather than unconditional so the desktop
                    // rail keeps its density, per spec D6.
                    className={`relative shrink-0 rounded-lg px-3 py-2 text-[12px] font-semibold whitespace-nowrap transition-all duration-200 sm:px-5 pointer-coarse:min-h-11 ${
                        activeTab === tab.key
                            ? 'bg-surface text-primary shadow-sm'
                            : 'text-text-muted hover:text-primary'
                    }`}
                >
                    {tab.label}
                    {tab.count !== undefined && tab.count > 0 && (
                        <span className="ml-1.5 rounded-full bg-danger-bg px-1.5 py-0.5 text-caption font-bold text-danger-text">
                            {tab.count}
                        </span>
                    )}
                </button>
            ))}
        </div>
    );
}
