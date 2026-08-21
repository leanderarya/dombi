interface AssignCourierLookupLifecycle {
    beginRequest: () => { id: number; signal: AbortSignal };
    canPublish: (requestId: number) => boolean;
    complete: (requestId: number) => void;
}

interface AssignCourierLookupOptions<T> {
    lifecycle: AssignCourierLookupLifecycle;
    request: (signal: AbortSignal) => Promise<T>;
    onData: (data: T) => void;
    onError: () => void;
}

export async function runAssignCourierLookup<T>({
    lifecycle,
    request,
    onData,
    onError,
}: AssignCourierLookupOptions<T>): Promise<void> {
    const activeRequest = lifecycle.beginRequest();

    try {
        const data = await request(activeRequest.signal);

        if (lifecycle.canPublish(activeRequest.id)) {
            onData(data);
        }
    } catch {
        if (
            !activeRequest.signal.aborted &&
            lifecycle.canPublish(activeRequest.id)
        ) {
            onError();
        }
    } finally {
        lifecycle.complete(activeRequest.id);
    }
}
