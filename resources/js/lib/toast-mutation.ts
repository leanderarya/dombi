import { toast } from 'sonner';

interface ToastMessages {
  loading?: string;
  success: string;
  error: string;
}

/**
 * Wrap an async function with toast feedback.
 * Shows loading toast, then success or error on completion.
 *
 * Usage:
 *   await toastMutation(() => fetch('/api/foo', { method: 'POST' }), {
 *     loading: 'Menyimpan...',
 *     success: 'Berhasil disimpan',
 *     error: 'Gagal menyimpan',
 *   });
 */
export async function toastMutation<T>(
  fn: () => Promise<T>,
  messages: ToastMessages,
): Promise<T | null> {
  const toastId = messages.loading ? toast.loading(messages.loading) : undefined;
  try {
    const result = await fn();
    if (toastId) toast.dismiss(toastId);
    toast.success(messages.success);
    return result;
  } catch (e: any) {
    if (toastId) toast.dismiss(toastId);
    const msg = e?.response?.data?.error ?? e?.message ?? messages.error;
    toast.error(msg);
    return null;
  }
}
