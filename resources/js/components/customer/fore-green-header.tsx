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
                    /*
                     * h-11 w-11, not h-10 w-10: the touch-target contract is
                     * 44px (DESIGN.md:83) and this link measured 40x40 with
                     * touch emulation active. It carried no accessible name
                     * either -- the only child is an SVG, so the accessibility
                     * tree reported `role: link, name: ""`. The spacers on
                     * either side move with it so the title stays centred.
                     */
                    <Link
                        href={backHref}
                        aria-label="Kembali"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white active:bg-white/10"
                    >
                        <svg
                            width="20"
                            height="20"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            aria-hidden="true"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15 19l-7-7 7-7"
                            />
                        </svg>
                    </Link>
                ) : (
                    <div className="h-11 w-11 shrink-0" />
                )}
                <h1 className="flex-1 text-center text-base font-bold text-white">
                    {title}
                </h1>
                <div className="h-11 w-11 shrink-0" />
            </div>
            {children}
        </div>
    );
}
