import { useRef, useState, type KeyboardEvent, type ClipboardEvent } from 'react';

interface OtpInputProps {
    length?: number;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    disabled?: boolean;
}

/**
 * Multi-digit OTP input with auto-advance, paste support, and backspace navigation.
 */
export default function OtpInput({ length = 6, value, onChange, error, disabled }: OtpInputProps) {
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const [focusedIndex, setFocusedIndex] = useState(0);

    const handleChange = (index: number, digit: string) => {
        if (disabled) return;
        if (!/^\d*$/.test(digit)) return;

        const chars = value.split('');
        chars[index] = digit.slice(-1);
        const result = chars.join('').slice(0, length);
        onChange(result);

        if (digit && index < length - 1) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
        if (disabled) return;
        if (e.key === 'Backspace' && !value[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
        if (disabled) return;
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
        onChange(pasted);
        const nextIndex = Math.min(pasted.length, length - 1);
        inputRefs.current[nextIndex]?.focus();
    };

    return (
        <div className="space-y-2">
            <div className="flex justify-center gap-2">
                {Array.from({ length }).map((_, i) => (
                    <input
                        key={i}
                        ref={(el) => {
                            inputRefs.current[i] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={value[i] || ''}
                        onChange={(e) => handleChange(i, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(i, e)}
                        onPaste={handlePaste}
                        onFocus={() => setFocusedIndex(i)}
                        disabled={disabled}
                        className={`h-12 w-10 rounded-lg border text-center text-lg font-semibold transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                            error ? 'border-danger' : 'border-border'
                        } ${disabled ? 'bg-surface text-text-muted' : ''} ${
                            focusedIndex === i && !disabled ? 'border-primary' : ''
                        }`}
                        aria-label={`Digit ${i + 1}`}
                    />
                ))}
            </div>
            {error && <p className="text-center text-xs text-danger">{error}</p>}
        </div>
    );
}
