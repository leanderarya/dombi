import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { MarginFilter, OtherOutlet, SortDir, SortKey } from './types';

/* ------------------------------------------------------------------ */
/*  SortBar                                                            */
/* ------------------------------------------------------------------ */

export function SortBar({ sortKey, sortDir, toggleSort }: { sortKey: SortKey; sortDir: SortDir; toggleSort: (key: SortKey) => void }) {
    const SortIcon = ({ column }: { column: SortKey }) => {
        if (sortKey !== column) {
            return <ChevronDown className="h-3 w-3 text-text-subtle" />;
        }

        return sortDir === 'asc' ? <ChevronUp className="h-3 w-3 text-primary" /> : <ChevronDown className="h-3 w-3 text-primary" />;
    };

    return (
        <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-text-muted">Urutkan:</span>
            {([
                { key: 'name' as SortKey, label: 'Produk' },
                { key: 'center_price' as SortKey, label: 'HPP' },
                { key: 'selling_price' as SortKey, label: 'Harga Jual' },
                { key: 'margin' as SortKey, label: 'Margin' },
            ]).map((col) => (
                <button
                    key={col.key}
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        sortKey === col.key ? 'bg-primary-light text-primary' : 'bg-surface text-text-muted hover:bg-surface-muted'
                    }`}
                >
                    {col.label}
                    <SortIcon column={col.key} />
                </button>
            ))}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  PaginationBar                                                      */
/* ------------------------------------------------------------------ */

export function PaginationBar({ page, totalPages, total, onPageChange }: { page: number; totalPages: number; total: number; onPageChange: (p: number) => void }) {
    return (
        <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-text-muted">{total} produk &middot; Halaman {page} dari {totalPages}</span>
            <div className="flex gap-1">
                <Button type="button" size="sm" variant="secondary" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}>
                    Prev
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
                    Next
                </Button>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  EmptyState                                                         */
/* ------------------------------------------------------------------ */

export function EmptyState({ icon, message }: { icon?: React.ReactNode; message: string }) {
    return (
        <div className="rounded-xl border border-dashed border-border bg-white p-10 text-center">
            {icon && <div className="mx-auto mb-2 text-text-subtle">{icon}</div>}
            <p className="text-sm text-text-muted">{message}</p>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  LoadingSkeleton                                                    */
/* ------------------------------------------------------------------ */

export function LoadingSkeleton() {
    return (
        <div className="space-y-3">
            {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl border border-border bg-white" />
            ))}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  BulkPanel                                                          */
/* ------------------------------------------------------------------ */

export function BulkPanel({ amount, onChange, onApply, onCancel, saving, count }: {
    amount: string; onChange: (v: string) => void; onApply: () => void; onCancel: () => void; saving: boolean; count: number;
}) {
    return (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-600">Atur Semua Harga</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1">
                    {[1000, 2000, 5000, 10000].map((amt) => (
                        <div key={amt} className="flex gap-0.5">
                            <Button type="button" size="sm" variant={amount === String(amt) ? 'primary' : 'secondary'} onClick={() => onChange(String(amt))} className="px-2 py-1 text-[11px]">
                                +{amt.toLocaleString('id-ID')}
                            </Button>
                            <Button type="button" size="sm" variant={amount === String(-amt) ? 'primary' : 'secondary'} onClick={() => onChange(String(-amt))} className="px-2 py-1 text-[11px]">
                                -{amt.toLocaleString('id-ID')}
                            </Button>
                        </div>
                    ))}
                </div>
                <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-text-subtle">Rp</span>
                    <Input type="number" value={amount} onChange={(e) => onChange(e.target.value)} placeholder="Custom" className="w-24 pl-7 text-xs" />
                </div>
                <Button type="button" size="sm" onClick={onApply} disabled={saving || !amount}>Terapkan</Button>
                <Button type="button" size="sm" variant="ghost" onClick={onCancel} className="text-amber-700">Batal</Button>
                <span className="text-[11px] text-amber-600">{count} produk</span>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  CopyPanel                                                          */
/* ------------------------------------------------------------------ */

export function CopyPanel({ outlets, source, onChange, onApply, onCancel, saving }: {
    outlets: OtherOutlet[]; source: string; onChange: (v: string) => void; onApply: () => void; onCancel: () => void; saving: boolean;
}) {
    return (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-blue-600">Salin Harga Dari Outlet Lain</div>
            <div className="mt-2 flex items-center gap-2">
                <Select
                    value={source}
                    onChange={(e) => onChange(e.target.value)}
                    options={outlets.map((o) => ({ value: String(o.id), label: o.name }))}
                    placeholder="Pilih outlet sumber..."
                    className="flex-1"
                />
                <Button type="button" size="sm" onClick={onApply} disabled={saving || !source}>Salin</Button>
                <Button type="button" size="sm" variant="ghost" onClick={onCancel} className="text-blue-700">Batal</Button>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Margin filter + search toolbar                                     */
/* ------------------------------------------------------------------ */

export function Toolbar({ search, onSearchChange, marginFilter, onMarginFilterChange, children }: {
    search: string; onSearchChange: (v: string) => void;
    marginFilter: MarginFilter; onMarginFilterChange: (v: MarginFilter) => void;
    children?: React.ReactNode;
}) {
    return (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-2 min-w-40 [&>input]:pl-2">
                <Input type="text" value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Cari produk..." />
            </div>
            <Select
                value={marginFilter}
                onChange={(e) => onMarginFilterChange(e.target.value as MarginFilter)}
                options={[
                    { value: 'all', label: 'Semua Margin' },
                    { value: 'high', label: 'Margin Tinggi (>20rb)' },
                    { value: 'low', label: 'Margin Rendah (<5rb)' },
                    { value: 'negative', label: 'Margin Negatif' },
                ]}
            />
            {children}
        </div>
    );
}
