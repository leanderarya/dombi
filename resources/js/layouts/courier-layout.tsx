import { router } from '@inertiajs/react';
import type { PropsWithChildren } from 'react';

export default function CourierLayout({ children }: PropsWithChildren) {
    return <main className="min-h-screen bg-zinc-50 p-6"><button onClick={() => router.post('/logout')} className="mb-6 text-sm">Logout</button>{children}</main>;
}
