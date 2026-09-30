import { useForm } from '@inertiajs/react';
import OutletFormSheet from '@/components/owner/outlet-form-sheet';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

const emptyOutletForm = {
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

type ExistingOutlet = {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    address?: string;
};

interface Props {
    open: boolean;
    onClose: () => void;
    existingOutlets: ExistingOutlet[];
}

export default function TambahOutletDialog({
    open,
    onClose,
    existingOutlets,
}: Props) {
    const form = useForm({ ...emptyOutletForm });

    const close = () => {
        form.clearErrors();
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && close()}>
            <DialogContent className="max-w-5xl">
                <DialogHeader>
                    <DialogTitle>Tambah Outlet</DialogTitle>
                    <DialogDescription>
                        Pilih lokasi pada peta, lalu isi informasi outlet.
                    </DialogDescription>
                </DialogHeader>
                <OutletFormSheet
                    mode="create"
                    form={form}
                    onCancel={close}
                    existingOutlets={existingOutlets}
                    submit={(event) => {
                        event.preventDefault();
                        form.post('/owner/outlets', {
                            onSuccess: () => {
                                form.reset();
                                onClose();
                            },
                        });
                    }}
                />
            </DialogContent>
        </Dialog>
    );
}
