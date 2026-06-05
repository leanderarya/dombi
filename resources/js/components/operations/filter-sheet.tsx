import { useEffect } from 'react';

interface FilterOption {
    value: string;
    label: string;
}

interface FilterSection {
    key: string;
    label: string;
    options: FilterOption[];
    value: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
    sections: FilterSection[];
    onApply: (filters: Record<string, string>) => void;
}

export default function FilterSheet({ open, onClose, sections, onApply }: Props) {
    useEffect(() => {
        if (open) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = '';
        return () => { document.body.style.overflow = ''; };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open, onClose]);

    if (!open) return null;

    // Local state mirrors current filters for preview before apply
    const handleSelect = (key: string, value: string) => {
        const updated: Record<string, string> = {};
        sections.forEach((s) => { updated[s.key] = s.key === key ? value : s.value; });
        onApply(updated);
        onClose();
    };

    const handleClear = () => {
        const cleared: Record<string, string> = {};
        sections.forEach((s) => { cleared[s.key] = ''; });
        onApply(cleared);
        onClose();
    };

    const hasActiveFilters = sections.some((s) => s.value !== '');

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative w-full max-w-lg animate-[slideUp_200ms_ease-out] rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)]" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                {/* Handle */}
                <div className="sticky top-0 z-10 flex justify-center rounded-t-2xl bg-white pt-3 pb-2">
                    <div className="h-1 w-12 rounded-full bg-slate-300" />
                </div>

                <div className="px-4 pb-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-bold text-slate-900">Filter</h2>
                        {hasActiveFilters && (
                            <button onClick={handleClear} className="text-xs font-semibold text-red-600 active:text-red-800">
                                Reset All
                            </button>
                        )}
                    </div>

                    {/* Sections */}
                    <div className="mt-4 space-y-5">
                        {sections.map((section) => (
                            <div key={section.key}>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{section.label}</div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    <FilterPill
                                        label="Semua"
                                        active={section.value === ''}
                                        onClick={() => handleSelect(section.key, '')}
                                    />
                                    {section.options.map((opt) => (
                                        <FilterPill
                                            key={opt.value}
                                            label={opt.label}
                                            active={section.value === opt.value}
                                            onClick={() => handleSelect(section.key, opt.value)}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-150 active:scale-[0.95] ${
                active ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600'
            }`}
        >
            {label}
        </button>
    );
}
