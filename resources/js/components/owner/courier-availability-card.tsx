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
        <div className="rounded-lg border border-slate-200 bg-surface p-3">
            <div className="flex items-center justify-between">
                <div className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                    Kurir Aktif
                </div>
                <span className="text-xs font-medium text-slate-500">
                    {totalActive} tugas aktif
                </span>
            </div>
            <div className="mt-2 space-y-1.5">
                {couriers.length === 0 ? (
                    <div className="py-2 text-center text-xs text-slate-400">
                        Tidak ada kurir aktif
                    </div>
                ) : (
                    couriers.map((courier) => (
                        <div
                            key={courier.id}
                            className="flex items-center justify-between rounded-md px-2 py-1.5"
                        >
                            <div className="flex items-center gap-2">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                                    {courier.name.charAt(0)}
                                </div>
                                <span className="text-xs font-medium text-slate-700">
                                    {courier.name}
                                </span>
                            </div>
                            <span
                                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                                    courier.active_deliveries === 0
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : courier.active_deliveries <= 2
                                          ? 'bg-blue-100 text-blue-700'
                                          : 'bg-amber-100 text-amber-700'
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
