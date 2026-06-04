export function formatCurrency(value: number | string) {
    return `Rp ${Number(value).toLocaleString('id-ID')}`;
}

export function formatDistance(km: number | null | undefined): string {
    if (km === null || km === undefined) return '-';
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
    if (minutes === null || minutes === undefined) return '-';
    if (minutes < 1) return 'Baru saja';
    if (minutes < 60) return `${minutes} menit`;
    const hours = Math.floor(minutes / 60);
    const remainMins = minutes % 60;
    if (hours < 24) return remainMins > 0 ? `${hours} jam ${remainMins} menit` : `${hours} jam`;
    const days = Math.floor(hours / 24);
    return `${days} hari`;
}
