export type CheckoutPaymentData = {
    adjusted?: boolean;
    all_removed?: boolean;
    adjustments?: any[];
    errors?: Record<string, unknown>;
    message?: string;
    payment_url?: string;
    redirect_url?: string;
    warnings?: string[];
};

type CheckoutPaymentResponse =
    | { data: CheckoutPaymentData }
    | { redirectUrl: string };

export async function readCheckoutPaymentResponse(
    response: Response,
    expectedOrigin = globalThis.location?.origin ?? '',
): Promise<CheckoutPaymentResponse> {
    if (response.redirected) {
        if (new URL(response.url).origin !== expectedOrigin) {
            throw new Error(
                'Respons pembayaran tidak valid. Silakan coba lagi.',
            );
        }

        return { redirectUrl: response.url };
    }

    const contentType = response.headers.get('content-type') ?? '';

    if (!contentType.includes('application/json')) {
        throw new Error('Respons pembayaran tidak valid. Silakan coba lagi.');
    }

    return { data: (await response.json()) as CheckoutPaymentData };
}
