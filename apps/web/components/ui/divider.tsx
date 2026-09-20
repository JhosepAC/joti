import * as React from "react";
import { cn } from "@/lib/utils";

export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export const Divider = React.forwardRef<HTMLDivElement, DividerProps>(
  ({ className, children, ...props }, ref) => {
    if (!children) {
      return (
        <hr
          ref={ref as React.ForwardedRef<HTMLHRElement>}
          className={cn("w-full border-t border-border-strong/40 my-6", className)}
          {...props}
        />
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center w-full my-6 text-xs text-text-muted select-none",
          className
        )}
        {...props}
      >
        <div className="flex-1 h-px bg-surface-hover" />
        <span className="px-4 text-text-muted font-light">{children}</span>
        <div className="flex-1 h-px bg-surface-hover" />
      </div>
    );
  }
);

Divider.displayName = "Divider";
