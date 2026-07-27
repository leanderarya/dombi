export interface CourierRequestLifecycle {
    begin: () => number;
    invalidate: () => void;
    isCurrent: (requestId: number) => boolean;
}

export function createCourierRequestLifecycle(): CourierRequestLifecycle {
    let currentRequestId = 0;

    return {
        begin: () => {
            currentRequestId += 1;

            return currentRequestId;
        },
        invalidate: () => {
            currentRequestId += 1;
        },
        isCurrent: (requestId) => requestId === currentRequestId,
    };
}
