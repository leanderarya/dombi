import * as React from "react"
import { Slot, Slottable } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control text-control font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-border bg-surface text-text hover:bg-surface-muted",
        secondary: "bg-surface-muted text-text hover:bg-border",
        ghost: "text-text-muted hover:bg-surface-muted hover:text-text",
        link: "text-primary underline-offset-4 hover:underline",
        primary: "bg-primary text-white hover:bg-primary-hover focus-visible:ring-primary",
        danger: "bg-danger text-white hover:bg-danger/90",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-9 px-3 text-control-sm",
        md: "h-10 px-4",
        lg: "h-11 px-5",
        cta: "h-12 px-6",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  icon?: React.ComponentType<{ className?: string }>
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, icon: Icon, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {/*
          `Slottable` is what lets `asChild` coexist with the optional icon.
          Radix Slot only slottable-izes a *single* child; without this wrapper
          `{Icon && …}` emits a second child (the literal `undefined`), and
          react-slot 1.3.0 throws "Slot failed to slot onto its children"
          instead of silently ignoring it.
        */}
        {!asChild && Icon && <Icon className="size-4" />}
        {asChild ? <Slottable>{children}</Slottable> : children}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
