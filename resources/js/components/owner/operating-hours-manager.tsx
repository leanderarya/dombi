import { Clock, Save } from 'lucide-react';
import { useState } from 'react';

interface HoursData {
    day_of_week: number;
    open_time: string;
    close_time: string;
    is_closed: boolean;
}

interface Props {
    outletId: number;
    initialHours: HoursData[];
}

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const DEFAULT_HOURS: HoursData[] = Array.from({ length: 7 }, (_, i) => ({
    day_of_week: i,
    open_time: '08:00',
    close_time: '21:00',
    is_closed: false,
}));

export default function OperatingHoursManager({ outletId, initialHours }: Props) {
    const [hours, setHours] = useState<HoursData[]>(() => {
        if (initialHours.length === 0) {
return DEFAULT_HOURS;
}

        const map = new Map(initialHours.map((h) => [h.day_of_week, h]));

        return DEFAULT_HOURS.map((d) => map.get(d.day_of_week) ?? d);
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    const updateDay = (index: number, field: keyof HoursData, value: any) => {
        setHours((prev) => prev.map((h, i) => i === index ? { ...h, [field]: value } : h));
        setSaved(false);
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);

        try {
            const res = await fetch(`/owner/outlets/${outletId}/operating-hours`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '',
                },
                body: JSON.stringify({ hours }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error ?? 'Gagal menyimpan.');
            } else {
                setSaved(true);
            }
        } catch {
            setError('Gagal menyimpan. Periksa koneksi Anda.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-3">
            {hours.map((h, index) => (
                <div key={h.day_of_week} className="flex items-center gap-3">
                    <span className="w-16 text-sm font-medium text-slate-700">{DAY_NAMES[h.day_of_week]}</span>
                    <label className="flex items-center gap-1.5">
                        <input
                            type="checkbox"
                            checked={!h.is_closed}
                            onChange={(e) => updateDay(index, 'is_closed', !e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-xs text-slate-500">Buka</span>
                    </label>
                    {!h.is_closed && (
                        <>
                            <input
                                type="time"
                                value={h.open_time}
                                onChange={(e) => updateDay(index, 'open_time', e.target.value)}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                            />
                            <span className="text-xs text-slate-400">-</span>
                            <input
                                type="time"
                                value={h.close_time}
                                onChange={(e) => updateDay(index, 'close_time', e.target.value)}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                            />
                        </>
                    )}
                    {h.is_closed && (
                        <span className="text-xs text-slate-400">Tutup</span>
                    )}
                </div>
            ))}

            {error && <p className="text-xs font-medium text-red-600">{error}</p>}
            {saved && <p className="text-xs font-medium text-emerald-600">Tersimpan.</p>}

            <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="mt-2 flex min-h-[40px] items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
                <Save className="h-4 w-4" />
                {saving ? 'Menyimpan...' : 'Simpan Jam Operasional'}
            </button>
        </div>
    );
}
