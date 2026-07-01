import { router } from '@inertiajs/react';
import { Check, ChevronLeft } from 'lucide-react';

interface StepConfig {
    label: string;
}

interface Props {
    title: string;
    currentStep: number;
    steps: StepConfig[];
    backHref: string;
}

export default function StepHeader({ title, currentStep, steps, backHref }: Props) {
    return (
        <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur pt-[env(safe-area-inset-top)]">
            <div className="mx-auto max-w-lg px-4 py-3">
                {/* Top row: back button + title */}
                <div className="flex items-center justify-between mb-3">
                    <button
                        type="button"
                        onClick={() => router.visit(backHref)}
                        className="flex h-11 w-11 items-center justify-center rounded-lg text-text active:opacity-80"
                        aria-label="Kembali"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <h1 className="text-base font-semibold text-text">{title}</h1>
                    <div className="h-11 w-11" />
                </div>

                {/* Progress indicator */}
                <div className="flex items-center justify-center gap-1">
                    {steps.map((step, index) => {
                        const isCompleted = index < currentStep;
                        const isCurrent = index === currentStep;

                        return (
                            <div key={step.label} className="flex items-center">
                                {/* Step circle */}
                                <div className="flex flex-col items-center">
                                    <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                                        isCompleted
                                            ? 'bg-emerald-600 text-white'
                                            : isCurrent
                                                ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-600'
                                                : 'bg-surface-muted text-text-subtle'
                                    }`}>
                                        {isCompleted ? (
                                            <Check className="h-3.5 w-3.5" />
                                        ) : (
                                            index + 1
                                        )}
                                    </div>
                                    <span className={`mt-1 text-[11px] font-medium ${
                                        isCurrent ? 'text-emerald-700' : isCompleted ? 'text-text' : 'text-text-subtle'
                                    }`}>
                                        {step.label}
                                    </span>
                                </div>

                                {/* Connector line */}
                                {index < steps.length - 1 && (
                                    <div className={`mx-1 h-0.5 w-8 rounded-full mb-4 ${
                                        isCompleted ? 'bg-emerald-600' : 'bg-border'
                                    }`} />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </header>
    );
}
