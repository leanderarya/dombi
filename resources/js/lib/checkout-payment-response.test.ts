import { describe, expect, it } from 'vitest';
import { readCheckoutPaymentResponse } from './checkout-payment-response';

describe('readCheckoutPaymentResponse', () => {
    it('returns the followed redirect instead of parsing its HTML as JSON', async () => {
        const response = new Response('<!doctype html><html></html>', {
            headers: { 'Content-Type': 'text/html' },
        });
        Object.defineProperties(response, {
            redirected: { value: true },
            url: {
                value: 'https://dombi.test/customer/checkout/customer',
            },
        });

        await expect(
            readCheckoutPaymentResponse(response, 'https://dombi.test'),
        ).resolves.toEqual({
            redirectUrl: 'https://dombi.test/customer/checkout/customer',
        });
    });

    it('rejects a followed redirect to another origin', async () => {
        const response = new Response('<!doctype html>', {
            headers: { 'Content-Type': 'text/html' },
        });
        Object.defineProperties(response, {
            redirected: { value: true },
            url: { value: 'https://evil.test/phishing' },
        });

        await expect(
            readCheckoutPaymentResponse(response, 'https://dombi.test'),
        ).rejects.toThrow('Respons pembayaran tidak valid');
    });

    it('reads a successful payment URL from JSON', async () => {
        const response = Response.json({
            payment_url: 'https://pay.doku.test/session',
        });

        await expect(readCheckoutPaymentResponse(response)).resolves.toEqual({
            data: { payment_url: 'https://pay.doku.test/session' },
        });
    });
});
