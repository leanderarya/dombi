import { useForm } from '@inertiajs/react';
import { Bike, Car } from 'lucide-react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const vehicleTypes = [
    { value: 'motorcycle', label: 'Motor', icon: Bike },
    { value: 'bicycle', label: 'Sepeda', icon: Bike },
    { value: 'car', label: 'Mobil', icon: Car },
] as const;

export default function CreateCourier() {
    const form = useForm({
        name: '',
        phone: '',
        vehicle_type: '' as '' | 'motorcycle' | 'bicycle' | 'car',
        vehicle_plate: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post('/owner/couriers');
    };

    return (
        <OwnerPageShell title="Tambah Kurir" backHref="/owner/couriers">
            <div className="mx-auto max-w-lg" aria-label="Form Tambah Kurir">
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Name */}
                    <Input
                        label="Nama Lengkap *"
                        type="text"
                        value={form.data.name}
                        onChange={(e) => form.setData('name', e.target.value)}
                        placeholder="Nama kurir"
                        error={form.errors.name}
                        required
                    />

                    {/* Phone */}
                    <div>
                        <Input
                            label="Nomor WhatsApp *"
                            type="tel"
                            value={form.data.phone}
                            onChange={(e) => form.setData('phone', e.target.value)}
                            placeholder="08xxxxxxxxxx"
                            error={form.errors.phone}
                            required
                        />
                        <p className="mt-1 text-xs text-text-muted">
                            Tautan undangan akan ditampilkan setelah kurir dibuat
                        </p>
                    </div>

                    {/* Vehicle Type */}
                    <div>
                        <label className="mb-1 block text-xs font-medium text-text-subtle">
                            Tipe Kendaraan
                        </label>
                        <div className="flex gap-2">
                            {vehicleTypes.map((vt) => {
                                const Icon = vt.icon;
                                const isSelected = form.data.vehicle_type === vt.value;

                                return (
                                    <button
                                        key={vt.value}
                                        type="button"
                                        onClick={() =>
                                            form.setData(
                                                'vehicle_type',
                                                isSelected ? '' : vt.value,
                                            )
                                        }
                                        className={cn(
                                            'flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-all',
                                            isSelected
                                                ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary/20'
                                                : 'border-border bg-white text-text-muted hover:bg-surface-muted',
                                        )}
                                    >
                                        <Icon className="h-4 w-4" aria-hidden="true" />
                                        {vt.label}
                                    </button>
                                );
                            })}
                        </div>
                        {form.errors.vehicle_type && (
                            <p className="mt-1 text-xs text-red-500">{form.errors.vehicle_type}</p>
                        )}
                    </div>

                    {/* Vehicle Plate */}
                    {form.data.vehicle_type && form.data.vehicle_type !== 'bicycle' && (
                        <Input
                            label="Plat Nomor"
                            type="text"
                            value={form.data.vehicle_plate}
                            onChange={(e) => form.setData('vehicle_plate', e.target.value)}
                            placeholder="AB 1234 CD"
                            error={form.errors.vehicle_plate}
                        />
                    )}

                    {/* Submit */}
                    <div className="flex items-center gap-3 pt-2">
                        <Button
                            type="submit"
                            loading={form.processing}
                            disabled={form.processing}
                        >
                            Tambah Kurir
                        </Button>
                        <a
                            href="/owner/couriers"
                            className="text-xs font-semibold text-text-muted hover:text-text"
                        >
                            Batal
                        </a>
                    </div>
                </form>
            </div>
        </OwnerPageShell>
    );
}
