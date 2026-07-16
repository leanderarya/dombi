import { useForm, router } from '@inertiajs/react';
import { ArrowLeftRight, CheckCircle2, Clock, Package, Truck, XCircle } from 'lucide-react';
import { useState } from 'react';
import OwnerDetailRow from '@/components/owner/owner-detail-row';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { displayProductName } from '@/lib/display';
import { formatCurrency, formatDate } from '@/lib/format';
import { getExchangeStatus, getReturnStatus } from '@/lib/status-labels';

const STATUS_ICONS: Record<string, typeof CheckCircle2> = {
    submitted: Clock,
    approved: CheckCircle2,
    rejected: XCircle,
    preparing: Package,
    shipped: Truck,
    received: ArrowLeftRight,
    completed: CheckCircle2,
};

export default function OwnerExchangesShow({ exchange }: any) {
    const [showApprove, setShowApprove] = useState(false);
    const [showReject, setShowReject] = useState(false);
    const [showComplete, setShowComplete] = useState(false);

    const approveForm = useForm({ notes: '' });
    const rejectForm = useForm({ reason: '' });

    if (!exchange) {
        return (
            <OwnerPageShell title="Memuat..." subtitle="Detail tukar produk" backHref="/owner/exchanges">
                <div className="grid gap-4 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-4">
                        <div className="rounded-lg border border-border p-4 space-y-3">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="rounded-lg border border-border p-4 space-y-3">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-8 w-full" />
                        </div>
                    </div>
                </div>
            </OwnerPageShell>
        );
    }

    const status = getExchangeStatus(exchange.status);
    const StatusIcon = STATUS_ICONS[exchange.status] ?? Clock;

    const handleApprove = () => {
        approveForm.post(`/owner/exchanges/${exchange.id}/approve`, {
            onSuccess: () => {
                setShowApprove(false);
                approveForm.reset();
            },
        });
    };

    const handleReject = () => {
        rejectForm.post(`/owner/exchanges/${exchange.id}/reject`, {
            onSuccess: () => {
                setShowReject(false);
                rejectForm.reset();
            },
        });
    };

    return (
        <OwnerPageShell title={`Exchange #${exchange.id}`} subtitle={exchange.outlet?.name} backHref="/owner/exchanges">
            <div className="grid gap-4 lg:grid-cols-3">
                {/* Main Content - 2 columns */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Exchange Items */}
                    <div className="rounded-lg border border-border p-4" aria-label="Item Pengganti">
                        <div className="mb-3 text-xs font-semibold text-text-subtle">Item Pengganti</div>
                        {exchange.items?.map((item: any) => (
                            <OwnerDetailRow key={item.id} label={`${displayProductName(item.variant)} x${item.quantity}`} value={formatCurrency(item.subtotal)} bold />
                        ))}
                        <div className="mt-2 flex justify-between border-t border-border pt-2 text-sm">
                            <span className="text-text-muted">Nilai Tukar</span>
                            <span className="font-bold text-primary">{formatCurrency(exchange.exchange_value)}</span>
                        </div>
                    </div>

                    {/* Linked Return */}
                    {exchange.return_request && (
                        <div className="rounded-lg border border-border p-4" aria-label="Return Terkait">
                            <div className="mb-3 text-xs font-semibold text-text-subtle">Return Terkait</div>
                            <OwnerDetailRow label="Return" value={`#${exchange.return_request.id}`} />
                            <OwnerDetailRow label="Item" value={`${exchange.return_request.items?.length ?? 0} item`} />
                            <OwnerDetailRow label="Status" value={<StatusBadge variant={getReturnStatus(exchange.return_request.status).variant} size="sm">{getReturnStatus(exchange.return_request.status).label}</StatusBadge>} />
                        </div>
                    )}

                    {/* Notes */}
                    {exchange.notes && (
                        <div className="rounded-lg border border-border p-4" aria-label="Catatan Exchange">
                            <div className="mb-3 text-xs font-semibold text-text-subtle">Catatan</div>
                            <p className="text-sm text-text-muted">{exchange.notes}</p>
                        </div>
                    )}
                </div>

                {/* Sidebar - 1 column */}
                <div className="space-y-4">
                    {/* Status + Actions */}
                    <div className="rounded-lg border border-border p-4" aria-label="Status Exchange">
                        <div className="mb-3 text-xs font-semibold text-text-subtle">Status</div>
                        <div className="flex items-center gap-2 mb-3">
                            <StatusIcon className="h-4 w-4 text-text-muted" aria-hidden="true" />
                            <StatusBadge variant={status.variant} size="sm">{status.label}</StatusBadge>
                        </div>
                        <OwnerDetailRow label="Nilai Tukar" value={formatCurrency(exchange.exchange_value)} bold />
                        <OwnerDetailRow label="Item" value={`${exchange.items?.length ?? 0} item`} />
                        <OwnerDetailRow label="Tanggal" value={formatDate(exchange.created_at)} />

                        {/* Actions */}
                        {exchange.status === 'submitted' && (
                            <div className="mt-4 flex gap-2">
                                <Button size="sm" className="flex-1" aria-label="Setujui Exchange" onClick={() => setShowApprove(true)}>
                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                                    Setujui
                                </Button>
                                <Button size="sm" variant="destructive" className="flex-1" aria-label="Tolak Exchange" onClick={() => setShowReject(true)}>
                                    <XCircle className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                                    Tolak
                                </Button>
                            </div>
                        )}

                        {(exchange.status === 'approved' || exchange.status === 'preparing') && (
                            <Button size="sm" className="mt-4 w-full" onClick={() => router.post(`/owner/exchanges/${exchange.id}/mark-shipped`)}>
                                <Truck className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                                Tandai Dikirim
                            </Button>
                        )}

                        {exchange.status === 'received' && (
                            <Button size="sm" className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700" onClick={() => setShowComplete(true)}>
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                                Selesaikan Tukar Produk
                            </Button>
                        )}

                        {exchange.status === 'completed' && (
                            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
                                <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-500" aria-hidden="true" />
                                <div className="mt-1 text-xs font-semibold text-emerald-800">Tukar Produk Selesai</div>
                            </div>
                        )}

                        {exchange.status === 'rejected' && (
                            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-center">
                                <XCircle className="mx-auto h-5 w-5 text-red-500" aria-hidden="true" />
                                <div className="mt-1 text-xs font-semibold text-red-800">Tukar Produk Ditolak</div>
                            </div>
                        )}
                    </div>

                    {/* Status History / Timeline */}
                    {exchange.status_histories?.length > 0 && (
                        <div className="rounded-lg border border-border p-4" aria-label="Riwayat Status Exchange">
                            <div className="mb-3 text-xs font-semibold text-text-subtle">Riwayat Status</div>
                            <div className="space-y-3">
                                {exchange.status_histories.map((h: any, i: number) => {
                                    const isLast = i === exchange.status_histories.length - 1;
                                    const histStatus = getExchangeStatus(h.to_status);

                                    return (
                                        <div key={i} className="flex items-start gap-2.5">
                                            <div className="flex flex-col items-center">
                                                <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${isLast ? 'bg-primary' : 'bg-border'}`} />
                                                {i < exchange.status_histories.length - 1 && <div className="w-px h-4 bg-border mt-1" />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5">
                                                    <StatusBadge variant={histStatus.variant} size="sm">{histStatus.label}</StatusBadge>
                                                </div>
                                                <div className="mt-0.5 text-xs text-text-muted">
                                                    {h.actor?.name} &middot; {formatDate(h.created_at)}
                                                </div>
                                                {h.notes && <div className="mt-0.5 text-xs text-text-muted">{h.notes}</div>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Approve Dialog */}
            <Dialog open={showApprove} onOpenChange={setShowApprove}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Setujui Tukar Produk</DialogTitle>
                        <DialogDescription>Berikan catatan untuk persetujuan ini (opsional).</DialogDescription>
                    </DialogHeader>
                    <Textarea
                        value={approveForm.data.notes}
                        onChange={(e) => approveForm.setData('notes', e.target.value)}
                        placeholder="Catatan (opsional)"
                        rows={3}
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowApprove(false)}>Batal</Button>
                        <Button onClick={handleApprove} disabled={approveForm.processing}>
                            {approveForm.processing ? 'Memproses...' : 'Setujui'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject Dialog */}
            <Dialog open={showReject} onOpenChange={setShowReject}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Tolak Tukar Produk</DialogTitle>
                        <DialogDescription>Berikan alasan penolakan tukar produk ini.</DialogDescription>
                    </DialogHeader>
                    <Textarea
                        value={rejectForm.data.reason}
                        onChange={(e) => rejectForm.setData('reason', e.target.value)}
                        placeholder="Alasan penolakan"
                        rows={3}
                    />
                    {rejectForm.errors.reason && <div className="text-xs text-red-600">{rejectForm.errors.reason}</div>}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowReject(false)}>Batal</Button>
                        <Button variant="destructive" onClick={handleReject} disabled={rejectForm.processing}>
                            {rejectForm.processing ? 'Memproses...' : 'Tolak'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Complete Dialog */}
            <Dialog open={showComplete} onOpenChange={setShowComplete}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Selesaikan Tukar Produk</DialogTitle>
                        <DialogDescription>
                            Tandai exchange ini selesai setelah outlet mengonfirmasi produk pengganti diterima.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowComplete(false)}>Batal</Button>
                        <Button onClick={() => router.post(`/owner/exchanges/${exchange.id}/complete`, {}, { onSuccess: () => setShowComplete(false) })}>
                            Selesai
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </OwnerPageShell>
    );
}
