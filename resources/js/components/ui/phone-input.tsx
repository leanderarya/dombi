import type { InputHTMLAttributes } from 'react';

interface PhoneInputProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    error?: string;
    hint?: string;
    required?: boolean;
    disabled?: boolean;
    inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'];
}

/**
 * Indonesian phone input with fixed +62 prefix.
 * User types digits only (without leading 0).
 * Backend prepends 62 to form the full number.
 */
export default function PhoneInput({
    label,
    value,
    onChange,
    placeholder = '81234567890',
    error,
    hint,
    required,
    disabled,
}: PhoneInputProps) {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Strip non-digits
        const digits = e.target.value.replace(/\D/g, '');
        onChange(digits);
    };

    return (
        <label className="block">
            {label && (
                <span className="text-[13px] text-text-subtle">
                    {label}
                    {required && <span className="ml-0.5 text-red-500">*</span>}
                </span>
            )}
            <div
                className={`mt-1 flex min-h-11 items-center overflow-hidden rounded-lg border ${
                    error ? 'border-red-400' : 'border-border'
                } bg-white focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 ${
                    disabled ? 'bg-surface text-text-muted' : ''
                }`}
            >
                <span className="flex self-stretch select-none items-center border-r border-border bg-surface-muted px-3 text-sm font-medium text-text-muted">
                    +62
                </span>
                <input
                    type="tel"
                    inputMode="numeric"
                    value={value}
                    onChange={handleChange}
                    placeholder={placeholder}
                    disabled={disabled}
                    maxLength={13}
                    className="flex-1 bg-transparent px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-subtle"
                />
            </div>
            {hint && !error && (
                <p className="mt-1 text-[11px] text-text-subtle">{hint}</p>
            )}
            {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        </label>
    );
}
