import { router } from '@inertiajs/react';

interface Props {
    title: string;
    step: string;
    backHref: string;
}

export default function StepHeader({ title, step, backHref }: Props) {
    return (
        <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur px-4 py-3">
            <div className="mx-auto flex max-w-lg items-center justify-between">
                <button
                    type="button"
                    onClick={() => router.visit(backHref)}
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-text active:opacity-80"
                    aria-label="Kembali"
                >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div className="text-center">
                    <h1 className="text-base font-semibold text-text">{title}</h1>
                    <p className="text-[13px] text-text-subtle">{step}</p>
                </div>
                <div className="h-11 w-11" />
            </div>
        </header>
    );
}
