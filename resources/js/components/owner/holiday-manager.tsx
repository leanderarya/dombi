import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { formatDate } from '@/lib/format';
import { toastMutation } from '@/lib/toast-mutation';

interface Holiday {
    id: number;
    start_date: string;
    end_date: string;
    reason: string | null;
}

interface Props {
    outletId: number;
    initialHolidays: Holiday[];
}

export default function HolidayManager({ outletId, initialHolidays }: Props) {
    const [holidays, setHolidays] = useState(initialHolidays);
    const [showForm, setShowForm] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAdd = async () => {
        if (!startDate || !endDate) {
            return;
        }

        setError(null);
        setSaving(true);
        await toastMutation(
            async () => {
                const res = await fetch(`/owner/outlets/${outletId}/holidays`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-CSRF-TOKEN':
                            document
                                .querySelector('meta[name="csrf-token"]')
                                ?.getAttribute('content') ?? '',
                    },
                    body: JSON.stringify({
                        start_date: startDate,
                        end_date: endDate,
                        reason: reason || null,
                    }),
                });
                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error ?? 'Gagal menambah hari libur.');
                }

                return data;
            },
            {
                loading: 'Menambah hari libur...',
                success: 'Hari libur ditambahkan',
                error: 'Gagal menambah hari libur',
            },
        );
        setHolidays((prev) => [/* refresh by reloading */ ...prev]);
        setStartDate('');
        setEndDate('');
        setReason('');
        setShowForm(false);
        setSaving(false);
    };

    const handleDelete = async (holidayId: number) => {
        await toastMutation(
            async () => {
                const res = await fetch(
                    `/owner/outlets/${outletId}/holidays/${holidayId}`,
                    {
                        method: 'DELETE',
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest',
                            'X-CSRF-TOKEN':
                                document
                                    .querySelector('meta[name="csrf-token"]')
                                    ?.getAttribute('content') ?? '',
                        },
                    },
                );

                if (!res.ok) {
                    throw new Error('Gagal menghapus.');
                }
            },
            {
                success: 'Hari libur dihapus',
                error: 'Gagal menghapus hari libur',
            },
        );
        setHolidays((prev) => prev.filter((h) => h.id !== holidayId));
    };

    return (
        <div className="space-y-3">
            {holidays.length === 0 && !showForm && (
                <p className="text-xs text-text-subtle">
                    Tidak ada hari libur terjadwal.
                </p>
            )}

            {holidays.map((h) => (
                <div
                    key={h.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface-muted px-3 py-2"
                >
                    <div>
                        <div className="text-sm font-medium text-text">
                            {formatDate(h.start_date)}
                            {h.start_date !== h.end_date &&
                                ` - ${formatDate(h.end_date)}`}
                        </div>
                        {h.reason && (
                            <div className="text-xs text-text-muted">
                                {h.reason}
                            </div>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => handleDelete(h.id)}
                        className="rounded-lg p-1.5 text-text-subtle hover:bg-danger-bg hover:text-danger-text"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            ))}

            {showForm ? (
                <div className="space-y-2 rounded-lg border border-success-border bg-success-bg/50 p-3">
                    <div className="grid grid-cols-2 gap-2">
                        <label className="block">
                            <span className="text-xs font-semibold text-text-muted uppercase">
                                Mulai
                            </span>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="mt-1"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-semibold text-text-muted uppercase">
                                Selesai
                            </span>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="mt-1"
                            />
                        </label>
                    </div>
                    <label className="block">
                        <span className="text-xs font-semibold text-text-muted uppercase">
                            Alasan
                        </span>
                        <input
                            type="text"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Libur Lebaran, Renovasi, dll."
                            className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm"
                        />
                    </label>
                    {error && (
                        <p className="text-xs font-medium text-danger">
                            {error}
                        </p>
                    )}
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handleAdd}
                            disabled={saving || !startDate || !endDate}
                            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                        >
                            {saving ? 'Menyimpan...' : 'Tambah'}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setShowForm(false);
                                setError(null);
                            }}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-text-muted"
                        >
                            Batal
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-dashed border-border-strong px-3 py-2 text-xs font-semibold text-text-muted hover:border-success-border hover:text-success-text"
                >
                    <Plus className="h-3.5 w-3.5" />
                    Tambah Hari Libur
                </button>
            )}
        </div>
    );
}
