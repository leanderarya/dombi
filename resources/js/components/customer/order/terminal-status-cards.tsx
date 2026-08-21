import { Link } from '@inertiajs/react';
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    Phone,
    RotateCcw,
    XCircle,
} from 'lucide-react';
import type { NormalizedOrder } from '@/lib/order-status';
import { isTerminal } from '@/lib/order-status';
import { whatsAppDefaultMessage, waLinkWithText } from '@/lib/whatsapp-message';

interface Props {
    order: NormalizedOrder;
    reorderHref: string;
}

export default function TerminalStatusCards({ order, reorderHref }: Props) {
    if (!isTerminal(order.status) || order.status === 'completed') {
        return null;
    }

    const reorderLink = (
        <Link
            href={reorderHref}
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-bold text-white active:opacity-80"
        >
            <RotateCcw className="h-4 w-4" />
            Pesan Lagi
        </Link>
    );

    if (order.status === 'completed') {
        return (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-6 text-center">
                <div className="flex justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                    </div>
                </div>
                <h2 className="mt-4 text-lg font-bold text-text">
                    Pesanan Selesai!
                </h2>
                <p className="mt-1 text-sm text-text-muted">
                    Terima kasih sudah pesan di Dombi 🎉
                </p>
            </div>
        );
    }

    if (
        order.status === 'rejected_by_outlet' ||
        order.status === 'cancelled_by_customer' ||
        order.status === 'cancelled_by_outlet'
    ) {
        const reason = order.rejection_reason ?? order.cancellation_reason;
        const title =
            order.status === 'rejected_by_outlet'
                ? 'Pesanan Ditolak Outlet'
                : order.status === 'cancelled_by_outlet'
                  ? 'Dibatalkan Outlet'
                  : 'Pesanan Dibatalkan';
        const note =
            order.status === 'rejected_by_outlet'
                ? order.rejection_note
                : order.cancellation_note;

        return (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <div className="text-[13px] text-red-600">{title}</div>
                </div>
                {reason && (
                    <div className="mt-2 text-sm font-semibold text-red-800">
                        {reason}
                    </div>
                )}
                {note && (
                    <div className="mt-1 text-xs text-red-700">{note}</div>
                )}
                {reorderLink}
            </div>
        );
    }

    if (order.status === 'failed_delivery') {
        const phone = order.outlet?.phone;
        const href = phone
            ? waLinkWithText(
                  phone,
                  whatsAppDefaultMessage({
                      order_code: order.order_code,
                      status: order.status,
                      fulfillment_type: order.fulfillment_type,
                      customer_name: order.customer_name ?? undefined,
                      outlet_name: order.outlet?.name ?? undefined,
                      total: order.total,
                  }),
              )
            : null;

        return (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <div className="text-[13px] text-amber-700">
                        Pengiriman Gagal
                    </div>
                </div>
                {order.delivery?.failed_reason && (
                    <div className="mt-1.5 text-sm font-medium text-amber-900">
                        {order.delivery.failed_reason}
                    </div>
                )}
                <div className="mt-2 text-sm text-amber-800">
                    Silakan hubungi outlet untuk bantuan.
                </div>
                {href && (
                    <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-bold text-white active:opacity-80"
                    >
                        <Phone className="h-4 w-4" />
                        Hubungi Outlet
                    </a>
                )}
                {reorderLink}
            </div>
        );
    }

    if (order.status === 'expired') {
        return (
            <div className="rounded-xl border border-border bg-surface-muted p-4">
                <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-text-muted" />
                    <div className="text-[13px] text-text">
                        Pesanan Kadaluarsa
                    </div>
                </div>
                <div className="mt-2 text-sm text-text-muted">
                    Outlet tidak memberikan konfirmasi dalam batas waktu.
                </div>
                {reorderLink}
            </div>
        );
    }

    return null;
}
