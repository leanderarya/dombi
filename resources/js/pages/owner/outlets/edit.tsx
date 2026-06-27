import { Link, useForm } from '@inertiajs/react';
import { MapPin, Clock, Truck, Package } from 'lucide-react';
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
                        <div className="rounded-xl border border-border bg-white p-4">
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

                        {/* Tips */}
                        <div className="rounded-xl border border-border bg-white p-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-text-subtle">Tips Edit</h3>
                            <ul className="mt-3 space-y-3">
                                <TipItem
                                    icon={<MapPin className="h-4 w-4 text-emerald-500" />}
                                    title="Geser Marker"
                                    desc="Geser marker di peta untuk memperbarui lokasi dan data wilayah."
                                />
                                <TipItem
                                    icon={<Clock className="h-4 w-4 text-blue-500" />}
                                    title="Radius & Estimasi"
                                    desc="Atur radius pengiriman dan estimasi persiapan di bagian Catatan Internal."
                                />
                                <TipItem
                                    icon={<Truck className="h-4 w-4 text-amber-500" />}
                                    title="Status Outlet"
                                    desc="Nonaktifkan outlet untuk berhenti menerima pesanan sementara."
                                />
                            </ul>
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
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle">{label}</span>
            <span className={`text-xs font-medium ${highlight ? 'text-emerald-600' : 'text-text'}`}>{value}</span>
        </div>
    );
}

function TipItem({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
    return (
        <li className="flex items-start gap-2.5">
            <div className="mt-0.5 shrink-0">{icon}</div>
            <div>
                <div className="text-xs font-semibold text-text">{title}</div>
                <div className="mt-0.5 text-[11px] leading-relaxed text-text-muted">{desc}</div>
            </div>
        </li>
    );
}
