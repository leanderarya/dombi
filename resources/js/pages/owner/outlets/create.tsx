import { useForm } from '@inertiajs/react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import OutletFormSheet from '@/components/owner/outlet-form-sheet';

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

export default function CreateOutlet() {
    const form = useForm(emptyOutletForm);

    return (
        <OwnerPageShell title="Tambah Outlet" backHref="/owner/outlets">
            <OutletFormSheet
                mode="create"
                form={form}
                submit={(event) => {
                    event.preventDefault();
                    form.post('/owner/outlets');
                }}
            />
        </OwnerPageShell>
    );
}
