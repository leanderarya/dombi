import { router } from '@inertiajs/react';
import { useCallback, useState } from 'react';
import { getCsrfToken } from '@/lib/csrf';

export function useOrderPay(orderId: number) {
    const [loading, setLoading] = useState(false);

    const pay = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/customer/orders/${orderId}/pay`, {
                method: 'POST',
                headers: { 'X-CSRF-TOKEN': getCsrfToken(), 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'same-origin',
            });
            if (res.redirected) { window.location.replace(res.url); return; }
            if (!res.ok) { const d = await res.json().catch(() => null); alert(d?.message ?? 'Gagal membuat pembayaran.'); }
        } catch { alert('Terjadi kesalahan. Coba lagi.'); }
        finally { setLoading(false); }
    }, [orderId]);

    return { pay, loading };
}

export function useOrderCancel(orderId: number, isConfirmation: boolean, recoveryToken: string | null, isPickup: boolean) {
    const [error, setError] = useState<string | null>(null);

    const cancel = useCallback(async (reason: string, note: string, last4Hp: string) => {
        setError(null);
        if (isConfirmation && recoveryToken) {
            try {
                const res = await fetch(`/track/${recoveryToken}/cancel`, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': getCsrfToken() },
                    body: JSON.stringify({ reason, note: note || null, ...(isPickup && { last4_hp: last4Hp }) }),
                });
                const data = await res.json();
                if (data.success) { window.location.reload(); }
                else { setError(data.error || 'Gagal membatalkan pesanan.'); }
            } catch { setError('Gagal membatalkan pesanan. Periksa koneksi Anda.'); }
            return;
        }
        router.post(`/customer/orders/${orderId}/cancel`, { reason, note });
    }, [orderId, isConfirmation, recoveryToken, isPickup]);

    return { cancel, error, setError };
}

export function useOrderReport(orderId: number) {
    const [error, setError] = useState<string | null>(null);

    const report = useCallback(async (type: string, notes: string) => {
        if (!type) return;
        setError(null);
        try {
            const res = await fetch(`/customer/orders/${orderId}/report`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': getCsrfToken() },
                body: JSON.stringify({ type, notes: notes || null }),
            });
            const data = await res.json();
            if (data.success) { router.reload({ only: ['activeReport', 'hasRecentReport', 'canReport'] }); }
            else { setError(data.error || 'Gagal mengirim laporan.'); }
        } catch { setError('Gagal mengirim laporan. Periksa koneksi Anda.'); }
    }, [orderId]);

    return { report, error, setError };
}

export function useShareTracking(trackingUrl: string | null) {
    return useCallback(() => {
        if (!trackingUrl) return;
        const text = `Lacak pesanan Dombi saya:\n${trackingUrl}`;
        if (navigator.share) { navigator.share({ text }).catch(() => {}); }
        else { window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank'); }
    }, [trackingUrl]);
}
