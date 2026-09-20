interface CourierInfo {
    id: number;
    name: string;
    active_deliveries: number;
}

interface Props {
    couriers: CourierInfo[];
}

export default function CourierAvailabilityCard({ couriers }: Props) {
    const totalActive = couriers.reduce(
        (sum, c) => sum + c.active_deliveries,
        0,
    );

    return (
        <div className="rounded-lg border border-border bg-surface p-3">
            <div className="flex items-center justify-between">
                <div className="text-xs font-bold tracking-wider text-text-muted uppercase">
                    Kurir Aktif
                </div>
                <span className="text-xs font-medium text-text-muted">
                    {totalActive} tugas aktif
                </span>
            </div>
            <div className="mt-2 space-y-1.5">
                {couriers.length === 0 ? (
                    <div className="py-2 text-center text-xs text-text-subtle">
                        Tidak ada kurir aktif
                    </div>
                ) : (
                    couriers.map((courier) => (
                        <div
                            key={courier.id}
                            className="flex items-center justify-between rounded-md px-2 py-1.5"
                        >
                            <div className="flex items-center gap-2">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-text-muted">
                                    {courier.name.charAt(0)}
                                </div>
                                <span className="text-xs font-medium text-text">
                                    {courier.name}
                                </span>
                            </div>
                            <span
                                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                                    courier.active_deliveries === 0
                                        ? 'bg-success-bg text-success-text'
                                        : courier.active_deliveries <= 2
                                          ? 'bg-info-bg text-info-text'
                                          : 'bg-warning-bg text-warning-text'
                                }`}
                            >
                                {courier.active_deliveries} aktif
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
