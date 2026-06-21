import { Head, router } from '@inertiajs/react';
import { ArrowLeft, Shield } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
    phone: string;
    otpLength: number;
    ttlSeconds: number;
}

export default function CheckoutVerifyOtp({ phone, otpLength, ttlSeconds }: Props) {
    const [code, setCode] = useState<string[]>(new Array(otpLength).fill(''));
    const [error, setError] = useState<string | null>(null);
    const [verifying, setVerifying] = useState(false);
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [countdown, setCountdown] = useState(ttlSeconds);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Auto-send OTP on mount
    useEffect(() => {
        sendOtp();
    }, []);

    // Countdown timer
    useEffect(() => {
        if (countdown <= 0) {
return;
}

        const timer = setInterval(() => setCountdown((prev) => Math.max(0, prev - 1)), 1000);

        return () => clearInterval(timer);
    }, [countdown]);

    // Auto-submit when all digits entered
    useEffect(() => {
        if (code.every((c) => c !== '') && code.length === otpLength) {
            verifyOtp(code.join(''));
        }
    }, [code]);

    const sendOtp = useCallback(async () => {
        setSending(true);
        setError(null);

        try {
            const response = await fetch('/customer/checkout/send-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '',
                },
            });

            if (response.ok) {
                setSent(true);
                setCountdown(ttlSeconds);
                setCode(new Array(otpLength).fill(''));
                inputRefs.current[0]?.focus();
            } else {
                setError('Gagal mengirim OTP. Coba lagi.');
            }
        } catch {
            setError('Gagal mengirim OTP. Periksa koneksi Anda.');
        } finally {
            setSending(false);
        }
    }, [otpLength, ttlSeconds]);

    const verifyOtp = useCallback(async (otpCode: string) => {
        setVerifying(true);
        setError(null);

        try {
            const response = await fetch('/customer/checkout/verify-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '',
                },
                body: JSON.stringify({ code: otpCode }),
            });

            const data = await response.json();

            if (data.verified) {
                router.visit('/customer/checkout/payment');
            } else {
                setError(data.error ?? 'Kode tidak valid.');
                setCode(new Array(otpLength).fill(''));
                inputRefs.current[0]?.focus();
            }
        } catch {
            setError('Gagal memverifikasi. Coba lagi.');
        } finally {
            setVerifying(false);
        }
    }, [otpLength]);

    const handleInput = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) {
return;
}

        const newCode = [...code];
        newCode[index] = value.slice(-1);
        setCode(newCode);

        if (value && index < otpLength - 1) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, otpLength);

        if (pasted.length === 0) {
return;
}

        const newCode = [...code];

        for (let i = 0; i < pasted.length; i++) {
            newCode[i] = pasted[i];
        }

        setCode(newCode);

        const nextEmpty = newCode.findIndex((c) => c === '');
        const focusIndex = nextEmpty === -1 ? otpLength - 1 : nextEmpty;
        inputRefs.current[focusIndex]?.focus();
    };

    const maskedPhone = phone.replace(/(\d{2})\d+(\d{4})/, '$1••••$2');
    const formattedCountdown = `${Math.floor(countdown / 60)}:${(countdown % 60).toString().padStart(2, '0')}`;
    const isExpired = countdown <= 0;

    return (
        <div className="min-h-dvh bg-[#fbf9f7] text-slate-950">
            <Head title="Verifikasi Nomor HP" />

            <header className="sticky top-0 z-30 border-b border-zinc-100 bg-white/95 backdrop-blur">
                <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
                    <button
                        type="button"
                        onClick={() => router.visit('/customer/checkout/customer')}
                        className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 active:bg-zinc-100"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <div className="text-sm font-semibold text-slate-900">Verifikasi Nomor HP</div>
                        <div className="text-[11px] text-slate-500">Diperlukan untuk pengiriman</div>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-lg px-4 py-8">
                <div className="flex flex-col items-center text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
                        <Shield className="h-8 w-8 text-emerald-600" />
                    </div>

                    <h1 className="mt-6 text-lg font-bold text-slate-900">Masukkan Kode OTP</h1>
                    <p className="mt-2 text-sm text-slate-500">
                        Kode verifikasi dikirim ke
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">{maskedPhone}</p>

                    {/* OTP Input */}
                    <div className="mt-8 flex gap-3">
                        {code.map((digit, index) => (
                            <input
                                key={index}
                                ref={(el) => {
 inputRefs.current[index] = el; 
}}
                                type="tel"
                                inputMode="numeric"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handleInput(index, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(index, e)}
                                onPaste={index === 0 ? handlePaste : undefined}
                                disabled={verifying || isExpired}
                                className={`flex h-14 w-12 items-center justify-center rounded-xl border-2 text-center text-xl font-bold tabular-nums transition-colors ${
                                    error
                                        ? 'border-red-300 bg-red-50 text-red-700'
                                        : digit
                                            ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                                            : 'border-slate-200 bg-white text-slate-900'
                                } ${verifying ? 'opacity-50' : ''}`}
                            />
                        ))}
                    </div>

                    {/* Error */}
                    {error && (
                        <p className="mt-4 text-sm font-medium text-red-600">{error}</p>
                    )}

                    {/* Countdown / Resend */}
                    <div className="mt-6">
                        {isExpired ? (
                            <button
                                type="button"
                                onClick={sendOtp}
                                disabled={sending}
                                className="min-h-[44px] px-4 text-sm font-semibold text-emerald-700 active:text-emerald-800 disabled:opacity-50"
                            >
                                {sending ? 'Mengirim...' : 'Kirim Ulang Kode'}
                            </button>
                        ) : (
                            <p className="text-sm text-slate-500">
                                Kirim ulang dalam <span className="font-semibold tabular-nums text-slate-700">{formattedCountdown}</span>
                            </p>
                        )}
                    </div>

                    {/* Status indicator */}
                    {verifying && (
                        <p className="mt-4 text-sm text-slate-500">Memverifikasi...</p>
                    )}

                    {/* Pickup note */}
                    <div className="mt-12 rounded-xl border border-slate-200 bg-white p-4 text-left">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Informasi</div>
                        <p className="mt-2 text-sm text-slate-600">
                            Verifikasi nomor HP diperlukan untuk keamanan pengiriman. Nomor Anda tidak akan dibagikan kepada pihak lain.
                        </p>
                        <p className="mt-2 text-sm text-slate-600">
                            Untuk <span className="font-semibold">pickup</span>, verifikasi tidak diperlukan.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
