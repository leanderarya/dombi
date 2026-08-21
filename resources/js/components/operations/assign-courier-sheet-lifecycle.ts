export interface AssignCourierSheetState {
    selectedCourier: number | null;
}

interface CourierRequest {
    id: number;
    controller: AbortController;
}

export function createInitialAssignCourierSheetState(): AssignCourierSheetState {
    return { selectedCourier: null };
}

export function createAssignCourierSheetLifecycle() {
    let nextRequestId = 0;
    let activeRequest: CourierRequest | null = null;

    return {
        beginRequest() {
            activeRequest?.controller.abort();

            const request = {
                id: ++nextRequestId,
                controller: new AbortController(),
            };
            activeRequest = request;

            return { id: request.id, signal: request.controller.signal };
        },
        canPublish(requestId: number) {
            return (
                activeRequest?.id === requestId &&
                !activeRequest.controller.signal.aborted
            );
        },
        complete(requestId: number) {
            if (activeRequest?.id === requestId) {
                activeRequest = null;
            }
        },
        close() {
            activeRequest?.controller.abort();
            activeRequest = null;
            nextRequestId += 1;
        },
        activeRequestId() {
            return activeRequest?.id ?? null;
        },
    };
}
