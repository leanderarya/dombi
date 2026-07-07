import { Link, useForm } from '@inertiajs/react';
import OutletFormSheet from '@/components/owner/outlet-form-sheet';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { emptyOutletForm } from './create';

export default function EditOutlet({ outlet, existingOutlets }: any) {
    const form = useForm({
        ...emptyOutletForm,
        name: outlet.name ?? '',
        kelurahan: outlet.kelurahan ?? '',
        kecamatan: outlet.kecamatan ?? '',
        city: outlet.city ?? '',
        province: outlet.province ?? '',
        postal_code: outlet.postal_code ?? '',
        address: outlet.address ?? '',
        latitude: outlet.latitude ?? '',
        longitude: outlet.longitude ?? '',
        phone: outlet.phone ?? '',
        operational_notes: outlet.operational_notes ?? '',
        delivery_radius_km: outlet.delivery_radius_km ?? '',
        prep_estimate_minutes: outlet.prep_estimate_minutes ?? '',
        status: outlet.status ?? 'active',
    });

    return (
        <OwnerPageShell title="Edit Outlet" subtitle={outlet.name} backHref="/owner/outlets">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_280px]">
                <div className="min-w-0">
                    <OutletFormSheet
                        mode="edit"
                        outlet={outlet}
                        form={form}
                        existingOutlets={existingOutlets ?? []}
                        submit={(event) => {
                            event.preventDefault();
                            form.put(`/owner/outlets/${outlet.id}`);
                        }}
                    />
                </div>

                {/* Desktop Sidebar: Outlet Info & Tips */}
                <aside className="hidden xl:block">
                    <div className="sticky top-4 space-y-4">
                        {/* Current Info */}
                        <div className="rounded-lg border border-border bg-white p-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-text-subtle">Info Saat Ini</h3>
                            <div className="mt-3 space-y-2.5">
                                <InfoRow label="Nama" value={outlet.name ?? '-'} />
                                <InfoRow label="Telepon" value={outlet.phone ?? '-'} />
                                <InfoRow
                                    label="Lokasi"
                                    value={
                                        outlet.kelurahan
                                            ? `${outlet.kelurahan}, ${outlet.kecamatan}`
                                            : '-'
                                    }
                                />
                                <InfoRow
                                    label="Status"
                                    value={outlet.status === 'active' ? 'Aktif' : 'Nonaktif'}
                                    highlight={outlet.status === 'active'}
                                />
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </OwnerPageShell>
    );
}

function InfoRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
    return (
        <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-subtle">{label}</span>
            <span className={`text-xs font-medium ${highlight ? 'text-emerald-600' : 'text-text'}`}>{value}</span>
        </div>
    );
}
