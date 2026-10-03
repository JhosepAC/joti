import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "recommended" | "default" | "outline";
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const variantStyles = {
      default: "bg-surface text-text-secondary border border-border",
      recommended:
        "bg-surface-hover text-text-secondary border border-border font-normal tracking-normal",
      outline: "border border-border text-text-secondary",
    };

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center text-[0.7rem] px-2.5 py-0.5 rounded-full select-none",
          variantStyles[variant],
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = "Badge";
