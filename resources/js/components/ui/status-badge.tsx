type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface VariantProps {
    variant: BadgeVariant;
    children: React.ReactNode;
    size?: 'sm' | 'md';
    status?: never;
}

interface StatusProps {
    status: string;
    size?: 'sm' | 'md';
    variant?: never;
    children?: never;
}

type Props = VariantProps | StatusProps;

const variantStyles: Record<BadgeVariant, string> = {
    success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    warning: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    danger: 'bg-red-50 text-red-700 ring-1 ring-red-200',
    info: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
    neutral: 'bg-surface-muted text-text-muted ring-1 ring-border',
};

const sizeStyles = {
    sm: 'px-2 py-0.5 text-[11px]',
    md: 'px-2.5 py-0.5 text-[11px]',
};

// Unified status → variant + label mapping
const ORDER_STATUSES: Record<string, { variant: BadgeVariant; label: string }> = {
    pending_confirmation: { variant: 'warning', label: 'Menunggu Konfirmasi' },
    confirmed: { variant: 'info', label: 'Diterima' },
    preparing: { variant: 'warning', label: 'Disiapkan' },
    ready_for_pickup: { variant: 'success', label: 'Siap Diambil' },
    picked_up: { variant: 'info', label: 'Sudah Diambil' },
    delivering: { variant: 'info', label: 'Dalam Pengiriman' },
    completed: { variant: 'success', label: 'Selesai' },
    cancelled_by_customer: { variant: 'danger', label: 'Dibatalkan Customer' },
    cancelled_by_outlet: { variant: 'danger', label: 'Dibatalkan Outlet' },
    rejected_by_outlet: { variant: 'danger', label: 'Ditolak Outlet' },
    failed_delivery: { variant: 'danger', label: 'Pengiriman Gagal' },
    expired: { variant: 'neutral', label: 'Kadaluarsa' },
};

const DELIVERY_STATUSES: Record<string, { variant: BadgeVariant; label: string }> = {
    waiting_assignment: { variant: 'neutral', label: 'Menunggu Assignment' },
    waiting_pickup: { variant: 'warning', label: 'Menunggu Pickup' },
    picked_up: { variant: 'info', label: 'Sudah Diambil' },
    delivering: { variant: 'info', label: 'Sedang Diantar' },
    completed: { variant: 'success', label: 'Selesai' },
    failed: { variant: 'danger', label: 'Gagal' },
    retry_delivery: { variant: 'warning', label: 'Pengiriman Ulang' },
    returned_to_outlet: { variant: 'warning', label: 'Dikembalikan' },
    cancelled_and_released: { variant: 'neutral', label: 'Dibatalkan' },
};

const RESTOCK_STATUSES: Record<string, { variant: BadgeVariant; label: string }> = {
    requested: { variant: 'warning', label: 'Diminta' },
    rejected: { variant: 'danger', label: 'Ditolak' },
    preparing: { variant: 'info', label: 'Disiapkan' },
    shipped: { variant: 'info', label: 'Dikirim' },
    completed: { variant: 'success', label: 'Selesai' },
};

const DISTRIBUTION_STATUSES: Record<string, { variant: BadgeVariant; label: string }> = {
    preparing: { variant: 'info', label: 'Disiapkan' },
    shipped: { variant: 'info', label: 'Dikirim' },
    completed: { variant: 'success', label: 'Selesai' },
};

const RETURN_STATUSES: Record<string, { variant: BadgeVariant; label: string }> = {
    submitted: { variant: 'warning', label: 'Diajukan' },
    approved: { variant: 'success', label: 'Disetujui' },
    rejected: { variant: 'danger', label: 'Ditolak' },
    received_at_center: { variant: 'info', label: 'Diterima Pusat' },
    completed: { variant: 'success', label: 'Selesai' },
};

const EXCHANGE_STATUSES: Record<string, { variant: BadgeVariant; label: string }> = {
    submitted: { variant: 'warning', label: 'Diajukan' },
    approved: { variant: 'success', label: 'Disetujui' },
    preparing: { variant: 'info', label: 'Disiapkan' },
    shipped: { variant: 'info', label: 'Dikirim' },
    received: { variant: 'success', label: 'Diterima' },
    completed: { variant: 'success', label: 'Selesai' },
    rejected: { variant: 'danger', label: 'Ditolak' },
};

// Merge all status maps for auto-detection (order takes precedence for shared keys like 'preparing')
const ALL_STATUSES: Record<string, { variant: BadgeVariant; label: string }> = {
    ...EXCHANGE_STATUSES,
    ...RETURN_STATUSES,
    ...DISTRIBUTION_STATUSES,
    ...RESTOCK_STATUSES,
    ...DELIVERY_STATUSES,
    ...ORDER_STATUSES,
};

function resolveStatus(status: string): { variant: BadgeVariant; label: string } {
    return ALL_STATUSES[status] ?? { variant: 'neutral', label: status.replaceAll('_', ' ') };
}

export default function StatusBadge(props: Props) {
    const { size = 'md' } = props;

    let variant: BadgeVariant;
    let label: React.ReactNode;

    if (props.status) {
        const resolved = resolveStatus(props.status);
        variant = resolved.variant;
        label = resolved.label;
    } else {
        variant = props.variant;
        label = props.children;
    }

    return (
        <span className={`inline-flex items-center rounded-full font-bold ${variantStyles[variant]} ${sizeStyles[size]}`}>
            {label}
        </span>
    );
}

export type { BadgeVariant };
