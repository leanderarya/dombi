import { router } from '@inertiajs/react';
import DistributionStatusBadge from '@/components/distribution-status-badge';
import OwnerPageShell from '@/components/owner/owner-page-shell';

export default function OwnerDistributionShow({ distribution }: any) {
    return (
        <OwnerPageShell title={`Distribution #${distribution.id}`} subtitle={distribution.outlet.name} backHref="/owner/distributions">
            <div className="flex items-center justify-between">
                <DistributionStatusBadge status={distribution.status} />
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
                <section className="rounded-lg border bg-white p-5">
                    <h2 className="font-semibold">Item</h2>
                    <div className="mt-3 space-y-3">
                        {distribution.items.map((item: any) => (
                            <div key={item.id} className="flex justify-between border-t pt-3 text-sm">
                                <span>{item.product.name}</span>
                                <span>{item.quantity}</span>
                            </div>
                        ))}
                    </div>
                </section>
                <aside className="rounded-lg border bg-white p-5 text-sm">
                    <h2 className="font-semibold">Status</h2>
                    <div className="mt-3">
                        Dikirim: {distribution.sent_at ? new Date(distribution.sent_at).toLocaleString('id-ID') : '-'}
                    </div>
                    <div>
                        Diterima: {distribution.received_at ? new Date(distribution.received_at).toLocaleString('id-ID') : '-'}
                    </div>
                    {distribution.status === 'preparing' && (
                        <button
                            onClick={() => router.post(`/owner/distributions/${distribution.id}/mark-shipped`)}
                            className="mt-5 w-full rounded-md bg-emerald-700 px-4 py-2 font-medium text-white"
                        >
                            Tandai Dikirim
                        </button>
                    )}
                </aside>
            </div>
        </OwnerPageShell>
    );
}
