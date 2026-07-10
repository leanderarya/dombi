import { Search, Store } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import StatusBadge from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import type { OutletData } from './types';

interface Props {
    outlets: OutletData[];
    selectedId: number | null;
    onSelect: (id: number) => void;
}

export default function OutletList({ outlets, selectedId, onSelect }: Props) {
    const [search, setSearch] = useState('');

    const filtered = outlets.filter((o) => {
        if (!search) return true;
        return o.name.toLowerCase().includes(search.toLowerCase());
    });

    return (
        <div className="flex h-full flex-col" aria-label="Daftar outlet">
            <div className="mb-3">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-subtle" aria-hidden="true" />
                    <Input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari outlet..."
                        className="h-8 pl-7 text-xs"
                    />
                </div>
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto">
                {filtered.length === 0 ? (
                    <p className="px-2 py-4 text-xs text-text-muted">Tidak ditemukan.</p>
                ) : (
                    filtered.map((o) => (
                        <button
                            key={o.id}
                            type="button"
                            onClick={() => onSelect(o.id)}
                            className={cn(
                                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-150',
                                selectedId === o.id
                                    ? 'bg-primary-light ring-1 ring-primary/20'
                                    : 'hover:bg-surface-muted'
                            )}
                        >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted">
                                <Store className="h-4 w-4 text-text-muted" aria-hidden="true" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-text truncate">{o.name}</div>
                                <div className="mt-0.5 text-xs text-text-muted">
                                    {o.override_count > 0
                                        ? `${o.override_count}/${o.total_variants} custom`
                                        : `${o.total_variants} produk`}
                                </div>
                            </div>
                            {o.all_standard ? (
                                <StatusBadge variant="success" size="sm">Standar</StatusBadge>
                            ) : (
                                <StatusBadge variant="info" size="sm">Custom</StatusBadge>
                            )}
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}
