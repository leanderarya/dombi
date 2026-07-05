interface Props {
    value: 'pickup' | 'delivery';
    onChange: (value: 'pickup' | 'delivery') => void;
    deliveryDisabled?: boolean;
}

export default function FulfillmentToggle({ value, onChange, deliveryDisabled }: Props) {
    return (
        <div className="relative mx-4 flex justify-center">
            <div className="flex rounded-full bg-white/20 p-1">
                <button
                    type="button"
                    onClick={() => onChange('pickup')}
                    className={`relative rounded-full px-5 py-1.5 text-xs font-semibold transition-all ${
                        value === 'pickup'
                            ? 'bg-white text-primary shadow-sm'
                            : 'text-white/70'
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
                            ? 'bg-white text-primary shadow-sm'
                            : deliveryDisabled
                                ? 'text-white/40'
                                : 'text-white/70'
                    }`}
                >
                    Delivery
                </button>
            </div>
            {/* "Tidak Tersedia" badge above Delivery */}
            {deliveryDisabled && (
                <div className="absolute -top-2 right-4 rounded-full bg-text px-2 py-0.5 text-[9px] font-bold text-white">
                    Tidak Tersedia
                </div>
            )}
        </div>
    );
}
