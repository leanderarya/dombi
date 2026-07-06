import { Head, router } from '@inertiajs/react';
import { Receipt } from 'lucide-react';
import { useState } from 'react';
import OutletPageShell from '@/components/outlet/outlet-page-shell';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import Pagination from '@/components/ui/pagination';
import StatusBadge from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import OutletLayout from '@/layouts/outlet-layout';
import { formatCurrency, formatDate } from '@/lib/format';

interface Payment {
    id: number;
    reference_number: string;
    payment_date: string;
    amount: number;
    status: string;
    notes: string | null;
    proof_image: string | null;
    rejection_reason: string | null;
    verifier: { name: string } | null;
    verified_at: string | null;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface Props {
    payments: {
        data: Payment[];
        current_page: number;
        last_page: number;
        links?: PaginationLink[];
    };
}

export default function OutletSettlementPayments({ payments }: Props) {
    const [showForm, setShowForm] = useState(false);
    const [amount, setAmount] = useState('');
    const [referenceNumber, setReferenceNumber] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState('');
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setErrors({});

        const formData = new FormData();
        formData.append('amount', amount);
        formData.append('reference_number', referenceNumber);
        formData.append('payment_date', paymentDate);

        if (notes) {
            formData.append('notes', notes);
        }

        if (proofFile) {
            formData.append('proof_image', proofFile);
        }

        router.post('/outlet/settlement-payments', formData, {
            onSuccess: () => {
                setAmount('');
                setReferenceNumber('');
                setPaymentDate(new Date().toISOString().split('T')[0]);
                setNotes('');
                setProofFile(null);
                setShowForm(false);
            },
            onError: (errs) => setErrors(errs),
            onFinish: () => setSaving(false),
        });
    };

    const statusLabels: Record<string, string> = {
        pending_verification: 'Menunggu Verifikasi',
        verified: 'Terverifikasi',
        rejected: 'Ditolak',
    };

    const statusVariants: Record<string, 'success' | 'warning' | 'danger'> = {
        pending_verification: 'warning',
        verified: 'success',
        rejected: 'danger',
    };

    return (
        <OutletLayout title="Riwayat Pembayaran" subtitle="Daftar pembayaran yang sudah dikirim">
            <Head title="Riwayat Pembayaran" />
            <OutletPageShell>
                <div className="flex items-center justify-between">
                    <Button size="lg" onClick={() => setShowForm(!showForm)}>
                        {showForm ? 'Batal' : 'Bayar'}
                    </Button>
                </div>

                {/* Payment Form */}
                {showForm && (
                    <form onSubmit={handleSubmit} className="mb-4 rounded-xl border border-border bg-white p-4">
                        <h2 className="mb-3 text-sm font-semibold text-text">Submit Pembayaran</h2>

                        <div className="space-y-3">
                            <Input
                                type="number"
                                label="Jumlah (Rp)"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                min="1"
                                required
                                placeholder="1200000"
                                error={errors.amount}
                            />

                            <Input
                                type="text"
                                label="Nomor Referensi"
                                value={referenceNumber}
                                onChange={(e) => setReferenceNumber(e.target.value)}
                                required
                                maxLength={100}
                                placeholder="TRF-20260605-001"
                                error={errors.reference_number}
                            />

                            <Input
                                type="date"
                                label="Tanggal Pembayaran"
                                value={paymentDate}
                                onChange={(e) => setPaymentDate(e.target.value)}
                                required
                                max={new Date().toISOString().split('T')[0]}
                                error={errors.payment_date}
                            />

                            <Textarea
                                label="Catatan (opsional)"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                maxLength={500}
                                rows={2}
                                placeholder="Transfer via BCA..."
                            />

                            <div>
                                <label className="mb-1 block text-sm font-medium text-text">Bukti Transfer (opsional)</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                                    className="w-full rounded-[--radius-control] border border-border bg-surface px-3 py-2 text-sm text-text transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                {errors.proof_image && <p className="mt-1 text-xs text-danger">{errors.proof_image}</p>}
                            </div>

                            <Button type="submit" size="lg" loading={saving} className="w-full">
                                Kirim Pembayaran
                            </Button>
                        </div>
                    </form>
                )}

                {/* Payment List */}
                <div className="space-y-2">
                    {payments.data.length === 0 ? (
                        <EmptyState
                            icon={<Receipt className="h-8 w-8 text-text-subtle" />}
                            title="Belum ada pembayaran"
                            description="Riwayat pembayaran Anda akan muncul di sini"
                        />
                    ) : (
                        payments.data.map((payment) => (
                            <div key={payment.id} className="rounded-xl border border-border bg-white p-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="text-sm font-semibold text-text">{formatCurrency(payment.amount)}</div>
                                        <div className="text-xs text-text-muted">{payment.reference_number}</div>
                                        <div className="text-xs text-text-subtle">{formatDate(payment.payment_date)}</div>
                                    </div>
                                    <StatusBadge variant={statusVariants[payment.status]}>
                                        {statusLabels[payment.status]}
                                    </StatusBadge>
                                </div>
                                {payment.notes && (
                                    <div className="mt-2 text-xs text-text-muted">{payment.notes}</div>
                                )}
                                {payment.proof_image && (
                                    <div className="mt-2">
                                        <a href={`/storage/${payment.proof_image}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">
                                            Lihat Bukti Transfer
                                        </a>
                                    </div>
                                )}
                                {payment.rejection_reason && (
                                    <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">
                                        Alasan ditolak: {payment.rejection_reason}
                                    </div>
                                )}
                                {payment.verifier && (
                                    <div className="mt-2 text-xs text-text-subtle">
                                        Diverifikasi oleh {payment.verifier.name}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Pagination */}
                <Pagination links={payments.links ?? []} />
            </OutletPageShell>
        </OutletLayout>
    );
}
