import { useForm } from '@inertiajs/react';
import { FormEventHandler, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { toast } from 'sonner';
import type { RefundDestinationType } from '@/types/refund';

interface DestinationFormData {
    destination_type: RefundDestinationType;
    bank_name: string;
    account_number: string;
    account_holder: string;
    ewallet_provider: string;
    ewallet_number: string;
    ewallet_holder: string;
}

interface Props {
    orderId: number;
    initialType?: RefundDestinationType;
    initialLabel?: string;
    initialHolder?: string;
    onSaved?: () => void;
}

export default function RefundDestinationForm({ orderId, initialType, initialLabel, initialHolder, onSaved }: Props) {
    const [type, setType] = useState<RefundDestinationType>(initialType ?? 'bank');

    const form = useForm<DestinationFormData>({
        destination_type: type,
        bank_name: initialType === 'bank' && initialLabel ? initialLabel : '',
        account_number: '',
        account_holder: initialHolder ?? '',
        ewallet_provider: initialType === 'ewallet' && initialLabel ? initialLabel : '',
        ewallet_number: '',
        ewallet_holder: initialHolder ?? '',
    });

    const isBank = type === 'bank';

    const handleSubmit: FormEventHandler = (e) => {
        e.preventDefault();
        form.setData('destination_type', type);
        if (isBank) {
            form.setData('ewallet_provider', '');
            form.setData('ewallet_number', '');
            form.setData('ewallet_holder', '');
        } else {
            form.setData('bank_name', '');
            form.setData('account_number', '');
            form.setData('account_holder', '');
        }
        form.patch(`/customer/orders/${orderId}/refund-destination`, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Tujuan refund disimpan');
                onSaved?.();
            },
            onError: (errors) => toast.error(Object.values(errors).flat().join(', ')),
        });
    };

    const handleTypeChange = (newType: RefundDestinationType) => {
        setType(newType);
        form.setData('destination_type', newType);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div>
                <Label>Metode Penerimaan</Label>
                <div className="mt-1 flex gap-2">
                    <button
                        type="button"
                        onClick={() => handleTypeChange('bank')}
                        className={`min-h-11 flex-1 rounded-lg border px-3 py-2 text-xs font-semibold ${type === 'bank' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-muted'}`}
                    >
                        Transfer Bank
                    </button>
                    <button
                        type="button"
                        onClick={() => handleTypeChange('ewallet')}
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
                        <Input id="bank_name" value={form.data.bank_name} onChange={(e) => form.setData('bank_name', e.target.value)} placeholder="BCA, Mandiri, BRI..." />
                        {form.errors.bank_name && <p className="mt-0.5 text-[11px] text-red-500" role="alert">{form.errors.bank_name}</p>}
                    </div>
                    <div>
                        <Label htmlFor="account_number">Nomor Rekening</Label>
                        <Input id="account_number" value={form.data.account_number} onChange={(e) => form.setData('account_number', e.target.value)} placeholder="1234567890" />
                        {form.errors.account_number && <p className="mt-0.5 text-[11px] text-red-500" role="alert">{form.errors.account_number}</p>}
                    </div>
                    <div>
                        <Label htmlFor="account_holder">Nama Pemilik Rekening</Label>
                        <Input id="account_holder" value={form.data.account_holder} onChange={(e) => form.setData('account_holder', e.target.value)} placeholder="sesuai rekening" />
                        {form.errors.account_holder && <p className="mt-0.5 text-[11px] text-red-500" role="alert">{form.errors.account_holder}</p>}
                    </div>
                </>
            ) : (
                <>
                    <div>
                        <Label htmlFor="ewallet_provider">Provider</Label>
                        <Select
                            id="ewallet_provider"
                            value={form.data.ewallet_provider}
                            onChange={(e) => form.setData('ewallet_provider', e.target.value)}
                            options={[
                                { value: 'GoPay', label: 'GoPay' },
                                { value: 'OVO', label: 'OVO' },
                                { value: 'DANA', label: 'DANA' },
                                { value: 'ShopeePay', label: 'ShopeePay' },
                                { value: 'LinkAja', label: 'LinkAja' },
                            ]}
                            placeholder="Pilih provider"
                        />
                        {form.errors.ewallet_provider && <p className="mt-0.5 text-[11px] text-red-500" role="alert">{form.errors.ewallet_provider}</p>}
                    </div>
                    <div>
                        <Label htmlFor="ewallet_number">Nomor Terdaftar</Label>
                        <Input id="ewallet_number" value={form.data.ewallet_number} onChange={(e) => form.setData('ewallet_number', e.target.value)} placeholder="081234567890" />
                        {form.errors.ewallet_number && <p className="mt-0.5 text-[11px] text-red-500" role="alert">{form.errors.ewallet_number}</p>}
                    </div>
                    <div>
                        <Label htmlFor="ewallet_holder">Nama Pemilik</Label>
                        <Input id="ewallet_holder" value={form.data.ewallet_holder} onChange={(e) => form.setData('ewallet_holder', e.target.value)} placeholder="sesuai akun" />
                        {form.errors.ewallet_holder && <p className="mt-0.5 text-[11px] text-red-500" role="alert">{form.errors.ewallet_holder}</p>}
                    </div>
                </>
            )}

            <Button type="submit" disabled={form.processing} className="min-h-11 w-full">
                {form.processing ? 'Menyimpan...' : 'Simpan Tujuan Refund'}
            </Button>
        </form>
    );
}
