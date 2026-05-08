const styles: Record<string, string> = {
    preparing: 'bg-purple-100 text-purple-800',
    shipped: 'bg-indigo-100 text-indigo-800',
    received: 'bg-green-100 text-green-800',
    completed: 'bg-green-100 text-green-800',
};

export default function DistributionStatusBadge({ status }: { status: string }) {
    return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${styles[status] ?? styles.preparing}`}>{status}</span>;
}
