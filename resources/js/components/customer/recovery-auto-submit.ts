export type AutoRecoveryOrder = {
    order_code: string;
};

export type AutoRecoveryResult = {
    found: boolean;
    requires_verification?: boolean;
    is_different_account?: boolean;
    customer_name?: string;
    active_orders?: AutoRecoveryOrder[];
    recent_orders?: AutoRecoveryOrder[];
};

type AutoRecoveryEvents = {
    onLoadingChange: (loading: boolean) => void;
    onNotFound: () => void;
    onVerificationRequired: (isDifferentAccount: boolean) => void;
    onRecovered: (
        phone: string,
        result: AutoRecoveryResult & {
            active_orders: AutoRecoveryOrder[];
            recent_orders: AutoRecoveryOrder[];
        },
        orderCodes: string[],
    ) => void;
    onError: () => void;
};

type RunAutoRecoveryOptions = {
    phone: string;
    recover: (phone: string) => Promise<AutoRecoveryResult>;
    isCancelled: () => boolean;
    getEvents: () => AutoRecoveryEvents;
};

export async function runAutoRecovery({
    phone,
    recover,
    isCancelled,
    getEvents,
}: RunAutoRecoveryOptions): Promise<void> {
    getEvents().onLoadingChange(true);

    try {
        const result = await recover(phone);

        if (isCancelled()) {
            return;
        }

        if (!result.found) {
            getEvents().onNotFound();

            return;
        }

        if (result.requires_verification) {
            getEvents().onVerificationRequired(
                result.is_different_account ?? false,
            );

            return;
        }

        const activeOrders = result.active_orders ?? [];
        const recentOrders = result.recent_orders ?? [];
        getEvents().onRecovered(
            phone,
            {
                ...result,
                active_orders: activeOrders,
                recent_orders: recentOrders,
            },
            [...activeOrders, ...recentOrders].map((order) => order.order_code),
        );
    } catch {
        if (!isCancelled()) {
            getEvents().onError();
        }
    } finally {
        if (!isCancelled()) {
            getEvents().onLoadingChange(false);
        }
    }
}
