import { Head, router } from '@inertiajs/react';
import DistributionStatusBadge from '@/components/distribution-status-badge';
import RestockStatusBadge from '@/components/restock-status-badge';
import StatusBadge from '@/components/ui/status-badge';
import SectionCard from '@/components/ui/section-card';
import StickyActionBar from '@/components/ui/sticky-action-bar';
import OutletLayout from '@/layouts/outlet-layout';

export default function OutletRestockShow({ restock }: any) {
    const canConfirmReceived = restock.distribution?.status === 'shipped';

    const handleConfirmReceived = () => {
        router.post(`/outlet/distributions/${restock.distribution.id}/confirm-received`);
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
                </SectionCard>
            )}

            {/* Sticky Confirm Received */}
            {canConfirmReceived && (
                <StickyActionBar
                    actions={[
                        {
                            label: 'Konfirmasi Diterima',
                            variant: 'primary',
                            onClick: handleConfirmReceived,
                        },
                    ]}
                />
            )}
            {canConfirmReceived && <div className="h-20" />}
        </OutletLayout>
    );
}
