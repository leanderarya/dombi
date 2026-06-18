import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import DistributionStatusBadge from '@/components/distribution-status-badge';
import RestockStatusBadge from '@/components/restock-status-badge';
import SectionCard from '@/components/ui/section-card';
import StatusBadge from '@/components/ui/status-badge';
import StickyActionBar from '@/components/ui/sticky-action-bar';
import OutletLayout from '@/layouts/outlet-layout';

export default function OutletRestockShow({ restock }: any) {
    const canConfirmReceived = restock.distribution?.status === 'shipped';
    const [showForm, setShowForm] = useState(false);
    const [receivedNotes, setReceivedNotes] = useState('');
    const [damageNotes, setDamageNotes] = useState('');

    const handleConfirmReceived = () => {
        router.post(`/outlet/distributions/${restock.distribution.id}/confirm-received`, {
            received_notes: receivedNotes || null,
            damage_notes: damageNotes || null,
        });
    };

    return (
        <OutletLayout title={`Restock #${restock.id}`} backHref="/outlet/restocks" hideNav>
            <Head title={`Restock #${restock.id}`} />

            {/* Status */}
            <div className="mb-4 flex items-center justify-between">
                <div />
                <RestockStatusBadge status={restock.status} />
            </div>

            {/* Items */}
            <SectionCard label="Item Restock" className="mb-4">
                <div className="mt-2 space-y-2">
                    {restock.items.map((item: any) => (
                        <div key={item.id} className="flex justify-between text-sm">
                            <span className="font-medium">{item.product.name}</span>
                            <span className="text-slate-600">Diminta: {item.requested_quantity} / Disetujui: {item.approved_quantity ?? '-'}</span>
                        </div>
                    ))}
                </div>
            </SectionCard>

            {/* Notes */}
            <SectionCard label="Catatan" className="mb-4">
                <div className="mt-2 space-y-2 text-sm">
                    <div>
                        <span className="text-slate-500">Catatan Outlet:</span>
                        <span className="ml-2 text-slate-700">{restock.notes ?? '-'}</span>
                    </div>
                    <div>
                        <span className="text-slate-500">Catatan Owner:</span>
                        <span className="ml-2 text-slate-700">{restock.owner_notes ?? '-'}</span>
                    </div>
                </div>
                {restock.rejected_reason && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                        <StatusBadge variant="danger" size="sm">Ditolak</StatusBadge>
                        <span className="text-sm text-slate-700">{restock.rejected_reason}</span>
                    </div>
                )}
            </SectionCard>

            {/* Distribution */}
            {restock.distribution && (
                <SectionCard label="Distribusi" className="mb-4">
                    <div className="mt-2">
                        <DistributionStatusBadge status={restock.distribution.status} />
                    </div>
                    {restock.distribution.received_notes && (
                        <div className="mt-3">
                            <span className="text-sm text-slate-500">Catatan Penerimaan:</span>
                            <p className="mt-1 text-sm text-slate-700">{restock.distribution.received_notes}</p>
                        </div>
                    )}
                    {restock.distribution.damage_notes && (
                        <div className="mt-2">
                            <span className="text-sm text-slate-500">Catatan Kerusakan:</span>
                            <p className="mt-1 text-sm text-slate-700">{restock.distribution.damage_notes}</p>
                        </div>
                    )}
                </SectionCard>
            )}

            {/* Notes form and Confirm Received */}
            {canConfirmReceived && showForm && (
                <SectionCard label="Catatan Penerimaan" className="mb-4">
                    <div className="mt-2 space-y-3">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">Catatan Penerimaan</label>
                            <textarea
                                value={receivedNotes}
                                onChange={(e) => setReceivedNotes(e.target.value)}
                                placeholder="Opsional: kondisi barang saat diterima"
                                maxLength={500}
                                rows={2}
                                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">Catatan Kerusakan</label>
                            <textarea
                                value={damageNotes}
                                onChange={(e) => setDamageNotes(e.target.value)}
                                placeholder="Opsional: catatan jika ada kerusakan"
                                maxLength={500}
                                rows={2}
                                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                            />
                        </div>
                    </div>
                </SectionCard>
            )}
            {canConfirmReceived && (
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
            )}
            {canConfirmReceived && <div className="h-20" />}
        </OutletLayout>
    );
}
