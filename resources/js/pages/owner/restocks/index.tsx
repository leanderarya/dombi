import { router, useForm } from '@inertiajs/react';
import {
    CheckCircle,
    CheckCircle2,
    Clock,
    Package,
    Truck,
    XCircle,
} from 'lucide-react';
import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import OwnerFilterCard from '@/components/owner/owner-filter-card';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import OwnerTable from '@/components/owner/owner-table';
import SortableTh from '@/components/owner/sortable-th';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import EmptyState from '@/components/ui/empty-state';
import Pagination from '@/components/ui/pagination';
import { SkeletonPage } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui/status-badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { displayProductName } from '@/lib/display';
import { formatDate } from '@/lib/format';

const statusFilters = [
    { key: '', label: 'Semua' },
    { key: 'requested', label: 'Butuh Tindakan' },
    { key: 'preparing', label: 'Disiapkan' },
    { key: 'shipped', label: 'Dikirim' },
    { key: 'completed', label: 'Selesai' },
    { key: 'rejected', label: 'Ditolak' },
    { key: 'cancelled', label: 'Dibatalkan' },
];

type SortKey = 'id' | 'outlet' | 'items' | 'date';

interface RestockDetailItem {
    id: number;
    approved_quantity?: number | null;
    requested_quantity: number;
}

interface RestockDetailResponse {
    restock: {
        owner_notes?: string | null;
        items?: RestockDetailItem[];
    };
    centralStock?: Record<number, number>;
}

