import { useForm } from '@inertiajs/react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import OutletFormSheet from '@/components/owner/outlet-form-sheet';
import { emptyOutletForm } from './create';

export default function EditOutlet({ outlet }: any) {
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
            <OutletFormSheet
                mode="edit"
                outlet={outlet}
                form={form}
                submit={(event) => {
                    event.preventDefault();
                    form.put(`/owner/outlets/${outlet.id}`);
                }}
            />
        </OwnerPageShell>
    );
}
