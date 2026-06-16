import { CreditCard, Banknote } from 'lucide-react';
import type { ReactNode } from 'react';

interface PaymentOption {
    id: string;
    label: string;
    description: string;
    icon: ReactNode;
}

interface Props {
    selected: string;
    onChange: (id: string) => void;
}

const options: PaymentOption[] = [
    { id: 'dombi_pay', label: 'Dombi Pay (E-Wallet)', description: 'Bayar via saldo Dombi', icon: <CreditCard className="h-5 w-5 text-slate-600" /> },
    { id: 'cod', label: 'Cash on Delivery', description: 'Bayar saat diterima', icon: <Banknote className="h-5 w-5 text-slate-600" /> },
];

export default function PaymentMethodCard({ selected, onChange }: Props) {
    return (
        <div className="space-y-2">
            {options.map((option) => {
                const isActive = selected === option.id;

                return (
                    <button
                        key={option.id}
                        type="button"
                        onClick={() => onChange(option.id)}
                        className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors active:bg-zinc-50 ${
                            isActive ? 'border-emerald-500 bg-emerald-50/30' : 'border-zinc-200 bg-white'
                        }`}
                    >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-50 text-lg">
                            {option.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-slate-900">{option.label}</div>
                            <div className="mt-0.5 text-xs text-slate-500">{option.description}</div>
                        </div>
                        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                            isActive ? 'border-emerald-600 bg-emerald-600' : 'border-zinc-300'
                        }`}>
                            {isActive && <div className="h-2 w-2 rounded-full bg-white" />}
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
