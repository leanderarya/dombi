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
    const inactiveStyle = variant === 'green' ? 'text-white/70' : 'text-text-muted';
    const disabledStyle = variant === 'green' ? 'text-white/40' : 'text-text-subtle';

    return (
        <div className="relative mx-4 flex justify-center">
            <div className={`flex rounded-full p-1 ${containerBg}`}>
                <button
                    type="button"
                    onClick={() => onChange('pickup')}
                    className={`relative rounded-full px-5 py-1.5 text-xs font-semibold transition-all ${
                        value === 'pickup' ? activeStyle : inactiveStyle
                    }`}
                >
                    Pick Up
                </button>
                <button
                    type="button"
                    onClick={() => !deliveryDisabled && onChange('delivery')}
                    disabled={deliveryDisabled}
                    className={`relative rounded-full px-5 py-1.5 text-xs font-semibold transition-all ${
                        value === 'delivery'
                            ? activeStyle
                            : deliveryDisabled
                              ? disabledStyle
                              : inactiveStyle
                    }`}
                >
                    Delivery
                </button>
            </div>
            {deliveryDisabled && (
                <div className="absolute -top-2 right-4 rounded-full bg-text px-2 py-0.5 text-[9px] font-bold text-white">
                    Tidak Tersedia
                </div>
            )}
        </div>
    );
}
