import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';

interface Props {
    title: string;
    backHref?: string;
    children?: ReactNode;
}

export default function ForeGreenHeader({ title, backHref, children }: Props) {
    return (
        <div>
            <div className="flex items-center gap-3 pb-2">
                {backHref ? (
                    <Link
                        href={backHref}
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-white active:bg-white/10"
                    >
                        <svg
                            width="20"
                            height="20"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2.5"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15 19l-7-7 7-7"
                            />
                        </svg>
                    </Link>
                ) : (
                    <div className="h-10 w-10" />
                )}
                <h1 className="flex-1 text-center text-base font-bold text-white">
                    {title}
                </h1>
                <div className="h-10 w-10" />
            </div>
            {children}
        </div>
    );
}
