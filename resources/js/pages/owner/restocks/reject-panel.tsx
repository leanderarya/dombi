export default function RejectPanel({ restock, form }: any) {
    return (
        <div className="rounded-lg border border-border p-4">
            <div className="mb-3 text-xs font-bold uppercase tracking-wide text-text-subtle">Tolak Permintaan</div>
            <p className="text-xs text-text-muted">Gunakan hanya jika request tidak bisa dipenuhi.</p>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    form.post(`/owner/restocks/${restock.id}/reject`);
                }}
                className="mt-3 space-y-2"
            >
                <textarea
                    value={form.data.rejected_reason}
                    onChange={(event) => form.setData('rejected_reason', event.target.value)}
                    placeholder="Alasan penolakan"
                    className="min-h-16 w-full rounded-lg border border-border px-2 py-1.5 text-xs outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                />
                {form.errors.rejected_reason && <div className="rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700">{form.errors.rejected_reason}</div>}
                <button disabled={form.processing} className="h-9 w-full rounded-lg border border-red-200 px-3 text-xs font-bold text-red-700 transition-all duration-150 active:opacity-80 disabled:opacity-60">
                    Tolak
                </button>
            </form>
        </div>
    );
}
