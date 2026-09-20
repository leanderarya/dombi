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
    slate: { bg: 'bg-surface-muted', dot: 'bg-text-subtle', text: 'text-text' },
    blue: { bg: 'bg-info-bg', dot: 'bg-info-bg0', text: 'text-info-text' },
    purple: {
        bg: 'bg-status-active-bg',
        dot: 'bg-status-active-bg0',
        text: 'text-status-active',
    },
    amber: {
        bg: 'bg-warning-bg',
        dot: 'bg-warning-bg0',
        text: 'text-warning-text',
    },
    green: {
        bg: 'bg-success-bg',
        dot: 'bg-success',
        text: 'text-success-text',
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
                <h3 className="text-xs font-bold tracking-wider text-text-muted uppercase">
                    {title}
                </h3>
            </div>

            {/* Cards */}
            <div className="space-y-2">
                {items.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-text-subtle">
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