export default function OwnerRestocksIndex({
    restocks,
    filters,
    outlets,
}: any) {
    const [sortKey, setSortKey] = useState<SortKey>('id');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [approveModal, setApproveModal] = useState<any>(null);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const currentStatus = filters?.status ?? '';

    const setFilter = (key: string, value: string) => {
        router.get(
            '/owner/restocks',
            { ...filters, [key]: value || undefined },
            { preserveState: true, replace: true },
        );
    };

    const sorted = useMemo(
        () =>
            [...(restocks?.data ?? [])].sort((a: any, b: any) => {
                let av: any, bv: any;

                switch (sortKey) {
                    case 'id':
                        av = a.id;
                        bv = b.id;
                        break;
                    case 'outlet':
                        av = a.outlet?.name ?? '';
                        bv = b.outlet?.name ?? '';
                        break;
                    case 'items':
                        av = a.items?.length ?? 0;
                        bv = b.items?.length ?? 0;
                        break;
                    case 'date':
                        av = a.created_at ?? '';
                        bv = b.created_at ?? '';
                        break;
                    default:
                        av = a.id;
                        bv = b.id;
                }

                const cmp =
                    typeof av === 'string'
                        ? av.localeCompare(String(bv))
                        : Number(av) - Number(bv);

                return sortDir === 'asc' ? cmp : -cmp;
            }),
        [restocks?.data, sortKey, sortDir],
    );

    if (!restocks || !filters) {
        return (
            <OwnerPageShell
                title="Restocks"
                subtitle="Kelola permintaan restock dari outlet"
            >
                <SkeletonPage />
            </OwnerPageShell>
        );
    }

    const handleOpenApprove = (restock: any) => {
        setApproveModal(restock);
    };

    const requestedCount = restocks.data.filter(
        (r: any) => r.status === 'requested',
    ).length;
    const preparingCount = restocks.data.filter(
        (r: any) => r.status === 'preparing',
    ).length;
    const shippedCount = restocks.data.filter(
        (r: any) => r.status === 'shipped',
    ).length;
    const completedCount = restocks.data.filter(
        (r: any) => r.status === 'completed',
    ).length;

    return (
        <OwnerPageShell
            title="Restocks"
            subtitle="Kelola permintaan restock dari outlet"
        >
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-text-muted">
                            Menunggu
                        </span>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                            <Clock className="h-5 w-5" />
                        </span>
                    </div>
                    <div
                        className={`font-heading text-xl font-bold tabular-nums sm:text-2xl ${requestedCount > 0 ? 'text-amber-600' : 'text-text'}`}
                    >
                        {requestedCount}
                    </div>
                    {requestedCount > 0 && (
                        <p className="text-[11px] text-amber-500">
                            Perlu ditinjau
                        </p>
                    )}
                </div>
                <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-text-muted">
                            Disiapkan
                        </span>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563EB]/10 text-[#2563EB]">
                            <Package className="h-5 w-5" />
                        </span>
                    </div>
                    <div className="font-heading text-xl font-bold text-text tabular-nums sm:text-2xl">
                        {preparingCount}
                    </div>
                </div>
                <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-text-muted">
                            Dikirim
                        </span>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0D9488]/10 text-[#0D9488]">
                            <Truck className="h-5 w-5" />
                        </span>
                    </div>
                    <div className="font-heading text-xl font-bold text-text tabular-nums sm:text-2xl">
                        {shippedCount}
                    </div>
                </div>
                <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-text-muted">
                            Selesai
                        </span>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                            <CheckCircle className="h-5 w-5" />
                        </span>
                    </div>
                    <div className="font-heading text-xl font-bold text-emerald-600 tabular-nums sm:text-2xl">
                        {completedCount}
                    </div>
                </div>
            </div>

            <section
                className="mb-4 flex flex-wrap items-center gap-2"
                aria-label="Filter Status"
            >
                {statusFilters.map((sf) => {
                    const isActive = currentStatus === sf.key;

                    return (
                        <button
                            key={sf.key}
                            type="button"
                            onClick={() => setFilter('status', sf.key)}
                            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-all ${isActive ? 'bg-primary/10 text-primary ring-primary/20' : 'bg-surface text-text-muted ring-border hover:bg-mint-wash'}`}
                        >
                            {sf.label}
                        </button>
                    );
                })}
            </section>

            <OwnerFilterCard
                collapsible
                defaultExpanded={false}
                searchPlaceholder="Cari kode..."
                searchValue={filters.search ?? ''}
                onSearch={(val) => setFilter('search', val)}
                outletOptions={outlets?.map((o: any) => ({
                    value: String(o.id),
                    label: o.name,
                }))}
                outletValue={filters.outlet_id ?? ''}
                onOutletChange={(val) => setFilter('outlet_id', val)}
                dateValue={filters.date ?? ''}
                onDateChange={(val) => setFilter('date', val)}
            />

            {restocks.data.length === 0 ? (
                <EmptyState
                    title="Tidak ada restock"
                    description="Permintaan restock akan muncul di sini setelah diajukan outlet"
                />
            ) : (
                <OwnerTable minWidth="600px">
                    <Table aria-label="Daftar Restock">
                        <TableHeader>
                            <TableRow className="bg-surface-muted/50">
                                <SortableTh
                                    label="Kode"
                                    active={sortKey === 'id'}
                                    dir={sortDir}
                                    onClick={() => toggleSort('id')}
                                />
                                <SortableTh
                                    label="Outlet"
                                    active={sortKey === 'outlet'}
                                    dir={sortDir}
                                    onClick={() => toggleSort('outlet')}
                                />
                                <TableHead className="px-3 py-2.5 text-xs font-semibold tracking-wide text-text-muted uppercase">
                                    Status
                                </TableHead>
                                <SortableTh
                                    label="Items"
                                    active={sortKey === 'items'}
                                    dir={sortDir}
                                    onClick={() => toggleSort('items')}
                                />
                                <SortableTh
                                    label="Tanggal"
                                    active={sortKey === 'date'}
                                    dir={sortDir}
                                    onClick={() => toggleSort('date')}
                                />
                                <TableHead className="w-28 px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-text-muted uppercase">
                                    Aksi
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sorted.map((r: any) => (
                                <TableRow
                                    key={r.id}
                                    className="border-t border-border/20 transition-colors hover:bg-mint-wash"
                                >
                                    <TableCell className="px-3 py-3 font-bold text-text tabular-nums">
                                        #{r.id}
                                    </TableCell>
                                    <TableCell className="px-3 py-3 text-text-muted">
                                        {r.outlet?.name ?? '—'}
                                    </TableCell>
                                    <TableCell className="px-3 py-3">
                                        <StatusBadge
                                            status={r.status}
                                            size="sm"
                                        />
                                    </TableCell>
                                    <TableCell className="px-3 py-3 text-text-muted">
                                        {r.items?.length ?? 0} item
                                    </TableCell>
                                    <TableCell className="px-3 py-3 text-text-muted">
                                        {formatDate(r.created_at)}
                                    </TableCell>
                                    <TableCell className="px-3 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {r.status === 'requested' ? (
                                                <Button
                                                    size="sm"
                                                    onClick={() =>
                                                        handleOpenApprove(r)
                                                    }
                                                >
                                                    Setujui
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                        handleOpenApprove(r)
                                                    }
                                                >
                                                    Detail
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </OwnerTable>
            )}

            <Pagination links={restocks.links} />

            {/* Approve/Detail Modal */}
            {approveModal && (
                <RestockActionModal
                    restock={approveModal}
                    onClose={() => setApproveModal(null)}
                    onSuccess={() => setApproveModal(null)}
                />
            )}
        </OwnerPageShell>
    );
}

// ── Approve/Detail Modal ──
function RestockActionModal({
    restock,
    onClose,
    onSuccess,
}: {
    restock: any;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [detail, setDetail] = useState<any>(null);
    const [centralStock, setCentralStock] = useState<Record<number, number>>(
        {},
    );
    const [loading, setLoading] = useState(true);
    const [showReject, setShowReject] = useState(false);

    const approveForm = useForm({
        owner_notes: '',
        items: [] as any[],
    });
    const rejectForm = useForm({ rejected_reason: '' });
    const restockId = restock.id;
    const hydrateDetail = useEffectEvent((data: RestockDetailResponse) => {
        setDetail(data.restock);
        setCentralStock(data.centralStock ?? {});
        approveForm.setData({
            owner_notes: data.restock.owner_notes ?? '',
            items: (data.restock.items ?? []).map((item) => ({
                restock_request_item_id: item.id,
                approved_quantity:
                    item.approved_quantity ?? item.requested_quantity,
            })),
        });
    });

    useEffect(() => {
        let cancelled = false;

        fetch(`/owner/restocks/${restockId}`, {
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
        })
            .then((r) => r.json())
            .then((data) => {
                if (!cancelled) {
                    hydrateDetail(data);
                }
            })
            .catch(() => {
                // Keep the dialog available so the owner can close and retry.
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [restockId]);

    const isRequested = restock.status === 'requested';

    const handleApprove = () => {
        approveForm.post(`/owner/restocks/${restock.id}/approve`, {
            onSuccess: () => {
                onSuccess();
                onClose();
            },
        });
    };

    const handleReject = () => {
        rejectForm.post(`/owner/restocks/${restock.id}/reject`, {
            onSuccess: () => {
                onSuccess();
                onClose();
            },
        });
    };

    return (
        <>
            <Dialog
                open={true}
                onOpenChange={(open) => {
                    if (!open) {
                        onClose();
                    }
                }}
            >
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {isRequested ? 'Setujui Restock' : 'Detail Restock'}{' '}
                            #{restock.id}
                        </DialogTitle>
                        <DialogDescription>
                            {restock.outlet?.name} &middot;{' '}
                            {formatDate(restock.created_at)}
                        </DialogDescription>
                    </DialogHeader>

                    {loading ? (
                        <div className="py-8 text-center text-sm text-text-muted">
                            Memuat...
                        </div>
                    ) : (
                        <div className="max-h-[60vh] space-y-3 overflow-y-auto">
                            {/* Items */}
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border text-xs text-text-muted">
                                        <th className="py-1.5 text-left font-medium">
                                            Produk
                                        </th>
                                        <th className="py-1.5 text-right font-medium">
                                            Diminta
                                        </th>
                                        <th className="py-1.5 text-right font-medium">
                                            Disetujui
                                        </th>
                                        <th className="py-1.5 text-right font-medium">
                                            Stok Gudang
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isRequested
                                        ? approveForm.data.items.map(
                                              (item: any, i: number) => {
                                                  const detailItem =
                                                      detail?.items?.[i];
                                                  const stockVal =
                                                      centralStock[
                                                          detailItem
                                                              ?.product_variant_id
                                                      ];
                                                  const approvedQty =
                                                      item.approved_quantity ??
                                                      0;
                                                  const stockWarning =
                                                      stockVal !== undefined &&
                                                      stockVal < approvedQty;

                                                  return (
                                                      <tr
                                                          key={i}
                                                          className="border-t border-border/30"
                                                      >
                                                          <td className="py-2 font-medium text-text">
                                                              {displayProductName(
                                                                  detailItem?.variant,
                                                              )}
                                                          </td>
                                                          <td className="py-2 text-right text-text-muted tabular-nums">
                                                              {
                                                                  detailItem?.requested_quantity
                                                              }
                                                          </td>
                                                          <td className="py-2 text-right">
                                                              <input
                                                                  type="number"
                                                                  min={0}
                                                                  value={
                                                                      item.approved_quantity
                                                                  }
                                                                  onChange={(
                                                                      e,
                                                                  ) => {
                                                                      const items =
                                                                          [
                                                                              ...approveForm
                                                                                  .data
                                                                                  .items,
                                                                          ];
                                                                      items[i] =
                                                                          {
                                                                              ...items[
                                                                                  i
                                                                              ],
                                                                              approved_quantity:
                                                                                  Number(
                                                                                      e
                                                                                          .target
                                                                                          .value,
                                                                                  ),
                                                                          };
                                                                      approveForm.setData(
                                                                          'items',
                                                                          items as any,
                                                                      );
                                                                  }}
                                                                  className="h-11 w-20 rounded border border-border px-1.5 text-right text-xs font-semibold outline-none focus:border-primary"
                                                              />
                                                          </td>
                                                          <td
                                                              className={`py-2 text-right tabular-nums ${stockWarning ? 'font-semibold text-red-600' : 'text-text-muted'}`}
                                                          >
                                                              {stockVal ?? '—'}
                                                          </td>
                                                      </tr>
                                                  );
                                              },
                                          )
                                        : (detail?.items ?? []).map(
                                              (item: any) => {
                                                  const stockVal =
                                                      centralStock[
                                                          item
                                                              .product_variant_id
                                                      ];
                                                  const approvedQty =
                                                      item.approved_quantity ??
                                                      0;
                                                  const stockWarning =
                                                      stockVal !== undefined &&
                                                      stockVal < approvedQty;

                                                  return (
                                                      <tr
                                                          key={item.id}
                                                          className="border-t border-border/30"
                                                      >
                                                          <td className="py-2 font-medium text-text">
                                                              {displayProductName(
                                                                  item.variant,
                                                              )}
                                                          </td>
                                                          <td className="py-2 text-right text-text-muted tabular-nums">
                                                              {
                                                                  item.requested_quantity
                                                              }
                                                          </td>
                                                          <td className="py-2 text-right font-semibold tabular-nums">
                                                              {item.approved_quantity ??
                                                                  '—'}
                                                          </td>
                                                          <td
                                                              className={`py-2 text-right tabular-nums ${stockWarning ? 'font-semibold text-red-600' : 'text-text-muted'}`}
                                                          >
                                                              {stockVal ?? '—'}
                                                          </td>
                                                      </tr>
                                                  );
                                              },
                                          )}
                                </tbody>
                            </table>

                            {isRequested && (
                                <Textarea
                                    value={approveForm.data.owner_notes}
                                    onChange={(e) =>
                                        approveForm.setData(
                                            'owner_notes',
                                            e.target.value,
                                        )
                                    }
                                    placeholder="Catatan (opsional)"
                                    rows={2}
                                />
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        {isRequested && (
                            <>
                                <Button
                                    variant="destructive"
                                    onClick={() => setShowReject(true)}
                                    disabled={loading}
                                >
                                    <XCircle className="mr-1.5 h-4 w-4" />
                                    Tolak
                                </Button>
                                <div className="flex-1" />
                                <Button variant="outline" onClick={onClose}>
                                    Batal
                                </Button>
                                <Button
                                    onClick={handleApprove}
                                    disabled={loading || approveForm.processing}
                                >
                                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                                    {approveForm.processing
                                        ? 'Menyetujui...'
                                        : 'Setujui & Buat Distribusi'}
                                </Button>
                            </>
                        )}
                        {!isRequested && (
                            <Button variant="outline" onClick={onClose}>
                                Tutup
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject sub-modal */}
            <Dialog open={showReject} onOpenChange={setShowReject}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Tolak Restock</DialogTitle>
                    </DialogHeader>
                    <Textarea
                        value={rejectForm.data.rejected_reason}
                        onChange={(e) =>
                            rejectForm.setData(
                                'rejected_reason',
                                e.target.value,
                            )
                        }
                        placeholder="Alasan penolakan"
                        rows={3}
                    />
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowReject(false)}
                        >
                            Batal
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleReject}
                            disabled={rejectForm.processing}
                        >
                            Tolak
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
