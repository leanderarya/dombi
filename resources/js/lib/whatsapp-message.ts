import { waLinkWithText as waLinkWithTextImpl } from '@/lib/wa';

type OrderContext = {
    order_code?: string;
    status?: string;
    fulfillment_type?: string;
    customer_name?: string;
    outlet_name?: string;
    total?: number;
};

export function whatsAppDefaultMessage(order: OrderContext): string {
    const code = order.order_code ?? '';
    const name = order.customer_name ?? 'pelanggan';
    const outlet = order.outlet_name ?? 'Outlet';
    const status = order.status ?? '';
    const fulfillment = order.fulfillment_type ?? 'delivery';
    const totalText =
        typeof order.total === 'number'
            ? ` - Total Rp${order.total.toLocaleString('id-ID')}`
            : '';

    let body = `Hai Admin ${outlet}, Saya ${name}. `;

    const opening = statusOpening(status, fulfillment);

    body += `${opening} ${code}${totalText}`;

    return body;
}

function statusOpening(status: string, fulfillment: string): string {
    if (status === 'pending_confirmation') {
        return 'Mohon konfirmasi pesanan';
    }

    if (['confirmed', 'preparing'].includes(status)) {
        return fulfillment === 'pickup'
            ? 'Kapan pesanan bisa saya ambil? Kode'
            : 'Kapan pesanan akan dikirim? Kode';
    }

    if (status === 'ready_for_pickup') {
        return fulfillment === 'pickup'
            ? 'Apakah pesanan sudah bisa saya ambil? Kode'
            : 'Kapan kurir akan mengambil pesanan? Kode';
    }

    if (['picked_up', 'delivering'].includes(status)) {
        return 'Mohon informasi posisi pengiriman pesanan';
    }

    if (['completed', 'failed_delivery'].includes(status)) {
        return 'Saya memiliki keluhan terkait pesanan';
    }

    return 'Saya ingin menanyakan pesanan';
}

export function waLinkWithText(phone: string, text: string): string {
    return waLinkWithTextImpl(phone, text);
}

export function whatsAppLink(phone: string, order: OrderContext): string {
    return waLinkWithText(phone, whatsAppDefaultMessage(order));
}
