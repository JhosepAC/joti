import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, hasError, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "w-full px-5 py-3.5 bg-surface border border-border rounded-2xl text-sm font-light text-text-primary placeholder:text-text-muted placeholder:font-light outline-none shadow-none transition-all duration-200 focus:bg-background focus:border-primary focus:shadow-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          hasError && "border-error focus:border-error",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
