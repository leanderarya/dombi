import { Button } from '@/components/ui/button';

interface Props {
    value: 'pickup' | 'delivery';
    onChange: (value: 'pickup' | 'delivery') => void;
    deliveryDisabled?: boolean;
    deliveryBadge?: string;
    variant?: 'green' | 'white';
}

export default function FulfillmentToggle({
    value,
    onChange,
    deliveryDisabled,
    deliveryBadge = 'Tutup',
    variant = 'green',
}: Props) {
    const containerBg =
        variant === 'green' ? 'bg-surface/20' : 'bg-surface-muted';
    const activeStyle = 'bg-surface text-primary shadow-sm';
    const inactiveStyle =
        variant === 'green' ? 'text-white/70' : 'text-text-muted';
    const disabledStyle =
        variant === 'green' ? 'text-white/40' : 'text-text-subtle';

    return (
        <div className="relative flex justify-center">
            <div
                className={`flex w-full max-w-[280px] rounded-full p-1 ${containerBg}`}
            >
                <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onChange('pickup')}
                    className={`relative h-auto min-h-0 flex-1 rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                        value === 'pickup' ? activeStyle : inactiveStyle
                    }`}
                >
                    Pick Up
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    onClick={() => !deliveryDisabled && onChange('delivery')}
                    disabled={deliveryDisabled}
                    className={`relative h-auto min-h-0 flex-1 rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                        value === 'delivery'
                            ? activeStyle
                            : deliveryDisabled
                              ? disabledStyle
                              : inactiveStyle
                    }`}
                >
                    Delivery
                    {deliveryDisabled && (
                        <span className="absolute -top-1.5 -right-1 rounded-full bg-danger px-1.5 text-[8px] font-extrabold text-white">
                            {deliveryBadge}
                        </span>
                    )}
                </Button>
            </div>
        </div>
    );
}
