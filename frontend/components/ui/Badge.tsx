import { HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "error" | "info" | "secondary";
  size?: "sm" | "md" | "lg";
  dot?: boolean;
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      className,
      variant = "default",
      size = "md",
      dot = false,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center font-medium rounded-full transition-colors";

    const variants = {
      default:
        "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100",
      success:
        "bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-400",
      warning:
        "bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-400",
      error:
        "bg-error-100 text-error-800 dark:bg-error-900/30 dark:text-error-400",
      info: "bg-info-100 text-info-800 dark:bg-info-900/30 dark:text-info-400",
      secondary:
        "bg-secondary-100 text-secondary-800 dark:bg-secondary-900/30 dark:text-secondary-400",
    };

    const sizes = {
      sm: "px-2 py-0.5 text-xs gap-1",
      md: "px-2.5 py-0.5 text-sm gap-1.5",
      lg: "px-3 py-1 text-base gap-2",
    };

    const dotColors = {
      default: "bg-neutral-500",
      success: "bg-success-500",
      warning: "bg-warning-500",
      error: "bg-error-500",
      info: "bg-info-500",
      secondary: "bg-secondary-500",
    };

    return (
      <span
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {dot && (
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              dotColors[variant]
            )}
          />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = "Badge";

export default Badge;
