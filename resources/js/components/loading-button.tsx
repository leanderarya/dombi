interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    loading?: boolean;
    children: React.ReactNode;
}

export default function LoadingButton({ loading, children, disabled, className = '', ...props }: Props) {
    return (
        <button
            {...props}
            disabled={disabled || loading}
            className={`relative inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-all active:scale-[0.97] disabled:opacity-60 ${className}`}
        >
            {loading && (
                <span className="absolute inset-0 flex items-center justify-center">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                </span>
            )}
            <span className={loading ? 'invisible' : ''}>{children}</span>
        </button>
    );
}
