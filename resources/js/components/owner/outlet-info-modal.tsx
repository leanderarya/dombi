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
import PhoneInput from '@/components/ui/phone-input';
import { Textarea } from '@/components/ui/textarea';
import {
    closeOutletInfoModal,
    createOutletInfoFormDefaults,
} from './outlet-modal-reset';

interface Props {
    outlet: any;
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function OutletInfoModal({
    outlet,
    open,
    onClose,
    onSuccess,
}: Props) {
    const { data, setData, patch, processing, errors, reset } = useForm(
        createOutletInfoFormDefaults(outlet),
    );

    const closeModal = () =>
        closeOutletInfoModal({ resetForm: reset, onClose });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        patch(`/owner/outlets/${outlet.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Informasi outlet diperbarui');
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
                    <DialogTitle>Edit Informasi Outlet</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-3">
                    <Input
                        label="Nama Outlet *"
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        error={errors.name}
                        required
                    />
                    <PhoneInput
                        label="Nomor Telepon"
                        value={data.phone}
                        onChange={(v) => setData('phone', v)}
                        error={errors.phone}
                    />
                    <Input
                        label="Nama PIC"
                        value={data.pic_name}
                        onChange={(e) => setData('pic_name', e.target.value)}
                        error={errors.pic_name}
                    />
                    <PhoneInput
                        label="No. HP PIC"
                        value={data.pic_phone}
                        onChange={(v) => setData('pic_phone', v)}
                        error={errors.pic_phone}
                    />
                    <Input
                        label="Jabatan PIC"
                        value={data.pic_position}
                        onChange={(e) =>
                            setData('pic_position', e.target.value)
                        }
                        error={errors.pic_position}
                    />
                    <Textarea
                        label="Catatan Operasional"
                        value={data.operational_notes}
                        onChange={(e) =>
                            setData('operational_notes', e.target.value)
                        }
                        error={errors.operational_notes}
                        rows={2}
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
