import { useForm } from '@inertiajs/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

interface Props {
    outlet: any;
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function OutletStatusModal({
    outlet,
    open,
    onClose,
    onSuccess,
}: Props) {
    const { data, setData, patch, processing, errors, reset } = useForm({
        status: outlet.status ?? 'active',
        delivery_radius_km: outlet.delivery_radius_km ?? '',
        prep_estimate_minutes: outlet.prep_estimate_minutes ?? '',
    });

    const closeModal = () => {
        reset();
        onClose();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        patch(`/owner/outlets/${outlet.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Status & area layanan diperbarui');
                onSuccess();
                closeModal();
            },
            onError: (errs) =>
                toast.error(Object.values(errs).flat().join(', ')),
        });
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && closeModal()}>
            <DialogContent className="z-[2000]" overlayClassName="z-[1999]">
                <DialogHeader>
                    <DialogTitle>Edit Status & Area Layanan</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-3">
                    <Select
                        label="Status"
                        value={data.status}
                        onChange={(e) => setData('status', e.target.value)}
                        options={[
                            { value: 'active', label: 'Aktif' },
                            { value: 'inactive', label: 'Nonaktif' },
                            {
                                value: 'temporarily_closed',
                                label: 'Tutup Sementara',
                            },
                        ]}
                        error={errors.status}
                    />
                    <Input
                        label="Radius Pengiriman (km)"
                        type="number"
                        value={data.delivery_radius_km}
                        onChange={(e) =>
                            setData('delivery_radius_km', e.target.value)
                        }
                        error={errors.delivery_radius_km}
                    />
                    <Input
                        label="Estimasi Persiapan (menit)"
                        type="number"
                        value={data.prep_estimate_minutes}
                        onChange={(e) =>
                            setData('prep_estimate_minutes', e.target.value)
                        }
                        error={errors.prep_estimate_minutes}
                    />
                    <DialogFooter>
                        <Button
                            variant="outline"
                            type="button"
                            onClick={closeModal}
                        >
                            Batal
                        </Button>
                        <Button
                            variant="primary"
                            type="submit"
                            disabled={processing}
                        >
                            {processing ? 'Menyimpan...' : 'Simpan'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
