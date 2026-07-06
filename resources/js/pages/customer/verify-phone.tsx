import { useState, useCallback } from 'react';
import { router } from '@inertiajs/react';
import PhoneInput from '@/components/ui/phone-input';
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';

interface Props {
    user: { name: string; email: string; avatar?: string };
}

export default function VerifyPhone() {
    const [phone, setPhone] = useState('');
    const [step, setStep] = useState<'phone' | 'confirm' | 'done'>('phone');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const csrf = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';

    const submitPhone = useCallback(async () => {
        if (!phone || phone.length < 9) {
            setError('Nomor HP tidak valid');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await fetch('/customer/verify-phone', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': csrf(),
                },
                body: JSON.stringify({ phone: `62${phone}` }),
            });

            const data = await res.json();

            if (res.ok && data.verified) {
                setStep('done');
                if (data.redirect) {
                    setTimeout(() => router.visit(data.redirect), 1500);
                }
            } else {
                setError(data.error || 'Gagal menghubungkan nomor HP');
            }
        } catch {
            setError('Terjadi kesalahan. Coba lagi.');
        } finally {
            setLoading(false);
        }
    }, [phone]);

    const handleSubmit = useCallback(() => {
        if (step === 'phone') {
            if (!phone || phone.length < 9) {
                setError('Nomor HP tidak valid');
                return;
            }
            setError('');
            setStep('confirm');
        } else if (step === 'confirm') {
            submitPhone();
        }
    }, [step, phone, submitPhone]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-surface px-4">
            <div className="w-full max-w-sm space-y-6">
                <div className="text-center">
                    <h1 className="text-xl font-semibold text-text">Hubungkan Nomor HP</h1>
                    <p className="mt-1 text-sm text-text-subtle">
                        {step === 'phone' && 'Masukkan nomor HP untuk mengelola pesanan'}
                        {step === 'confirm' && 'Pastikan nomor HP sudah benar'}
                        {step === 'done' && 'Nomor HP berhasil dihubungkan!'}
                    </p>
                </div>

                {step === 'phone' && (
                    <div className="space-y-4">
                        <PhoneInput
                            label="Nomor HP"
                            value={phone}
                            onChange={setPhone}
                            placeholder="81234567890"
                            error={error}
                            required
                        />

                        <button
                            onClick={handleSubmit}
                            disabled={loading || !phone}
                            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                        >
                            Lanjutkan
                        </button>
                    </div>
                )}

                {step === 'confirm' && (
                    <div className="space-y-4">
                        <div className="rounded-lg border border-border bg-surface-muted p-4 text-center">
                            <p className="text-sm text-text-subtle">Nomor HP Anda:</p>
                            <p className="mt-1 text-lg font-semibold text-text">+62 {phone}</p>
                        </div>

                        {error && <p className="text-center text-sm text-danger">{error}</p>}

                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                        >
                            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                            Ya, Hubungkan
                        </button>

                        <button
                            onClick={() => {
                                setStep('phone');
                                setError('');
                            }}
                            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text hover:bg-surface-muted"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Ganti Nomor
                        </button>
                    </div>
                )}

                {step === 'done' && (
                    <div className="flex flex-col items-center gap-3">
                        <CheckCircle2 className="h-12 w-12 text-green-500" />
                        <p className="text-sm text-text">Nomor HP berhasil dihubungkan</p>
                    </div>
                )}
            </div>
        </div>
    );
}
