export function normalizePhone(phone: string): string {
    return '62' + String(phone).replace(/\D/g, '').replace(/^(?:0|62)/, '');
}

export function waLink(phone: string): string {
    return `https://wa.me/${normalizePhone(phone)}`;
}

export function waMessage(order: {
    order_code: string;
    customer_name?: string;
    outlet_name?: string;
    total?: number;
}): string {
    let msg = `Hai Admin Outlet`;
    if (order.outlet_name) msg += ` ${order.outlet_name}`;
    msg += `, Saya ${order.customer_name ?? 'pelanggan'} order dengan nomor ${order.order_code}`;
    if (typeof order.total === 'number') {
        msg += ` - Total Rp${order.total.toLocaleString('id-ID')}`;
    }
    return encodeURIComponent(msg);
}

export function waLinkWithMessage(phone: string, order: Parameters<typeof waMessage>[0]): string {
    return `${waLink(phone)}?text=${waMessage(order)}`;
}
