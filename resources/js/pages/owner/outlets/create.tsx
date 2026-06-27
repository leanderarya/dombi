import { Link, useForm } from '@inertiajs/react';
import { MapPin, Phone, Store, Tag } from 'lucide-react';
import OutletFormSheet from '@/components/owner/outlet-form-sheet';
import OwnerPageShell from '@/components/owner/owner-page-shell';

export const emptyOutletForm = {
    name: '',
    kelurahan: '',
    kecamatan: '',
    city: '',
    province: '',
    postal_code: '',
    address: '',
    latitude: '',
    longitude: '',
    phone: '',
    operational_notes: '',
    delivery_radius_km: '',
    prep_estimate_minutes: '',
    status: 'active',
};

export default function CreateOutlet({ existingOutlets }: any) {
    const form = useForm(emptyOutletForm);

    return (
        <OwnerPageShell title="Tambah Outlet" backHref="/owner/outlets">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_280px]">
                <div className="min-w-0">
                    <OutletFormSheet
                        mode="create"
                        form={form}
                        existingOutlets={existingOutlets ?? []}
                        submit={(event) => {
                            event.preventDefault();
                            form.post('/owner/outlets');
                        }}
                    />
                </div>

                {/* Desktop Sidebar: Tips */}
                <aside className="hidden xl:block">
                    <div className="sticky top-4 space-y-4">
                        <div className="rounded-xl border border-border bg-white p-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-text-subtle">Panduan Pengisian</h3>
                            <ul className="mt-3 space-y-3">
                                <TipItem
                                    icon={<MapPin className="h-4 w-4 text-emerald-500" />}
                                    title="Lokasi di Peta"
                                    desc="Klik pada peta atau cari alamat. Data wilayah akan terisi otomatis."
                                />
                                <TipItem
                                    icon={<Store className="h-4 w-4 text-blue-500" />}
                                    title="Nama Outlet"
                                    desc="Gunakan nama yang mudah dikenali oleh kurir dan customer."
                                />
                                <TipItem
                                    icon={<Phone className="h-4 w-4 text-amber-500" />}
                                    title="Nomor Telepon"
                                    desc="Nomor yang bisa dihubungi untuk koordinasi operasional."
                                />
                                <TipItem
                                    icon={<Tag className="h-4 w-4 text-purple-500" />}
                                    title="Detail Alamat"
                                    desc="Tambahkan patokan lokasi agar kurir mudah menemukan outlet."
                                />
                            </ul>
                        </div>
                    </div>
                </aside>
            </div>
        </OwnerPageShell>
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
