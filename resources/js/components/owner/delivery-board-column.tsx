import DeliveryCard from './delivery-card';

interface Props {
    title: string;
    count: number;
    items: any[];
    color: string;
    emptyMessage?: string;
    onAssignCourier?: (orderId: number) => void;
    onResolve?: (deliveryId: number) => void;
}

const colorMap: Record<string, { bg: string; dot: string; text: string }> = {
    slate: { bg: 'bg-slate-100', dot: 'bg-slate-400', text: 'text-slate-700' },
    blue: { bg: 'bg-blue-100', dot: 'bg-blue-500', text: 'text-blue-700' },
    purple: {
        bg: 'bg-purple-100',
        dot: 'bg-purple-500',
        text: 'text-purple-700',
    },
    amber: { bg: 'bg-amber-100', dot: 'bg-amber-500', text: 'text-amber-700' },
    green: {
        bg: 'bg-emerald-100',
        dot: 'bg-emerald-500',
        text: 'text-emerald-700',
    },
};

export default function DeliveryBoardColumn({
    title,
    count,
    items,
    color,
    emptyMessage,
    onAssignCourier,
    onResolve,
}: Props) {
    const colors = colorMap[color] ?? colorMap.slate;

    return (
        <div className="flex flex-col">
            {/* Column Header */}
            <div className="sticky top-0 z-10 flex items-center gap-2 px-1 pb-2">
                <span
                    className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold ${colors.bg} ${colors.text}`}
                >
                    {count}
                </span>
                <h3 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                    {title}
                </h3>
            </div>

            {/* Cards */}
            <div className="space-y-2">
                {items.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                        {emptyMessage ?? 'Tidak ada data'}
                    </div>
                ) : (
                    items.map((item) => (
                        <DeliveryCard
                            key={`${item.type}-${item.id}`}
                            item={item}
                            onAssignCourier={onAssignCourier}
                            onResolve={onResolve}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
