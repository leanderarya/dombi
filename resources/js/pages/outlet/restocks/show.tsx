import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import SectionCard from '@/components/ui/section-card';
import StatusBadge from '@/components/ui/status-badge';
import StickyActionBar from '@/components/ui/sticky-action-bar';
import OutletLayout from '@/layouts/outlet-layout';

export default function OutletRestockShow({ restock }: any) {
    const canConfirmReceived = restock.status === 'shipped';
    const [showForm, setShowForm] = useState(false);
    const [receivedNotes, setReceivedNotes] = useState('');
    const [damageNotes, setDamageNotes] = useState('');
    const [showCancelDialog, setShowCancelDialog] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    const handleConfirmReceived = () => {
        router.post(`/outlet/restocks/${restock.id}/confirm-received`, {
            received_notes: receivedNotes || null,
            damage_notes: damageNotes || null,
        });
    };

    const handleCancel = () => {
        setCancelling(true);
        router.post(
            `/outlet/restocks/${restock.id}/cancel`,
            {},
            {
                onFinish: () => {
                    setCancelling(false);
                    setShowCancelDialog(false);
                },
            },
        );
    };

    return (
        <OutletLayout
            title={`Restock #${restock.id}`}
            backHref="/outlet/restocks"
            actionBarSlot={
                canConfirmReceived ? (
                    <StickyActionBar
                        actions={[
                            showForm
                                ? {
                                      label: 'Konfirmasi Diterima',
                                      variant: 'primary',
                                      onClick: handleConfirmReceived,
                                  }
                                : {
                                      label: 'Konfirmasi Diterima',
                                      variant: 'primary',
                                      onClick: () => setShowForm(true),
                                  },
                        ]}
                    />
                ) : undefined
            }
        >
            <Head title={`Restock #${restock.id}`} />

            {/* Status + Cancel */}
            <div className="mt-4 mb-4 flex items-center justify-between">
                <div />
                <div className="flex items-center gap-2">
                    <StatusBadge status={restock.status} />
                    {restock.status === 'requested' && (
                        <button
                            onClick={() => setShowCancelDialog(true)}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                            Batalkan
                        </button>
                    )}
                </div>
            </div>

            {/* Items */}
            <SectionCard label="Item Restock">
                <div className="mt-2 space-y-2">
                    {restock.items.map((item: any) => (
                        <div
                            key={item.id}
                            className="flex justify-between text-sm"
                        >
                            <span className="font-medium">
                                {item.product?.name ??
                                    item.variant?.name ??
                                    '-'}
                            </span>
                            <span className="text-text-muted">
                                Diminta: {item.requested_quantity} / Disetujui:{' '}
                                {item.approved_quantity ?? '-'}
                            </span>
                        </div>
                    ))}
                </div>
            </SectionCard>

            {/* Notes */}
            <SectionCard label="Catatan">
                <div className="mt-2 space-y-2 text-sm">
                    <div>
                        <span className="text-text-muted">Catatan Outlet:</span>
                        <span className="ml-2 text-text">
                            {restock.notes ?? '-'}
                        </span>
                    </div>
                    <div>
                        <span className="text-text-muted">Catatan Owner:</span>
                        <span className="ml-2 text-text">
                            {restock.owner_notes ?? '-'}
                        </span>
                    </div>
                </div>
                {restock.rejected_reason && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-surface-muted p-3">
                        <StatusBadge variant="danger" size="sm">
                            Ditolak
                        </StatusBadge>
                        <span className="text-sm text-text">
                            {restock.rejected_reason}
                        </span>
                    </div>
                )}
            </SectionCard>

            {/* Received Info */}
            {(restock.received_notes || restock.damage_notes) && (
                <SectionCard label="Info Penerimaan">
                    {restock.received_notes && (
                        <div className="mt-2">
                            <span className="text-sm text-text-muted">
                                Catatan Penerimaan:
                            </span>
                            <p className="mt-1 text-sm text-text">
                                {restock.received_notes}
                            </p>
                        </div>
                    )}
                    {restock.damage_notes && (
                        <div className="mt-2">
                            <span className="text-sm text-text-muted">
                                Catatan Kerusakan:
                            </span>
                            <p className="mt-1 text-sm text-text">
                                {restock.damage_notes}
                            </p>
                        </div>
                    )}
                </SectionCard>
            )}

            {/* Notes form and Confirm Received */}
            {canConfirmReceived && showForm && (
                <SectionCard label="Catatan Penerimaan">
                    <div className="mt-2 space-y-3">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-text">
                                Catatan Penerimaan
                            </label>
                            <textarea
                                value={receivedNotes}
                                onChange={(e) =>
                                    setReceivedNotes(e.target.value)
                                }
                                placeholder="Opsional: kondisi barang saat diterima"
                                maxLength={500}
                                rows={2}
                                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-text">
                                Catatan Kerusakan
                            </label>
                            <textarea
                                value={damageNotes}
                                onChange={(e) => setDamageNotes(e.target.value)}
                                placeholder="Opsional: catatan jika ada kerusakan"
                                maxLength={500}
                                rows={2}
                                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                            />
                        </div>
                    </div>
                </SectionCard>
            )}

            {/* Cancel Confirmation Dialog */}
            {showCancelDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/40"
                        onClick={() => setShowCancelDialog(false)}
                    />
                    <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
                        <h3 className="text-lg font-bold text-text">
                            Batalkan Request?
                        </h3>
                        <p className="mt-2 text-sm text-text-muted">
                            Request restock #{restock.id} akan dibatalkan.
                            Tindakan ini tidak dapat diurungkan.
                        </p>
                        <div className="mt-6 flex gap-2">
                            <button
                                type="button"
                                onClick={() => setShowCancelDialog(false)}
                                className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-text hover:bg-surface-muted"
                            >
                                Kembali
                            </button>
                            <button
                                type="button"
                                onClick={handleCancel}
                                disabled={cancelling}
                                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                            >
                                {cancelling ? 'Membatalkan...' : 'Ya, Batalkan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </OutletLayout>
    );
}
