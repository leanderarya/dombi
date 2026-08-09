import { useForm } from '@inertiajs/react';
import { lazy, Suspense, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    closeOutletLocationModal,
    createOutletLocationFormDefaults,
} from './outlet-modal-reset';

const OutletLocationMap = lazy(() => import('./outlet-location-map'));

interface Props {
    outlet: any;
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function OutletLocationModal({
    outlet,
    open,
    onClose,
    onSuccess,
}: Props) {
    const { data, setData, patch, processing, errors, reset } = useForm(
        createOutletLocationFormDefaults(outlet),
    );

    const [geo, setGeo] = useState<{ loading: boolean; failed: boolean }>({
        loading: false,
        failed: false,
    });
    const closeModal = () =>
        closeOutletLocationModal({ resetForm: reset, onClose });

    const location = (() => {
        const lat = Number(data.latitude);
        const lng = Number(data.longitude);

        return Number.isFinite(lat) && Number.isFinite(lng)
            ? { lat, lng }
            : null;
    })();

    const setLocation = (change: {
        lat: number;
        lng: number;
        geo: { loading: boolean; failed: boolean; address: any };
    }) => {
        setData((prev) => ({
            ...prev,
            latitude: change.lat.toFixed(7),
            longitude: change.lng.toFixed(7),
            kelurahan: change.geo.address?.kelurahan || prev.kelurahan,
            kecamatan: change.geo.address?.kecamatan || prev.kecamatan,
            city: change.geo.address?.city || prev.city,
            province: change.geo.address?.province || prev.province,
            postal_code: change.geo.address?.postal_code || prev.postal_code,
        }));
        setGeo({ loading: change.geo.loading, failed: change.geo.failed });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        patch(`/owner/outlets/${outlet.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Lokasi outlet diperbarui');
                onSuccess();
                closeModal();
            },
            onError: (errs) =>
                toast.error(Object.values(errs).flat().join(', ')),
        });
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && closeModal()}>
            <DialogContent
                className="z-[2000] max-w-2xl"
                overlayClassName="z-[1999]"
            >
                <DialogHeader>
                    <DialogTitle>Edit Lokasi Outlet</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Suspense
                        fallback={
                            <div className="flex h-[300px] items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-500">
                                Loading peta...
                            </div>
                        }
                    >
                        <OutletLocationMap
                            key={`${outlet.id}-${open ? 'open' : 'closed'}`}
                            value={location}
                            onChange={setLocation}
                        />
                    </Suspense>
                    {(errors.latitude || errors.longitude || geo.failed) && (
                        <p className="text-xs font-semibold text-red-600">
                            {geo.failed
                                ? 'Gagal mendeteksi wilayah. Geser marker atau coba lagi. Anda bisa isi manual.'
                                : 'Pilih lokasi pada peta.'}
                        </p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <InfoBadge
                            label="Kelurahan"
                            value={data.kelurahan}
                            loading={geo.loading}
                        />
                        <InfoBadge
                            label="Kecamatan"
                            value={data.kecamatan}
                            loading={geo.loading}
                        />
                        <InfoBadge
                            label="Kota"
                            value={data.city}
                            loading={geo.loading}
                        />
                        <InfoBadge
                            label="Provinsi"
                            value={data.province}
                            loading={geo.loading}
                        />
                        <InfoBadge
                            label="Kode Pos"
                            value={data.postal_code}
                            loading={geo.loading}
                            className="col-span-2"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                            Alamat Detail
                        </label>
                        <textarea
                            value={data.address}
                            onChange={(e) => setData('address', e.target.value)}
                            rows={2}
                            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        />
                        {errors.address && (
                            <span className="text-xs font-semibold text-red-600">
                                {errors.address}
                            </span>
                        )}
                    </div>
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

function InfoBadge({
    label,
    value,
    loading,
    className = '',
}: {
    label: string;
    value?: string;
    loading?: boolean;
    className?: string;
}) {
    return (
        <div
            className={`rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 ${className}`}
        >
            <div className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                {label}
            </div>
            <div
                className={`mt-0.5 text-sm font-medium ${loading ? 'text-slate-400' : 'text-slate-900'}`}
            >
                {loading ? 'Mendeteksi...' : value || '-'}
            </div>
        </div>
    );
}
