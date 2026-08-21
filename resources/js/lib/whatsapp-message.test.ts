import { describe, expect, it } from 'vitest';
import { whatsAppDefaultMessage } from './whatsapp-message';

describe('whatsappDefaultMessage', () => {
    it('asks pickup confirmation timing for pickup in confirmed/preparing', () => {
        const msg = whatsAppDefaultMessage({
            status: 'confirmed',
            fulfillment_type: 'pickup',
            order_code: 'DOMBI-123',
            customer_name: 'Andi',
            outlet_name: 'Outlet A',
        });

        expect(msg).toContain('Outlet A');
        expect(msg).toContain('Andi');
        expect(msg).toContain('bisa saya ambil');
        expect(msg).toContain('DOMBI-123');
    });

    it('asks delivery timing for delivery in confirmed/preparing', () => {
        const msg = whatsAppDefaultMessage({
            status: 'preparing',
            fulfillment_type: 'delivery_dombi',
            order_code: 'DOMBI-124',
            customer_name: 'Budi',
            outlet_name: 'Outlet B',
        });

        expect(msg).toContain('akan dikirim');
        expect(msg).toContain('DOMBI-124');
    });

    it('complains for completed orders', () => {
        const msg = whatsAppDefaultMessage({
            status: 'completed',
            fulfillment_type: 'delivery_dombi',
            order_code: 'DOMBI-125',
        });

        expect(msg).toContain('keluhan');
        expect(msg).toContain('DOMBI-125');
    });

    it('falls back to generic inquiry when status unknown', () => {
        const msg = whatsAppDefaultMessage({
            status: 'unknown',
            order_code: 'DOMBI-126',
        });

        expect(msg).toContain('menanyakan pesanan');
        expect(msg).toContain('DOMBI-126');
    });

    it('always includes order code when available', () => {
        const msg = whatsAppDefaultMessage({
            status: 'pending_confirmation',
            order_code: 'DOMBI-127',
        });

        expect(msg).toContain('DOMBI-127');
    });
});
