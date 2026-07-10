import { Link, router } from '@inertiajs/react';
import { ArrowLeft, Copy, Plus, RotateCcw } from 'lucide-react';
import { MarginBarInline } from '@/components/owner';
import { useCallback, useMemo, useState } from 'react';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import EmptyState from '@/components/ui/empty-state';
import { Select } from '@/components/ui/select';
import { SkeletonList } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency, formatMarginPercent } from '@/lib/format';
import { marginColor } from '@/lib/pricing-utils';
import { OutletPriceModal } from './pricing-modals';
import { BulkPanel, CopyPanel, PaginationBar, SortBar } from './pricing-shared';
import type { MarginFilter, OtherOutlet, OutletData, OutletPriceRow, SortDir, SortKey } from './types';

export default function OutletDetail({ outlet, prices, otherOutlets, allOutlets }: {
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

    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmTitle, setConfirmTitle] = useState('');
    const [confirmDescription, setConfirmDescription] = useState('');
    const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

    const showConfirm = (title: string, description: string, action: () => void) => {
        setConfirmTitle(title);
        setConfirmDescription(description);
        setConfirmAction(() => action);
        setConfirmOpen(true);
    };

    const handleConfirm = () => {
        confirmAction?.();
        setConfirmOpen(false);
        setConfirmAction(null);
    };

    const handleOutletChange = (outletId: string) => {
        if (outletId) {
            router.reload({ only: ['outletPrices', 'selectedOutlet'], data: { tab: 'outlet', outlet_id: outletId }, preserveState: true, replace: true });
        }
    };

    if (!prices) {
        return <SkeletonList count={5} />;
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

        showConfirm(
            'Atur Massal',
            `${sorted.length} produk akan diperbarui. Lanjutkan?`,
            () => {
                setSaving(true);
                router.post(`/owner/pricing/outlets/${outlet.id}/bulk-update`, { adjustment: amount }, {
                    onFinish: () => {
                        setSaving(false); setBulkOpen(false); setBulkAmount('');
                    },
                });
            },
        );
    }, [bulkAmount, outlet.id, sorted.length]);

    const handleCopy = useCallback(() => {
        if (!copySource) {
            return;
        }

        showConfirm(
            'Salin Harga',
            'Ini akan menimpa semua harga outlet ini. Lanjutkan?',
            () => {
                setSaving(true);
                router.post(`/owner/pricing/outlets/${outlet.id}/copy`, { source_outlet_id: parseInt(copySource) }, {
                    onFinish: () => {
                        setSaving(false); setCopyOpen(false); setCopySource('');
                    },
                });
            },
        );
    }, [copySource, outlet.id]);

    const handleReset = useCallback((variantId: number, productName: string) => {
        showConfirm(
            'Reset Harga',
            `Reset ${productName} ke Harga Pusat?`,
            () => {
                router.delete(`/owner/pricing/outlets/${outlet.id}/variants/${variantId}`);
            },
        );
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
                    <Link href="/owner/pricing?tab=outlet" className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-muted text-text-muted hover:text-text" aria-label="Kembali ke daftar outlet">
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
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

            <OwnerFilterCard
                collapsible
                defaultExpanded={false}
                searchPlaceholder="Cari produk..."
                searchValue={search}
                onSearch={(v) => {
 setSearch(v); setPage(1); 
}}
                marginOptions={[
                    { value: 'high', label: 'Margin Tinggi (>20rb)' },
                    { value: 'low', label: 'Margin Rendah (<5rb)' },
                    { value: 'negative', label: 'Margin Negatif' },
                ]}
                marginValue={marginFilter === 'all' ? '' : marginFilter}
                onMarginChange={(v) => {
 setMarginFilter((v || 'all') as MarginFilter); setPage(1); 
}}
            >
                <Button type="button" variant="secondary" size="sm" icon={Plus} onClick={() => setBulkOpen(!bulkOpen)} aria-label="Atur massal harga">
                    Atur Massal
                </Button>
                {otherOutlets && otherOutlets.length > 0 && (
                    <Button type="button" variant="secondary" size="sm" icon={Copy} onClick={() => setCopyOpen(!copyOpen)} aria-label="Salin harga dari outlet lain">
                        Salin Dari
                    </Button>
                )}
            </OwnerFilterCard>

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

            <div className="space-y-2" aria-label="Daftar harga outlet">
                {paginated.map((row) => (
                    <div key={row.variant_id} className="rounded-lg border border-border bg-white p-4 transition-all duration-200">
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
                                        aria-label={`Reset ${row.name} ke harga pusat`}
                                    >
                                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
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
                            <div className="flex items-center gap-2">
                            <span className={`font-bold tabular-nums ${marginColor(row.margin, row.selling_price)}`}>
                                {formatCurrency(row.margin)} {formatMarginPercent(row.margin, row.selling_price)}
                            </span>
                            <MarginBarInline margin={row.margin} maxMargin={Math.max(...sorted.map((r) => r.margin), 1)} sellingPrice={row.selling_price} />
                        </div>
                        </div>
                    </div>
                ))}
                {paginated.length === 0 && (
                    <EmptyState title={search || marginFilter !== 'all' ? 'Produk tidak ditemukan.' : 'Belum ada produk aktif.'} />
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

            <Dialog open={confirmOpen} onOpenChange={(isOpen) => !isOpen && setConfirmOpen(false)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{confirmTitle}</DialogTitle>
                        <DialogDescription>{confirmDescription}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type="button" variant="secondary" onClick={() => setConfirmOpen(false)}>Batal</Button>
                        <Button type="button" variant="primary" onClick={handleConfirm}>Lanjutkan</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
