import { useState, useEffect, useCallback } from 'react';
import { router } from '@inertiajs/react';
import PhoneInput from '@/components/ui/phone-input';
import OtpInput from '@/components/ui/otp-input';
import { ArrowLeft, Loader2, CheckCircle2, MessageCircle } from 'lucide-react';

interface Props {
    user: { name: string; email: string; avatar?: string };
    otpLength: number;
    ttlSeconds: number;
}

export default function VerifyPhone({ otpLength, ttlSeconds }: Props) {
    const [phone, setPhone] = useState('');
    const [step, setStep] = useState<'phone' | 'otp' | 'done'>('phone');
    const [code, setCode] = useState('');
    const [sending, setSending] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState('');
    const [countdown, setCountdown] = useState(0);

    useEffect(() => {
        if (countdown <= 0) return;
        const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
        return () => clearInterval(timer);
    }, [countdown]);

    const csrf = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';

    const sendOtp = useCallback(async () => {
        if (!phone || phone.length < 10) {
            setError('Nomor HP tidak valid');
            return;
        }

        setSending(true);
        setError('');

        try {
            const res = await fetch('/customer/send-phone-otp', {
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

            if (res.ok && data.sent) {
                setStep('otp');
                setCountdown(ttlSeconds);
            } else {
                setError(data.message || 'Gagal mengirim kode OTP');
            }
        } catch {
            setError('Terjadi kesalahan. Coba lagi.');
        } finally {
            setSending(false);
        }
    }, [phone, ttlSeconds]);

    const verifyOtp = useCallback(async () => {
        if (code.length !== otpLength) return;

        setVerifying(true);
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
                body: JSON.stringify({ phone: `62${phone}`, code }),
            });

            const data = await res.json();

            if (res.ok && data.verified) {
                setStep('done');
                if (data.redirect) {
                    setTimeout(() => router.visit(data.redirect), 1500);
                }
            } else {
                setError(data.error || 'Kode OTP salah');
                setCode('');
            }
        } catch {
            setError('Terjadi kesalahan. Coba lagi.');
        } finally {
            setVerifying(false);
        }
    }, [code, phone, otpLength]);

    useEffect(() => {
        if (code.length === otpLength && step === 'otp') {
            verifyOtp();
        }
    }, [code, otpLength, step, verifyOtp]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-surface px-4">
            <div className="w-full max-w-sm space-y-6">
                <div className="text-center">
                    <h1 className="text-xl font-semibold text-text">Verifikasi Nomor HP</h1>
                    <p className="mt-1 text-sm text-text-subtle">
                        {step === 'phone' && 'Masukkan nomor HP untuk mengelola pesanan'}
                        {step === 'otp' && `Kode OTP telah dikirim ke WhatsApp +62${phone}`}
                        {step === 'done' && 'Verifikasi berhasil!'}
                    </p>
                </div>

                {step === 'phone' && (
                    <div className="space-y-4">
                        <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
                            <div className="flex items-start gap-2">
                                <MessageCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                <p>Pastikan Anda sudah memulai chat dengan bot WhatsApp kami terlebih dahulu.</p>
                            </div>
                        </div>

                        <PhoneInput
                            label="Nomor HP"
                            value={phone}
                            onChange={setPhone}
                            placeholder="81234567890"
                            error={error}
                            required
                        />

                        <button
                            onClick={sendOtp}
                            disabled={sending || !phone}
                            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                        >
                            {sending && <Loader2 className="h-4 w-4 animate-spin" />}
                            Kirim Kode OTP
                        </button>
                    </div>
                )}

                {step === 'otp' && (
                    <div className="space-y-4">
                        <OtpInput
                            length={otpLength}
                            value={code}
                            onChange={setCode}
                            error={error}
                            disabled={verifying}
                        />

                        {verifying && (
                            <div className="flex items-center justify-center gap-2 text-sm text-text-subtle">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Memverifikasi...
                            </div>
                        )}

                        <div className="text-center">
                            {countdown > 0 ? (
                                <p className="text-sm text-text-subtle">Kirim ulang dalam {countdown}s</p>
                            ) : (
                                <button
                                    onClick={() => {
                                        setCode('');
                                        sendOtp();
                                    }}
                                    disabled={sending}
                                    className="text-sm text-primary hover:underline"
                                >
                                    {sending ? 'Mengirim...' : 'Kirim ulang kode'}
                                </button>
                            )}
                        </div>

                        <button
                            onClick={() => {
                                setStep('phone');
                                setCode('');
                                setError('');
                            }}
                            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text hover:bg-surface-muted"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Ganti nomor
                        </button>
                    </div>
                )}

                {step === 'done' && (
                    <div className="flex flex-col items-center gap-3">
                        <CheckCircle2 className="h-12 w-12 text-green-500" />
                        <p className="text-sm text-text">Nomor HP berhasil diverifikasi</p>
                    </div>
                )}
            </div>
        </div>
    );
}
