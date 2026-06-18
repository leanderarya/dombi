export function formatCurrency(value: number | string) {
    return `Rp ${Number(value).toLocaleString('id-ID')}`;
}

export function formatDistance(km: number | null | undefined): string {
    if (km === null || km === undefined) {
return '-';
}

    return `${km.toFixed(1)} km`;
}

export function formatDate(value?: string | null) {
    if (!value) {
        return '-';
    }

    return new Date(value).toLocaleString('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
}

export function formatDeliveryAge(minutes: number | null | undefined): string {
    if (minutes === null || minutes === undefined) {
return '-';
}

    if (minutes < 1) {
return 'Baru saja';
}

    if (minutes < 60) {
return `${minutes} menit`;
}

    const hours = Math.floor(minutes / 60);
    const remainMins = minutes % 60;

    if (hours < 24) {
return remainMins > 0 ? `${hours} jam ${remainMins} menit` : `${hours} jam`;
}

    const days = Math.floor(hours / 24);

    return `${days} hari`;
}

export function formatRelativeDate(value?: string | null): string {
    if (!value) return '-';

    const now = new Date();
    const date = new Date(value);
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 1) return 'Baru saja';
    if (diffMinutes < 60) return `${diffMinutes} menit lalu`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} jam lalu`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} hari lalu`;

    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 5) return `${diffWeeks} minggu lalu`;

    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths} bulan lalu`;

    return `${Math.floor(diffDays / 365)} tahun lalu`;
}

export function formatMarginPercent(margin: number, sellingPrice: number): string {
    if (sellingPrice <= 0) {
return '(0%)';
}

    const pct = (margin / sellingPrice) * 100;

    return `(${pct.toFixed(1)}%)`;
}
