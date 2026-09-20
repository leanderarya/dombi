import { Bike, MapPin, Truck, Users } from 'lucide-react';

interface CourierStats {
    total: number;
    online: number;
    active_location: number;
}

interface Props {
    stats: CourierStats;
    todayDeliveries: number;
}

export default function CourierStats({ stats, todayDeliveries }: Props) {
    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
                icon={Users}
                label="Total Kurir"
                value={stats.total}
                color="text-info-text"
                bgColor="bg-info-bg"
            />
            <StatCard
                icon={Truck}
                label="Online"
                value={stats.online}
                color="text-success-text"
                bgColor="bg-success-bg"
            />
            <StatCard
                icon={MapPin}
                label="Lokasi Aktif"
                value={stats.active_location}
                color="text-status-transit"
                bgColor="bg-status-transit-bg"
            />
            <StatCard
                icon={Bike}
                label="Pengiriman Hari Ini"
                value={todayDeliveries}
                color="text-warning-text"
                bgColor="bg-warning-bg"
            />
        </div>
    );
}

function StatCard({
    icon: Icon,
    label,
    value,
    color,
    bgColor,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: number;
    color: string;
    bgColor: string;
}) {
    return (
        <div className="rounded-xl bg-surface p-4 shadow-card">
            <div className="flex items-center gap-2">
                <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${bgColor}`}
                >
                    <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <div>
                    <div className="text-xs font-medium text-text-muted">
                        {label}
                    </div>
                    <div className="text-xl font-bold text-text tabular-nums">
                        {value}
                    </div>
                </div>
            </div>
        </div>
    );
}
