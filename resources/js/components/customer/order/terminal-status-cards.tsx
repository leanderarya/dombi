import { Link } from '@inertiajs/react';
import { AlertTriangle, Clock, Phone, RotateCcw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Notice from '@/components/ui/notice';
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
        <Button asChild variant="primary" size="lg" className="w-full">
            <Link href={reorderHref}>
                <RotateCcw />
                Pesan Lagi
            </Link>
        </Button>
    );

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
            <Notice
                variant="block"
                tone="danger"
                icon={XCircle}
                title={title}
                action={reorderLink}
            >
                {reason && (
                    <div className="text-sm font-semibold">{reason}</div>
                )}
                {note && <div className="mt-1 text-xs">{note}</div>}
            </Notice>
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
            <Notice
                variant="block"
                tone="warning"
                icon={AlertTriangle}
                title="Pengiriman Gagal"
                action={
                    <>
                        {href && (
                            <Button
                                asChild
                                variant="primary"
                                size="lg"
                                className="w-full"
                            >
                                <a
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <Phone />
                                    Hubungi Outlet
                                </a>
                            </Button>
                        )}
                        {reorderLink}
                    </>
                }
            >
                {order.delivery?.failed_reason && (
                    <div className="text-sm font-medium">
                        {order.delivery.failed_reason}
                    </div>
                )}
                <div className="mt-1 text-sm">
                    Silakan hubungi outlet untuk bantuan.
                </div>
            </Notice>
        );
    }

    if (order.status === 'expired') {
        return (
            <Notice
                variant="block"
                tone="neutral"
                icon={Clock}
                title="Pesanan Kadaluarsa"
                action={reorderLink}
            >
                <div className="text-sm">
                    Pesanan tidak diselesaikan dalam batas waktu.
                </div>
            </Notice>
        );
    }

    return null;
}
