import { Link, router } from '@inertiajs/react';
import { ArrowLeft, Copy, DollarSign, Plus, RotateCcw, Search, Store } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import OwnerKpiCard from '@/components/owner/owner-kpi-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency, formatMarginPercent } from '@/lib/format';
import { marginColor } from '@/lib/pricing-utils';
import { OutletPriceModal } from './pricing-modals';
import { BulkPanel, CopyPanel, EmptyState, LoadingSkeleton, PaginationBar, SortBar, Toolbar } from './pricing-shared';
import type { MarginFilter, OtherOutlet, OutletData, OutletPriceRow, SortDir, SortKey } from './types';

/* ------------------------------------------------------------------ */
/*  OutletTab — router between grid and detail                         */
/* ------------------------------------------------------------------ */

export function OutletTab({ outlets, selectedOutlet, outletPrices, otherOutlets }: {
    outlets?: OutletData[];
    selectedOutlet?: { id: number; name: string };
    outletPrices?: OutletPriceRow[];
    otherOutlets?: OtherOutlet[];
}) {
    if (!selectedOutlet) {
        return <OutletGrid outlets={outlets} />;
    }

    return (
        <OutletDetail
            outlet={selectedOutlet}
            prices={outletPrices}
            otherOutlets={otherOutlets}
            allOutlets={outlets}
        />
    );
}

/* ------------------------------------------------------------------ */
/*  OutletGrid                                                         */
/* ------------------------------------------------------------------ */

