import { router } from '@inertiajs/react';
import { Check, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StepConfig {
    label: string;
}

interface Props {
    title: string;
    currentStep: number;
    steps: StepConfig[];
    backHref: string;
}

export default function StepHeader({
    title,
    currentStep,
    steps,
    backHref,
}: Props) {
    return (
        <header className="sticky top-0 z-30 bg-surface/95 pt-safe-header backdrop-blur">
            <div className="mx-auto max-w-lg px-4 py-3">
                {/* Top row: back button + title */}
                <div className="mb-3 flex items-center justify-between">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => router.visit(backHref)}
                        className="h-11 w-11 rounded-chip text-text"
                        aria-label="Kembali"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-base font-semibold text-text">
                        {title}
                    </h1>
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
                                    <div
                                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                                            isCompleted
                                                ? 'bg-primary text-white'
                                                : isCurrent
                                                  ? 'bg-primary-light text-primary ring-2 ring-primary'
                                                  : 'bg-surface-muted text-text-subtle'
                                        }`}
                                    >
                                        {isCompleted ? (
                                            <Check className="h-3.5 w-3.5" />
                                        ) : (
                                            index + 1
                                        )}
                                    </div>
                                    <span
                                        className={`mt-1 text-[11px] font-medium ${
                                            isCurrent
                                                ? 'text-primary'
                                                : isCompleted
                                                  ? 'text-text'
                                                  : 'text-text-subtle'
                                        }`}
                                    >
                                        {step.label}
                                    </span>
                                </div>

                                {/* Connector line */}
                                {index < steps.length - 1 && (
                                    <div
                                        className={`mx-1 mb-4 h-0.5 w-8 rounded-full ${
                                            isCompleted
                                                ? 'bg-primary'
                                                : 'bg-border'
                                        }`}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </header>
    );
}
