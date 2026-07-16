import { useForm } from '@inertiajs/react';
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
        <OwnerPageShell
            title="Tambah Outlet"
            subtitle="Pilih lokasi pada peta, lalu isi informasi outlet"
            backHref="/owner/outlets"
        >
            <OutletFormSheet
                mode="create"
                form={form}
                existingOutlets={existingOutlets ?? []}
                submit={(event) => {
                    event.preventDefault();
                    form.post('/owner/outlets');
                }}
            />
        </OwnerPageShell>
    );
}
