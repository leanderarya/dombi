import { ChevronDown, Search, X } from 'lucide-react';
import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface Option {
    value: string;
    label: string;
    subtitle?: string;
}

interface Props {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label?: string;
    searchable?: boolean;
    className?: string;
}

export default function CustomSelect({ options, value, onChange, placeholder = 'Pilih...', label, searchable = false, className }: Props) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selected = options.find((o) => o.value === value);

    const filtered = useMemo(() => {
        if (!search) return options;
        const q = search.toLowerCase();
        return options.filter((o) => o.label.toLowerCase().includes(q) || (o.subtitle ?? '').toLowerCase().includes(q));
    }, [options, search]);

    // Position dropdown relative to trigger
    const updatePos = useCallback(() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const viewportH = window.innerHeight;
        const spaceBelow = viewportH - rect.bottom;
        const dropdownH = 320; // max-h-80 = 320px

        // Open downward if enough space, otherwise upward
        const top = spaceBelow > dropdownH
            ? rect.bottom + 6
            : rect.top - dropdownH - 6;

        setPos({
            top: Math.max(8, top),
            left: rect.left,
            width: rect.width,
        });
    }, []);

    useEffect(() => {
        if (open) {
            updatePos();
            window.addEventListener('scroll', updatePos, true);
            window.addEventListener('resize', updatePos);
            return () => {
                window.removeEventListener('scroll', updatePos, true);
                window.removeEventListener('resize', updatePos);
            };
        }
    }, [open, updatePos]);

    const handleSelect = (val: string) => {
        onChange(val);
        setOpen(false);
        setSearch('');
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
        setSearch('');
    };

    const dropdown = open ? (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />

            {/* Dropdown portal */}
            <div
                ref={dropdownRef}
                style={{ top: pos.top, left: pos.left, width: pos.width }}
                className="fixed z-[9999] overflow-hidden rounded-xl border border-border bg-white shadow-xl"
            >
                {/* Search */}
                {searchable && (
                    <div className="border-b border-border px-3 py-2.5">
                        <div className="flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-2">
                            <Search className="h-4 w-4 shrink-0 text-text-subtle" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Cari produk..."
                                className="w-full bg-transparent text-sm outline-none"
                                autoFocus
                            />
                        </div>
                    </div>
                )}

                {/* Options — fixed height, scrollable */}
                <div className="max-h-80 overflow-y-auto overscroll-contain">
                    {filtered.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-text-subtle">Tidak ditemukan</div>
                    ) : (
                        filtered.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => handleSelect(option.value)}
                                className={cn(
                                    'flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors',
                                    option.value === value
                                        ? 'bg-primary-light text-primary'
                                        : 'text-text hover:bg-surface-muted active:bg-surface-muted/80',
                                )}
                            >
                                <span className="truncate">{option.label}</span>
                                {option.value === value && (
                                    <span className="ml-2 text-xs font-bold text-primary">&#10003;</span>
                                )}
                            </button>
                        ))
                    )}
                </div>
            </div>
        </>
    ) : null;

    return (
        <div className={cn('relative', className)}>
            {label && <label className="mb-1.5 block text-xs font-medium text-text-muted">{label}</label>}

            {/* Trigger */}
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setOpen(!open)}
                className={cn(
                    'flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors',
                    open ? 'border-primary ring-1 ring-primary/20' : 'border-border',
                    selected ? 'text-text' : 'text-text-subtle',
                )}
            >
                <span className="truncate text-sm font-medium">{selected?.label ?? placeholder}</span>
                <div className="flex items-center gap-1.5">
                    {selected && (
                        <span onClick={handleClear} className="rounded p-0.5 text-text-subtle hover:text-text-muted">
                            <X className="h-4 w-4" />
                        </span>
                    )}
                    <ChevronDown className={cn('h-5 w-5 text-text-subtle transition-transform', open && 'rotate-180')} />
                </div>
            </button>

            {createPortal(dropdown, document.body)}
        </div>
    );
}
