interface Props {
    value: 'pickup' | 'delivery';
    onChange: (value: 'pickup' | 'delivery') => void;
    deliveryDisabled?: boolean;
    variant?: 'green' | 'white';
}

export default function FulfillmentToggle({
    value,
    onChange,
    deliveryDisabled,
    variant = 'green',
}: Props) {
    const containerBg = variant === 'green' ? 'bg-white/20' : 'bg-gray-100';
    const activeStyle = 'bg-white text-primary shadow-sm';
    const inactiveStyle =
        variant === 'green' ? 'text-white/70' : 'text-text-muted';
    const disabledStyle =
        variant === 'green' ? 'text-white/40' : 'text-text-subtle';

    return (
        <div className="relative flex justify-center">
            <div
                className={`flex w-full max-w-[280px] rounded-full p-1 ${containerBg}`}
            >
                <button
                    type="button"
                    onClick={() => onChange('pickup')}
                    className={`relative flex-1 rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                        value === 'pickup' ? activeStyle : inactiveStyle
                    }`}
                >
                    Pick Up
                </button>
                <button
                    type="button"
                    onClick={() => !deliveryDisabled && onChange('delivery')}
                    disabled={deliveryDisabled}
                    className={`relative flex-1 rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                        value === 'delivery'
                            ? activeStyle
                            : deliveryDisabled
                              ? disabledStyle
                              : inactiveStyle
                    }`}
                >
                    Delivery
                    {deliveryDisabled && (
                        <span className="absolute -top-1.5 -right-1 rounded-full bg-red-500 px-1.5 text-[8px] font-extrabold text-white">
                            Tutup
                        </span>
                    )}
                </button>
            </div>
        </div>
    );
}
