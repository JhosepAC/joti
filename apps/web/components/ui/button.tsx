import { LoaderCircle } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  isLoading?: boolean;
  /** Accessible/translated loading text. Rendered only when provided. */
  loadingText?: string;
  /** Opt out of the press-scale feedback where the motion would distract. */
  static?: boolean;
}

/** Press feedback: 0.96 over 150ms, excluded while disabled (better-ui). */
const tapScale = "enabled:active:scale-[0.96]";

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      children,
      variant = "primary",
      size = "default",
      isLoading = false,
      loadingText,
      static: isStatic = false,
      disabled,
      ...props
    },
    ref,
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded-full cursor-pointer transition-[background-color,border-color,color,scale] duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none";

    const variantStyles = {
      primary:
        "bg-primary text-white hover:bg-action-hover active:bg-action-active",
      secondary:
        "bg-surface text-text-primary hover:bg-surface-hover active:bg-surface-disabled",
      outline:
        "border border-border bg-background text-text-primary hover:bg-surface hover:border-border-strong",
      ghost: "hover:bg-surface hover:text-text-primary",
    };

    const sizeStyles = {
      default: "h-11 px-6 py-2.5 text-sm",
      sm: "h-9 px-4 text-xs",
      lg: "h-12 px-8 text-base",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          baseStyles,
          !isStatic && tapScale,
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...props}
      >
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <LoaderCircle
              size="16"
              strokeWidth={1.7}
              aria-hidden="true"
              className="animate-spin h-4 w-4 text-current"
            />
            {loadingText && <span>{loadingText}</span>}
          </span>
        ) : (
          children
        )}
      </button>
    );
  },
);

Button.displayName = "Button";
