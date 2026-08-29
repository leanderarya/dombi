export class CheckoutLocationSaver<T> {
    private pending: Promise<void> = Promise.resolve();

    constructor(private readonly save: (data: T) => Promise<void>) {}

    persist(data: T): Promise<void> {
        const next = this.pending.then(() => this.save(data));
        this.pending = next.catch(() => {});

        return next;
    }
}
