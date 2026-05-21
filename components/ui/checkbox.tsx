import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        "h-4 w-4 rounded border border-border text-primary focus-visible:ring-2 focus-visible:ring-primary/30 accent-primary",
        className
      )}
      {...props}
    />
  )
);
Checkbox.displayName = "Checkbox";
