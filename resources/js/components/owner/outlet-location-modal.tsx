import { useForm } from '@inertiajs/react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { reverseGeocode } from '@/lib/geocoding';

const OutletLocationMap = lazy(() => import('./outlet-location-map'));

interface Props {
    outlet: any;
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function OutletLocationModal({ outlet, open, onClose, onSuccess }: Props) {
    const { data, setData, patch, processing, errors, reset } = useForm({
        latitude: outlet.latitude ?? '',
        longitude: outlet.longitude ?? '',
        kelurahan: outlet.kelurahan ?? '',
        kecamatan: outlet.kecamatan ?? '',
        city: outlet.city ?? '',
        province: outlet.province ?? '',
        postal_code: outlet.postal_code ?? '',
        address: outlet.address ?? '',
    });

    const [geoLoading, setGeoLoading] = useState(false);
    const mapKeyRef = useRef(0);

    useEffect(() => {
        if (!open) {
            reset();
        } else {
            mapKeyRef.current += 1;
        }
    }, [open]);

    const location = (() => {
        const lat = Number(data.latitude);
        const lng = Number(data.longitude);
        return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    })();

    const setLocation = async (point: { lat: number; lng: number }) => {
        setData((prev) => ({
            ...prev,
            latitude: String(point.lat.toFixed(7)),
            longitude: String(point.lng.toFixed(7)),
        }));
        setGeoLoading(true);
        try {
            const result = await reverseGeocode(point.lat, point.lng);
            setData((prev) => ({
                ...prev,
                kelurahan: result.kelurahan || prev.kelurahan,
                kecamatan: result.kecamatan || prev.kecamatan,
                city: result.city || prev.city,
                province: result.province || prev.province,
                postal_code: result.postal_code || prev.postal_code,
            }));
        } catch { /* ignore */ }
        setGeoLoading(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        patch(`/owner/outlets/${outlet.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Lokasi outlet diperbarui');
                onSuccess();
                onClose();
            },
            onError: (errs) => toast.error(Object.values(errs).flat().join(', ')),
        });
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="z-[2000] max-w-2xl" overlayClassName="z-[1999]">
                <DialogHeader>
                    <DialogTitle>Edit Lokasi Outlet</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Suspense fallback={<div className="flex h-[300px] items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-500">Loading peta...</div>}>
                        <OutletLocationMap
                            key={mapKeyRef.current}
                            value={location}
                            onChange={setLocation}
                        />
                    </Suspense>
                    {(errors.latitude || errors.longitude) && (
                        <p className="text-xs font-semibold text-red-600">Pilih lokasi pada peta.</p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <InfoBadge label="Kelurahan" value={data.kelurahan} loading={geoLoading} />
                        <InfoBadge label="Kecamatan" value={data.kecamatan} loading={geoLoading} />
                        <InfoBadge label="Kota" value={data.city} loading={geoLoading} />
                        <InfoBadge label="Provinsi" value={data.province} loading={geoLoading} />
                        <InfoBadge label="Kode Pos" value={data.postal_code} loading={geoLoading} className="col-span-2" />
                    </div>
                    <div>
                        <label className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Alamat Detail</label>
                        <textarea
                            value={data.address}
                            onChange={(e) => setData('address', e.target.value)}
                            rows={2}
                            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        />
                        {errors.address && <span className="text-xs font-semibold text-red-600">{errors.address}</span>}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" type="button" onClick={onClose}>Batal</Button>
                        <Button variant="primary" type="submit" disabled={processing}>
                            {processing ? 'Menyimpan...' : 'Simpan'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function InfoBadge({ label, value, loading, className = '' }: { label: string; value?: string; loading?: boolean; className?: string }) {
    return (
        <div className={`rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 ${className}`}>
            <div className="text-xs font-bold tracking-wider text-slate-400 uppercase">{label}</div>
            <div className={`mt-0.5 text-sm font-medium ${loading ? 'text-slate-400' : 'text-slate-900'}`}>
                {loading ? 'Mendeteksi...' : value || '-'}
            </div>
        </div>
    );
}
