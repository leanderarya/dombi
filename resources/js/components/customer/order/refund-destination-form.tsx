import { router } from '@inertiajs/react';
import { FormEventHandler, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { toast } from 'sonner';
import type { RefundDestinationType } from '@/types/refund';

interface Props {
    orderId: number;
    initialType?: RefundDestinationType;
    initialLabel?: string;
    initialHolder?: string;
    onSaved?: () => void;
}

export default function RefundDestinationForm({ orderId, initialType, initialLabel, initialHolder, onSaved }: Props) {
    const [type, setType] = useState<RefundDestinationType>(initialType ?? 'bank');
    const [bankName, setBankName] = useState(initialType === 'bank' && initialLabel ? initialLabel : '');
    const [accountNumber, setAccountNumber] = useState('');
    const [accountHolder, setAccountHolder] = useState(initialHolder ?? '');
    const [ewalletProvider, setEwalletProvider] = useState(initialType === 'ewallet' && initialLabel ? initialLabel : '');
    const [ewalletNumber, setEwalletNumber] = useState('');
    const [ewalletHolder, setEwalletHolder] = useState(initialHolder ?? '');
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const isBank = type === 'bank';

    const handleSubmit: FormEventHandler = (e) => {
        e.preventDefault();
        setProcessing(true);
        setErrors({});

        const payload = isBank
            ? {
                  destination_type: 'bank' as const,
                  bank_name: bankName,
                  account_number: accountNumber,
                  account_holder: accountHolder,
              }
            : {
                  destination_type: 'ewallet' as const,
                  ewallet_provider: ewalletProvider,
                  ewallet_number: ewalletNumber,
                  ewallet_holder: ewalletHolder,
              };

        router.patch(`/customer/orders/${orderId}/refund-destination`, payload as any, {
            preserveScroll: true,
            onSuccess: () => {
                setProcessing(false);
                toast.success('Tujuan refund disimpan');
                onSaved?.();
            },
            onError: (errs: any) => {
                setProcessing(false);
                setErrors(errs as Record<string, string>);
                const msg = Object.values(errs).flat().join(', ') as string;
                if (msg) toast.error(msg);
            },
            onFinish: () => setProcessing(false),
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div>
                <Label>Metode Penerimaan</Label>
                <div className="mt-1 flex gap-2">
                    <button
                        type="button"
                        onClick={() => setType('bank')}
                        className={`min-h-11 flex-1 rounded-lg border px-3 py-2 text-xs font-semibold ${type === 'bank' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-muted'}`}
                    >
                        Transfer Bank
                    </button>
                    <button
                        type="button"
                        onClick={() => setType('ewallet')}
                        className={`min-h-11 flex-1 rounded-lg border px-3 py-2 text-xs font-semibold ${type === 'ewallet' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-muted'}`}
                    >
                        E-Wallet
                    </button>
                </div>
            </div>

            {isBank ? (
                <>
                    <div>
                        <Label htmlFor="bank_name">Nama Bank</Label>
                        <Input id="bank_name" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="BCA, Mandiri, BRI..." />
                        {errors.bank_name && <p className="mt-0.5 text-[11px] text-red-500" role="alert">{errors.bank_name}</p>}
                    </div>
                    <div>
                        <Label htmlFor="account_number">Nomor Rekening</Label>
                        <Input id="account_number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="1234567890" />
                        {errors.account_number && <p className="mt-0.5 text-[11px] text-red-500" role="alert">{errors.account_number}</p>}
                    </div>
                    <div>
                        <Label htmlFor="account_holder">Nama Pemilik Rekening</Label>
                        <Input id="account_holder" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} placeholder="sesuai rekening" />
                        {errors.account_holder && <p className="mt-0.5 text-[11px] text-red-500" role="alert">{errors.account_holder}</p>}
                    </div>
                </>
            ) : (
                <>
                    <div>
                        <Label htmlFor="ewallet_provider">Provider</Label>
                        <Select
                            id="ewallet_provider"
                            value={ewalletProvider}
                            onChange={(e) => setEwalletProvider(e.target.value)}
                            options={[
                                { value: 'GoPay', label: 'GoPay' },
                                { value: 'OVO', label: 'OVO' },
                                { value: 'DANA', label: 'DANA' },
                                { value: 'ShopeePay', label: 'ShopeePay' },
                                { value: 'LinkAja', label: 'LinkAja' },
                            ]}
                            placeholder="Pilih provider"
                        />
                        {errors.ewallet_provider && <p className="mt-0.5 text-[11px] text-red-500" role="alert">{errors.ewallet_provider}</p>}
                    </div>
                    <div>
                        <Label htmlFor="ewallet_number">Nomor Terdaftar</Label>
                        <Input id="ewallet_number" value={ewalletNumber} onChange={(e) => setEwalletNumber(e.target.value)} placeholder="081234567890" />
                        {errors.ewallet_number && <p className="mt-0.5 text-[11px] text-red-500" role="alert">{errors.ewallet_number}</p>}
                    </div>
                    <div>
                        <Label htmlFor="ewallet_holder">Nama Pemilik</Label>
                        <Input id="ewallet_holder" value={ewalletHolder} onChange={(e) => setEwalletHolder(e.target.value)} placeholder="sesuai akun" />
                        {errors.ewallet_holder && <p className="mt-0.5 text-[11px] text-red-500" role="alert">{errors.ewallet_holder}</p>}
                    </div>
                </>
            )}

            <Button type="submit" disabled={processing} className="min-h-11 w-full">
                {processing ? 'Menyimpan...' : 'Simpan Tujuan Refund'}
            </Button>
        </form>
    );
}
