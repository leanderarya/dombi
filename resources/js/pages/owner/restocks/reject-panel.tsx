import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

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
                <Textarea
                    value={form.data.rejected_reason}
                    onChange={(event) => form.setData('rejected_reason', event.target.value)}
                    placeholder="Alasan penolakan"
                    rows={3}
                />
                {form.errors.rejected_reason && <div className="rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700">{form.errors.rejected_reason}</div>}
                <Button type="submit" variant="destructive" className="w-full" disabled={form.processing}>
                    {form.processing ? 'Memproses...' : 'Tolak'}
                </Button>
            </form>
        </div>
    );
}
