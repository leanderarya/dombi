import { Head, Link } from '@inertiajs/react';
import CourierLayout from '../../layouts/courier-layout';

export default function CourierDashboard({ stats }: any) {
    return (
        <CourierLayout>
            <Head title="Courier Dashboard" />
            <h1 className="text-2xl font-semibold">Courier Dashboard</h1>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {[
                    ['Waiting pickup', stats.waitingPickup],
                    ['Picked up', stats.pickedUp],
                    ['Delivering', stats.delivering],
                    ['Completed today', stats.completedToday],
                    ['Failed today', stats.failedToday],
                ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border bg-white p-4">
                        <div className="text-sm text-zinc-500">{label}</div>
                        <div className="mt-2 text-3xl font-semibold">{value}</div>
                    </div>
                ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/courier/deliveries?status=waiting_pickup" className="rounded-md bg-emerald-700 px-4 py-2 text-white">Waiting pickup</Link>
                <Link href="/courier/deliveries?status=delivering" className="rounded-md border px-4 py-2">Delivering</Link>
            </div>
        </CourierLayout>
    );
}
