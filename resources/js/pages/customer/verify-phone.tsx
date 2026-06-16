import { Head, router } from '@inertiajs/react';
import { ArrowLeft, Phone, Shield } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
    user: {
        name: string;
        email: string;
        avatar?: string;
    };
    otpLength: number;
    ttlSeconds: number;
}

export default function VerifyPhone({ user, otpLength, ttlSeconds }: Props) {
    const [phone, setPhone] = useState('');
    const [step, setStep] = useState<'phone' | 'otp'>('phone');
    const [code, setCode] = useState<string[]>(new Array(otpLength).fill(''));
    const [error, setError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        if (countdown <= 0) {
return;
}

        const timer = setInterval(() => setCountdown((prev) => Math.max(0, prev - 1)), 1000);

        return () => clearInterval(timer);
    }, [countdown]);

    const normalizePhone = (raw: string): string => {
        const digits = raw.replace(/\D/g, '');

        if (digits.startsWith('62')) {
return digits;
}

        if (digits.startsWith('0')) {
return '62' + digits.slice(1);
}

        if (digits.startsWith('8')) {
return '62' + digits;
}

        return digits;
    };

    const sendOtp = useCallback(async () => {
        const normalized = normalizePhone(phone);

        if (!/^62[0-9]{9,13}$/.test(normalized)) {
            setError('Nomor HP tidak valid. Gunakan format Indonesia (08xxx).');

            return;
        }

        setSending(true);
        setError(null);

        try {
            const response = await fetch('/customer/verify-phone/send-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '',
                },
                body: JSON.stringify({ phone: normalized }),
            });

            if (response.ok) {
                setStep('otp');
                setCountdown(ttlSeconds);
                setCode(new Array(otpLength).fill(''));
                setTimeout(() => inputRefs.current[0]?.focus(), 100);
            } else {
                const data = await response.json();
                setError(data.message ?? 'Gagal mengirim OTP.');
            }
        } catch {
            setError('Gagal mengirim OTP. Periksa koneksi Anda.');
        } finally {
            setSending(false);
        }
    }, [phone, otpLength, ttlSeconds]);

    const verifyOtp = useCallback(async (otpCode: string) => {
        const normalized = normalizePhone(phone);
        setVerifying(true);
        setError(null);

        try {
            const response = await fetch('/customer/verify-phone/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '',
                },
                body: JSON.stringify({ phone: normalized, code: otpCode }),
            });

            const data = await response.json();

            if (data.verified) {
                router.visit(data.redirect ?? '/customer/home');
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
    }, [phone, otpLength]);

    useEffect(() => {
        if (step === 'otp' && code.every((c) => c !== '') && code.length === otpLength) {
            verifyOtp(code.join(''));
        }
    }, [code, step, otpLength, verifyOtp]);

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

        if (!pasted.length) {
return;
}

        const newCode = [...code];

        for (let i = 0; i < pasted.length; i++) {
newCode[i] = pasted[i];
}

        setCode(newCode);
        const nextEmpty = newCode.findIndex((c) => c === '');
        inputRefs.current[nextEmpty === -1 ? otpLength - 1 : nextEmpty]?.focus();
    };

    const formattedCountdown = `${Math.floor(countdown / 60)}:${(countdown % 60).toString().padStart(2, '0')}`;
    const isExpired = countdown <= 0;

    return (
        <div className="min-h-dvh bg-[#fbf9f7] text-slate-950">
            <Head title="Verifikasi Nomor HP" />

            <header className="sticky top-0 z-30 border-b border-zinc-100 bg-white/95 backdrop-blur">
                <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
                    {step === 'otp' ? (
                        <button
                            type="button"
                            onClick={() => {
 setStep('phone'); setError(null); 
}}
                            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 active:bg-zinc-100"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                    ) : (
                        <div className="h-10 w-10" />
                    )}
                    <div>
                        <div className="text-sm font-semibold text-slate-900">Verifikasi Nomor HP</div>
                        <div className="text-[11px] text-slate-500">Diperlukan untuk keamanan akun</div>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-lg px-4 py-8">
                <div className="flex flex-col items-center text-center">
                    {/* User info */}
                    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                        {user.avatar ? (
                            <img src={user.avatar} alt="" className="h-10 w-10 rounded-full" />
                        ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                                {user.name.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div className="text-left">
                            <div className="text-sm font-semibold text-slate-900">{user.name}</div>
                            <div className="text-xs text-slate-500">{user.email}</div>
                        </div>
                    </div>

                    {step === 'phone' ? (
                        <>
                            <div className="mt-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
                                <Phone className="h-7 w-7 text-emerald-600" />
                            </div>
                            <h1 className="mt-6 text-lg font-bold text-slate-900">Masukkan Nomor HP</h1>
                            <p className="mt-2 max-w-sm text-sm text-slate-500">
                                Nomor HP diperlukan untuk pengiriman, pelacakan pesanan, dan keamanan akun.
                            </p>

                            <div className="mt-8 w-full max-w-sm">
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">+62</span>
                                    <input
                                        type="tel"
                                        inputMode="numeric"
                                        value={phone.startsWith('0') ? phone.slice(1) : phone}
                                        onChange={(e) => setPhone('0' + e.target.value.replace(/^0+/, ''))}
                                        placeholder="8123456789"
                                        className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-12 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
                                    />
                                </div>
                                {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
                            </div>

                            <button
                                type="button"
                                onClick={sendOtp}
                                disabled={sending || !phone}
                                className="mt-6 flex min-h-[48px] w-full max-w-sm items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white active:bg-emerald-700 disabled:opacity-50"
                            >
                                {sending ? 'Mengirim...' : 'Kirim Kode OTP'}
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="mt-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
                                <Shield className="h-7 w-7 text-emerald-600" />
                            </div>
                            <h1 className="mt-6 text-lg font-bold text-slate-900">Masukkan Kode OTP</h1>
                            <p className="mt-2 text-sm text-slate-500">
                                Kode dikirim ke <span className="font-semibold text-slate-700">{phone}</span>
                            </p>

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

                            {error && <p className="mt-4 text-sm font-medium text-red-600">{error}</p>}
                            {verifying && <p className="mt-4 text-sm text-slate-500">Memverifikasi...</p>}

                            <div className="mt-6">
                                {isExpired ? (
                                    <button
                                        type="button"
                                        onClick={sendOtp}
                                        disabled={sending}
                                        className="text-sm font-semibold text-emerald-700 active:text-emerald-800 disabled:opacity-50"
                                    >
                                        {sending ? 'Mengirim...' : 'Kirim Ulang Kode'}
                                    </button>
                                ) : (
                                    <p className="text-sm text-slate-500">
                                        Kirim ulang dalam <span className="font-semibold tabular-nums text-slate-700">{formattedCountdown}</span>
                                    </p>
                                )}
                            </div>
                        </>
                    )}

                    <div className="mt-12 w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 text-left">
                        <div className="flex items-start gap-3">
                            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                            <div>
                                <div className="text-sm font-semibold text-slate-900">Mengapa nomor HP diperlukan?</div>
                                <ul className="mt-2 space-y-1 text-xs leading-relaxed text-slate-500">
                                    <li>• Kurir dapat menghubungi Anda saat pengiriman</li>
                                    <li>• Melacak pesanan tanpa perlu mengingat kode</li>
                                    <li>• Keamanan akun dan riwayat pesanan</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
