import { useForm } from '@inertiajs/react';
import { FormEventHandler, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { toast } from 'sonner';

type DestinationType = 'bank' | 'ewallet';

interface Props {
    orderId: number;
    initialType?: DestinationType;
    initialLabel?: string;
    initialHolder?: string;
    initialProvider?: string;
    onSaved?: () => void;
}

export default function RefundDestinationForm({ orderId, initialType, initialLabel, initialHolder, initialProvider, onSaved }: Props) {
    const [type, setType] = useState<DestinationType>(initialType ?? 'bank');

    const form = useForm({
        destination_type: type,
        bank_name: '',
        account_number: '',
        account_holder: '',
        ewallet_provider: initialProvider ?? '',
        ewallet_number: '',
        ewallet_holder: '',
    });

    const isBank = type === 'bank';

    const handleSubmit: FormEventHandler = (e) => {
        e.preventDefault();
        form.setData('destination_type', type);
        form.patch(`/customer/orders/${orderId}/refund-destination`, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Tujuan refund disimpan');
                onSaved?.();
            },
            onError: (errors) => toast.error(Object.values(errors).flat().join(', ')),
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
                        className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold ${type === 'bank' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-muted'}`}
                    >
                        Transfer Bank
                    </button>
                    <button
                        type="button"
                        onClick={() => setType('ewallet')}
                        className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold ${type === 'ewallet' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-muted'}`}
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
                        {form.errors.bank_name && <p className="mt-0.5 text-[11px] text-red-500">{form.errors.bank_name}</p>}
                    </div>
                    <div>
                        <Label htmlFor="account_number">Nomor Rekening</Label>
                        <Input id="account_number" value={form.data.account_number} onChange={(e) => form.setData('account_number', e.target.value)} placeholder="1234567890" />
                        {form.errors.account_number && <p className="mt-0.5 text-[11px] text-red-500">{form.errors.account_number}</p>}
                    </div>
                    <div>
                        <Label htmlFor="account_holder">Nama Pemilik Rekening</Label>
                        <Input id="account_holder" value={form.data.account_holder} onChange={(e) => form.setData('account_holder', e.target.value)} placeholder="sesuai rekening" />
                        {form.errors.account_holder && <p className="mt-0.5 text-[11px] text-red-500">{form.errors.account_holder}</p>}
                    </div>
                </>
            ) : (
                <>
                    <div>
                        <Label htmlFor="ewallet_provider">Provider</Label>
                        <Select
                            id="ewallet_provider"
                            value={form.data.ewallet_provider}
                            onValueChange={(v) => form.setData('ewallet_provider', v)}
                        >
                            <option value="">Pilih provider</option>
                            <option value="GoPay">GoPay</option>
                            <option value="OVO">OVO</option>
                            <option value="DANA">DANA</option>
                            <option value="ShopeePay">ShopeePay</option>
                            <option value="LinkAja">LinkAja</option>
                        </Select>
                        {form.errors.ewallet_provider && <p className="mt-0.5 text-[11px] text-red-500">{form.errors.ewallet_provider}</p>}
                    </div>
                    <div>
                        <Label htmlFor="ewallet_number">Nomor Terdaftar</Label>
                        <Input id="ewallet_number" value={form.data.ewallet_number} onChange={(e) => form.setData('ewallet_number', e.target.value)} placeholder="081234567890" />
                        {form.errors.ewallet_number && <p className="mt-0.5 text-[11px] text-red-500">{form.errors.ewallet_number}</p>}
                    </div>
                    <div>
                        <Label htmlFor="ewallet_holder">Nama Pemilik</Label>
                        <Input id="ewallet_holder" value={form.data.ewallet_holder} onChange={(e) => form.setData('ewallet_holder', e.target.value)} placeholder="sesuai akun" />
                        {form.errors.ewallet_holder && <p className="mt-0.5 text-[11px] text-red-500">{form.errors.ewallet_holder}</p>}
                    </div>
                </>
            )}

            <Button type="submit" disabled={form.processing} className="w-full">
                {form.processing ? 'Menyimpan...' : 'Simpan Tujuan Refund'}
            </Button>
        </form>
    );
}