function OutletGrid({ outlets }: { outlets?: OutletData[] }) {
    if (!outlets || outlets.length === 0) {
        return (
            <EmptyState icon={<Store className="h-10 w-10" />} message="Belum ada outlet aktif." />
        );
    }

    return (
        <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {outlets.map((o) => (
                    <Link
                        key={o.id}
                        href={`/owner/pricing?tab=outlet&outlet_id=${o.id}`}
                        className="flex items-center gap-4 rounded-xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-sm hover:border-primary/20 active:opacity-80"
                    >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light">
                            <Store className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-bold text-text">{o.name}</div>
                            <div className="mt-0.5 text-xs text-text-muted">
                                {o.override_count > 0
                                    ? `${o.override_count} dari ${o.total_variants} produk custom`
                                    : 'Semua standar'}
                            </div>
                        </div>
                        {o.all_standard ? (
                            <StatusBadge variant="success" size="sm">Standar</StatusBadge>
                        ) : (
                            <StatusBadge variant="info" size="sm">Custom</StatusBadge>
                        )}
                    </Link>
                ))}
            </div>

            <aside className="hidden lg:block">
                <div className="sticky top-4 space-y-3">
                    <OwnerKpiCard label="Total Outlet" value={outlets.length} icon={<Store className="h-5 w-5" />} />
                    <OwnerKpiCard
                        label="Outlet dengan Override"
                        value={outlets.filter((o) => !o.all_standard).length}
                        icon={<DollarSign className="h-5 w-5" />}
                    />
                </div>
            </aside>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  OutletDetail                                                       */
/* ------------------------------------------------------------------ */

function OutletDetail({ outlet, prices, otherOutlets, allOutlets }: {
    outlet: { id: number; name: string };
    prices?: OutletPriceRow[];
    otherOutlets?: OtherOutlet[];
    allOutlets?: OutletData[];
}) {
    const [search, setSearch] = useState('');
    const [marginFilter, setMarginFilter] = useState<MarginFilter>('all');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [page, setPage] = useState(1);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedRow, setSelectedRow] = useState<OutletPriceRow | null>(null);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [bulkAmount, setBulkAmount] = useState('');
    const [copyOpen, setCopyOpen] = useState(false);
    const [copySource, setCopySource] = useState('');
    const [saving, setSaving] = useState(false);

    const handleOutletChange = (outletId: string) => {
        if (outletId) {
            router.get('/owner/pricing', { tab: 'outlet', outlet_id: outletId }, { preserveState: true, replace: true });
        }
    };

    if (!prices) {
        return <LoadingSkeleton />;
    }

    const filtered = useMemo(() => {
        return prices.filter((p) => {
            if (search) {
                const q = search.toLowerCase();

                if (!p.name.toLowerCase().includes(q) && !(p.family_name ?? '').toLowerCase().includes(q)) {
                    return false;
                }
            }

            if (marginFilter === 'high' && p.margin <= 20000) {
                return false;
            }

            if (marginFilter === 'low' && (p.margin < 5000 || p.margin > 20000)) {
                return false;
            }

            if (marginFilter === 'negative' && p.margin >= 0) {
                return false;
            }

            return true;
        });
    }, [prices, search, marginFilter]);

    const sorted = useMemo(() => {
        return [...filtered].sort((a, b) => {
            const aVal = a[sortKey];
            const bVal = b[sortKey];
            const cmp = typeof aVal === 'string' ? aVal.localeCompare(String(bVal)) : Number(aVal) - Number(bVal);

            return sortDir === 'asc' ? cmp : -cmp;
        });
    }, [filtered, sortKey, sortDir]);

    const perPage = 20;
    const totalPages = Math.ceil(sorted.length / perPage);
    const paginated = sorted.slice((page - 1) * perPage, page * perPage);

    const toggleSort = useCallback(
        (key: SortKey) => {
            if (sortKey === key) {
                setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
            } else {
                setSortKey(key); setSortDir('asc');
            }

            setPage(1);
        },
        [sortKey],
    );

    const handleBulkUpdate = useCallback(() => {
        const amount = parseFloat(bulkAmount);

        if (isNaN(amount)) {
            return;
        }

        if (!confirm(`${sorted.length} produk akan diperbarui. Lanjutkan?`)) {
            return;
        }

        setSaving(true);
        router.post(`/owner/pricing/outlets/${outlet.id}/bulk-update`, { adjustment: amount }, {
            onFinish: () => {
                setSaving(false); setBulkOpen(false); setBulkAmount('');
            },
        });
    }, [bulkAmount, outlet.id, sorted.length]);

    const handleCopy = useCallback(() => {
        if (!copySource) {
            return;
        }

        if (!confirm('Ini akan menimpa semua harga outlet ini. Lanjutkan?')) {
            return;
        }

        setSaving(true);
        router.post(`/owner/pricing/outlets/${outlet.id}/copy`, { source_outlet_id: parseInt(copySource) }, {
            onFinish: () => {
                setSaving(false); setCopyOpen(false); setCopySource('');
            },
        });
    }, [copySource, outlet.id]);

    const handleReset = useCallback((variantId: number, productName: string) => {
        if (!confirm(`Reset ${productName} ke Harga Pusat?`)) {
            return;
        }

        router.delete(`/owner/pricing/outlets/${outlet.id}/variants/${variantId}`);
    }, [outlet.id]);

    const handleSave = useCallback((newPrice: number) => {
        if (!selectedRow) {
            return;
        }

        setSaving(true);
        router.patch(`/owner/pricing/outlets/${outlet.id}/variants/${selectedRow.variant_id}`, { selling_price: newPrice }, {
            onFinish: () => {
                setSaving(false); setModalOpen(false); setSelectedRow(null);
            },
        });
    }, [selectedRow, outlet.id]);

    return (
        <div>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/owner/pricing?tab=outlet" className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-muted text-text-muted hover:text-text">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <span className="text-lg font-bold text-text">{outlet.name}</span>
                </div>
                {allOutlets && allOutlets.length > 1 && (
                    <Select
                        value={String(outlet.id)}
                        onChange={(e) => handleOutletChange(e.target.value)}
                        options={allOutlets.map((o) => ({ value: String(o.id), label: o.name }))}
                    />
                )}
            </div>

            <Toolbar
                search={search}
                onSearchChange={(v) => {
 setSearch(v); setPage(1); 
}}
                marginFilter={marginFilter}
                onMarginFilterChange={(v) => {
 setMarginFilter(v); setPage(1); 
}}
            >
                <Button type="button" variant="secondary" size="sm" icon={Plus} onClick={() => setBulkOpen(!bulkOpen)}>
                    Atur Massal
                </Button>
                {otherOutlets && otherOutlets.length > 0 && (
                    <Button type="button" variant="secondary" size="sm" icon={Copy} onClick={() => setCopyOpen(!copyOpen)}>
                        Salin Dari
                    </Button>
                )}
            </Toolbar>

            {bulkOpen && (
                <BulkPanel
                    amount={bulkAmount}
                    onChange={setBulkAmount}
                    onApply={handleBulkUpdate}
                    onCancel={() => {
 setBulkOpen(false); setBulkAmount(''); 
}}
                    saving={saving}
                    count={sorted.length}
                />
            )}

            {copyOpen && otherOutlets && (
                <CopyPanel
                    outlets={otherOutlets}
                    source={copySource}
                    onChange={setCopySource}
                    onApply={handleCopy}
                    onCancel={() => {
 setCopyOpen(false); setCopySource(''); 
}}
                    saving={saving}
                />
            )}

            <SortBar sortKey={sortKey} sortDir={sortDir} toggleSort={toggleSort} />

            <div className="space-y-2">
                {paginated.map((row) => (
                    <div key={row.variant_id} className="rounded-xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-sm">
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="text-lg font-bold text-text">{row.name}</div>
                                <div className="mt-0.5 flex items-center gap-2">
                                    {row.has_override ? (
                                        <StatusBadge variant="info" size="sm">Custom</StatusBadge>
                                    ) : (
                                        <StatusBadge variant="neutral" size="sm">Standar</StatusBadge>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                {row.has_override && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleReset(row.variant_id, row.name)}
                                        className="shrink-0 text-text-muted hover:text-red-600"
                                        title="Reset ke harga pusat"
                                    >
                                        <RotateCcw className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
 setSelectedRow(row); setModalOpen(true); 
}}
                                    className="shrink-0 text-primary"
                                >
                                    Ubah
                                </Button>
                            </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                            <span className="text-text-muted">
                                Pusat: <span className="tabular-nums text-text-muted">{formatCurrency(row.center_price)}</span>
                            </span>
                            <span className="text-text-muted">
                                Jual: <span className="font-semibold tabular-nums text-text">{formatCurrency(row.selling_price)}</span>
                            </span>
                            <span className={`font-bold tabular-nums ${marginColor(row.margin, row.selling_price)}`}>
                                {formatCurrency(row.margin)} {formatMarginPercent(row.margin, row.selling_price)}
                            </span>
                        </div>
                    </div>
                ))}
                {paginated.length === 0 && (
                    <EmptyState message={search || marginFilter !== 'all' ? 'Produk tidak ditemukan.' : 'Belum ada produk aktif.'} />
                )}
            </div>

            {totalPages > 1 && <PaginationBar page={page} totalPages={totalPages} total={sorted.length} onPageChange={setPage} />}

            {selectedRow && (
                <OutletPriceModal
                    open={modalOpen}
                    row={selectedRow}
                    onClose={() => {
 setModalOpen(false); setSelectedRow(null); 
}}
                    onSave={handleSave}
                    saving={saving}
                />
            )}
        </div>
    );
}
